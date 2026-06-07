import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  Radio,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import type { MiniAppInfo, MiniAppLaunchContext } from "@/components/types";
import { getLaunchParam } from "@/lib/miniapp-launch-params";
import { resolveMiniAppSlug } from "@/lib/miniapp-media";
import { getWalletAdapter, useWalletStore } from "@/lib/wallet/store";
import type { InvokeParams, WalletAdapter } from "@/lib/wallet/adapters";

export type PlayMetric = { label: string; value: string; accent?: boolean };
export type ActivityRow = {
  icon: string;
  primary: string;
  secondary?: string;
  amount?: string;
  accent?: boolean;
};
export type PlayActivity = {
  title: string;
  rows: ActivityRow[];
  emptyText?: string;
};

export type PlayAreaRegistryProps = {
  app: MiniAppInfo;
  stats: PlayMetric[];
  statsMap: Record<string, string>;
  activity: PlayActivity | null;
  loading: boolean;
  error: string | null;
  contractHash: string | null;
  network: "mainnet" | "testnet";
  launchContext?: MiniAppLaunchContext | null;
  onRefresh: () => void;
};

export type PlayAreaComponent = (props: PlayAreaRegistryProps) => JSX.Element;
export type NativePlayAreaKind = "custom" | "oracle" | "profiled";

const EMBEDDED_DAPP_SETTLE_MS = 800;
const HOST_WALLET_BRIDGE_REQUEST = "neo-miniapp-wallet-bridge:request";
const HOST_WALLET_BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
export const HOST_WALLET_BRIDGE_RESULT =
  "neo-miniapp-wallet-bridge:result";
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;
const NEO_ASSET_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_ASSET_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export type PlayTone =
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "sky"
  | "slate";

export function getMetric(
  stats: Record<string, string>,
  label: string,
  fallback = "0",
) {
  return stats[label] || fallback;
}

