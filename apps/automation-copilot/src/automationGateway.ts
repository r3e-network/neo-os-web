export type AutomationTriggerRequest = {
  name: string;
  trigger_type: "threshold" | "interval";
  schedule?: string;
  condition: {
    kind: "price_threshold";
    asset: string;
    operator: "gte";
    target_price: number;
    current_price?: number | null;
    datafeed_contract: string;
    network: string;
  };
  action: {
    type: "morpheus_workflow";
    workflow_id: "automation.upkeep";
    route: "/automation/execute";
    action_name: string;
    app_id: "miniapp-automation-copilot";
    payload: {
      asset: string;
      target_price: number;
      schedule: string;
      network: string;
    };
  };
};

export type AutomationTrigger = {
  id: string;
  name: string;
  trigger_type: string;
  schedule?: string;
  condition?: unknown;
  action?: unknown;
  enabled: boolean;
  created_at: string;
  next_execution?: string;
  last_execution?: string;
  registration_state?: string;
};

export type AutomationGatewayMeta = {
  state?: string;
};

export type AutomationGatewayResult<T> = {
  data: T;
  meta: AutomationGatewayMeta;
};

const DEFAULT_TIMEOUT_MS = 10_000;

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readRuntimeValue(keys: string[]) {
  if (typeof window === "undefined") return "";
  const stores: Storage[] = [];
  try {
    if (window.sessionStorage) stores.push(window.sessionStorage);
  } catch {
    // ignore unavailable storage
  }
  try {
    if (window.localStorage) stores.push(window.localStorage);
  } catch {
    // ignore unavailable storage
  }

  for (const store of stores) {
    for (const key of keys) {
      try {
        const value = store.getItem(key)?.trim();
        if (value) return value;
      } catch {
        // ignore unreadable storage
      }
    }
  }
  return "";
}

function runtimeCredentialHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = readRuntimeValue(["sb-access-token", "neo_miniapp_auth_jwt"]);
  if (token) headers.Authorization = `Bearer ${token}`;
  const apiKey = readRuntimeValue(["neo_miniapp_api_key"]);
  if (apiKey && !headers.Authorization) headers["X-API-Key"] = apiKey;
  return headers;
}

function parseErrorPayload(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  return clean(record.message, clean(record.error, fallback));
}

function normalizeGatewayPayload<T>(payload: unknown): AutomationGatewayResult<T> {
  if (payload && typeof payload === "object" && "ok" in payload && "data" in payload) {
    const record = payload as { data: T; meta?: AutomationGatewayMeta };
    return {
      data: record.data,
      meta: record.meta ?? {},
    };
  }
  return {
    data: payload as T,
    meta: {},
  };
}

export function buildAutomationTriggerRequest(input: {
  asset: string;
  targetPrice: string;
  schedule: string;
  actionName: string;
  network: string;
  datafeedHash: string;
  currentPrice?: number | null;
}): AutomationTriggerRequest {
  const asset = clean(input.asset, "NEO").toUpperCase();
  const schedule = clean(input.schedule, "0 */6 * * *");
  const actionName = clean(input.actionName, "auto_repay_self_loan");
  const targetPrice = readNumber(input.targetPrice, 0);
  return {
    name: `${asset} ${targetPrice || "price"} ${actionName}`,
    trigger_type: "threshold",
    schedule,
    condition: {
      kind: "price_threshold",
      asset,
      operator: "gte",
      target_price: targetPrice,
      current_price: input.currentPrice ?? null,
      datafeed_contract: clean(input.datafeedHash),
      network: clean(input.network, "mainnet"),
    },
    action: {
      type: "morpheus_workflow",
      workflow_id: "automation.upkeep",
      route: "/automation/execute",
      action_name: actionName,
      app_id: "miniapp-automation-copilot",
      payload: {
        asset,
        target_price: targetPrice,
        schedule,
        network: clean(input.network, "mainnet"),
      },
    },
  };
}

export async function callAutomationEndpoint<T>(
  endpoint: string,
  options: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<AutomationGatewayResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`/api/edge/${endpoint}`, {
      method: options.method ?? "POST",
      headers: runtimeCredentialHeaders(),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text
      ? JSON.parse(text) as unknown
      : null;

    if (!response.ok) {
      throw new Error(parseErrorPayload(payload, `Automation gateway returned ${response.status}`));
    }

    return normalizeGatewayPayload<T>(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Automation gateway timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeTrigger(value: unknown): AutomationTrigger | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = clean(record.id);
  if (!id) return null;
  return {
    id,
    name: clean(record.name, id),
    trigger_type: clean(record.trigger_type, "threshold"),
    schedule: clean(record.schedule),
    condition: record.condition,
    action: record.action,
    enabled: Boolean(record.enabled),
    created_at: clean(record.created_at, new Date().toISOString()),
    next_execution: clean(record.next_execution),
    last_execution: clean(record.last_execution),
    registration_state: clean(record.registration_state),
  };
}

export function normalizeTriggerList(value: unknown): AutomationTrigger[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).triggers)
      ? (value as { triggers: unknown[] }).triggers
      : [];
  return list.map(normalizeTrigger).filter(Boolean) as AutomationTrigger[];
}

export function mergeTrigger(list: AutomationTrigger[], trigger: AutomationTrigger) {
  const without = list.filter((item) => item.id !== trigger.id);
  return [trigger, ...without];
}

export function isLocalAutomationIntent(
  trigger?: Pick<AutomationTrigger, "registration_state"> | null,
  meta?: AutomationGatewayMeta,
) {
  return (
    trigger?.registration_state === "local_automation_intent" ||
    meta?.state === "local_automation_intent"
  );
}
