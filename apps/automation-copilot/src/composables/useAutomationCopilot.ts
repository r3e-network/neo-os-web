/**
 * useAutomationCopilot — Domain logic for Automation Copilot.
 *
 * Reads price feed directly from on-chain MorpheusDataFeed (no off-chain HTTP)
 * and builds a deterministic automation recipe payload from user input.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useMorpheusDataFeed } from "@shared/composables/useMorpheusDataFeed";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "@shared/constants/rpc";

export interface UseAutomationCopilotOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useAutomationCopilot({ t }: UseAutomationCopilotOptions) {
  const network = getNetwork();
  const integration = EXTERNAL_INTEGRATIONS[network];
  const datafeed = useMorpheusDataFeed({ network });

  const asset = createObservable("NEO");
  const targetPrice = createObservable("20");
  const schedule = createObservable("0 */6 * * *");
  const actionName = createObservable("auto_repay_self_loan");
  const latestPayload = createObservable<Record<string, unknown> | null>(null);
  const latestPrice = createObservable<number | null>(null);
  const isRequestingRaw = createObservable(false);

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

  const networkDisplay: Observable<string> = {
    get: () => network,
    set: () => {},
    subscribe: () => () => {},
  };

  const datafeedHash: Observable<string> = {
    get: () => integration.contracts.morpheusDatafeed,
    set: () => {},
    subscribe: () => () => {},
  };

  const oracleHash: Observable<string> = {
    get: () => integration.contracts.morpheusOracle,
    set: () => {},
    subscribe: () => () => {},
  };

  async function fetchCurrentPrice() {
    isRequestingRaw.set(true);
    try {
      const price = await datafeed.getPrice(asset.get());
      latestPrice.set(price);
      latestPayload.set({
        kind: "price",
        asset: asset.get(),
        current_price: price,
        target_price: Number(targetPrice.get() || "0"),
        schedule: schedule.get(),
        action_name: actionName.get(),
        network,
        source: `on-chain MorpheusDataFeed @ ${integration.contracts.morpheusDatafeed}`,
      });
      return { success: true };
    } finally {
      isRequestingRaw.set(false);
    }
  }

  function buildRecipePayload() {
    latestPayload.set({
      kind: "automation_recipe",
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
      network,
    });
    return { success: true };
  }

  const loadAll = async () => {};

  const isRequesting: Observable<boolean> = isRequestingRaw;

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
    isRequesting,
    fetchCurrentPrice,
    buildRecipePayload,
    loadAll,
  };
}
