import type { MiniAppLaunchContext } from "../types";
import { getRpcNetwork } from "@/lib/rpc-helpers";

/* ── RPC helpers ─────────────────────────────────────────────────────── */

export async function invokeRead(
  _rpcUrl: string,
  contractHash: string,
  method: string,
  params: Array<{ type: string; value: string }> = [],
  network: "mainnet" | "testnet" = getRpcNetwork(),
): Promise<unknown[]> {
  const resp = await fetch("/api/rpc/neo-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractHash, method, params, network }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await resp.json();
  if (data?.result?.state !== "HALT") return [];
  return data.result.stack || [];
}

export type StackItem = { type: string; value: unknown };

function decodeByteLike(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!value) return "";
  try {
    const bin = atob(value);
    let printable = true;
    for (let i = 0; i < bin.length; i += 1) {
      const code = bin.charCodeAt(i);
      if (
        code !== 9 &&
        code !== 10 &&
        code !== 13 &&
        (code < 32 || code > 126)
      ) {
        printable = false;
        break;
      }
    }
    if (printable) return bin;
    let hex = "";
    for (let i = 0; i < bin.length; i += 1) {
      hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex.length ? `0x${hex}` : "";
  } catch {
    return value;
  }
}

function decodeStackValue(item: StackItem | undefined): unknown {
  if (!item) return undefined;
  if (
    item.type === "ByteString" ||
    item.type === "ByteArray" ||
    item.type === "Buffer"
  ) {
    return decodeByteLike(item.value);
  }
  if (item.type === "Boolean") return Boolean(item.value);
  return item.value;
}

export function stackInt(stack: unknown[], index = 0): number {
  const item = (stack as StackItem[])[index];
  if (!item) return 0;
  return parseInt(String(item.value || "0"), 10);
}

export function stackBool(stack: unknown[], index = 0): boolean {
  const item = (stack as StackItem[])[index];
  if (!item) return false;
  if (item.type === "Boolean") return Boolean(item.value);
  return String(item.value || "0") !== "0";
}

export function stackItemBool(item: StackItem | undefined): boolean {
  if (!item) return false;
  if (item.type === "Boolean") return Boolean(item.value);
  return String(item.value || "0") !== "0";
}

export function stackArray(stack: unknown[], index = 0): StackItem[] {
  const item = (stack as StackItem[])[index];
  if (!item || (item.type !== "Struct" && item.type !== "Array")) return [];
  return Array.isArray(item.value) ? (item.value as StackItem[]) : [];
}

export function decodeMap(
  stack: unknown[],
  index = 0,
): Record<string, unknown> {
  const item = (stack as StackItem[])[index];
  if (!item || item.type !== "Map") return {};
  const out: Record<string, unknown> = {};
  for (const kv of (item.value as Array<{
    key: StackItem;
    value: StackItem;
  }>) || []) {
    const decodedKey = decodeStackValue(kv.key);
    const key = String(decodedKey || "");
    out[key] = decodeStackValue(kv.value);
    (out as Record<string, unknown>)[`__type__${key}`] = kv.value?.type;
  }
  return out;
}

export function fmtGas(units: number | string | undefined): string {
  const n = typeof units === "string" ? parseInt(units, 10) : (units ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return (n / 100000000).toFixed(2);
}

export function fmtAddr(b64OrHex: string | undefined): string {
  if (!b64OrHex) return "—";
  if (b64OrHex.startsWith("0x") && b64OrHex.length === 42)
    return `${b64OrHex.slice(0, 6)}…${b64OrHex.slice(-4)}`;
  // base64 hash160 → render as 0x-prefixed scripthash (first6…last4)
  try {
    const bin = atob(b64OrHex);
    if (bin.length === 20) {
      let hex = "";
      for (let i = 0; i < bin.length; i++)
        hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
      return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
    }
  } catch {
    /* fall through */
  }
  return `${b64OrHex.slice(0, 8)}…${b64OrHex.slice(-4)}`;
}

export function resolveAnchorAppId(
  appId: string,
  launchContext?: MiniAppLaunchContext | null,
): string | null {
  if (
    appId === "miniapp-profitanchor" ||
    appId === "miniapp-profitanchor-admin"
  ) {
    return "miniapp-profitanchor";
  }
  if (
    appId === "miniapp-trustanchor" ||
    appId === "miniapp-trustanchor-admin"
  ) {
    return "miniapp-trustanchor";
  }
  if (appId === "miniapp-custom-anchor") {
    return (
      launchContext?.params.anchorAppId ||
      launchContext?.params.anchor ||
      launchContext?.params.appId ||
      null
    );
  }
  return null;
}

export function isZeroAddr(b64: string | undefined): boolean {
  if (!b64) return true;
  if (b64 === "0x0000000000000000000000000000000000000000") return true;
  try {
    const bin = atob(b64);
    if (bin.length !== 20) return false;
    for (let i = 0; i < bin.length; i++)
      if (bin.charCodeAt(i) !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

export function isCouncilProposalActive(map: Record<string, unknown>): boolean {
  const status = parseInt(String(map.status ?? "0"), 10);
  const statusText = String(map.statusString || "").toLowerCase();
  const expiryTime = parseInt(String(map.expiryTime ?? "0"), 10);
  const expiryMs =
    expiryTime > 0 && expiryTime < 10_000_000_000
      ? expiryTime * 1000
      : expiryTime;
  if (statusText.includes("active")) {
    return expiryMs <= 0 || expiryMs > Date.now();
  }
  return status === 1 && (expiryMs <= 0 || expiryMs > Date.now());
}

export const LAST_SURVIVOR_ROLLOVER_LABEL = "Rollover Ready";

export function fmtCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0)
    return LAST_SURVIVOR_ROLLOVER_LABEL;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function timeAgo(msTimestamp: number): string {
  if (!Number.isFinite(msTimestamp) || msTimestamp <= 0) return "—";
  const diff = Date.now() - msTimestamp;
  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export const LAST_SURVIVOR_APP_ID = "miniapp-last-survivor";
