import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  addFeed,
  DEMO,
  findOperator,
  findUserByEmail,
  findUserById,
  getAccount,
  getOrder,
  insertAccount,
  insertOrder,
  insertPause,
  listAccounts,
  listFeed,
  listOperatorSectors,
  listPauses,
  listSectors,
  emailTaken,
  listTimeSamples,
  ordersFor,
  orderVisibleToOperator,
  otherActiveManagers,
  patchSectorMeta,
  patchSectorPos,
  pausesFor,
  recordImport,
  replaceDeps,
  saveProgress,
  sectorTaken,
  setPauseState,
  trackSectorTime,
  updateAccount,
  type OrderRecord,
  type PauseRecord,
  type ProgressCell,
  type UserRecord,
} from './db';
import { estimateLeadTime, summarizeSamples, type TimeSample } from './chrono';
import { canStart, wouldCreateCycle } from './graph';
import { addClient, eachClient, removeClient } from './hub';
import { parsePlanilha } from './planilha';
import { hashSecret, verifySecret } from './password';
import { readToken, signToken } from './token';

const COOKIE = 'fluxo_session';
const TTL_MS = 12 * 60 * 60 * 1000;
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STALE_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET ?? 'fluxo-dev-secret-trocar-em-producao';
}

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    sectorId: user.sectorId,
  };
}

function actorFrom(request: FastifyRequest): UserRecord | null {
  const raw = request.cookies[COOKIE];
  if (!raw) return null;
  const payload = readToken(raw, secret());
  if (!payload) return null;
  const user = findUserById(payload.sub);
  if (!user || user.role !== payload.role) return null;
  return user;
}

function requireUser(request: FastifyRequest, reply: FastifyReply): UserRecord | null {
  const user = actorFrom(request);
  if (!user) {
    reply.code(401).send({ error: 'Sessão ausente' });
    return null;
  }
  return user;
}

function requireManager(request: FastifyRequest, reply: FastifyReply): UserRecord | null {
  const user = requireUser(request, reply);
  if (!user) return null;
  if (user.role !== 'manager') {
    reply.code(403).send({ error: 'Só a gerência pode fazer isso' });
    return null;
  }
  return user;
}

function publishOrder(order: OrderRecord): void {
  const sectors = listSectors();
  eachClient((client) => {
    if (client.role === 'operator') {
      if (!client.sectorId || !orderVisibleToOperator(order, client.sectorId, sectors)) return;
    }
    client.send('order.updated', order);
  });
}

function publishPause(pause: PauseRecord, order: OrderRecord): void {
  eachClient((client) => {
    if (client.role === 'operator' && client.sectorId !== pause.sectorId) return;
    client.send('order.paused', { pause, order });
  });
}

function publishGraph(): void {
  const sectors = listSectors();
  eachClient((client) => {
    if (client.role !== 'manager') return;
    client.send('graph.updated', sectors);
  });
}

