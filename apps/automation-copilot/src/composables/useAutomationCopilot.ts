/**
 * useAutomationCopilot — Domain logic for Automation Copilot.
 *
 * Reads price feed directly from on-chain MorpheusDataFeed (no off-chain
 * HTTP). Randomness is derived locally from crypto.getRandomValues for
 * the recipe-jitter use case (this is a UI/recipe preview tool — the
 * actual on-chain VRF flow lives in flagship contracts like fogplay).
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useMorpheusDataFeed } from "@shared/composables/useMorpheusDataFeed";
import { EXTERNAL_INTEGRATIONS, getNetwork } from "@shared/constants/rpc";

export interface UseAutomationCopilotOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
}

function jitterBytesHex(): string {
  const bytes = new Uint8Array(32);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
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
      network,
    });
    return { success: true };
  }

  function loadJitter() {
    // Local-only jitter (32 random bytes) for recipe scheduling preview.
    // For verifiable on-chain randomness, see how flagship contracts like
    // fogplay invoke the MorpheusOracle directly via a contract callback.
    latestPayload.set({
      kind: "jitter",
      asset: asset.get(),
      jitter_bytes_hex: jitterBytesHex(),
      note: "local pseudorandomness for recipe preview only — not verifiable randomness",
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
    previewRecipePayload,
    loadJitter,
    loadAll,
  };
}
