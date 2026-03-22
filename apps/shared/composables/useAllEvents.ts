/**
 * useAllEvents - Paginated event fetching composable
 *
 * Wraps the SDK's `listEvents` with automatic pagination,
 * returning all matching events across pages.
 */
import type { EventsListParams, EventsListResponse } from "@shared/utils/wallet-sdk";

type ListEventsFn = (params: EventsListParams) => Promise<EventsListResponse>;
type UseAllEventsOptions = {
  onError?: (error: unknown, eventName: string) => void;
  pageSize?: number;
};

export function useAllEvents(listEvents: ListEventsFn, appId: string, options: UseAllEventsOptions = {}) {
  const { pageSize = 50 } = options;

  const listAllEvents = async (eventName: string): Promise<unknown[]> => {
    const events: unknown[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const res = await listEvents({ app_id: appId, event_name: eventName, limit: pageSize, offset });
        const eventList = Array.isArray(res.events) ? res.events : [];
        events.push(...eventList);
        // Use total if available to determine if more pages exist; otherwise use event count
        hasMore = res.total !== undefined ? offset + res.events.length < res.total : res.events.length === pageSize;
        offset += pageSize;
      } catch (error: unknown) {
        const sanitized = error instanceof Error ? error.message : "Failed to fetch events";
        if (!options?.onError) {
          throw new Error(sanitized);
        }
        options.onError(error, eventName);
        break;
      }
    }
    return events;
  };

  return { listAllEvents };
}
