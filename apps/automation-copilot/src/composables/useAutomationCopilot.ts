/**
 * useAutomationCopilot -- Domain logic for Automation Copilot
 *
 * Uses createObservable instead of Vue ref/computed.
 * Called once during setup, returns observables that React components subscribe to.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { OracleService } from "@shared/services";

export interface UseAutomationCopilotOptions {
  oracle: OracleService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAutomationCopilot({ oracle, t }: UseAutomationCopilotOptions) {
  const asset = createObservable("NEO");
  const targetPrice = createObservable("20");
  const schedule = createObservable("0 */6 * * *");
  const actionName = createObservable("auto_repay_self_loan");
  const latestPayload = createObservable<Record<string, unknown> | null>(null);
  const latestPrice = createObservable<number | null>(null);

  const priceDisplay: Observable<string> = {
    get: () => latestPrice.get() == null ? t("notAvailable") : `$${latestPrice.get()!.toFixed(4)}`,
    set: () => {},
    subscribe: (fn) => latestPrice.subscribe(fn),
  };

  const renderedPayload: Observable<string> = {
    get: () => JSON.stringify(latestPayload.get() ?? {}, null, 2) || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => latestPayload.subscribe(fn),
  };

  const oracleHash: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusOracle,
    set: () => {},
    subscribe: () => () => {},
  };

  const networkDisplay: Observable<string> = {
    get: () => oracle.network,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedHash: Observable<string> = {
    get: () => oracle.integration.contracts.morpheusDatafeed,
    set: () => {},
    subscribe: () => () => {},
  };

  const publicApiUrl: Observable<string> = {
    get: () => oracle.integration.morpheusPublicApiUrl,
    set: () => {},
    subscribe: () => () => {},
  };

  async function fetchCurrentPrice() {
    const price = await oracle.getPrice(asset.get());
    latestPrice.set(price.price);
    latestPayload.set({
      kind: "price",
      asset: asset.get(),
      current_price: latestPrice.get(),
      target_price: Number(targetPrice.get() || "0"),
      schedule: schedule.get(),
      action_name: actionName.get(),
      network: oracle.network,
    });
    return { success: true };
  }

  function previewRecipePayload() {
    latestPayload.set({
      kind: "recipe_preview",
      trigger: {
        type: "price_threshold",
        asset: asset.get(),
        target_price: Number(targetPrice.get() || "0"),
      },
      schedule: schedule.get(),
      execution: {
        action_name: actionName.get(),
        target: "aa_or_morpheus_runtime",
      },
      protections: {
        datafeed_priority: "highest",
        request_response_isolation: true,
      },
      network: oracle.network,
    });
    return { success: true };
  }

  async function loadRandomness() {
    const result = await oracle.requestRandom("automation-jitter");
    latestPayload.set({
      kind: "randomness",
      asset: asset.get(),
      randomness: result.randomBytes,
      proof: result.proof,
      request_id: result.requestId,
    });
    return { success: true };
  }

  async function fetchOracleKey() {
    const keyData = await oracle.getOraclePublicKey();
    latestPayload.set(keyData as unknown as Record<string, unknown>);
    return { success: true };
  }

  const loadAll = async () => {};

  const isRequesting: Observable<boolean> = {
    get: () => oracle.isRequesting,
    set: () => {},
    subscribe: () => () => {},
  };

  return {
    asset,
    targetPrice,
    schedule,
    actionName,
    latestPayload,
    latestPrice,
    priceDisplay,
    renderedPayload,
    oracleHash,
    networkDisplay,
    datafeedHash,
    publicApiUrl,
    isRequesting,
    fetchCurrentPrice,
    previewRecipePayload,
    loadRandomness,
    fetchOracleKey,
    loadAll,
  };
}

export type UseAutomationCopilotReturn = ReturnType<typeof useAutomationCopilot>;
