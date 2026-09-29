import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { fetchUsers, type Account } from '@/services/api';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useUiStore, type UiTheme } from '@/store/useUiStore';
import { Filters } from './Filters';
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
    let live = true;
    const load = () => {
      void fetchUsers()
        .then((data) => {
          if (live) setStaff(data.users);
        })
        .catch(() => {
          if (live) setStaff([]);
        });
    };
    load();
    window.addEventListener('fluxo:users-changed', load);
    return () => {
      live = false;
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
  const sub =
    role === 'manager'
      ? 'Acompanhe cada ordem do CNC até a finalização, em tempo real.'
      : 'Registre início, pausa e finalização das ordens do seu setor.';

  return (
    <>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Fluxo de Produção</h1>
          <p className={styles.sub}>{sub}</p>
        </div>
        <div className={styles.acts}>
          <span className={styles.who}>
            {user?.name ?? 'Sessão'}
            <small>{user?.role === 'manager' ? 'Gerência' : 'Operador'}</small>
          </span>
          {managing ? (
            <>
              <Button onClick={() => window.dispatchEvent(new CustomEvent('fluxo:open-users'))}>
                Usuários
              </Button>
              <Button onClick={() => window.dispatchEvent(new CustomEvent('fluxo:open-chrono'))}>
                Cronoanálise
              </Button>
              <select
                className={styles.speed}
                aria-label="Abrir posto de operador"
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
            </>
          ) : null}
          <Button variant="ghost" onClick={() => void logout()}>
            Sair
          </Button>
          <Button
            className={`${styles.bell} bell${ring ? ' ring' : ''}`}
            aria-label="Paradas e alertas"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('fluxo:open-pauses'))
            }
          >
            🔔 Paradas
            {newCount > 0 ? <b className={styles.badge}>{newCount}</b> : null}
          </Button>
          <button
            type="button"
            className={`${styles.live} live${live ? '' : ' off'}`}
            aria-pressed={live}
            onClick={toggleLive}
          >
            <i aria-hidden />
            <span>Ao vivo</span>
          </button>
          <select
            className={styles.speed}
            aria-label="Velocidade da simulação"
            value={String(speed)}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value="1">Velocidade 1x</option>
            <option value="2">Velocidade 2x</option>
            <option value="4">Velocidade 4x</option>
          </select>
          <Button onClick={cycleTheme} aria-label="Alternar tema">
            ◐ {THEME_LABEL[themeKey]}
          </Button>
        </div>
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
      {role === 'manager' ? <Filters /> : null}
    </>
  );
}