export function buildEmbeddedDappUrl(
  app: MiniAppInfo,
  network: "mainnet" | "testnet",
  launchContext?: MiniAppLaunchContext | null,
) {
  const slug = resolveMiniAppSlug(app.app_id, app.dapp_url || app.entry_url);
  const base =
    app.dapp_url ||
    (app.entry_url && app.entry_url.startsWith("/")
      ? app.entry_url
      : `/miniapps/${slug}/index.html`);
  const params = new URLSearchParams();
  params.set("network", network);
  // "embed" tells the standalone dApp shell to render in minimal mode
  // (no internal sidebar/tabs/stats) since the platform iframe already
  // provides the surrounding chrome — see MiniAppRoot.standaloneDappMode.
  params.set("source", "embed");
  if (launchContext?.operation)
    params.set("operation", launchContext.operation);
  if (launchContext?.tab) params.set("tab", launchContext.tab);
  for (const [key, value] of Object.entries(launchContext?.params || {})) {
    if (!params.has(key)) params.set(key, value);
  }
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${params.toString()}`;
}

type BridgeRecord = Record<string, unknown>;
type BridgeRequest = {
  type?: unknown;
  id?: unknown;
  method?: unknown;
  payload?: unknown;
};
export type EmbeddedWalletBridgeResultDetail = {
  appId: string;
  network: "mainnet" | "testnet";
  requestMethod: string;
  txid: string;
  operation: string;
  contractHash: string;
  memo: string;
  at: string;
};
type BridgeInvocation = {
  hash?: unknown;
  scriptHash?: unknown;
  contractHash?: unknown;
  operation?: unknown;
  method?: unknown;
  args?: unknown;
};
type BridgeSigner = {
  account?: unknown;
  scopes?: unknown;
  allowedContracts?: unknown;
  allowedcontracts?: unknown;
  allowedGroups?: unknown;
  rules?: unknown;
};
type SendCapableWalletAdapter = WalletAdapter & {
  send?: (
    asset: string,
    amount: string | number,
    to: string,
    from?: string,
  ) => Promise<{ txid?: string; hash?: string; tx?: string }>;
};

function isBridgeRecord(value: unknown): value is BridgeRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asBridgeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bridgeNetworkMagic(network: "mainnet" | "testnet") {
  return network === "mainnet" ? MAINNET_MAGIC : TESTNET_MAGIC;
}

function networkFromEmbeddedUrl(
  url: string,
  fallback: "mainnet" | "testnet" = "testnet",
) {
  try {
    const parsed = new URL(url, "http://localhost");
    const raw = (parsed.searchParams.get("network") || "").toLowerCase();
    if (raw.includes("mainnet")) return "mainnet";
    if (raw.includes("testnet")) return "testnet";
  } catch {
    // Keep the explicit fallback.
  }
  return fallback;
}

function normalizeBridgeScope(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "CalledByEntry").trim();
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  const scopeMap: Record<string, number> = {
    none: 0,
    calledbyentry: 1,
    customcontracts: 16,
    customgroups: 32,
    rules: 64,
    witnessrules: 64,
    global: 128,
  };
  const parts = raw
    .split(",")
    .map((part) => scopeMap[part.trim().toLowerCase()])
    .filter((scope): scope is number => typeof scope === "number");
  return parts.length ? parts.reduce((acc, scope) => acc | scope, 0) : 1;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.map((entry) => asBridgeString(entry)).filter(Boolean);
  return entries.length ? entries : undefined;
}

function normalizeBridgeSigners(value: unknown): InvokeParams["signers"] {
  if (!Array.isArray(value)) return undefined;
  const signers = value
    .filter(isBridgeRecord)
    .map((entry: BridgeSigner) => {
      const account = asBridgeString(entry.account);
      if (!account) return null;
      const allowedContracts = stringArray(
        entry.allowedContracts ?? entry.allowedcontracts,
      );
      const allowedGroups = stringArray(entry.allowedGroups);
      return {
        account,
        scopes: normalizeBridgeScope(entry.scopes),
        ...(allowedContracts ? { allowedContracts } : {}),
        ...(allowedGroups ? { allowedGroups } : {}),
      };
    })
    .filter(
      (
        signer,
      ): signer is NonNullable<InvokeParams["signers"]>[number] =>
        Boolean(signer),
    );
  return signers.length ? signers : undefined;
}

function firstBridgeInvocation(payload: unknown): BridgeInvocation | null {
  if (!isBridgeRecord(payload)) return null;
  const invocations = Array.isArray(payload.invocations)
    ? payload.invocations.filter(isBridgeRecord)
    : [];
  if (isBridgeRecord(invocations[0])) {
    return invocations[0] as BridgeInvocation;
  }
  const invocation = payload.invocation;
  return isBridgeRecord(invocation) ? (invocation as BridgeInvocation) : null;
}

function bridgeResultTxId(result: unknown): string {
  if (!isBridgeRecord(result)) return "";
  return asBridgeString(result.txid) ||
    asBridgeString(result.hash) ||
    asBridgeString(result.tx);
}

function bridgeInvocationMemo(invocation: BridgeInvocation | null): string {
  const args = Array.isArray(invocation?.args) ? invocation.args : [];
  const stringArgs = args
    .filter(isBridgeRecord)
    .map((arg) => asBridgeString(arg.value))
    .filter(Boolean);
  return (
    stringArgs.find((value) => value.includes("miniapp-")) ||
    stringArgs[stringArgs.length - 1] ||
    ""
  );
}

export function buildEmbeddedWalletBridgeResultDetail({
  appId,
  network,
  requestMethod,
  payload,
  result,
}: {
  appId: string;
  network: "mainnet" | "testnet";
  requestMethod: string;
  payload: unknown;
  result: unknown;
}): EmbeddedWalletBridgeResultDetail {
  const invocation = firstBridgeInvocation(payload);
  return {
    appId,
    network,
    requestMethod,
    txid: bridgeResultTxId(result),
    operation: normalizeBridgeOperation(
      invocation?.operation ?? invocation?.method,
    ),
    contractHash: asBridgeString(
      invocation?.hash ?? invocation?.scriptHash ?? invocation?.contractHash,
    ),
    memo: bridgeInvocationMemo(invocation),
    at: new Date().toISOString(),
  };
}

function normalizeBridgeArgs(value: unknown): InvokeParams["args"] {
  if (!Array.isArray(value)) return [];
  return value.filter(isBridgeRecord).map((entry) => ({
    type: asBridgeString(entry.type) || "String",
    value: entry.value,
  }));
}

// OS service intents encode the caller as a "SENDER" placeholder (or a zero
// hash) since the edge function doesn't know the connected address. Resolve it
// to the wallet address before signing so the transfer/invoke is valid.
const SENDER_PLACEHOLDERS = new Set([
  "sender",
  "{{sender}}",
  "{sender}",
  "0x0000000000000000000000000000000000000000",
  "",
]);
function resolveSenderArgs(params: InvokeParams, address: string): InvokeParams {
  if (!address) return params;
  return {
    ...params,
    args: params.args.map((a) =>
      String(a.type).toLowerCase() === "hash160" &&
      typeof a.value === "string" &&
      SENDER_PLACEHOLDERS.has(a.value.trim().toLowerCase())
        ? { ...a, value: address }
        : a,
    ),
  };
}

function normalizeBridgeOperation(value: unknown): string {
  const operation = asBridgeString(value);
  const canonicalKernelMethods: Record<string, string> = {
    ConfigureMiniApp: "configureMiniApp",
    DeleteMiniAppState: "deleteMiniAppState",
    FulfillRequest: "fulfillRequest",
    GetMiniApp: "getMiniApp",
    GetMiniAppState: "getMiniAppState",
    GrantModuleToMiniApp: "grantModuleToMiniApp",
    PutMiniAppState: "putMiniAppState",
    PutMiniAppStateBatch: "putMiniAppStateBatch",
    RegisterMiniApp: "registerMiniApp",
    RevokeModuleFromMiniApp: "revokeModuleFromMiniApp",
    SubmitMiniAppRequest: "submitMiniAppRequest",
    configureMiniApp: "configureMiniApp",
    deleteMiniAppState: "deleteMiniAppState",
    fulfillRequest: "fulfillRequest",
    getMiniApp: "getMiniApp",
    getMiniAppState: "getMiniAppState",
    grantModuleToMiniApp: "grantModuleToMiniApp",
    putMiniAppState: "putMiniAppState",
    putMiniAppStateBatch: "putMiniAppStateBatch",
    registerMiniApp: "registerMiniApp",
    revokeModuleFromMiniApp: "revokeModuleFromMiniApp",
    submitMiniAppRequest: "submitMiniAppRequest",
    updateMiniApp: "configureMiniApp",
  };
  return canonicalKernelMethods[operation] ?? operation;
}

function bridgeInvocationToParams(
  invocation: BridgeInvocation,
  signers?: InvokeParams["signers"],
): InvokeParams {
  const scriptHash = asBridgeString(
    invocation.hash ?? invocation.scriptHash ?? invocation.contractHash,
  );
  const operation = normalizeBridgeOperation(
    invocation.operation ?? invocation.method,
  );
  if (!scriptHash) throw new Error("Embedded wallet request is missing script hash.");
  if (!operation) throw new Error("Embedded wallet request is missing operation.");
  return {
    scriptHash,
    operation,
    args: normalizeBridgeArgs(invocation.args),
    ...(signers ? { signers } : {}),
  };
}

function requireBridgeWallet(targetNetwork: "mainnet" | "testnet") {
  const walletState = useWalletStore.getState();
  const adapter = getWalletAdapter();
  if (!walletState.connected || !walletState.address || !adapter) {
    throw new Error(
      "Connect wallet from the top navigation before submitting embedded dApp actions.",
    );
  }
  if (walletState.network && walletState.network !== targetNetwork) {
    throw new Error(
      `Wallet is on ${walletState.network} but this embedded dApp targets ${targetNetwork}.`,
    );
  }
  return { walletState, adapter };
}

async function invokeBridgeRead(
  invocation: BridgeInvocation,
  targetNetwork: "mainnet" | "testnet",
) {
  const params = bridgeInvocationToParams(invocation);
  const response = await fetch("/api/rpc/neo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      network: targetNetwork,
      method: "invokefunction",
      params: [params.scriptHash, params.operation, params.args],
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { result?: unknown; error?: unknown }
    | null;
  if (!response.ok || payload?.error) {
    const message = isBridgeRecord(payload?.error)
      ? asBridgeString(payload?.error.message)
      : asBridgeString(payload?.error);
    throw new Error(message || "Embedded dApp read failed.");
  }
  return payload?.result ?? payload;
}

// Audit fix (frontend bridge hardening): wallet methods that sign or move funds must not run
// silently on a miniapp's request. These require an explicit user confirmation in the host.
const SENSITIVE_BRIDGE_METHODS = new Set(["signMessage", "invoke", "send"]);

function describeSensitiveBridgeOperation(method: string, payload: unknown): string {
  const rec = isBridgeRecord(payload) ? payload : {};
  if (method === "send") {
    const amount = asBridgeString(rec.amount) || "?";
    const asset = asBridgeString(rec.asset) || "?";
    const to = asBridgeString(rec.to) || "?";
    return `send ${amount} ${asset} to ${to}`;
  }
  if (method === "signMessage") {
    const msg = asBridgeString(rec.message);
    const preview = msg.length > 120 ? `${msg.slice(0, 120)}…` : msg;
    return `sign a message:\n\n"${preview}"`;
  }
  if (method === "invoke") {
    const invocations = Array.isArray(rec.invocations)
      ? rec.invocations.filter(isBridgeRecord)
      : [];
    const ops = invocations
      .map((inv) => {
        const scriptHash =
          asBridgeString(inv.scriptHash) || asBridgeString(inv.contract) || "?";
        const op = asBridgeString(inv.operation) || asBridgeString(inv.method) || "?";
        return `${op} @ ${scriptHash}`;
      })
      .join(", ");
    return `submit a transaction (${ops || "no operations"})`;
  }
  return method;
}

function confirmSensitiveBridgeOperation(
  appId: string,
  method: string,
  payload: unknown,
): boolean {
  // Runs only client-side (invoked from a message handler), but fail closed if no
  // confirmation primitive is available rather than approving a fund-moving op silently.
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  const description = describeSensitiveBridgeOperation(method, payload);
  return window.confirm(
    `"${appId}" is asking your wallet to ${description}.\n\nApprove this request?`,
  );
}

async function handleEmbeddedWalletBridgeRequest(
  method: string,
  payload: unknown,
  targetNetwork: "mainnet" | "testnet",
) {
  if (method === "call") {
    const invocation = isBridgeRecord(payload)
      ? (payload.invocation as BridgeInvocation)
      : null;
    if (!isBridgeRecord(invocation)) {
      throw new Error("Embedded dApp read request is missing invocation.");
    }
    return invokeBridgeRead(invocation, targetNetwork);
  }

  const { walletState, adapter } = requireBridgeWallet(targetNetwork);
  if (method === "getAccounts") {
    return [
      {
        hash: walletState.address,
        address: walletState.address,
        label: "Host wallet",
        isDefault: true,
      },
    ];
  }
  if (method === "authenticate") {
    return {
      network: bridgeNetworkMagic(targetNetwork),
      address: walletState.address,
      pubkey: walletState.publicKey || undefined,
    };
  }
  if (method === "getBalance") {
    const balance = await adapter.getBalance(walletState.address);
    const asset = asBridgeString(isBridgeRecord(payload) ? payload.asset : "");
    if (asset === "NEO" || asset.toLowerCase() === NEO_ASSET_HASH) return balance.neo;
    if (asset === "GAS" || asset.toLowerCase() === GAS_ASSET_HASH) return balance.gas;
    return { [NEO_ASSET_HASH]: balance.neo, [GAS_ASSET_HASH]: balance.gas };
  }
  if (method === "signMessage") {
    const message = asBridgeString(isBridgeRecord(payload) ? payload.message : "");
    return adapter.signMessage(message);
  }
  if (method === "invoke") {
    const invocations = isBridgeRecord(payload) && Array.isArray(payload.invocations)
      ? payload.invocations.filter(isBridgeRecord)
      : [];
    if (!invocations.length) {
      throw new Error("Embedded dApp wallet request has no invocations.");
    }
    const signers = normalizeBridgeSigners(
      isBridgeRecord(payload) ? payload.signers : undefined,
    );
    const params = invocations.map((invocation) =>
      resolveSenderArgs(bridgeInvocationToParams(invocation, signers), walletState.address),
    );
    if (params.length > 1) {
      if (!adapter.invokeMultiple) {
        throw new Error("Connected wallet does not support batched embedded dApp invokes.");
      }
      return adapter.invokeMultiple(params, signers);
    }
    return adapter.invoke(params[0]!);
  }
  if (method === "send") {
    const sendAdapter = adapter as SendCapableWalletAdapter;
    if (!sendAdapter.send || !isBridgeRecord(payload)) {
      throw new Error("Connected wallet does not support embedded dApp transfers.");
    }
    const asset = asBridgeString(payload.asset);
    const amount = asBridgeString(payload.amount);
    const to = asBridgeString(payload.to);
    const from = asBridgeString(payload.from) || undefined;
    if (!asset || !amount || !to) {
      throw new Error("Embedded dApp transfer request is incomplete.");
    }
    return sendAdapter.send(asset, amount, to, from);
  }
  throw new Error(`Unsupported embedded wallet method: ${method}`);
}

export function useEmbeddedWalletBridge({
  appId,
  iframeRef,
  network,
}: {
  appId: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  network: "mainnet" | "testnet";
}) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      const frameWindow = frame?.contentWindow;
      // Identity check: the message must originate from this exact embedded frame's window.
      if (!frameWindow || event.source !== frameWindow) return;

      // Audit fix (origin hardening): additionally allowlist the sender origin against the
      // frame's own src origin. Miniapps are first-party (served same-origin), so a legitimate
      // message's origin equals the frame origin; anything else is rejected.
      let expectedOrigin = window.location.origin;
      try {
        expectedOrigin = new URL(frame!.src, window.location.href).origin;
      } catch {
        expectedOrigin = window.location.origin;
      }
      if (event.origin !== expectedOrigin) return;

      const data = event.data as BridgeRequest;
      if (!isBridgeRecord(data) || data.type !== HOST_WALLET_BRIDGE_REQUEST) return;
      const id = asBridgeString(data.id);
      const method = asBridgeString(data.method);
      if (!id || !method) return;

      const reply = (response: BridgeRecord) => {
        // Reply only to the expected origin (was "*"), so a response carrying a signature/txid
        // cannot leak if the frame is ever navigated cross-origin.
        frameWindow.postMessage(
          {
            type: HOST_WALLET_BRIDGE_RESPONSE,
            id,
            appId,
            ...response,
          },
          expectedOrigin,
        );
      };

      // Audit fix (confirmation hardening): require explicit user approval before any signing
      // or fund-moving wallet operation requested by the embedded miniapp.
      if (
        SENSITIVE_BRIDGE_METHODS.has(method) &&
        !confirmSensitiveBridgeOperation(appId, method, data.payload)
      ) {
        reply({ ok: false, error: { message: "User rejected the request." } });
        return;
      }

      void handleEmbeddedWalletBridgeRequest(method, data.payload, network)
        .then((result) => {
          const detail = buildEmbeddedWalletBridgeResultDetail({
            appId,
            network,
            requestMethod: method,
            payload: data.payload,
            result,
          });
          if (detail.txid) {
            window.dispatchEvent(
              new CustomEvent(HOST_WALLET_BRIDGE_RESULT, { detail }),
            );
          }
          reply({ ok: true, result });
        })
        .catch((error: unknown) =>
          reply({
            ok: false,
            error: {
              message:
                error instanceof Error ? error.message : String(error),
            },
          }),
        );
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appId, iframeRef, network]);
}

export function statsMapFromStats(stats: PlayMetric[]): Record<string, string> {
  return Object.fromEntries(stats.map((item) => [item.label, item.value]));
}

export function parseGas(value: string): number {
  const match = String(value || "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

export function parseNumericMetric(value: string): number {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatGas(value: number) {
  if (!Number.isFinite(value)) return "0.00 GAS";
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

export function useLaunchParamState(
  launchContext: MiniAppLaunchContext | null | undefined,
  keys: string | string[],
  fallback = "",
) {
  const initial = getLaunchParam(launchContext, keys, fallback);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, launchContext?.signature]);

  return [value, setValue] as const;
}

export function useLaunchChoiceState<T extends string>(
  launchContext: MiniAppLaunchContext | null | undefined,
  keys: string | string[],
  options: readonly T[],
  fallback: T,
) {
  const raw = getLaunchParam(launchContext, keys, fallback);
  const initial = options.includes(raw as T) ? (raw as T) : fallback;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, launchContext?.signature]);

  return [value, setValue] as const;
}

export function shortHash(value?: string | null) {
  if (!value) return "shared runtime";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

const TONE_STYLES: Record<
  PlayTone,
  {
    accent: string;
    soft: string;
    active: string;
    text: string;
    ring: string;
  }
> = {
  emerald: {
    accent: "bg-emerald-500",
    soft: "bg-emerald-50",
    active: "border-emerald-500 bg-emerald-50 text-emerald-950",
    text: "text-emerald-700",
    ring: "focus-visible:ring-neo/40",
  },
  violet: {
    accent: "bg-violet-500",
    soft: "bg-violet-50",
    active: "border-violet-500 bg-violet-50 text-violet-950",
    text: "text-violet-700",
    ring: "focus-visible:ring-violet-400/40",
  },
  amber: {
    accent: "bg-amber-500",
    soft: "bg-amber-50",
    active: "border-amber-500 bg-amber-50 text-amber-950",
    text: "text-amber-700",
    ring: "focus-visible:ring-amber-400/40",
  },
  rose: {
    accent: "bg-rose-500",
    soft: "bg-rose-50",
    active: "border-rose-500 bg-rose-50 text-rose-950",
    text: "text-rose-700",
    ring: "focus-visible:ring-rose-400/40",
  },
  sky: {
    accent: "bg-sky-500",
    soft: "bg-sky-50",
    active: "border-sky-500 bg-sky-50 text-sky-950",
    text: "text-sky-700",
    ring: "focus-visible:ring-sky-400/40",
  },
  slate: {
    accent: "bg-slate-800",
    soft: "bg-slate-50",
    active: "border-slate-700 bg-slate-50 text-slate-950",
    text: "text-slate-700",
    ring: "focus-visible:ring-slate-400/40",
  },
};

export function toneStyle(tone: PlayTone = "emerald") {
  return TONE_STYLES[tone];
}

export function PlayShell({
  app,
  title,
  subtitle,
  tone = "emerald",
  children,
  side,
  footer,
}: {
  app: MiniAppInfo;
  title: string;
  subtitle: string;
  tone?: PlayTone;
  children: React.ReactNode;
  side?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const styles = toneStyle(tone);

  void styles;
  return (
    <div className="focus-play-shell bg-white">
      <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Focus workspace
            </p>
            <h2 className="m-0 truncate text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
              {title}
            </h2>
            <p className="m-0 mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              {subtitle}
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
            {app.name}
          </span>
        </div>
      </div>
      <div className="p-0 sm:p-1">
        <div className="min-w-0">{children}</div>
        {side && (
          <div className="mt-3 px-2 sm:px-3">
            <SecondaryInfo
              title="Context and diagnostics"
              description="Receipts, raw readings, and technical context stay tucked away until needed."
            >
              <div className="min-w-0 space-y-3">{side}</div>
            </SecondaryInfo>
          </div>
        )}
      </div>
      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-3 py-1.5 text-xs sm:px-4">
          {footer}
        </div>
      )}
    </div>
  );
}

export function SecondaryInfo({
  title,
  description,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-xl border border-gray-200 bg-gray-50/70 shadow-sm shadow-gray-950/5"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30">
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-gray-900">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs leading-5 text-gray-700">
              {description}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {meta && (
            <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-700">
              {meta}
            </span>
          )}
          <ChevronDown
            className="h-4 w-4 text-gray-600 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="border-t border-gray-200 px-3.5 py-3">{children}</div>
    </details>
  );
}

export function ChainStateStrip({
  loading,
  error,
  contractHash,
  network,
  onRefresh,
}: Pick<
  PlayAreaRegistryProps,
  "loading" | "error" | "contractHash" | "network" | "onRefresh"
>) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-700">
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            {loading ? "Syncing" : error ? "Cached state" : "Live state"}
          </span>
          <span className="font-semibold uppercase text-gray-600">
            {network}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      <details
        className="group rounded-xl border border-gray-200 bg-white/70"
        data-testid="chain-technical-details"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-700 marker:content-none">
          Technical chain details
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-gray-200 px-2.5 py-2">
          <span className="block truncate font-mono text-gray-600">
            Contract: {shortHash(contractHash)}
          </span>
          {error && (
            <span className="mt-1 block text-[11px] font-semibold text-amber-700">
              {error}
            </span>
          )}
        </div>
      </details>
    </div>
  );
}

export function MetricGrid({ stats }: { stats: PlayMetric[] }) {
  if (!stats.length) return null;
  return (
    <SecondaryInfo
      title="Additional metrics"
      description="Raw app counters and diagnostic readings."
      meta={`${stats.length} items`}
    >
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
        {stats.slice(0, 8).map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm shadow-gray-950/5"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
              {item.label}
            </p>
            <p
              className={`m-0 mt-1 truncate text-sm font-black sm:text-base ${item.accent ? "text-emerald-600" : "text-gray-950"}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </SecondaryInfo>
  );
}

