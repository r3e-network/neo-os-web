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
import { formatErrorMessage } from "@shared/utils/errorHandling";
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

export type PriceFreshnessState = "unloaded" | "fresh" | "stale" | "unknown";

export const FRESH_PRICE_MAX_AGE_SECONDS = 12 * 60 * 60;
const MAX_FUTURE_CLOCK_SKEW_SECONDS = 5 * 60;

export function assessPriceFreshness(
  dataTimestamp: number,
  nowMs = Date.now(),
): PriceFreshnessState {
  if (!Number.isFinite(dataTimestamp) || dataTimestamp <= 0) return "unknown";
  const nowSeconds = Math.floor(nowMs / 1000);
  if (dataTimestamp > nowSeconds + MAX_FUTURE_CLOCK_SKEW_SECONDS) return "unknown";
  return nowSeconds - dataTimestamp <= FRESH_PRICE_MAX_AGE_SECONDS
    ? "fresh"
    : "stale";
}

// Keep the input contract shared between the visual builder and the gateway
// action. The PlayArea uses these pure helpers to disable the primary action
// before dispatch, while the composable still performs the authoritative check.
const DECIMAL_RE = /^\+?\d+(\.\d+)?$/;
const CRON_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const;

export function parsePositiveTargetPrice(raw: string): number | null {
  const text = String(raw ?? "").trim();
  if (!DECIMAL_RE.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseAutomationActionName(raw: string): string | null {
  const text = String(raw ?? "").trim();
  return /^[A-Za-z][A-Za-z0-9_.:-]{1,63}$/.test(text) ? text : null;
}

export function parseFiveFieldCron(raw: string): string | null {
  const text = String(raw ?? "").trim();
  const fields = text.split(/\s+/);
  if (fields.length !== 5) return null;

  const validAtom = (atom: string, min: number, max: number) => {
    const [baseRaw, stepText, ...extra] = atom.split("/");
    const base = baseRaw ?? "";
    if (extra.length > 0) return false;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText)) return false;
      const step = Number(stepText);
      if (!Number.isInteger(step) || step <= 0 || step > max - min + 1) return false;
    }
    if (base === "*") return true;
    const rangeMatch = /^(\d+)-(\d+)$/.exec(base);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      return start >= min && end <= max && start <= end;
    }
    if (stepText !== undefined || !/^\d+$/.test(base)) return false;
    const value = Number(base);
    return value >= min && value <= max;
  };

  const valid = fields.every((field, index) => {
    const range = CRON_RANGES[index];
    if (!range) return false;
    const [min, max] = range;
    const atoms = field.split(",");
    return atoms.length > 0 && atoms.every((atom) => validAtom(atom, min, max));
  });
  return valid ? text : null;
}

