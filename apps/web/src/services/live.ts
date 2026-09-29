import type { Order, Pause, Sector } from '@/domain/types';
import { applyRemote } from '@/services/authState';
import { useGraphStore } from '@/store/useGraphStore';
import { useOrdersStore } from '@/store/useOrdersStore';

type FeedItem = { id: string; text: string; at: string };

export function subscribeProduction(): () => void {
  const source = new EventSource('/api/events', { withCredentials: true });

  const onOrder = (event: MessageEvent) => {
    const order = JSON.parse(event.data) as Order;
    applyRemote(() => useOrdersStore.getState().upsertOrder(order));
  };
  const onPause = (event: MessageEvent) => {
    const payload = JSON.parse(event.data) as { pause: Pause; order: Order };
    applyRemote(() => {
      useOrdersStore.getState().upsertOrder(payload.order);
      const exists = useOrdersStore.getState().pauses.some((p) => p.id === payload.pause.id);
      if (!exists) useOrdersStore.getState().registerPause({ ...payload.pause });
    });
  };
  const onGraph = (event: MessageEvent) => {
    const sectors = JSON.parse(event.data) as Sector[];
    applyRemote(() => useGraphStore.setState({ sectors }));
  };
  const onFeed = (event: MessageEvent) => {
    const item = JSON.parse(event.data) as FeedItem;
    applyRemote(() => useOrdersStore.getState().log(item.text));
  };

  source.addEventListener('order.updated', onOrder);
  source.addEventListener('order.paused', onPause);
  source.addEventListener('graph.updated', onGraph);
  source.addEventListener('feed.created', onFeed);

  return () => source.close();
}
