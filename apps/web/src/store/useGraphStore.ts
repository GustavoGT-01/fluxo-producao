import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { wouldCreateCycle } from '@/domain/graph';
import type { Sector } from '@/domain/types';
import { SECTORS } from '@/mocks/sectors';
import { isRemoteApply, isSignedIn } from '@/services/authState';
import { pushSector } from '@/services/commands';
import { useUiStore } from '@/store/useUiStore';

export type ConnectResult = { ok: true } | { ok: false; reason: 'ciclo' };

interface GraphState {
  sectors: Sector[];
  moveSector: (id: string, pos: { x: number; y: number }) => void;
  commitSectorPosition: (id: string) => void;
  connect: (from: string, to: string) => ConnectResult;
  disconnect: (from: string, to: string) => void;
  updateSector: (id: string, meta: Partial<Pick<Sector, 'name' | 'icon' | 'color'>>) => void;
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      sectors: SECTORS.map((s) => ({
        ...s,
        deps: [...s.deps],
        pos: { ...s.pos },
      })),
      moveSector: (id, pos) =>
        set((state) => ({
          sectors: state.sectors.map((s) => (s.id === id ? { ...s, pos: { ...pos } } : s)),
        })),
      commitSectorPosition: (id) => {
        if (isRemoteApply() || !isSignedIn()) return;
        const sector = get().sectors.find((s) => s.id === id);
        if (!sector) return;
        void pushSector(id, { pos: sector.pos }).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Falha ao gravar posição';
          useUiStore.getState().pushToast(message);
        });
      },
      connect: (from, to) => {
        const { sectors } = get();
        if (from === to) return { ok: false, reason: 'ciclo' };
        if (wouldCreateCycle(sectors, from, to)) {
          return { ok: false, reason: 'ciclo' };
        }
        const target = sectors.find((s) => s.id === to);
        if (!target) return { ok: false, reason: 'ciclo' };
        if (target.deps.includes(from)) return { ok: true };
        const nextDeps = [...target.deps, from];
        set({
          sectors: sectors.map((s) => (s.id === to ? { ...s, deps: nextDeps } : s)),
        });
        if (!isRemoteApply() && isSignedIn()) {
          void pushSector(to, { deps: nextDeps }).catch((error: unknown) => {
            set({ sectors });
            const message = error instanceof Error ? error.message : 'Ciclo bloqueado';
            useUiStore.getState().pushToast(message);
          });
        }
        return { ok: true };
      },
      disconnect: (from, to) => {
        const sectors = get().sectors;
        const target = sectors.find((s) => s.id === to);
        const nextDeps = target ? target.deps.filter((d) => d !== from) : [];
        set({
          sectors: sectors.map((s) => (s.id === to ? { ...s, deps: nextDeps } : s)),
        });
        if (!isRemoteApply() && isSignedIn() && target) {
          void pushSector(to, { deps: nextDeps }).catch((error: unknown) => {
            set({ sectors });
            const message = error instanceof Error ? error.message : 'Falha ao remover fio';
            useUiStore.getState().pushToast(message);
          });
        }
      },
      updateSector: (id, meta) => {
        const sectors = get().sectors;
        set({
          sectors: sectors.map((s) => (s.id === id ? { ...s, ...meta } : s)),
        });
        if (!isRemoteApply() && isSignedIn()) {
          void pushSector(id, meta).catch((error: unknown) => {
            set({ sectors });
            const message = error instanceof Error ? error.message : 'Falha ao gravar setor';
            useUiStore.getState().pushToast(message);
          });
        }
      },
    }),
    {
      name: 'fluxo-graph',
      version: 1,
      partialize: (state) => ({
        sectors: state.sectors.map(({ id, name, icon, color, deps, pos }) => ({
          id,
          name,
          icon,
          color,
          deps,
          pos,
        })),
      }),
    },
  ),
);
