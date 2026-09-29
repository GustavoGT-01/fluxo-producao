import { create } from 'zustand';
import {
  fetchBootstrap,
  fetchMe,
  loginManager,
  loginOperator,
  logoutApi,
  type SessionUser,
} from '@/services/api';
import { applyRemote, setSignedIn } from '@/services/authState';
import { createDemoOrders } from '@/mocks/orderFactory';
import { isPresentation } from '@/services/presentation';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useUiStore } from '@/store/useUiStore';

type Status = 'unknown' | 'anon' | 'in';

interface SessionState {
  status: Status;
  user: SessionUser | null;
  restore: () => Promise<void>;
  enter: (user: SessionUser) => Promise<void>;
  loginAsManager: (email: string, password: string, remember?: boolean) => Promise<void>;
  loginAsOperator: (sectorId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

async function applyUser(user: SessionUser): Promise<void> {
  const data = await fetchBootstrap();
  applyRemote(() => {
    useGraphStore.setState({
      sectors: data.sectors.map((s) => ({ ...s, deps: [...s.deps], pos: { ...s.pos } })),
    });
    useOrdersStore.setState({
      orders: data.orders,
      pauses: data.pauses,
      feed: data.feed,
    });
    if (isPresentation()) {
      const demo = createDemoOrders();
      useOrdersStore.setState({
        orders: demo.orders,
        pauses: demo.pauses,
        feed: demo.feed,
      });
    }
  });
  useUiStore.getState().setRole(user.role);
  if (user.role === 'operator' && user.sectorId) {
    useUiStore.getState().setSector(user.sectorId);
  }
  setSignedIn(true);
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'unknown',
  user: null,
  restore: async () => {
    try {
      const { user } = await fetchMe();
      await applyUser(user);
      set({ status: 'in', user });
    } catch {
      setSignedIn(false);
      set({ status: 'anon', user: null });
    }
  },
  enter: async (user) => {
    await applyUser(user);
    set({ status: 'in', user });
  },
  loginAsManager: async (email, password, remember) => {
    const { user } = await loginManager(email, password, remember);
    await applyUser(user);
    set({ status: 'in', user });
  },
  loginAsOperator: async (sectorId, pin) => {
    const { user } = await loginOperator(sectorId, pin);
    await applyUser(user);
    set({ status: 'in', user });
  },
  logout: async () => {
    try {
      await logoutApi();
    } catch {
      /* cookie já caiu */
    }
    setSignedIn(false);
    useUiStore.getState().setOperatorLens(null);
    useUiStore.getState().setRole('manager');
    useUiStore.getState().setSector(null);
    set({ status: 'anon', user: null });
  },
}));
