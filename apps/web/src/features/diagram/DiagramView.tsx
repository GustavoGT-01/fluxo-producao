import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { isIndependent } from '@/domain/graph';
import type { Order, Sector } from '@/domain/types';
import { fetchUsers } from '@/services/api';
import { selectIndependentSectors } from '@/store/selectors';
import { useSessionStore } from '@/store/useSessionStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './diagram.module.css';

const NODE_W = 200;
const NODE_H = 92;

type WireEdge = { from: string; to: string };

function bezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = Math.max(45, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function portOut(pos: { x: number; y: number }) {
  return { x: pos.x + NODE_W, y: pos.y + NODE_H / 2 };
}

function portIn(pos: { x: number; y: number }) {
  return { x: pos.x, y: pos.y + NODE_H / 2 };
}

function sourceHasRun(orders: Order[], sourceId: string): boolean {
  return orders.some((o) => o.progressBySector[sourceId]?.status === 'run');
}

function countByStatus(orders: Order[], sectorId: string) {
  let run = 0;
  let pause = 0;
  let wait = 0;
  for (const o of orders) {
    const s = o.progressBySector[sectorId]?.status;
    if (s === 'run') run += 1;
    else if (s === 'pause') pause += 1;
    else if (s === 'wait') wait += 1;
  }
  return { run, pause, wait, total: run + pause + wait };
}

export function DiagramView() {
  const sectors = useGraphStore((s) => s.sectors);
  const moveSector = useGraphStore((s) => s.moveSector);
  const commitSectorPosition = useGraphStore((s) => s.commitSectorPosition);
  const connect = useGraphStore((s) => s.connect);
  const disconnect = useGraphStore((s) => s.disconnect);
  const updateSector = useGraphStore((s) => s.updateSector);

  const orders = useOrdersStore((s) => s.orders);

  const connectSource = useUiStore((s) => s.connectSource);
  const setConnectSource = useUiStore((s) => s.setConnectSource);
  const pushToast = useUiStore((s) => s.pushToast);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [wirePending, setWirePending] = useState<WireEdge | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [zoom, setZoom] = useState(1);
  const [operatorBySector, setOperatorBySector] = useState<Record<string, string>>({});
  const sessionRole = useSessionStore((s) => s.user?.role);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const panDrag = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (sessionRole !== 'manager') return;
    let cancel = false;
    void fetchUsers()
      .then(({ users }) => {
        if (cancel) return;
        const next: Record<string, string> = {};
        for (const user of users) {
          if (user.role === 'operator' && user.sectorId && user.active) {
            next[user.sectorId] = user.name;
          }
        }
        setOperatorBySector(next);
      })
      .catch(() => {
        if (!cancel) setOperatorBySector({});
      });
    return () => {
      cancel = true;
    };
  }, [sessionRole]);

  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, Sector>();
    for (const s of sectors) map.set(s.id, s);
    return map;
  }, [sectors]);

  const independentCount = selectIndependentSectors(sectors).length;

  const wires = useMemo(() => {
    const list: WireEdge[] = [];
    for (const target of sectors) {
      for (const from of target.deps) {
        if (byId.has(from)) list.push({ from, to: target.id });
      }
    }
    return list;
  }, [sectors, byId]);

  const tryConnect = useCallback(
    (from: string, to: string) => {
      const result = connect(from, to);
      if (!result.ok) {
        pushToast('Ciclo bloqueado');
      }
      setConnectSource(null);
    },
    [connect, pushToast, setConnectSource],
  );

  const onOutPort = useCallback(
    (id: string) => {
      setConnectSource(id);
    },
    [setConnectSource],
  );

  const onInPort = useCallback(
    (targetId: string) => {
      if (!connectSource) return;
      tryConnect(connectSource, targetId);
    },
    [connectSource, tryConnect],
  );

  const onNodeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, id: string) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!connectSource) {
        setConnectSource(id);
        return;
      }
      if (connectSource === id) {
        setConnectSource(null);
        return;
      }
      tryConnect(connectSource, id);
    },
    [connectSource, setConnectSource, tryConnect],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, sector: Sector) => {
      const t = e.target as HTMLElement;
      if (t.closest('.d-port') || t.closest('button')) return;
      e.preventDefault();
      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = {
        id: sector.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: sector.pos.x,
        origY: sector.pos.y,
      };
      setFocusId(sector.id);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const x = Math.max(10, d.origX + (e.clientX - d.startX));
      const y = Math.max(10, d.origY + (e.clientY - d.startY));
      moveSector(d.id, { x, y });
    },
    [moveSector],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
    commitSectorPosition(d.id);
  }, [commitSectorPosition]);

  const openConfig = (sector: Sector) => {
    setConfigId(sector.id);
    setEditName(sector.name);
  };

  const confirmDisconnect = () => {
    if (!wirePending) return;
    disconnect(wirePending.from, wirePending.to);
    pushToast('Fio removido');
    setWirePending(null);
  };

  const saveConfigName = () => {
    if (!configId) return;
    const trimmed = editName.trim();
    if (trimmed) updateSector(configId, { name: trimmed });
  };

  const toggleDep = (fromId: string, checked: boolean) => {
    if (!configId) return;
    if (checked) {
      const result = connect(fromId, configId);
      if (!result.ok) pushToast('Ciclo bloqueado');
    } else {
      disconnect(fromId, configId);
    }
  };

  const configSector = configId ? byId.get(configId) : undefined;
  const fromSector = wirePending ? byId.get(wirePending.from) : undefined;
  const toSector = wirePending ? byId.get(wirePending.to) : undefined;

  const canvasW = Math.max(
    1760,
    ...sectors.map((s) => s.pos.x + NODE_W + 80),
  );
  const canvasH = Math.max(
    560,
    ...sectors.map((s) => s.pos.y + NODE_H + 80),
  );

  return (
    <section className={styles.wrap} aria-label="Diagrama de dependências">
      <p className={styles.srOnly}>
        Teclado: foque um nó e pressione Enter para marcar origem da conexão.
        Foque outro nó e pressione Enter para conectar. Escape no modal fecha.
      </p>

      <div className={styles.bar}>
        <h3 className={styles.barTitle}>
          <span>Diagrama de Dependências da Linha</span>
          <span className={styles.infoTag}>
            {independentCount} setores independentes · Grafo Direcionado
          </span>
        </h3>
        <div>
          {connectSource ? (
            <Button
              variant="ghost"
              onClick={() => setConnectSource(null)}
            >
              Cancelar conexão
            </Button>
          ) : null}
          <Button variant="ghost" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>
            −
          </Button>
          <Button variant="ghost" aria-label="Zoom 100 por cento" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </Button>
          <Button variant="ghost" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}>
            +
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className={styles.canvas}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-node]')) return;
          const scroller = scrollerRef.current;
          if (!scroller) return;
          panDrag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: scroller.scrollLeft,
            top: scroller.scrollTop,
          };
          scroller.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = panDrag.current;
          const scroller = scrollerRef.current;
          if (!drag || drag.id !== event.pointerId || !scroller) return;
          scroller.scrollLeft = drag.left - (event.clientX - drag.x);
          scroller.scrollTop = drag.top - (event.clientY - drag.y);
        }}
        onPointerUp={() => {
          panDrag.current = null;
        }}
        onPointerCancel={() => {
          panDrag.current = null;
        }}
      >
        <div style={{ width: canvasW * zoom, height: canvasH * zoom }}>
        <div
          className={styles.canvasInner}
          style={{
            width: canvasW,
            minHeight: canvasH,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            className={styles.svg}
            width={canvasW}
            height={canvasH}
            aria-hidden={wires.length === 0}
          >
            <defs>
              <marker
                id="dg-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--dg-wire-arrow)" />
              </marker>
              <marker
                id="dg-arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--flow)" />
              </marker>
            </defs>
            {wires.map(({ from, to }) => {
              const src = byId.get(from);
              const tgt = byId.get(to);
              if (!src || !tgt) return null;
              const p1 = portOut(src.pos);
              const p2 = portIn(tgt.pos);
              const active = sourceHasRun(orders, from);
              const pathClass = [
                'd-path',
                styles.path,
                active ? 'flow-active' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <path
                  key={`${from}->${to}`}
                  className={pathClass}
                  d={bezierPath(p1.x, p1.y, p2.x, p2.y)}
                  markerEnd={`url(#${active ? 'dg-arrow-active' : 'dg-arrow'})`}
                  onClick={() => setWirePending({ from, to })}
                />
              );
            })}
          </svg>

          <div className={styles.nodes}>
            {sectors.map((sector) => {
              const indep = isIndependent(sector);
              const counts = countByStatus(orders, sector.id);
              const selected = focusId === sector.id;
              const nodeClass = [
                'd-node',
                styles.node,
                indep ? styles.nodeIndependent : '',
                selected ? styles.nodeSelected : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={sector.id}
                  role="button"
                  data-node=""
                  className={nodeClass}
                  style={{
                    left: sector.pos.x,
                    top: sector.pos.y,
                    ['--nc' as string]: sector.color,
                    width: NODE_W,
                  }}
                  tabIndex={0}
                  aria-label={`Setor ${sector.name}`}
                  aria-pressed={connectSource === sector.id}
                  onFocus={() => setFocusId(sector.id)}
                  onDoubleClick={() => openConfig(sector)}
                  onKeyDown={(e) => onNodeKeyDown(e, sector.id)}
                  onPointerDown={(e) => onPointerDown(e, sector)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  <button
                    type="button"
                    className={`d-port ${styles.port} ${styles.portIn}`}
                    title="Entrada de dependência"
                    aria-label={`Entrada de ${sector.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInPort(sector.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />

                  <div className={styles.nodeHead}>
                    <span className={styles.nodeTitle}>
                      <span aria-hidden="true">{sector.icon}</span>
                      {sector.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        className={`${styles.badge} ${
                          indep ? styles.badgeIndep : styles.badgeDep
                        }`}
                      >
                        {indep ? 'Independente' : `Deps: ${sector.deps.length}`}
                      </span>
                      <button
                        type="button"
                        className={styles.cfg}
                        title="Configurar setor"
                        aria-label={`Configurar ${sector.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfig(sector);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        ⚙️
                      </button>
                    </div>
                  </div>

                  <div className={styles.nodeMeta}>
                    <span>Op.: {operatorBySector[sector.id] ?? '—'}</span>
                    <span>·</span>
                    <span>{counts.total} ordens</span>
                  </div>

                  <div className={styles.nodeStats}>
                    <span>
                      Prod: <b>{counts.run}</b>
                    </span>
                    <span>
                      Pausa: <b>{counts.pause}</b>
                    </span>
                    <span>
                      Fila: <b>{counts.wait}</b>
                    </span>
                  </div>

                  <button
                    type="button"
                    className={[
                      'd-port',
                      styles.port,
                      styles.portOut,
                      connectSource === sector.id ? 'connecting' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title="Conectar ao próximo setor"
                    aria-label={`Saída de ${sector.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOutPort(sector.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.map}
        aria-label="Mover a vista pelo mapa do diagrama"
        onClick={(event) => {
          const scroller = scrollerRef.current;
          if (!scroller) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const rx = (event.clientX - rect.left) / rect.width;
          const ry = (event.clientY - rect.top) / rect.height;
          scroller.scrollLeft = Math.max(0, rx * (scroller.scrollWidth - scroller.clientWidth));
          scroller.scrollTop = Math.max(0, ry * (scroller.scrollHeight - scroller.clientHeight));
        }}
      >
        {sectors.map((sector) => (
          <span
            key={sector.id}
            className={styles.mapDot}
            style={{
              left: `${(sector.pos.x / canvasW) * 100}%`,
              top: `${(sector.pos.y / canvasH) * 100}%`,
            }}
          />
        ))}
      </button>

      <div className={styles.legend}>
        <span>
          <i
            className={styles.dot}
            style={{ background: 'var(--dg-connect)' }}
          />
          <b>{independentCount} setores independentes</b>
        </span>
        <span>
          <i
            className={styles.dot}
            style={{ background: 'var(--brand)' }}
          />
          Dependentes: precisam das etapas anteriores
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--dg-ink)' }}>
          Arraste para mover · Porta direita → porta esquerda para vincular
        </span>
      </div>

      <Modal
        open={!!wirePending}
        title="Remover fio?"
        onClose={() => setWirePending(null)}
      >
        <p className={styles.modalBody}>
          Remover dependência de {fromSector?.name ?? wirePending?.from} →{' '}
          {toSector?.name ?? wirePending?.to}?
        </p>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setWirePending(null)}>
            Desfazer
          </Button>
          <Button variant="danger" onClick={confirmDisconnect}>
            Confirmar
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!configSector}
        title={
          configSector
            ? `Configurar Setor: ${configSector.icon} ${configSector.name}`
            : 'Configurar setor'
        }
        onClose={() => setConfigId(null)}
      >
        {configSector ? (
          <>
            <p className={styles.modalBody}>
              Edite o nome. Dependências só mudam via conectar/desconectar (ciclo
              checado).
            </p>
            <label className={styles.nameField}>
              Nome
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={saveConfigName}
              />
            </label>
            <div className={styles.depList} role="group" aria-label="Dependências">
              {sectors
                .filter((s) => s.id !== configSector.id)
                .map((s) => {
                  const checked = configSector.deps.includes(s.id);
                  return (
                    <label key={s.id} className={styles.depItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleDep(s.id, e.target.checked)}
                      />
                      <span>
                        {s.icon} <b>{s.name}</b>
                      </span>
                    </label>
                  );
                })}
            </div>
            <div className={styles.modalActions}>
              <Button
                variant="brand"
                onClick={() => {
                  saveConfigName();
                  setConfigId(null);
                }}
              >
                Fechar
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </section>
  );
}
