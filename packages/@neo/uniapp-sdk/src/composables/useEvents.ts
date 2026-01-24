/**
 * useEvents - Contract events composable for uni-app
 * Refactored to use useAsyncAction (DRY principle)
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { EventsListParams, EventsListResponse } from "../types";

export function useEvents() {
  const listAction = useAsyncAction(async (params: EventsListParams = {}): Promise<EventsListResponse> => {
    const sdk = await waitForSDK();
    if (!sdk.events?.list) {
      throw new Error("events.list not available");
    }
    return await sdk.events.list(params);
  });

  const emitAction = useAsyncAction(async (eventName: string, data?: Record<string, unknown>): Promise<unknown> => {
    const name = String(eventName || "").trim();
    if (!name) throw new Error("eventName required");
    const sdk = await waitForSDK();
    if (!sdk.events?.emit) {
      throw new Error("events.emit not available");
    }
    return await sdk.events.emit(name, data || {});
  });

  return {
    isLoading: listAction.isLoading,
    error: listAction.error,
    list: listAction.execute,
    isEmitting: emitAction.isLoading,
    emitError: emitAction.error,
    emit: emitAction.execute,
  };
}
