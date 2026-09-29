export type RealtimeHandler = (event: { type: string; payload?: unknown }) => void;

/** Stub — sem rede. Retorna unsubscribe no-op. */
export function connectRealtime(_handler: RealtimeHandler): () => void {
  return () => {};
}
