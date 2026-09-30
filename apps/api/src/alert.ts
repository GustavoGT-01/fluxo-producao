export interface PauseAlert {
  kind: 'pause.created';
  pauseId: string;
  orderId: string;
  sectorId: string;
  reason: string;
  at: string;
}

export async function dispatchPauseAlert(
  url: string | undefined,
  payload: PauseAlert,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!url) return false;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.ok;
}
