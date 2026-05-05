import type { MiniAppInfo } from "@/components/types";
import { invokeRead, type StackItem } from "@/lib/chain/rpc-client";
import { getPlatformRuntimeModules } from "@/lib/miniapp-runtime";

export type LifecycleNetwork = "mainnet" | "testnet";

export type CountdownLifecycleAction =
  | "healthy"
  | "paused"
  | "start_needed"
  | "rollover_needed";

export type CountdownLifecycleTarget = {
  appId: string;
  contractHash: string;
  network: LifecycleNetwork;
  statusMethod: string;
  maintenanceMethod: string;
};

export type CountdownLifecycleState = Record<string, unknown>;

export type CountdownLifecycleDecision = {
  action: CountdownLifecycleAction;
  reason: string;
};

export type CountdownLifecycleInvoke = {
  scriptHash: string;
  operation: string;
  args: Array<{ type: string; value: string }>;
};

export type CountdownLifecycleResult = {
  appId: string;
  contractHash: string;
  network: LifecycleNetwork;
  state: CountdownLifecycleState;
  decision: CountdownLifecycleDecision;
  invoke: CountdownLifecycleInvoke | null;
};

const COUNTDOWN_BINDING = "countdown-auction";
const COUNTDOWN_MODULE_TYPE = "1";
const DEFAULT_STATUS_METHOD = "getCountdownStatus";
const DEFAULT_MAINTENANCE_METHOD = "checkAndEndCountdownRound";

function networkKey(network: LifecycleNetwork): "neo-n3-mainnet" | "neo-n3-testnet" {
  return network === "mainnet" ? "neo-n3-mainnet" : "neo-n3-testnet";
}

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const raw = asString(value).toLowerCase();
  return raw === "true" || raw === "1";
}

function decodeByteString(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "";
  try {
    const text = Buffer.from(raw, "base64").toString("utf8");
    if (/^[\x20-\x7E\s]*$/.test(text)) return text;
  } catch {
    // Return the raw RPC value when it is not base64 text.
  }
  return raw;
}

function decodeStackValue(item: StackItem | undefined): unknown {
  if (!item) return null;
  switch (item.type) {
    case "Integer":
      return item.value;
    case "Boolean":
      return item.value;
    case "ByteString":
      return decodeByteString(item.value);
    case "Array":
    case "Struct":
      return item.value.map((entry) => decodeStackValue(entry));
    case "Map":
      return Object.fromEntries(
        item.value.map((entry) => [
          asString(decodeStackValue(entry.key)),
          decodeStackValue(entry.value),
        ]),
      );
    default:
      return null;
  }
}

export function decodeCountdownLifecycleState(stack: StackItem[] | undefined): CountdownLifecycleState {
  const decoded = decodeStackValue(stack?.[0]);
  return decoded && typeof decoded === "object" && !Array.isArray(decoded)
    ? (decoded as CountdownLifecycleState)
    : {};
}

function isCountdownModule(module: ReturnType<typeof getPlatformRuntimeModules>[number]): boolean {
  return (
    module.binding === COUNTDOWN_BINDING ||
    (module.platform === "PlatformGame" && asString(module.moduleType) === COUNTDOWN_MODULE_TYPE)
  );
}

function operationName(
  operations: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const value = operations?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function findCountdownLifecycleApps(
  apps: MiniAppInfo[],
  network: LifecycleNetwork,
): CountdownLifecycleTarget[] {
  const key = networkKey(network);
  const targets: CountdownLifecycleTarget[] = [];

  for (const app of apps) {
    for (const module of getPlatformRuntimeModules(app)) {
      if (!isCountdownModule(module)) continue;
      const binding = module.networks[key];
      if (!binding?.registered || !binding.contract_hash) continue;

      targets.push({
        appId: module.appId || app.app_id,
        contractHash: binding.contract_hash,
        network,
        statusMethod: operationName(module.operations, "status", DEFAULT_STATUS_METHOD),
        maintenanceMethod: operationName(module.operations, "rollover", DEFAULT_MAINTENANCE_METHOD),
      });
    }
  }

  return targets;
}

export function classifyCountdownLifecycle(
  state: CountdownLifecycleState,
): CountdownLifecycleDecision {
  if (asBool(state.paused)) {
    return { action: "paused", reason: "countdown app is paused" };
  }

  const roundId = asNumber(state.roundId);
  if (roundId <= 0) {
    return { action: "start_needed", reason: "no countdown round exists" };
  }

  const active = asBool(state.active);
  const status = asString(state.status).toLowerCase();
  const remainingTime = asNumber(state.remainingTime);
  const endTime = asNumber(state.endTime);
  const endTimeExpired = endTime > 0 && endTime < Date.now();

  if (
    active &&
    (status === "ending" || remainingTime <= 0 || endTimeExpired)
  ) {
    return { action: "rollover_needed", reason: "active round timer expired" };
  }

  if (!active) {
    return {
      action: asBool(state.settled) ? "rollover_needed" : "start_needed",
      reason: asBool(state.settled)
        ? "settled round needs the next live round"
        : "inactive round needs lifecycle recovery",
    };
  }

  return { action: "healthy", reason: "countdown round is live" };
}

export function buildCountdownLifecycleInvoke(
  target: CountdownLifecycleTarget,
): CountdownLifecycleInvoke {
  return {
    scriptHash: target.contractHash,
    operation: target.maintenanceMethod,
    args: [{ type: "String", value: target.appId }],
  };
}

export async function readCountdownLifecycleState(
  target: CountdownLifecycleTarget,
): Promise<CountdownLifecycleState> {
  const result = await invokeRead(
    target.contractHash,
    target.statusMethod,
    [{ type: "String", value: target.appId }],
    target.network,
  );
  return decodeCountdownLifecycleState(result.stack);
}

export async function evaluateCountdownLifecycleTarget(
  target: CountdownLifecycleTarget,
): Promise<CountdownLifecycleResult> {
  const state = await readCountdownLifecycleState(target);
  const decision = classifyCountdownLifecycle(state);
  return {
    appId: target.appId,
    contractHash: target.contractHash,
    network: target.network,
    state,
    decision,
    invoke:
      decision.action === "start_needed" || decision.action === "rollover_needed"
        ? buildCountdownLifecycleInvoke(target)
        : null,
  };
}
