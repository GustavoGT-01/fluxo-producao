export type Status = 'run' | 'wait' | 'pause' | 'stop' | 'done';
export type Role = 'manager' | 'operator';

export interface Sector {
  id: string;
  name: string;
  icon: string;
  color: string;
  deps: string[];
  pos: { x: number; y: number };
}

export interface SectorProgress {
  sectorId: string;
  status: Status;
  progress: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface Order {
  id: string;
  product: string;
  quantity: number;
  batch: string;
  client: string;
  orderCode: string;
  urgent: boolean;
  dueDate: string;
  progressBySector: Record<string, SectorProgress>;
}

export interface Pause {
  id: string;
  orderId: string;
  sectorId: string;
  reason: string;
  note?: string;
  by: string;
  at: string;
  state: 'new' | 'seen' | 'handled';
}

export interface OrderFilters {
  status?: ReadonlySet<Status> | readonly Status[];
  batch?: string;
  query?: string;
  urgentOnly?: boolean;
  sectorId?: string | null;
}
