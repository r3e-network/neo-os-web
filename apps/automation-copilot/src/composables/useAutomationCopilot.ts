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
import {
  buildAutomationTriggerRequest,
  callAutomationEndpoint,
  isLocalAutomationIntent,
  mergeTrigger,
  normalizeTrigger,
  normalizeTriggerList,
  type AutomationTrigger,
  type AutomationTriggerRequest,
} from "../automationGateway";

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
  const isRegistering = createObservable(false);
  const isRefreshing = createObservable(false);
  const triggerRequest = createObservable<AutomationTriggerRequest | null>(null);
  const latestTrigger = createObservable<AutomationTrigger | null>(null);
  const triggers = createObservable<AutomationTrigger[]>([]);
  const apiStatus = createObservable(t("apiIdle"));
  const lastError = createObservable("");

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

  const renderedTriggerRequest: Observable<string> = {
    get: () => JSON.stringify(triggerRequest.get() ?? {}, null, 2) || t("notAvailable"),
    set: () => {},
    subscribe: (fn) => triggerRequest.subscribe(fn),
  };

  const latestTriggerId: Observable<string> = {
    get: () => latestTrigger.get()?.id ?? t("notAvailable"),
    set: () => {},
    subscribe: (fn) => latestTrigger.subscribe(fn),
  };

  const latestTriggerState: Observable<string> = {
    get: () => {
      const trigger = latestTrigger.get();
      if (!trigger) return t("notAvailable");
      if (trigger.registration_state === "local_automation_intent") return t("handoffPrepared");
      return trigger.enabled ? t("enabled") : t("disabled");
    },
    set: () => {},
    subscribe: (fn) => latestTrigger.subscribe(fn),
  };

  const triggerCount: Observable<number> = {
    get: () => triggers.get().length,
    set: () => {},
    subscribe: (fn) => triggers.subscribe(fn),
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
    lastError.set("");
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
    } catch (error) {
      lastError.set(error instanceof Error ? error.message : t("fetchFailed"));
      throw error;
    } finally {
      isRequestingRaw.set(false);
    }
  }

  // Strict decimal: optional leading +, digits, optional single fractional part.
  // Rejects NaN, blank, hex (0x..), scientific (1e3), and whitespace-only input.
  const DECIMAL_RE = /^\+?\d+(\.\d+)?$/;

  function validateTargetPrice(raw: string): number | null {
    const text = String(raw ?? "").trim();
    if (!DECIMAL_RE.test(text)) {
      lastError.set(t("targetPriceInvalid"));
      return null;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0) {
      lastError.set(t("targetPriceInvalid"));
      return null;
    }
    return value;
  }

  function buildRecipePayload() {
    lastError.set("");
    if (validateTargetPrice(targetPrice.get()) === null) {
      throw new Error(lastError.get() || t("targetPriceInvalid"));
    }
    const request = buildAutomationTriggerRequest({
      asset: asset.get(),
      targetPrice: targetPrice.get(),
      schedule: schedule.get(),
      actionName: actionName.get(),
      network,
      datafeedHash: integration.contracts.morpheusDatafeed,
      currentPrice: latestPrice.get(),
    });
    triggerRequest.set(request);
    latestPayload.set({
      kind: "automation_recipe",
      trigger: request.condition,
      schedule: request.schedule,
      execution: request.action,
      protections: {
        datafeed_priority: "highest",
        request_response_isolation: true,
      },
      network,
    });
    return { success: true };
  }

  async function registerTrigger() {
    if (isRegistering.get()) return;
    isRegistering.set(true);
    lastError.set("");
    try {
      buildRecipePayload();
      const request = triggerRequest.get();
      if (!request) throw new Error(t("recipeFailed"));
      const result = await callAutomationEndpoint<AutomationTrigger>(
        "automation-triggers",
        {
          method: "POST",
          body: request,
        },
      );
      const trigger = normalizeTrigger(result.data);
      if (!trigger) throw new Error(t("triggerMalformed"));
      const handoffOnly = isLocalAutomationIntent(trigger, result.meta);
      latestTrigger.set(trigger);
      if (!handoffOnly) {
        triggers.set(mergeTrigger(triggers.get(), trigger));
      }
      apiStatus.set(
        handoffOnly ? t("handoffPrepared") : t("triggerRegistered"),
      );
      latestPayload.set({
        kind: "automation_trigger_registration",
        request,
        trigger,
        meta: result.meta,
      });
      return trigger;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("triggerFailed");
      lastError.set(message);
      apiStatus.set(message);
      throw error;
    } finally {
      isRegistering.set(false);
    }
  }

  async function refreshTriggers() {
    if (isRefreshing.get()) return [];
    isRefreshing.set(true);
    lastError.set("");
    try {
      const result = await callAutomationEndpoint<AutomationTrigger[] | { triggers: AutomationTrigger[] }>(
        "automation-triggers",
        { method: "GET" },
      );
      const list = normalizeTriggerList(result.data);
      triggers.set(list);
      // Keep selection consistent with the list: clear it when the server
      // returns an empty set so the status card returns to the empty state
      // instead of operating on a trigger that no longer exists.
      latestTrigger.set(list[0] ?? null);
      apiStatus.set(t("triggersLoaded"));
      return list;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("triggerListFailed");
      lastError.set(message);
      apiStatus.set(message);
      throw error;
    } finally {
      isRefreshing.set(false);
    }
  }

  async function toggleLatestTrigger() {
    if (isRegistering.get()) return;
    const trigger = latestTrigger.get();
    if (!trigger) throw new Error(t("noTriggerSelected"));
    if (isLocalAutomationIntent(trigger)) {
      const message = t("handoffCannotOperate");
      lastError.set(message);
      apiStatus.set(message);
      throw new Error(message);
    }
    isRegistering.set(true);
    lastError.set("");
    try {
      const endpoint = trigger.enabled
        ? "automation-trigger-disable"
        : "automation-trigger-enable";
      const result = await callAutomationEndpoint<{ status?: string }>(
        endpoint,
        {
          method: "POST",
          body: { id: trigger.id },
        },
      );
      const next = {
        ...trigger,
        enabled: !trigger.enabled,
        registration_state: result.meta.state ?? trigger.registration_state,
      };
      latestTrigger.set(next);
      triggers.set(mergeTrigger(triggers.get(), next));
      apiStatus.set(next.enabled ? t("enabled") : t("disabled"));
      latestPayload.set({
        kind: "automation_trigger_status",
        trigger: next,
        result: result.data,
        meta: result.meta,
      });
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("triggerStatusFailed");
      lastError.set(message);
      apiStatus.set(message);
      throw error;
    } finally {
      isRegistering.set(false);
    }
  }

  const loadAll = async () => {};

  const isRequesting: Observable<boolean> = {
    get: () => isRequestingRaw.get() || isRegistering.get() || isRefreshing.get(),
    set: () => {},
    subscribe: (fn) => {
      const a = isRequestingRaw.subscribe(fn);
      const b = isRegistering.subscribe(fn);
      const c = isRefreshing.subscribe(fn);
      return () => {
        a();
        b();
        c();
      };
    },
  };

  return {
    asset,
    targetPrice,
    schedule,
    actionName,
    latestPayload,
    latestPrice,
    triggerRequest,
    latestTrigger,
    triggers,
    priceDisplay,
    renderedPayload,
    renderedTriggerRequest,
    oracleHash,
    networkDisplay,
    datafeedHash,
    latestTriggerId,
    latestTriggerState,
    triggerCount,
    apiStatus,
    lastError,
    isRequesting,
    isRegistering,
    isRefreshing,
    fetchCurrentPrice,
    buildRecipePayload,
    registerTrigger,
    refreshTriggers,
    toggleLatestTrigger,
    loadAll,
  };
}
