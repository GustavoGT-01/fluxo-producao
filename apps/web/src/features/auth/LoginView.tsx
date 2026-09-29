import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  fetchOperatorSectors,
  loginManager,
  loginOperator,
} from '@/services/api';
import { useSessionStore } from '@/store/useSessionStore';
import { useUiStore } from '@/store/useUiStore';
import styles from './Login.module.css';

type Kind = 'manager' | 'operator';
type GoPhase = 'idle' | 'loading' | 'success' | 'shake';

interface SectorOption {
  id: string;
  name: string;
  icon: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function safeAuthMessage(err: unknown, kind: Kind): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return kind === 'manager' ? 'E-mail ou senha inválidos.' : 'PIN incorreto para este setor.';
    }
    if (err.status === 403) return 'Sem permissão para este acesso.';
    if (err.status >= 500) return 'Erro no servidor. Tente de novo.';
    return err.message;
  }
  return 'Falha de conexão. Verifique a rede e o servidor.';
}

function goClass(phase: GoPhase, extra?: string): string {
  return [
    styles.go,
    phase === 'loading' ? styles.goLoading : '',
    phase === 'success' ? styles.goSuccess : '',
    phase === 'shake' ? styles.goShake : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function LoginView() {
  const enter = useSessionStore((s) => s.enter);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const pushToast = useUiStore((s) => s.pushToast);

  const [kind, setKind] = useState<Kind>('manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [emailErr, setEmailErr] = useState(false);
  const [passwordErr, setPasswordErr] = useState(false);

  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [sectorId, setSectorId] = useState('');
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState(false);

  const [alert, setAlert] = useState('');
  const [goPhase, setGoPhase] = useState<GoPhase>('idle');
  const [sectorsLoadFailed, setSectorsLoadFailed] = useState(false);

  const railRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const autoPinRef = useRef(false);

  useEffect(() => {
    let live = true;
    fetchOperatorSectors()
      .then((data) => {
        if (!live) return;
        setSectors(data.sectors);
        setSectorId((current) => current || data.sectors[0]?.id || '');
        setSectorsLoadFailed(false);
      })
      .catch(() => {
        if (live) {
          setSectorsLoadFailed(true);
          setAlert('Servidor indisponível. Confira se a API está rodando.');
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const sectorIndex = Math.max(
    0,
    sectors.findIndex((s) => s.id === sectorId),
  );

  const selectSector = useCallback((index: number, scroll = true) => {
    const sector = sectors[index];
    if (!sector) return;
    setSectorId(sector.id);
    setPinErr(false);
    setAlert('');
    if (scroll) {
      const rail = railRef.current;
      const el = rail?.querySelector(`[data-sector-index="${index}"]`);
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [sectors]);

  const toggleTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = theme ?? (prefersDark ? 'dark' : 'light');
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  };

  const finishSuccess = async (user: Awaited<ReturnType<typeof loginManager>>['user']) => {
    setGoPhase('success');
    await pause(650);
    await enter(user);
  };

  const submitManager = async () => {
    if (submitLock.current || goPhase === 'loading' || goPhase === 'success') return;

    const trimmed = email.trim();
    const emailOk = EMAIL_RE.test(trimmed);
    const passwordOk = password.length >= 8;
    setEmailErr(!emailOk);
    setPasswordErr(!passwordOk);
    setAlert('');

    if (!emailOk || !passwordOk) {
      if (!emailOk) document.getElementById('login-email')?.focus();
      else document.getElementById('login-password')?.focus();
      return;
    }

    submitLock.current = true;
    setGoPhase('loading');
    try {
      const { user } = await loginManager(trimmed, password, remember);
      if (user.role !== 'manager') {
        throw new ApiError(403, 'Sem permissão para este acesso.');
      }
      await finishSuccess(user);
    } catch (err) {
      setGoPhase('shake');
      setAlert(safeAuthMessage(err, 'manager'));
      await pause(400);
      setGoPhase('idle');
    } finally {
      submitLock.current = false;
    }
  };

  const submitOperator = async () => {
    if (submitLock.current || goPhase === 'loading' || goPhase === 'success') return;

    setPinErr(false);
    setAlert('');

    if (!sectorId) {
      setAlert('Escolha um setor.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setPinErr(true);
      return;
    }

    submitLock.current = true;
    setGoPhase('loading');
    try {
      const { user } = await loginOperator(sectorId, pin);
      if (user.role !== 'operator') {
        throw new ApiError(403, 'Sem permissão para este acesso.');
      }
      await finishSuccess(user);
    } catch (err) {
      setGoPhase('shake');
      setPinErr(true);
      setAlert(safeAuthMessage(err, 'operator'));
      await pause(400);
      setGoPhase('idle');
    } finally {
      submitLock.current = false;
      autoPinRef.current = false;
    }
  };

  useEffect(() => {
    if (kind !== 'operator' || pin.length !== 4 || autoPinRef.current) return;
    autoPinRef.current = true;
    void submitOperator();
  }, [kind, pin]);

  const pushDigit = (key: string) => {
    setPinErr(false);
    setAlert('');
    if (key === 'C') setPin('');
    else if (key === '⌫') setPin((current) => current.slice(0, -1));
    else setPin((current) => (current.length >= 4 ? current : current + key));
  };

  const onForgotPassword = () => {
    pushToast('Recuperação de senha não está configurada. Fale com a gerência.');
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} aria-hidden>
        <div className={`${styles.orb} ${styles.orb1}`} data-login-orb="1" />
        <div className={`${styles.orb} ${styles.orb2}`} data-login-orb="2" />
        <div className={`${styles.orb} ${styles.orb3}`} data-login-orb="3" />
        <svg className={styles.bgSvg} viewBox="0 0 1000 600" preserveAspectRatio="none">
          <path
            className={styles.pulse}
            data-login-pulse=""
            d="M0 480 C 200 420, 300 520, 500 460 S 800 380, 1000 430"
          />
          <path
            className={`${styles.pulse} ${styles.pulseRun}`}
            data-login-pulse="run"
            d="M0 120 C 220 180, 320 70, 520 140 S 820 210, 1000 150"
          />
        </svg>
      </div>

      <div className={styles.shell} data-login-shell>
        <aside className={styles.brand}>
          <div className={styles.brandTop}>
            <div>
              <p className={styles.tag}>FLUXO</p>
              <h1 className={styles.title}>Produção</h1>
            </div>
          </div>
          <div className={styles.chain} aria-hidden={sectors.length === 0}>
            {sectors.map((sector, index) => (
              <div
                key={sector.id}
                className={`${styles.chainNode} ${index < 4 ? styles.chainNodeOn : ''}`}
                data-login-chain=""
                style={{ animationDelay: `${0.15 + index * 0.05}s` }}
              >
                <span className={styles.chainIcon}>{sector.icon}</span>
                {sector.name}
              </div>
            ))}
          </div>
          <div className={styles.foot}>
            <b>Chão de fábrica em tempo real</b>
            Do CNC ao controle de qualidade, tudo em um só lugar.
          </div>
        </aside>

        <div className={styles.side}>
          <div className={styles.topRow}>
            <button type="button" className={styles.themeBtn} onClick={toggleTheme}>
              ◐ Tema
            </button>
          </div>

          <div className={styles.seg} role="group" aria-label="Perfil de acesso">
            <div
              className={`${styles.segThumb} ${kind === 'operator' ? styles.segThumbOp : ''}`}
              aria-hidden
            />
            <button
              type="button"
              className={`${styles.segBtn} ${kind === 'manager' ? styles.segBtnOn : ''}`}
              aria-pressed={kind === 'manager'}
              onClick={() => {
                setKind('manager');
                setAlert('');
                setGoPhase('idle');
              }}
            >
              Gerência
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${kind === 'operator' ? styles.segBtnOn : ''}`}
              aria-pressed={kind === 'operator'}
              onClick={() => {
                setKind('operator');
                setAlert('');
                setGoPhase('idle');
              }}
            >
              Operador
            </button>
          </div>

          <div className={styles.panes}>
            <form
              className={`${styles.pane} ${kind === 'manager' ? styles.paneOn : ''}`}
              onSubmit={(event) => {
                event.preventDefault();
                void submitManager();
              }}
            >
              <div
                className={`${styles.field} ${emailErr ? styles.fieldErr : ''}`}
                data-login-shake={emailErr ? '' : undefined}
              >
                <label className={styles.fieldLabel} htmlFor="login-email">
                  E-mail
                </label>
                <div className={styles.fieldBox}>
                  <input
                    id="login-email"
                    className={styles.fieldInput}
                    type="email"
                    autoComplete="username"
                    placeholder="voce@fabrica.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailErr(false);
                      setAlert('');
                    }}
                    required
                  />
                </div>
                <span className={styles.fieldMsg} role="alert">
                  Informe um e-mail válido.
                </span>
              </div>

              <div
                className={`${styles.field} ${passwordErr ? styles.fieldErr : ''}`}
                data-login-shake={passwordErr ? '' : undefined}
              >
                <label className={styles.fieldLabel} htmlFor="login-password">
                  Senha
                </label>
                <div className={styles.fieldBox}>
                  <input
                    id="login-password"
                    className={styles.fieldInput}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setPasswordErr(false);
                      setAlert('');
                    }}
                    required
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'ocultar' : 'mostrar'}
                  </button>
                </div>
                <span className={styles.fieldMsg} role="alert">
                  A senha precisa ter pelo menos 8 caracteres.
                </span>
              </div>

              <div className={styles.row2}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Manter conectado
                </label>
                <button type="button" className={styles.forgot} onClick={onForgotPassword}>
                  Esqueci a senha
                </button>
              </div>

              <button
                type="submit"
                className={goClass(goPhase)}
                data-login-shake={goPhase === 'shake' ? '' : undefined}
                disabled={goPhase === 'loading' || goPhase === 'success'}
              >
                <span className={styles.goTxt}>Entrar como gerência →</span>
                <span className={styles.spin} data-login-spin={goPhase === 'loading' ? '' : undefined} aria-hidden />
                <span className={styles.ok} aria-hidden>
                  ✓
                </span>
              </button>
            </form>

            <form
              className={`${styles.pane} ${kind === 'operator' ? styles.paneOn : ''}`}
              onSubmit={(event) => {
                event.preventDefault();
                void submitOperator();
              }}
            >
              <div className={styles.carousel}>
                <span className={styles.fieldLabel}>Selecione seu setor</span>
                <div className={styles.railWrap}>
                  <button
                    type="button"
                    className={styles.navb}
                    aria-label="Setor anterior"
                    disabled={sectorIndex <= 0 || sectors.length === 0}
                    onClick={() => selectSector(Math.max(0, sectorIndex - 1))}
                  >
                    ‹
                  </button>
                  <div className={styles.rail} ref={railRef} role="radiogroup" aria-label="Setor">
                    {sectors.map((sector, index) => (
                      <button
                        key={sector.id}
                        type="button"
                        data-sector-index={index}
                        className={`${styles.sector} ${sectorId === sector.id ? styles.sectorSel : ''}`}
                        aria-pressed={sectorId === sector.id}
                        onClick={() => selectSector(index)}
                      >
                        <span aria-hidden>{sector.icon}</span>
                        {sector.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.navb}
                    aria-label="Próximo setor"
                    disabled={sectorIndex >= sectors.length - 1 || sectors.length === 0}
                    onClick={() => selectSector(Math.min(sectors.length - 1, sectorIndex + 1))}
                  >
                    ›
                  </button>
                </div>
                <div className={styles.dots} aria-hidden={sectors.length <= 1}>
                  {sectors.map((sector, index) => (
                    <button
                      key={sector.id}
                      type="button"
                      className={`${styles.dot} ${index === sectorIndex ? styles.dotOn : ''}`}
                      aria-label={`Setor ${sector.name}`}
                      onClick={() => selectSector(index)}
                    />
                  ))}
                </div>
              </div>

              <div
                className={`${styles.pinBlock} ${pinErr ? styles.pinErr : ''}`}
                data-login-shake={pinErr ? '' : undefined}
              >
                <span className={styles.pinLabel}>Seu PIN</span>
                <div className={styles.dotsPin} aria-hidden>
                  {[0, 1, 2, 3].map((index) => (
                    <i key={index} data-on={pin.length > index ? '1' : '0'} />
                  ))}
                </div>
                <p className={styles.pinHint} role="alert">
                  PIN incorreto. Tente novamente.
                </p>
                <input
                  className={styles.pinCatch}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  aria-label="PIN de 4 dígitos"
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, '').slice(0, 4));
                    setPinErr(false);
                    setAlert('');
                    autoPinRef.current = false;
                  }}
                />
                <div className={styles.pad}>
                  {PAD_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.key} ${key === 'C' || key === '⌫' ? styles.keyAux : ''}`}
                      onClick={() => pushDigit(key)}
                    >
                      {key === 'C' ? 'Limpar' : key}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className={goClass(goPhase)}
                data-login-shake={goPhase === 'shake' ? '' : undefined}
                disabled={
                  goPhase === 'loading' ||
                  goPhase === 'success' ||
                  sectorsLoadFailed ||
                  sectors.length === 0
                }
              >
                <span className={styles.goTxt}>Entrar no setor →</span>
                <span className={styles.spin} data-login-spin={goPhase === 'loading' ? '' : undefined} aria-hidden />
                <span className={styles.ok} aria-hidden>
                  ✓
                </span>
              </button>
            </form>
          </div>

          {alert ? (
            <p className={styles.alert} role="alert">
              {alert}
            </p>
          ) : null}

          {import.meta.env.DEV ? (
            <details className={styles.demo}>
              <summary>Ambiente de desenvolvimento</summary>
              <div className={styles.demoList}>
                <div className={styles.demoItem}>
                  <span>Preencher e-mail da gerência demo</span>
                  <button
                    type="button"
                    className={styles.demoUse}
                    onClick={() => {
                      setKind('manager');
                      setEmail('gerencia@fabrica.local');
                      setPassword('');
                      setEmailErr(false);
                      setPasswordErr(false);
                    }}
                  >
                    Usar
                  </button>
                </div>
                {sectors.slice(0, 4).map((sector, index) => (
                  <div key={sector.id} className={styles.demoItem}>
                    <span>
                      {sector.icon} {sector.name}
                    </span>
                    <button
                      type="button"
                      className={styles.demoUse}
                      onClick={() => {
                        setKind('operator');
                        selectSector(index);
                        setPin('');
                        setPinErr(false);
                      }}
                    >
                      Setor
                    </button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