export function useAutomationCopilot({ t }: UseAutomationCopilotOptions) {
  const network = getNetwork();
  const integration = EXTERNAL_INTEGRATIONS[network];
  const datafeed = useMorpheusDataFeed({ network });

  const latestPayload = createObservable<Record<string, unknown> | null>(null);
  const latestPrice = createObservable<number | null>(null);
  const priceDataTimestamp = createObservable(0);
  const priceRecordTimestamp = createObservable(0);
  const priceFreshnessState = createObservable<PriceFreshnessState>("unloaded");
  const triggerRequest = createObservable<AutomationTriggerRequest | null>(null);

  const invalidateRecipe = () => {
    triggerRequest.set(null);
    latestPayload.set(null);
  };
  const recipeField = (
    initialValue: string,
    onChanged: () => void = invalidateRecipe,
  ): Observable<string> => {
    const source = createObservable(initialValue);
    return {
      get: source.get,
      set: (next) => {
        const value = String(next ?? "");
        if (value === source.get()) return;
        source.set(value);
        onChanged();
      },
      subscribe: source.subscribe,
    };
  };

  const asset = recipeField("NEO", () => {
    invalidateRecipe();
    latestPrice.set(null);
    priceDataTimestamp.set(0);
    priceRecordTimestamp.set(0);
    priceFreshnessState.set("unloaded");
  });
  const targetPrice = recipeField("20");
  const schedule = recipeField("0 */6 * * *");
  const actionName = recipeField("auto_repay_self_loan");
  const isRequestingRaw = createObservable(false);
  const isRegistering = createObservable(false);
  const isRefreshing = createObservable(false);
  const latestTrigger = createObservable<AutomationTrigger | null>(null);
  const triggers = createObservable<AutomationTrigger[]>([]);
  const triggersLoaded = createObservable(false);
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
      // No trigger yet → return an empty string so the PlayArea status fallback
      // chain resolves to "Ready" (apiIdle) instead of a discouraging "N/A".
      if (!trigger) return "";
      if (trigger.registration_state === "local_automation_intent") return t("handoffPrepared");
      return trigger.enabled ? t("enabled") : t("disabled");
    },
    set: () => {},
    subscribe: (fn) => latestTrigger.subscribe(fn),
  };

  const latestTriggerMode: Observable<string> = {
    get: () => {
      const trigger = latestTrigger.get();
      if (!trigger) return "draft";
      if (trigger.registration_state === "local_automation_intent") return "handoff";
      return trigger.enabled ? "enabled" : "disabled";
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
      const quote = await datafeed.getPriceWithMeta(asset.get());
      if (!Number.isFinite(quote.price) || quote.price <= 0) {
        throw new Error(t("priceInvalid"));
      }
      latestPrice.set(quote.price);
      priceDataTimestamp.set(quote.dataTimestamp);
      priceRecordTimestamp.set(quote.recordTimestamp);
      const freshness = assessPriceFreshness(quote.dataTimestamp);
      priceFreshnessState.set(freshness);
      latestPayload.set({
        kind: "price",
        asset: asset.get(),
        current_price: quote.price,
        data_timestamp: quote.dataTimestamp,
        record_timestamp: quote.recordTimestamp,
        freshness,
        target_price: Number(targetPrice.get() || "0"),
        schedule: schedule.get(),
        action_name: actionName.get(),
        network,
        source: `on-chain MorpheusDataFeed @ ${integration.contracts.morpheusDatafeed}`,
      });
      if (freshness !== "fresh") {
        const message = freshness === "stale" ? t("priceStale") : t("priceFreshnessUnknown");
        lastError.set(message);
        apiStatus.set(message);
        throw new Error(message);
      }
      apiStatus.set(t("priceLoaded"));
      return { success: true };
    } catch (error) {
      const message = formatErrorMessage(error, t("fetchFailed"));
      lastError.set(message);
      if (latestPrice.get() === null) priceFreshnessState.set("unloaded");
      throw error;
    } finally {
      isRequestingRaw.set(false);
    }
  }

  function validateTargetPrice(raw: string): number | null {
    const value = parsePositiveTargetPrice(raw);
    if (value === null) {
      lastError.set(t("targetPriceInvalid"));
      return null;
    }
    return value;
  }

  // A standard 5-field cron expression. Each field is *, a number, a list
  // (a,b), a range (a-b), or a step (*/n or a-b/n) — enough to reject the
  // malformed strings the gateway would otherwise reject server-side.
  function validateSchedule(raw: string): string | null {
    const text = parseFiveFieldCron(raw);
    if (text === null) {
      lastError.set(t("scheduleInvalid"));
      return null;
    }
    return text;
  }

  function validateActionName(raw: string): string | null {
    const text = parseAutomationActionName(raw);
    if (text === null) {
      lastError.set(t("actionNameInvalid"));
      return null;
    }
    return text;
  }

  function buildRecipePayload() {
    lastError.set("");
    if (validateTargetPrice(targetPrice.get()) === null) {
      throw new Error(lastError.get() || t("targetPriceInvalid"));
    }
    if (validateSchedule(schedule.get()) === null) {
      throw new Error(lastError.get() || t("scheduleInvalid"));
    }
    if (validateActionName(actionName.get()) === null) {
      throw new Error(lastError.get() || t("actionNameInvalid"));
    }
    const request = buildAutomationTriggerRequest({
      asset: asset.get(),
      targetPrice: targetPrice.get(),
      schedule: schedule.get(),
      actionName: actionName.get(),
      network,
      datafeedHash: integration.contracts.morpheusDatafeed,
      currentPrice: priceFreshnessState.get() === "fresh" ? latestPrice.get() : null,
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
        price_snapshot_freshness: priceFreshnessState.get(),
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
      if (latestPrice.get() === null) {
        throw new Error(t("priceRequired"));
      }
      if (priceFreshnessState.get() !== "fresh") {
        throw new Error(
          priceFreshnessState.get() === "stale"
            ? t("priceStale")
            : t("priceFreshnessUnknown"),
        );
      }
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
      const message = formatErrorMessage(error, t("triggerFailed"));
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
      if (result.meta.state === "local_automation_unavailable") {
        throw new Error(t("automationGatewayUnavailable"));
      }
      const list = normalizeTriggerList(result.data);
      triggers.set(list);
      triggersLoaded.set(true);
      // Keep selection consistent with the list: clear it when the server
      // returns an empty set so the status card returns to the empty state
      // instead of operating on a trigger that no longer exists.
      latestTrigger.set(list[0] ?? null);
      apiStatus.set(t("triggersLoaded"));
      return list;
    } catch (error) {
      const message = formatErrorMessage(error, t("triggerListFailed"));
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
      if (isLocalAutomationIntent(null, result.meta)) {
        throw new Error(t("automationGatewayUnavailable"));
      }
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
      const message = formatErrorMessage(error, t("triggerStatusFailed"));
      lastError.set(message);
      apiStatus.set(message);
      throw error;
    } finally {
      isRegistering.set(false);
    }
  }

  /** Make a trigger from the list the active (operated) trigger. */
  function selectTrigger(id: string) {
    const match = triggers.get().find((trigger) => trigger.id === id);
    if (match) latestTrigger.set(match);
  }

  /**
   * Delete a verified trigger via the automation-trigger-delete edge function.
   * Local handoff intents (never persisted on the gateway) are dropped from the
   * list without a network call. Keeps the active selection consistent.
   */
  async function deleteTrigger(id: string) {
    if (isRegistering.get()) return;
    const target = triggers.get().find((trigger) => trigger.id === id)
      ?? (latestTrigger.get()?.id === id ? latestTrigger.get() : null);

    const dropLocally = () => {
      const next = triggers.get().filter((trigger) => trigger.id !== id);
      triggers.set(next);
      if (latestTrigger.get()?.id === id) latestTrigger.set(next[0] ?? null);
    };

    // A handoff-only intent was never registered server-side — just drop it.
    if (target && isLocalAutomationIntent(target)) {
      dropLocally();
      apiStatus.set(t("triggerDeleted"));
      return;
    }

    isRegistering.set(true);
    lastError.set("");
    try {
      const result = await callAutomationEndpoint<{ status?: string }>(
        "automation-trigger-delete",
        { method: "POST", body: { id } },
      );
      if (isLocalAutomationIntent(null, result.meta)) {
        throw new Error(t("automationGatewayUnavailable"));
      }
      dropLocally();
      apiStatus.set(t("triggerDeleted"));
    } catch (error) {
      const message = formatErrorMessage(error, t("triggerDeleteFailed"));
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
    priceDataTimestamp,
    priceRecordTimestamp,
    priceFreshnessState,
    triggerRequest,
    latestTrigger,
    triggers,
    triggersLoaded,
    priceDisplay,
    renderedPayload,
    renderedTriggerRequest,
    oracleHash,
    networkDisplay,
    datafeedHash,
    latestTriggerId,
    latestTriggerState,
    latestTriggerMode,
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
    selectTrigger,
    deleteTrigger,
    loadAll,
  };
}