export function ActivityPanel({ activity }: { activity: PlayActivity | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-bold text-gray-900">
          {activity?.title || "Recent activity"}
        </h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
          {activity?.rows.length || 0} items
        </span>
      </div>
      {activity?.rows.length ? (
        <div className="space-y-2">
          {activity.rows.slice(0, 4).map((row, index) => (
            <div
              key={`${row.primary}:${index}`}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold text-gray-900">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="m-0 mt-0.5 truncate text-xs text-gray-700">
                      {row.secondary}
                    </p>
                  )}
                </div>
                {row.amount && (
                  <span className="shrink-0 text-xs font-bold text-emerald-700">
                    {row.amount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm leading-6 text-gray-700">
          {activity?.emptyText ||
            "No live on-chain events are available for this miniapp yet."}
        </p>
      )}
    </div>
  );
}

export function ActionRow({
  label,
  detail,
  value,
  valueLabel,
  tone = "emerald",
  active,
  icon,
}: {
  label: string;
  detail?: string;
  value?: string;
  valueLabel?: string;
  tone?: PlayTone;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  const styles = toneStyle(tone);
  const className = `group flex w-full flex-col items-stretch justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition sm:flex-row sm:items-center sm:gap-3 sm:py-3 ${
    active ? styles.active : "border-gray-200 bg-white text-gray-950"
  }`;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${active ? "bg-white/75" : styles.soft} ${styles.text}`}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0">
          <span className="block break-words text-[13px] font-black sm:text-sm">
            {label}
          </span>
          {detail && (
            <span className="mt-0.5 block break-words text-[11px] font-semibold leading-4 text-gray-700 sm:text-xs sm:leading-5">
              {detail}
            </span>
          )}
        </span>
      </div>
      {(value || valueLabel) && (
        <span className="shrink-0 pl-12 text-left sm:pl-0 sm:text-right">
          {value && (
            <span className="block text-[13px] font-black tabular-nums text-gray-950 sm:text-sm">
              {value}
            </span>
          )}
          {valueLabel && (
            <span className="block text-[10px] font-black uppercase tracking-wide text-gray-600">
              {valueLabel}
            </span>
          )}
        </span>
      )}
    </>
  );

  return <div className={className}>{content}</div>;
}

export function ActionBoard({
  title,
  subtitle,
  rows,
  tone = "emerald",
}: {
  title: string;
  subtitle?: string;
  rows: Array<{
    label: string;
    detail?: string;
    value?: string;
    valueLabel?: string;
    active?: boolean;
    icon?: React.ReactNode;
  }>;
  tone?: PlayTone;
}) {
  const styles = toneStyle(tone);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-black text-gray-950">{title}</h3>
          {subtitle && (
            <p className="m-0 mt-1 text-xs leading-5 text-gray-700">
              {subtitle}
            </p>
          )}
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${styles.accent}`} />
      </div>
      <div className="space-y-2">
        {rows.slice(0, 6).map((row) => (
          <ActionRow
            key={`${row.label}:${row.detail || row.value || ""}`}
            {...row}
            tone={tone}
          />
        ))}
      </div>
    </section>
  );
}

export function EmbeddedDappSurface({
  // title/subtitle are intentionally accepted but no longer rendered as a
  // header block — the actual dApp iframe IS the focal content. A small
  // pop-out link still appears for users who want a full-window view.
  title,
  subtitle,
  url,
  tone = "emerald",
  frameTitle,
  testId,
  appId = testId.replace(/^native-dapp-frame-/, ""),
  network = networkFromEmbeddedUrl(url),
  // Default to a viewport-driven height with a sensible minimum so the
  // dApp's core UI fits above the fold on common screen sizes without
  // collapsing to nothing on short windows. The Polymarket-style compact
  // chrome (navbar 64px + sticky detail header ~48px + small footer ~32px
  // + outer padding ~28px ≈ 172px) leaves the rest for the dApp.
  heightClass = "min-h-[580px] h-[calc(100vh-172px)]",
}: {
  title: string;
  subtitle: string;
  url: string;
  tone?: PlayTone;
  frameTitle: string;
  testId: string;
  appId?: string;
  network?: "mainnet" | "testnet";
  heightClass?: string;
}) {
  void title;
  void subtitle;
  void tone;
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const loadingTitle = frameTitle.replace(/\s+dApp$/i, "");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEmbeddedWalletBridge({ appId, iframeRef, network });

  useEffect(() => {
    setFrameLoaded(false);
    setShowLoading(true);
  }, [url]);

  useEffect(() => {
    if (!frameLoaded) return undefined;
    const timeout = window.setTimeout(
      () => setShowLoading(false),
      EMBEDDED_DAPP_SETTLE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [frameLoaded]);

  return (
    <section className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Open dApp in a new window"
        title="Open in a new window"
        className="absolute right-1.5 top-1.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white/95 p-0 text-[11px] font-semibold text-gray-600 opacity-0 shadow-sm backdrop-blur transition hover:text-gray-900 group-hover:opacity-100 focus:opacity-100 sm:right-2 sm:top-2 sm:h-auto sm:w-auto sm:gap-1 sm:px-2 sm:py-1"
      >
        <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
        <span className="hidden sm:inline">New window</span>
      </a>
      {/* Audit fix C-4: miniapps run in the host's origin and must be sandboxed.
          allow-scripts is required for the dApp to function; allow-same-origin is
          intentionally omitted so a malicious miniapp cannot read window.parent.* or
          lift sb-access-token from sessionStorage. */}
      <iframe
        ref={iframeRef}
        title={frameTitle}
        src={url}
        data-testid={testId}
        data-wallet-bridge="neo-miniapp-host"
        className={`block ${heightClass} w-full border-0 bg-white transition-opacity duration-300 ${showLoading ? "opacity-0" : "opacity-100"}`}
        loading="eager"
        onLoad={() => setFrameLoaded(true)}
        referrerPolicy="no-referrer-when-downgrade"
        /* allow-same-origin is intentionally omitted (Audit fix C-4): with
           allow-scripts it would defeat the sandbox, letting a miniapp reach
           window.parent.* and lift the host's wallet session. The wallet session
           reaches miniapps over the postMessage wallet bridge (data-wallet-bridge),
           not via shared same-origin storage. */
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
      {showLoading && (
        <div
          className="absolute inset-0 grid place-items-center bg-[#f7f8fb] px-6 text-center"
          data-testid={`${testId}-loading`}
          aria-live="polite"
        >
          <div className="w-full max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md shadow-gray-950/10 ring-1 ring-gray-200">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gray-950 text-white shadow-inner">
                <Radio className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <p className="m-0 mt-5 text-base font-black text-gray-950">
              Loading {loadingTitle}
            </p>
            <div
              className="mx-auto mt-4 grid h-2 max-w-44 grid-cols-3 gap-1.5"
              aria-hidden="true"
            >
              <span className="rounded-full bg-emerald-400" />
              <span className="rounded-full bg-sky-400" />
              <span className="rounded-full bg-orange-300" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ToolCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
        {label}
      </p>
      <p className="m-0 mt-1 break-words text-sm font-black text-gray-950">
        {value}
      </p>
    </div>
  );
}

export function BridgeStatusPanel() {
  const steps = ["Lock", "Relay", "Prove", "Release"];
  return (
    <div className="rounded-lg border border-sky-100 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-black text-gray-950">Operation status</h3>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-500"}`}
            >
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-gray-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OracleStatusPanel({
  mode,
  result,
}: {
  mode: string;
  result: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-950 p-4 text-white">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black">
        <ShieldCheck className="h-4 w-4 text-neo" />
        Result verifier
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        Mode: <span className="font-bold text-white">{mode}</span>
      </p>
      <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-5 text-emerald-200">
        {result}
      </pre>
    </div>
  );
}
