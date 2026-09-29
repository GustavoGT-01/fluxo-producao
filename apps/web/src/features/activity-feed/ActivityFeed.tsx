import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { useOrdersStore } from '@/store/useOrdersStore';
import styles from './ActivityFeed.module.css';

type FeedKind = 'all' | 'pause' | 'prod' | 'admin';

const KINDS: { id: FeedKind; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'pause', label: 'Pausas' },
  { id: 'prod', label: 'Produção' },
  { id: 'admin', label: 'Sistema' },
];

const PREVIEW = 8;

function kindOf(text: string): Exclude<FeedKind, 'all'> {
  const t = text.toLowerCase();
  if (t.includes('pausa') || t.includes('parada')) return 'pause';
  if (
    t.includes('conta') ||
    t.includes('operador') ||
    t.includes('entrou') ||
    t.includes('saiu') ||
    t.includes('setor') ||
    t.includes('dependên') ||
    t.includes('importada')
  ) {
    return 'admin';
  }
  return 'prod';
}

export function ActivityFeed() {
  const feed = useOrdersStore((s) => s.feed);
  const [kind, setKind] = useState<FeedKind>('all');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    if (kind === 'all') return feed;
    return feed.filter((item) => kindOf(item.text) === kind);
  }, [feed, kind]);

  const visible = expanded ? filtered : filtered.slice(0, PREVIEW);
  const hidden = Math.max(0, filtered.length - visible.length);

  return (
    <section className={`${styles.feed} feed`} aria-label="Atividade recente">
      <div className={styles.head}>
        <h3>Atividade recente</h3>
        <span className={styles.count}>
          {kind === 'all' ? filtered.length : `${filtered.length}/${feed.length}`}
        </span>
      </div>

      <div className={styles.filters} role="group" aria-label="Filtrar atividades">
        {KINDS.map((item) => (
          <Button
            key={item.id}
            variant={kind === item.id ? 'brand' : 'default'}
            aria-pressed={kind === item.id}
            className={styles.chip}
            onClick={() => {
              setKind(item.id);
              setExpanded(false);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <ul className={styles.list}>
        {visible.length === 0 ? (
          <li className={styles.empty}>
            {feed.length === 0 ? 'Nenhuma atividade ainda.' : 'Nada neste filtro.'}
          </li>
        ) : (
          visible.map((item) => (
            <li key={item.id} data-kind={kindOf(item.text)}>
              <time dateTime={item.at}>{item.at}</time>
              <span>{item.text}</span>
            </li>
          ))
        )}
      </ul>

      {filtered.length > PREVIEW ? (
        <Button
          variant="ghost"
          className={styles.more}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Recolher' : `Ver mais · ${hidden}`}
        </Button>
      ) : null}
    </section>
  );
}
