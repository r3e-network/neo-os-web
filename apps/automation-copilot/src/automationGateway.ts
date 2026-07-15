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

// framework-exempt: auth-header harvesting — reads the platform's own
// session/local-storage credential keys (not app-scoped `neo:<appId>:` data),
// so it must not move to app.storage.local; there is no framework gateway
// client, and moving this partially would drop credentials on every request
// (plan §3.6). This direct read only works when the copilot runs top-level on
// the host origin (the "open in new window" escape hatch, dev, tests); inside
// the embedded iframe the opaque-origin sandbox (audit fix C-4) makes these
// reads throw, and the credential arrives over the host bridge below instead.
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

// Host<->miniapp credential bridge (audit fix C-4 follow-up). The embedded
// copilot iframe lost its allow-same-origin grant, so the host now hands the
// signed-in gateway credential to this one canonical app over postMessage.
// These wire constants must stay identical to the host side
// (platform/host-app/components/playarea/bridge/use-embedded-credential-bridge.ts).
// Exported so apps/shared/test/embedded-bridge-protocol-parity.test.ts pins
// that parity — drift on either side is a test failure.
export const CREDENTIAL_BRIDGE_REQUEST = "neo-miniapp-credential:request";
export const CREDENTIAL_BRIDGE_RESPONSE = "neo-miniapp-credential:response";
export const CREDENTIAL_BRIDGE_PROTOCOL_VERSION = 1;
export const CREDENTIAL_BRIDGE_APP_ID = "miniapp-automation-copilot";
export const CREDENTIAL_BRIDGE_SCOPE = "automation-gateway";
const CREDENTIAL_BRIDGE_TIMEOUT_MS = 1_500;

type BridgeCredential = { token: string; apiKey: string };

type CredentialBridgeResponse = {
  type?: unknown;
  version?: unknown;
  requestId?: unknown;
  ok?: unknown;
  token?: unknown;
  apiKey?: unknown;
};

function isEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.parent) && window.parent !== window;
  } catch {
    return false;
  }
}

function credentialRequestId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the manual id
  }
  return `credential-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function requestHostCredential(
  timeoutMs = CREDENTIAL_BRIDGE_TIMEOUT_MS,
): Promise<BridgeCredential> {
  const empty: BridgeCredential = { token: "", apiKey: "" };
  if (!isEmbedded()) return Promise.resolve(empty);

  // Sandboxed documents keep a URL-derived location.origin even though the
  // document origin is opaque; the host serves miniapps first-party, so the
  // embedding host window lives on exactly that origin.
  let expectedOrigin = "";
  try {
    const origin = window.location.origin;
    if (origin && origin !== "null") expectedOrigin = origin;
  } catch {
    // handled below — no concrete origin means no request is sent
  }
  // Fail closed like the wallet SDK's hostBridgeRequest: without a concrete
  // target origin the request would have to broadcast with "*". The gateway
  // call then simply proceeds unauthenticated, exactly as when no user is
  // signed in.
  if (!expectedOrigin) return Promise.resolve(empty);

  return new Promise<BridgeCredential>((resolve) => {
    const requestId = credentialRequestId();

    let settled = false;
    const settle = (credential: BridgeCredential) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(credential);
    };

    const onMessage = (event: MessageEvent) => {
      // Identity check mirroring the wallet SDK bridge: only the embedding
      // host window may answer. A null/undefined source only occurs for
      // synthetic same-document events (e.g. jsdom test harnesses).
      if (event.source !== window.parent && event.source != null) return;
      // A real, mismatching origin is rejected outright; opaque ("null"/empty)
      // origins fall back to the source identity boundary above.
      if (
        event.origin
        && event.origin !== "null"
        && event.origin !== expectedOrigin
      ) return;
      const data = event.data as CredentialBridgeResponse | null;
      if (
        !data
        || data.type !== CREDENTIAL_BRIDGE_RESPONSE
        || data.version !== CREDENTIAL_BRIDGE_PROTOCOL_VERSION
        || data.requestId !== requestId
      ) return;
      if (data.ok !== true) {
        settle(empty);
        return;
      }
      settle({
        token: typeof data.token === "string" ? data.token.trim() : "",
        apiKey: typeof data.apiKey === "string" ? data.apiKey.trim() : "",
      });
    };

    // Failing to obtain a credential must never block the gateway call.
    const timer = setTimeout(() => settle(empty), timeoutMs);
    window.addEventListener("message", onMessage);
    try {
      window.parent.postMessage(
        {
          type: CREDENTIAL_BRIDGE_REQUEST,
          version: CREDENTIAL_BRIDGE_PROTOCOL_VERSION,
          requestId,
          appId: CREDENTIAL_BRIDGE_APP_ID,
          scope: CREDENTIAL_BRIDGE_SCOPE,
        },
        expectedOrigin,
      );
    } catch {
      settle(empty);
    }
  });
}

// Exported for the gateway test suite: resolves the credential headers the
// same way callAutomationEndpoint does — direct storage read first (top-level
// host-origin contexts), then the host credential bridge when embedded in the
// opaque-origin sandbox where storage is unreachable.
export async function resolveRuntimeCredentialHeaders(
  options: { bridgeTimeoutMs?: number } = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let token = readRuntimeValue(["sb-access-token", "neo_miniapp_auth_jwt"]);
  let apiKey = readRuntimeValue(["neo_miniapp_api_key"]);
  if (!token && !apiKey && isEmbedded()) {
    const credential = await requestHostCredential(options.bridgeTimeoutMs);
    token = credential.token;
    apiKey = credential.apiKey;
  }
  if (token) headers.Authorization = `Bearer ${token}`;
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

// framework-exempt: gateway envelope — the `/api/edge/*` automation gateway
// protocol ({ok,data,meta} unwrapping + credential headers) has no framework
// client surface; migrating the fetch alone would strip the auth headers the
// gateway requires on every request (plan §3.6).
export async function callAutomationEndpoint<T>(
  endpoint: string,
  options: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<AutomationGatewayResult<T>> {
  // Resolve the credential (storage read or host bridge roundtrip) before the
  // gateway timeout starts so a slow bridge cannot eat into the fetch budget.
  const headers = await resolveRuntimeCredentialHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`/api/edge/${endpoint}`, {
      method: options.method ?? "POST",
      headers,
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
