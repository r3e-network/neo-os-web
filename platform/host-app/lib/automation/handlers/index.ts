import type {
  AutomationTask,
  TaskPayload,
  CallApiPayload,
  InvokeContractPayload,
  EmitEventPayload,
  CustomPayload,
} from "@/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { getChainRpcUrl } from "@/lib/chains/rpc-functions";
import type { ChainId } from "@/lib/chains/types";

// SSRF prevention: validate URLs before server-side fetch
function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Only allow HTTPS
  if (parsed.protocol !== "https:") {
    throw new Error(`Only HTTPS URLs are allowed, got: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::1]") {
    throw new Error(`Requests to localhost are not allowed`);
  }

  // Block private/reserved IP ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    const isPrivate =
      a === 127 || // 127.0.0.0/8 loopback
      a === 10 || // 10.0.0.0/8 private
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
      (a === 192 && b === 168) || // 192.168.0.0/16 private
      (a === 169 && b === 254) || // 169.254.0.0/16 link-local
      a === 0; // 0.0.0.0/8

    if (isPrivate) {
      throw new Error(`Requests to private IP addresses are not allowed: ${hostname}`);
    }
  }
}

// Lazy initialization to avoid errors when env vars are not set
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase configuration missing for automation handlers");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Generic action handlers
async function handleCallApi(payload: CallApiPayload, task: AutomationTask): Promise<Record<string, unknown>> {
  validateUrl(payload.url);

  const response = await fetch(payload.url, {
    method: payload.method || "POST",
    headers: {
      "Content-Type": "application/json",
      "X-App-Id": task.app_id,
      "X-Task-Id": task.id,
      ...payload.headers,
    },
    body: payload.body ? JSON.stringify(payload.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

async function handleInvokeContract(
  payload: InvokeContractPayload,
  task: AutomationTask,
): Promise<Record<string, unknown>> {
  // chainId is required in payload
  if (!payload.chainId) {
    throw new Error(`chainId is required for invoke-contract action (task: ${task.task_name})`);
  }

  const chainId: ChainId = payload.chainId;
  const rpcUrl = getChainRpcUrl(chainId);

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [payload.contractAddress, payload.method, payload.args || []],
    }),
  });

  const result = await response.json();
  return { rpcResult: result, contractAddress: payload.contractAddress, method: payload.method, chainId };
}

async function handleEmitEvent(payload: EmitEventPayload, task: AutomationTask): Promise<Record<string, unknown>> {
  // Insert event into Supabase for subscribers
  const { error } = await getSupabase().from("automation_events").insert({
    app_id: task.app_id,
    task_id: task.id,
    event_name: payload.eventName,
    event_data: payload.eventData,
  });

  if (error) throw error;
  return { emitted: true, eventName: payload.eventName };
}

// Custom handler registry - receives payload.data from CustomPayload
type CustomHandler = (data: Record<string, unknown>, task: AutomationTask) => Promise<Record<string, unknown>>;

const customHandlers: Record<string, CustomHandler> = {
  "lottery:draw": async (data) => ({ drawn: true, round: data.round }),
  "compound:autoCompound": async (data, task) => ({ compounded: true, appId: task.app_id }),
  "timeCapsule:unlock": async (data) => ({ unlocked: true, capsuleId: data.capsuleId }),
  "heritage:checkInactivity": async (data) => ({ checked: true, trustId: data.trustId }),
  "garden:plantGrowth": async (data, task) => ({ grown: true, appId: task.app_id }),
  "doomsday:settlement": async (data, task) => ({ settled: true, appId: task.app_id }),
};

async function handleCustom(payload: CustomPayload, task: AutomationTask): Promise<Record<string, unknown>> {
  const handler = customHandlers[payload.handler];
  if (!handler) {
    throw new Error(`Unknown custom handler: ${payload.handler}`);
  }
  return handler(payload.data || {}, task);
}

// Main task handler - routes based on payload.action
export async function handleTask(task: AutomationTask): Promise<Record<string, unknown>> {
  const payload = task.payload as TaskPayload | Record<string, unknown>;

  // Route based on action type
  if (payload && "action" in payload) {
    switch ((payload as TaskPayload).action) {
      case "call-api":
        return handleCallApi(payload as CallApiPayload, task);
      case "invoke-contract":
        return handleInvokeContract(payload as InvokeContractPayload, task);
      case "emit-event":
        return handleEmitEvent(payload as EmitEventPayload, task);
      case "custom":
        return handleCustom(payload as CustomPayload, task);
    }
  }

  // Fallback: legacy handler lookup by app_id:task_name
  const handlerKey = `${task.app_id.replace("miniapp-", "")}:${task.task_name}`;
  const legacyHandler = customHandlers[handlerKey] || customHandlers[task.task_name];

  if (legacyHandler) {
    return legacyHandler(payload as Record<string, unknown>, task);
  }

  throw new Error(
    `No handler for task: ${task.task_name} (action: ${(payload as Record<string, unknown>)?.action || "none"})`,
  );
}
