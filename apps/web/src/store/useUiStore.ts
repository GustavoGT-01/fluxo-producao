import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/domain/types';

export type UiView = 'board' | 'list' | 'diag';
export type UiTheme = 'light' | 'dark' | null;
export type BoardLayout = 'focus' | 'strip';

export interface UiFilters {
  statuses: string[];
  batch: string;
  query: string;
  urgentOnly: boolean;
  sectorId: string | null;
}

export interface ToastItem {
  id: string;
  text: string;
}

export interface OperatorLens {
  userId: string;
  name: string;
  sectorId: string;
  sectorName: string;
}

interface UiState {
  role: Role;
  view: UiView;
  boardLayout: BoardLayout;
  theme: UiTheme;
  live: boolean;
  speed: number;
  motion: boolean;
  filters: UiFilters;
  openOrderId: string | null;
  connectSource: string | null;
  operatorLens: OperatorLens | null;
  toasts: ToastItem[];
  setRole: (role: Role) => void;
  setView: (view: UiView) => void;
  setBoardLayout: (boardLayout: BoardLayout) => void;
  setTheme: (theme: UiTheme) => void;
  toggleLive: () => void;
  setSpeed: (speed: number) => void;
  toggleStatus: (status: string) => void;
  setBatch: (batch: string) => void;
  setQuery: (query: string) => void;
  setUrgentOnly: (urgentOnly: boolean) => void;
  setSector: (sectorId: string | null) => void;
  clearFilters: () => void;
  setOperatorLens: (lens: OperatorLens | null) => void;
  openOrder: (orderId: string) => void;
  closeOrder: () => void;
  setConnectSource: (sectorId: string | null) => void;
  pushToast: (text: string) => void;
  dismissToast: (id: string) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      role: 'manager',
      view: 'board',
      boardLayout: 'focus',
      theme: null,
      live: true,
      speed: 1,
      motion: true,
      filters: {
        statuses: [],
        batch: '',
        query: '',
        urgentOnly: false,
        sectorId: null,
      },
      openOrderId: null,
      connectSource: null,
      operatorLens: null,
      toasts: [],
      setRole: (role) => set({ role }),
      setView: (view) => set({ view }),
      setBoardLayout: (boardLayout) => set({ boardLayout }),
      setTheme: (theme) => set({ theme }),
      toggleLive: () => set((s) => ({ live: !s.live })),
      setSpeed: (speed) => set({ speed }),
      toggleStatus: (status) =>
        set((s) => {
          const has = s.filters.statuses.includes(status);
          const statuses = has
            ? s.filters.statuses.filter((x) => x !== status)
            : [...s.filters.statuses, status];
          return { filters: { ...s.filters, statuses } };
        }),
      setBatch: (batch) => set((s) => ({ filters: { ...s.filters, batch } })),
      setQuery: (query) => set((s) => ({ filters: { ...s.filters, query } })),
      setUrgentOnly: (urgentOnly) => set((s) => ({ filters: { ...s.filters, urgentOnly } })),
      setSector: (sectorId) => set((s) => ({ filters: { ...s.filters, sectorId } })),
      clearFilters: () =>
        set((s) => ({
          filters: {
            ...s.filters,
            statuses: [],
            batch: '',
            query: '',
            urgentOnly: false,
            sectorId: null,
          },
        })),
      setOperatorLens: (operatorLens) => set({ operatorLens }),
      openOrder: (orderId) => set({ openOrderId: orderId }),
      closeOrder: () => set({ openOrderId: null }),
      setConnectSource: (connectSource) => set({ connectSource }),
      pushToast: (text) =>
        set((s) => ({
          toasts: [...s.toasts, { id: `t${++toastSeq}`, text }],
        })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'fluxo-ui',
      version: 3,
      partialize: (state) => ({
        view: state.view,
        boardLayout: state.boardLayout,
        theme: state.theme,
        filters: state.filters,
      }),
      migrate: (persisted, version) => {
        const data = (persisted ?? {}) as Record<string, unknown>;
        if (version < 3 && data.boardLayout == null) {
          data.boardLayout = 'focus';
        }
        return data as never;
      },
    },
  ),
);
