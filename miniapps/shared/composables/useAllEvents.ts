/**
 * useAllEvents - Paginated event fetching composable
 *
 * Wraps the SDK's `listEvents` with automatic pagination,
 * returning all matching events across pages.
 */
import type { EventsListParams, EventsListResponse } from "@neo/uniapp-sdk";

type ListEventsFn = (params: EventsListParams) => Promise<EventsListResponse>;

export function useAllEvents(listEvents: ListEventsFn, appId: string) {
  const listAllEvents = async (eventName: string): Promise<unknown[]> => {
    const events: unknown[] = [];
    let afterId: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const res = await listEvents({ app_id: appId, event_name: eventName, limit: 50, after_id: afterId });
      events.push(...res.events);
      hasMore = Boolean(res.has_more && res.last_id);
      afterId = res.last_id || undefined;
    }
    return events;
  };

  return { listAllEvents };
}
