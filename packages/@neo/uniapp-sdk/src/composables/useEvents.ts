/**
 * useEvents - Contract events composable for uni-app
 * Refactored to use useAsyncAction (DRY principle)
 */
import { waitForSDK } from "../bridge";
import { useAsyncAction } from "./useAsyncAction";
import type { EventsListParams, EventsListResponse } from "../types";

export function useEvents() {
  const {
    isLoading,
    error,
    execute: list,
  } = useAsyncAction(async (params: EventsListParams = {}): Promise<EventsListResponse> => {
    const sdk = await waitForSDK();
    if (!sdk.events?.list) {
      throw new Error("events.list not available");
    }
    return await sdk.events.list(params);
  });

  return { isLoading, error, list };
}
