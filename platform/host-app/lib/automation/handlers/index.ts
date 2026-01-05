import type {
  AutomationTask,
  TaskPayload,
  CallApiPayload,
  InvokeContractPayload,
  EmitEventPayload,
  CustomPayload,
} from "@/lib/db/types";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Generic action handlers
async function handleCallApi(payload: CallApiPayload, task: AutomationTask): Promise<Record<string, unknown>> {
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
  // Call Neo RPC to invoke contract
  const rpcUrl = payload.network === "mainnet" ? "https://mainnet1.neo.coz.io:443" : "https://testnet1.neo.coz.io:443";

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [payload.contractHash, payload.method, payload.args || []],
    }),
  });

  const result = await response.json();
  return { rpcResult: result, contractHash: payload.contractHash, method: payload.method };
}

async function handleEmitEvent(payload: EmitEventPayload, task: AutomationTask): Promise<Record<string, unknown>> {
  // Insert event into Supabase for subscribers
  const { error } = await supabase.from("automation_events").insert({
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