export async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 } });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Dados inválidos' });
    }
    const status =
      typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 500;
    const message = error instanceof Error ? error.message : 'Falha interna';
    if (status && status < 500) {
      return reply.code(status).send({ error: message });
    }
    return reply.code(500).send({ error: 'Falha interna' });
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = z
        .discriminatedUnion('kind', [
          z.object({
            kind: z.literal('manager'),
            email: z.string().email(),
            password: z.string().min(1),
            remember: z.boolean().optional(),
          }),
          z.object({
            kind: z.literal('operator'),
            sectorId: z.string().min(1),
            pin: z.string().regex(/^\d{4}$/),
          }),
        ])
        .safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'Dados de login inválidos' });
      }

      let user: UserRecord | null = null;
      if (body.data.kind === 'manager') {
        const found = findUserByEmail(body.data.email.toLowerCase());
        if (
          !found ||
          found.role !== 'manager' ||
          !found.passwordHash ||
          !verifySecret(body.data.password, found.passwordHash)
        ) {
          return reply.code(401).send({ error: 'E-mail ou senha incorretos' });
        }
        user = found;
      } else {
        const found = findOperator(body.data.sectorId);
        if (
          !found ||
          found.role !== 'operator' ||
          !found.pinHash ||
          !verifySecret(body.data.pin, found.pinHash)
        ) {
          return reply.code(401).send({ error: 'PIN incorreto para este setor' });
        }
        user = found;
      }

      const sessionTtl =
        body.data.kind === 'manager' && body.data.remember ? REMEMBER_TTL_MS : TTL_MS;
      const token = signToken(
        { sub: user.id, role: user.role, sectorId: user.sectorId, name: user.name },
        secret(),
        sessionTtl,
      );

      reply.setCookie(COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: sessionTtl / 1000,
      });
      addFeed(user.id, `${user.name} entrou`);
      return { user: publicUser(user) };
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    const user = actorFrom(request);
    reply.clearCookie(COOKIE, { path: '/' });
    if (user) addFeed(user.id, `${user.name} saiu`);
    return { ok: true };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return { user: publicUser(user) };
  });

  app.get('/api/auth/operator-sectors', async () => ({ sectors: listOperatorSectors() }));

  app.get('/api/bootstrap', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return {
      user: publicUser(user),
      sectors: listSectors(),
      orders: ordersFor(user.role, user.sectorId),
      pauses: pausesFor(user.role, user.sectorId),
      feed: listFeed(),
    };
  });

  app.get('/api/users', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    return { users: listAccounts() };
  });

  app.post('/api/users', async (request, reply) => {
    const actor = requireManager(request, reply);
    if (!actor) return;
    const body = z
      .discriminatedUnion('kind', [
        z.object({
          kind: z.literal('manager'),
          name: z.string().trim().min(1),
          email: z.string().email(),
          password: z.string().min(8),
        }),
        z.object({
          kind: z.literal('operator'),
          name: z.string().trim().min(1),
          sectorId: z.string().min(1),
          pin: z.string().regex(/^\d{4}$/),
        }),
      ])
      .safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Dados do usuário inválidos. Senha com 8 caracteres ou PIN de 4 dígitos.' });
    }
    if (body.data.kind === 'manager') {
      const email = body.data.email.toLowerCase();
      if (emailTaken(email)) {
        return reply.code(409).send({ error: 'E-mail já usado' });
      }
      const id = `user-${randomUUID()}`;
      insertAccount({
        id,
        name: body.data.name,
        role: 'manager',
        email,
        sectorId: null,
        passwordHash: hashSecret(body.data.password),
        pinHash: null,
      });
      addFeed(actor.id, `Conta de gerência criada: ${body.data.name}`);
      return reply.code(201).send({ user: getAccount(id) });
    }
    const operator = body.data;
    const sector = listSectors().find((item) => item.id === operator.sectorId);
    if (!sector) return reply.code(404).send({ error: 'Setor não encontrado' });
    if (sectorTaken(operator.sectorId)) {
      return reply.code(409).send({ error: 'Esse setor já tem um operador ativo' });
    }
    const id = `user-${randomUUID()}`;
    insertAccount({
      id,
      name: operator.name,
      role: 'operator',
      email: null,
      sectorId: operator.sectorId,
      passwordHash: null,
      pinHash: hashSecret(operator.pin),
    });
    addFeed(actor.id, `Operador criado: ${operator.name} · ${sector.name}`);
    return reply.code(201).send({ user: getAccount(id) });
  });

  app.patch('/api/users/:id', async (request, reply) => {
    const actor = requireManager(request, reply);
    if (!actor) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        name: z.string().trim().min(1).optional(),
        email: z.string().email().optional(),
        password: z.string().min(8).optional(),
        pin: z.string().regex(/^\d{4}$/).optional(),
        sectorId: z.string().min(1).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Dados do usuário inválidos' });
    }
    const current = getAccount(params.id);
    if (!current) return reply.code(404).send({ error: 'Usuário não encontrado' });
    if (body.data.active === false && params.id === actor.id) {
      return reply.code(409).send({ error: 'Você não pode desativar a própria conta' });
    }
    if (body.data.active === false && current.role === 'manager' && otherActiveManagers(params.id) === 0) {
      return reply.code(409).send({ error: 'Precisa restar ao menos uma gerência ativa' });
    }
    if (current.role === 'manager' && body.data.email) {
      const email = body.data.email.toLowerCase();
      if (emailTaken(email, current.id)) {
        return reply.code(409).send({ error: 'E-mail já usado' });
      }
    }
    if (current.role === 'operator' && body.data.sectorId) {
      const sector = listSectors().find((item) => item.id === body.data.sectorId);
      if (!sector) return reply.code(404).send({ error: 'Setor não encontrado' });
      if (sectorTaken(body.data.sectorId, current.id)) {
        return reply.code(409).send({ error: 'Esse setor já tem um operador ativo' });
      }
    }
    const nextActive = body.data.active === undefined ? current.active : body.data.active;
    updateAccount(params.id, {
      name: body.data.name,
      email: current.role === 'manager' && body.data.email ? body.data.email.toLowerCase() : undefined,
      sectorId: current.role === 'operator' ? body.data.sectorId : undefined,
      passwordHash: current.role === 'manager' && body.data.password ? hashSecret(body.data.password) : undefined,
      pinHash: current.role === 'operator' && body.data.pin ? hashSecret(body.data.pin) : undefined,
      active: nextActive,
    });
    addFeed(actor.id, `Conta atualizada: ${body.data.name ?? current.name}`);
    return { user: getAccount(params.id) };
  });

  app.get('/api/events', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const id = addClient({ role: user.role, sectorId: user.sectorId, send });
    send('ready', { ok: true });
    request.raw.on('close', () => removeClient(id));
  });

  app.patch('/api/sectors/:id', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        pos: z.object({ x: z.number(), y: z.number() }).optional(),
        name: z.string().min(1).optional(),
        icon: z.string().min(1).optional(),
        color: z.string().min(1).optional(),
      })
      .parse(request.body);
    const sectors = listSectors();
    if (!sectors.some((s) => s.id === params.id)) {
      return reply.code(404).send({ error: 'Setor não encontrado' });
    }
    if (body.pos) patchSectorPos(params.id, body.pos);
    if (body.name || body.icon || body.color) patchSectorMeta(params.id, body);
    publishGraph();
    addFeed(user.id, `Setor atualizado: ${params.id}`);
    return { sectors: listSectors() };
  });

  app.put('/api/sectors/:id/dependencies', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ deps: z.array(z.string()) }).parse(request.body);
    const sectors = listSectors();
    const target = sectors.find((s) => s.id === params.id);
    if (!target) return reply.code(404).send({ error: 'Setor não encontrado' });
    if (body.deps.includes(params.id)) {
      return reply.code(409).send({ error: 'Ciclo bloqueado' });
    }
    const known = new Set(sectors.map((s) => s.id));
    if (body.deps.some((dep) => !known.has(dep))) {
      return reply.code(400).send({ error: 'Dependência desconhecida' });
    }
    let draft = sectors.map((s) => (s.id === params.id ? { ...s, deps: [] as string[] } : s));
    for (const dep of body.deps) {
      if (wouldCreateCycle(draft, dep, params.id)) {
        return reply.code(409).send({ error: 'Ciclo bloqueado' });
      }
      draft = draft.map((s) =>
        s.id === params.id ? { ...s, deps: [...s.deps, dep] } : s,
      );
    }
    replaceDeps(params.id, body.deps);
    publishGraph();
    addFeed(user.id, `Dependências de ${target.name} atualizadas`);
    return { sectors: listSectors() };
  });

  const progressBody = z.object({
    sectorId: z.string(),
    status: z.enum(['run', 'wait', 'pause', 'stop', 'done']).optional(),
    progress: z.number().min(0).max(100).optional(),
  });

  app.patch('/api/orders/:id/progress', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = progressBody.parse(request.body);
    if (user.role === 'operator' && user.sectorId !== body.sectorId) {
      return reply.code(403).send({ error: 'Operador só altera o próprio setor' });
    }
    if (body.status === 'stop' && user.role !== 'manager') {
      return reply.code(403).send({ error: 'Só a gerência interrompe uma ordem' });
    }
    const order = getOrder(params.id);
    if (!order) return reply.code(404).send({ error: 'Ordem não encontrada' });
    const sector = listSectors().find((s) => s.id === body.sectorId);
    if (!sector) return reply.code(404).send({ error: 'Setor não encontrado' });
    const prev = order.progressBySector[body.sectorId];
    const nextStatus = body.status ?? prev?.status ?? 'wait';
    const engaged = prev?.status === 'run' || prev?.status === 'pause' || prev?.status === 'stop';
    if (
      !engaged &&
      (nextStatus === 'run' || nextStatus === 'done') &&
      !canStart(order.progressBySector, sector.deps)
    ) {
      return reply.code(409).send({ error: 'Pré-requisitos do setor ainda não concluídos' });
    }
    const cell: ProgressCell = {
      sectorId: body.sectorId,
      status: nextStatus,
      progress: body.progress ?? (nextStatus === 'done' ? 100 : prev?.progress ?? 0),
      startedAt: prev?.startedAt ?? (nextStatus === 'run' ? new Date().toISOString() : undefined),
      finishedAt: nextStatus === 'done' ? new Date().toISOString() : prev?.finishedAt,
    };
    saveProgress(params.id, cell);
    const saved = getOrder(params.id);
    if (!saved) return reply.code(500).send({ error: 'Falha ao gravar' });
    trackSectorTime(saved, body.sectorId, prev?.status, nextStatus);
    addFeed(user.id, `${params.id} · ${sector.name} · ${cell.status}`);
    publishOrder(saved);
    return { order: saved };
  });

  app.post('/api/orders/:id/pause', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        sectorId: z.string(),
    reason: z.string().min(1),
    note: z.string().optional(),
    status: z.enum(['pause', 'stop']).optional(),
      })
      .parse(request.body);
    if (user.role === 'operator' && user.sectorId !== body.sectorId) {
      return reply.code(403).send({ error: 'Operador só pausa o próprio setor' });
    }
    if (body.status === 'stop' && user.role !== 'manager') {
      return reply.code(403).send({ error: 'Só a gerência interrompe uma ordem' });
    }
    const order = getOrder(params.id);
    if (!order) return reply.code(404).send({ error: 'Ordem não encontrada' });
    const prev = order.progressBySector[body.sectorId];
    const nextStatus = body.status ?? 'pause';
    const cell: ProgressCell = {
      sectorId: body.sectorId,
      status: nextStatus,
      progress: prev?.progress ?? 0,
      startedAt: prev?.startedAt,
    };
    saveProgress(params.id, cell);
    const pause: PauseRecord = {
      id: `P${randomUUID().slice(0, 8)}`,
      orderId: params.id,
      sectorId: body.sectorId,
      reason: body.reason,
      note: body.note,
      by: `${user.name} · ${listSectors().find((s) => s.id === body.sectorId)?.name ?? body.sectorId}`,
      at: new Date().toISOString(),
      state: 'new',
    };
    insertPause(pause);
    const saved = getOrder(params.id);
    if (!saved) return reply.code(500).send({ error: 'Falha ao gravar' });
    trackSectorTime(saved, body.sectorId, prev?.status, nextStatus);
    addFeed(user.id, `Pausa: ${params.id} · ${body.reason}`);
    publishPause(pause, saved);
    publishOrder(saved);
    return { pause, order: saved };
  });

  app.patch('/api/pauses/:id', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ state: z.enum(['new', 'seen', 'handled']) }).parse(request.body);
    const current = listPauses().find((pause) => pause.id === params.id);
    if (!current) return reply.code(404).send({ error: 'Parada não encontrada' });
    setPauseState(params.id, body.state);
    const pause = { ...current, state: body.state };
    const order = getOrder(pause.orderId);
    if (order) publishPause(pause, order);
    return { pause };
  });

  app.get('/api/metrics', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const sectors = listSectors();
    const orders = ordersFor('manager', null);
    const counts = new Map(sectors.map((s) => [s.id, 0]));
    for (const order of orders) {
      for (const cell of Object.values(order.progressBySector)) {
        if (cell.status === 'done') continue;
        if (!counts.has(cell.sectorId)) continue;
        counts.set(cell.sectorId, (counts.get(cell.sectorId) ?? 0) + 1);
      }
    }
    let bottleneck: { sectorId: string; name: string; count: number } | null = null;
    for (const sector of sectors) {
      const count = counts.get(sector.id) ?? 0;
      if (count === 0) continue;
      if (!bottleneck || count > bottleneck.count || (count === bottleneck.count && sector.id < bottleneck.sectorId)) {
        bottleneck = { sectorId: sector.id, name: sector.name, count };
      }
    }
    const now = Date.now();
    const stalePauses = listPauses().filter((pause) => {
      if (pause.state === 'handled') return false;
      const at = Date.parse(pause.at);
      return Number.isFinite(at) && now - at >= STALE_MS;
    });
    return { bottleneck, stalePauses };
  });

  app.get('/api/chrono/samples', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const query = z
      .object({
        product: z.string().optional(),
        sectorId: z.string().optional(),
      })
      .parse(request.query);
    const samples = listTimeSamples({
      product: query.product,
      sectorId: query.sectorId,
    });
    return { samples };
  });

  app.get('/api/chrono/summary', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const rows = listTimeSamples();
    const samples: TimeSample[] = rows.map((row) => ({
      product: row.product,
      productKey: row.productKey,
      sectorId: row.sectorId,
      quantity: row.quantity,
      activeMs: row.activeMs,
      pauseMs: row.pauseMs,
      wallMs: row.wallMs,
    }));
    return { summary: summarizeSamples(samples) };
  });

  app.post('/api/chrono/estimate', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const body = z
      .object({
        product: z.string().min(1),
        quantity: z.number().int().positive(),
      })
      .parse(request.body);
    const rows = listTimeSamples({ product: body.product });
    const samples: TimeSample[] = rows.map((row) => ({
      product: row.product,
      productKey: row.productKey,
      sectorId: row.sectorId,
      quantity: row.quantity,
      activeMs: row.activeMs,
      pauseMs: row.pauseMs,
      wallMs: row.wallMs,
    }));
    const estimate = estimateLeadTime({
      product: body.product,
      quantity: body.quantity,
      samples,
      sectors: listSectors(),
    });
    return estimate;
  });

  app.post('/api/batches/import', async (request, reply) => {
    const user = requireManager(request, reply);
    if (!user) return;
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'Arquivo ausente' });
    const name = file.filename || 'planilha.csv';
    const ext = path.extname(name).toLowerCase();
    if (!['.csv', '.txt', '.xlsx'].includes(ext)) {
      return reply.code(400).send({ error: 'Envie .csv ou .xlsx' });
    }
    const buffer = await file.toBuffer();
    const parsed = parsePlanilha(buffer, name);
    const confirm = z.object({ confirm: z.string().optional() }).parse(request.query).confirm === '1';
    if (!confirm || parsed.errors.length > 0) {
      return {
        filename: name,
        orders: parsed.orders.map((order) => ({
          id: order.id,
          product: order.product,
          quantity: order.quantity,
          batch: order.batch,
          dueDate: order.dueDate,
          urgent: order.urgent,
        })),
        errors: parsed.errors,
        committed: false,
      };
    }
    for (const order of parsed.orders) insertOrder(order, user.id);
    recordImport(randomUUID(), name, parsed.orders.length, user.id);
    for (const order of parsed.orders) {
      const saved = getOrder(order.id);
      if (saved) publishOrder(saved);
    }
    return { filename: name, count: parsed.orders.length, errors: [], committed: true };
  });

  return app;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API em http://127.0.0.1:${port}`);
  console.log(`Gerência: ${DEMO.managerEmail} / ${DEMO.managerPassword}`);
}

export { DEMO };
