export interface LiveClient {
  id: string;
  role: 'manager' | 'operator';
  sectorId: string | null;
  send: (event: string, data: unknown) => void;
}

const clients = new Map<string, LiveClient>();
let seq = 0;

export function addClient(client: Omit<LiveClient, 'id'>): string {
  const id = `c${++seq}`;
  clients.set(id, { ...client, id });
  return id;
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function eachClient(visit: (client: LiveClient) => void): void {
  for (const client of clients.values()) visit(client);
}
