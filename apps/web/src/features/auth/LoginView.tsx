import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ApiError, fetchOperatorSectors } from '@/services/api';
import { useSessionStore } from '@/store/useSessionStore';
import styles from './Login.module.css';

type Kind = 'manager' | 'operator';

interface SectorOption {
  id: string;
  name: string;
  icon: string;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

export function LoginView() {
  const loginAsManager = useSessionStore((s) => s.loginAsManager);
  const loginAsOperator = useSessionStore((s) => s.loginAsOperator);
  const [kind, setKind] = useState<Kind>('manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [sectorId, setSectorId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchOperatorSectors()
      .then((data) => {
        if (!live) return;
        setSectors(data.sectors);
        setSectorId((current) => current || data.sectors[0]?.id || '');
      })
      .catch(() => {
        if (live) setError('Servidor indisponível');
      });
    return () => {
      live = false;
    };
  }, []);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (kind === 'manager') {
        await loginAsManager(email.trim(), password);
      } else {
        if (!sectorId) {
          setError('Escolha o setor');
          return;
        }
        if (!/^\d{4}$/.test(pin)) {
          setError('PIN de 4 dígitos');
          return;
        }
        await loginAsOperator(sectorId, pin);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar');
    } finally {
      setBusy(false);
    }
  };

  const pushDigit = (digit: string) => {
    setPin((current) => (current.length >= 4 ? current : current + digit));
  };

  return (
    <main className={styles.shell}>
      <section className={`mbox ${styles.stage}`}>
        <header className={styles.brand}>
          <p className={styles.mark}>Fluxo</p>
          <h1 className={styles.title}>Produção</h1>
        </header>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <SegmentedControl
            aria-label="Tipo de acesso"
            options={[
              { value: 'manager', label: 'Gerência' },
              { value: 'operator', label: 'Operador' },
            ]}
            value={kind}
            onChange={(value) => {
              setKind(value as Kind);
              setError('');
            }}
          />

          {kind === 'manager' ? (
            <div className={styles.fields}>
              <label className={styles.label}>
                E-mail
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                Senha
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            </div>
          ) : (
            <div className={styles.fields}>
              <div className={styles.sectors} role="radiogroup" aria-label="Setor">
                {sectors.map((sector) => (
                  <button
                    key={sector.id}
                    type="button"
                    className={styles.sector}
                    aria-pressed={sectorId === sector.id}
                    onClick={() => setSectorId(sector.id)}
                  >
                    <span aria-hidden>{sector.icon}</span>
                    {sector.name}
                  </button>
                ))}
              </div>
              <label className={styles.pinBox}>
                <span className={styles.srOnly}>PIN</span>
                <span className={styles.slots} aria-hidden>
                  {[0, 1, 2, 3].map((index) => (
                    <i key={index} data-on={pin.length > index ? '1' : '0'} />
                  ))}
                </span>
                <input
                  className={styles.pinCatch}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </label>
              <div className={styles.pad}>
                {DIGITS.map((digit) => (
                  <button key={digit} type="button" className={styles.key} onClick={() => pushDigit(digit)}>
                    {digit}
                  </button>
                ))}
                <button type="button" className={styles.key} onClick={() => setPin('')}>
                  Limpar
                </button>
              </div>
            </div>
          )}

          {error ? (
            <p key={error} className={`alert ${styles.error}`} role="alert">
              {error}
            </p>
          ) : null}
          <Button variant="brand" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          {import.meta.env.DEV ? (
            <details className={styles.demo}>
              <summary>Contas de teste</summary>
              <p>gerencia@fabrica.local · Gestao#2401</p>
              <p>CNC · 1101</p>
            </details>
          ) : null}
        </form>
      </section>
    </main>
  );
}
