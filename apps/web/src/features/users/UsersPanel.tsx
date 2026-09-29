import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ApiError, createUser, fetchUsers, patchUser, type Account } from '@/services/api';
import { useGraphStore } from '@/store/useGraphStore';
import { useSessionStore } from '@/store/useSessionStore';
import styles from './Users.module.css';

type Kind = 'manager' | 'operator';

export function UsersPanel() {
  const me = useSessionStore((s) => s.user);
  const sectors = useGraphStore((s) => s.sectors);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Account[]>([]);
  const [kind, setKind] = useState<Kind>('operator');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secretFor, setSecretFor] = useState<string | null>(null);
  const [secret, setSecret] = useState('');

  const load = async () => {
    const data = await fetchUsers();
    setUsers(data.users);
  };

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setError('');
      void load().catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Falha ao listar usuários');
      });
    };
    window.addEventListener('fluxo:open-users', onOpen);
    return () => window.removeEventListener('fluxo:open-users', onOpen);
  }, []);

  useEffect(() => {
    if (!sectorId && sectors[0]) setSectorId(sectors[0].id);
  }, [sectorId, sectors]);

  const notify = () => window.dispatchEvent(new CustomEvent('fluxo:users-changed'));

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      if (kind === 'manager') {
        await createUser({ kind: 'manager', name: name.trim(), email: email.trim(), password });
      } else {
        await createUser({ kind: 'operator', name: name.trim(), sectorId, pin });
      }
      setName('');
      setEmail('');
      setPassword('');
      setPin('');
      await load();
      notify();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao criar usuário');
    } finally {
      setBusy(false);
    }
  };

  const saveSecret = async (account: Account) => {
    setError('');
    setBusy(true);
    try {
      if (account.role === 'manager') await patchUser(account.id, { password: secret });
      else await patchUser(account.id, { pin: secret });
      setSecretFor(null);
      setSecret('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao gravar senha');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (account: Account) => {
    setError('');
    try {
      await patchUser(account.id, { active: !account.active });
      await load();
      notify();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao atualizar usuário');
    }
  };

  return (
    <Modal open={open} title="Usuários" onClose={() => setOpen(false)}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <SegmentedControl
          aria-label="Tipo de conta"
          options={[
            { value: 'operator', label: 'Operador' },
            { value: 'manager', label: 'Gerência' },
          ]}
          value={kind}
          onChange={(value) => setKind(value as Kind)}
        />
        <div className={styles.grid}>
          <label className={styles.label}>
            Nome
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {kind === 'manager' ? (
            <>
              <label className={styles.label}>
                E-mail
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                Senha
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.label}>
                Setor
                <select className={styles.input} value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.icon} {sector.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                PIN
                <input
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                />
              </label>
            </>
          )}
        </div>
        <Button variant="brand" disabled={busy} onClick={() => void create()}>
          {busy ? 'Criando…' : 'Criar'}
        </Button>
      </form>
      {error ? (
        <p key={error} className={`alert ${styles.error}`} role="alert">
          {error}
        </p>
      ) : null}
      <ul className={`feed ${styles.list}`}>
        {users.map((account) => {
          const sector = sectors.find((item) => item.id === account.sectorId);
          return (
            <li key={account.id} className={account.active ? styles.row : styles.rowOff}>
              <div className={styles.who}>
                <b>
                  {account.name}
                  {account.id === me?.id ? <span className={styles.you}>você</span> : null}
                </b>
                <span className={styles.meta}>
                  {account.role === 'manager' ? 'Gerência' : 'Operador'}
                  {' · '}
                  {account.role === 'manager'
                    ? account.email
                    : sector
                      ? `${sector.icon} ${sector.name}`
                      : '—'}
                  {account.active ? '' : ' · inativa'}
                </span>
              </div>
              <div className={styles.rowActs}>
                {secretFor === account.id ? (
                  <>
                    <input
                      className={styles.secret}
                      type={account.role === 'manager' ? 'password' : 'text'}
                      inputMode={account.role === 'operator' ? 'numeric' : undefined}
                      autoComplete="new-password"
                      aria-label={account.role === 'manager' ? 'Nova senha' : 'Novo PIN'}
                      value={secret}
                      onChange={(e) =>
                        setSecret(
                          account.role === 'operator'
                            ? e.target.value.replace(/\D/g, '').slice(0, 4)
                            : e.target.value,
                        )
                      }
                    />
                    <Button disabled={busy} onClick={() => void saveSecret(account)}>
                      Gravar
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setSecretFor(account.id);
                      setSecret('');
                    }}
                  >
                    {account.role === 'manager' ? 'Senha' : 'PIN'}
                  </Button>
                )}
                {account.id !== me?.id ? (
                  <Button variant={account.active ? 'danger' : 'default'} onClick={() => void toggleActive(account)}>
                    {account.active ? 'Desativar' : 'Reativar'}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
