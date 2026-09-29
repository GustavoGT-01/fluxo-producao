import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { fetchUsers, type Account } from '@/services/api';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useUiStore, type UiTheme } from '@/store/useUiStore';
import { Filters } from './Filters';
import { Icon } from './icons';
import styles from './Header.module.css';

const THEME_CYCLE: UiTheme[] = [null, 'light', 'dark'];
const THEME_LABEL: Record<string, string> = {
  null: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
};

export function Header() {
  const role = useUiStore((s) => s.role);
  const theme = useUiStore((s) => s.theme);
  const live = useUiStore((s) => s.live);
  const speed = useUiStore((s) => s.speed);
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const lens = useUiStore((s) => s.operatorLens);
  const setOperatorLens = useUiStore((s) => s.setOperatorLens);
  const setRole = useUiStore((s) => s.setRole);
  const setSector = useUiStore((s) => s.setSector);
  const sectors = useGraphStore((s) => s.sectors);
  const [staff, setStaff] = useState<Account[]>([]);
  const setTheme = useUiStore((s) => s.setTheme);
  const toggleLive = useUiStore((s) => s.toggleLive);
  const setSpeed = useUiStore((s) => s.setSpeed);

  const pauses = useOrdersStore((s) => s.pauses);
  const newCount = pauses.filter((p) => p.state === 'new').length;

  const [ring, setRing] = useState(false);
  const prevCount = useRef(newCount);

  useEffect(() => {
    if (user?.role !== 'manager') return;
    let alive = true;
    const load = () => {
      void fetchUsers()
        .then((data) => {
          if (alive) setStaff(data.users);
        })
        .catch(() => {
          if (alive) setStaff([]);
        });
    };
    load();
    window.addEventListener('fluxo:users-changed', load);
    return () => {
      alive = false;
      window.removeEventListener('fluxo:users-changed', load);
    };
  }, [user?.role]);

  useEffect(() => {
    if (newCount > prevCount.current) {
      setRing(false);
      const id = window.requestAnimationFrame(() => setRing(true));
      const t = window.setTimeout(() => setRing(false), 700);
      prevCount.current = newCount;
      return () => {
        window.cancelAnimationFrame(id);
        window.clearTimeout(t);
      };
    }
    prevCount.current = newCount;
  }, [newCount]);

  const cycleTheme = () => {
    const idx = THEME_CYCLE.findIndex((t) => t === theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  const openStation = (userId: string) => {
    const account = staff.find((item) => item.id === userId);
    if (!account?.sectorId) return;
    const sector = sectors.find((item) => item.id === account.sectorId);
    setOperatorLens({
      userId: account.id,
      name: account.name,
      sectorId: account.sectorId,
      sectorName: sector?.name ?? account.sectorId,
    });
    setSector(account.sectorId);
    setRole('operator');
  };

  const leaveStation = () => {
    setOperatorLens(null);
    setSector(null);
    setRole('manager');
  };

  const operators = staff.filter((item) => item.role === 'operator' && item.active && item.sectorId);
  const managing = user?.role === 'manager' && !lens;
  const themeKey = theme === null ? 'null' : theme;
  const roleLabel = user?.role === 'manager' ? 'Gerência' : 'Operador';
  const sub =
    role === 'manager'
      ? 'Acompanhe cada ordem do CNC até a finalização, em tempo real.'
      : 'Registre início, pausa e finalização das ordens do seu setor.';

  return (
    <>
      <header className={styles.hdr}>
        <div className={styles.row}>
          <div className={styles.brand}>
            <h1>Fluxo de Produção</h1>
            <p>{sub}</p>
          </div>
          <span className={`${styles.ctrl} ${styles.who}`} title={user?.name ?? 'Sessão'}>
            <Icon name="user" />
            <b>{roleLabel}</b>
          </span>
          {managing ? (
            <>
              <button
                type="button"
                className={styles.ctrl}
                title="Usuários"
                onClick={() => window.dispatchEvent(new CustomEvent('fluxo:open-users'))}
              >
                <Icon name="users" />
                <span className={styles.hideS}>Usuários</span>
              </button>
              <button
                type="button"
                className={styles.ctrl}
                title="Cronoanálise"
                onClick={() => window.dispatchEvent(new CustomEvent('fluxo:open-chrono'))}
              >
                <Icon name="timer" />
                <span className={styles.hideS}>Cronoanálise</span>
              </button>
              <label className={`${styles.ctrl} ${styles.field}`}>
                <Icon name="pin" />
                <select
                  aria-label="Abrir posto"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) openStation(event.target.value);
                  }}
                >
                  <option value="">Abrir posto…</option>
                  {operators.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <span className={styles.sep} aria-hidden />
          <button
            type="button"
            className={`${styles.ctrl} ${styles.ic} ${styles.bell} bell${ring ? ' ring' : ''}`}
            title="Paradas"
            aria-label="Paradas"
            onClick={() => window.dispatchEvent(new CustomEvent('fluxo:open-pauses'))}
          >
            <Icon name="bell" />
            {newCount > 0 ? <em>{newCount}</em> : null}
          </button>
          <button
            type="button"
            className={`${styles.ctrl} ${styles.live} live${live ? '' : ' off'}`}
            aria-pressed={live}
            title="Alternar ao vivo"
            onClick={toggleLive}
          >
            <i aria-hidden />
            Ao vivo
          </button>
          <label className={`${styles.ctrl} ${styles.field}`} title="Velocidade da simulação">
            <Icon name="gauge" />
            <select
              aria-label="Velocidade"
              value={String(speed)}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </label>
          <button
            type="button"
            className={`${styles.ctrl} ${styles.ic}`}
            title={`Tema: ${THEME_LABEL[themeKey]}`}
            aria-label="Alternar tema"
            onClick={cycleTheme}
          >
            <Icon name="half" />
          </button>
          <button type="button" className={`${styles.ctrl} ${styles.ic}`} title="Sair" aria-label="Sair" onClick={() => void logout()}>
            <Icon name="out" />
          </button>
        </div>
        {role === 'manager' ? <Filters /> : null}
      </header>
      {user?.role === 'manager' && lens ? (
        <div className={styles.lens}>
          <span>
            Você continua na gerência. Posto aberto: {lens.name} · {lens.sectorName}
          </span>
          <Button variant="brand" onClick={leaveStation}>
            Voltar à gerência
          </Button>
        </div>
      ) : null}
    </>
  );
}
