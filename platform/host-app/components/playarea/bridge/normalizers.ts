import type { InvokeParams } from "@/lib/wallet/adapters";

import type {
  BridgeInvocation,
  BridgeRecord,
  BridgeSigner,
  EmbeddedWalletBridgeResultDetail,
} from "./types";

export const MAINNET_MAGIC = 860833102;
export const TESTNET_MAGIC = 894710606;
export const NEO_ASSET_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
export const GAS_ASSET_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

export function isBridgeRecord(value: unknown): value is BridgeRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asBridgeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function bridgeNetworkMagic(network: "mainnet" | "testnet") {
  return network === "mainnet" ? MAINNET_MAGIC : TESTNET_MAGIC;
}

export function normalizeBridgeScope(value: unknown): number {
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

export function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.map((entry) => asBridgeString(entry)).filter(Boolean);
  return entries.length ? entries : undefined;
}

export function normalizeBridgeSigners(value: unknown): InvokeParams["signers"] {
  if (!Array.isArray(value)) return undefined;
  const signers = value
    .filter(isBridgeRecord)
    .map((entry: BridgeSigner) => {
      const account = asBridgeString(entry.account);
      if (!account) return null;
      const scopes = normalizeBridgeScope(entry.scopes);
      // Audit fix (signer hardening): the bridge does not forward WitnessRules rule
      // trees, so mapping scope 64 while dropping the rules would hand the wallet a
      // broader witness than the miniapp specified. Reject explicitly instead.
      if (entry.rules != null || (scopes & 64) !== 0) {
        throw new Error(
          "WitnessRules signers are not supported by the embedded wallet bridge.",
        );
      }
      const allowedContracts = stringArray(
        entry.allowedContracts ?? entry.allowedcontracts,
      );
      const allowedGroups = stringArray(entry.allowedGroups);
      return {
        account,
        scopes,
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

// Single source of truth for the invocation's target contract. The miniapp SDK
// sends it under `hash` (NeoDapiInvocation); display and execution must use the
// same fallback chain so the user-approval prompt can never show a different
// contract than the one actually invoked.
export function invocationContractHash(invocation: BridgeInvocation): string {
  return asBridgeString(
    invocation.hash ?? invocation.scriptHash ?? invocation.contractHash,
  );
}

export function firstBridgeInvocation(payload: unknown): BridgeInvocation | null {
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

export function bridgeResultTxId(result: unknown): string {
  if (!isBridgeRecord(result)) return "";
  return asBridgeString(result.txid) ||
    asBridgeString(result.hash) ||
    asBridgeString(result.tx);
}

export function bridgeInvocationMemo(invocation: BridgeInvocation | null): string {
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
    contractHash: invocation ? invocationContractHash(invocation) : "",
    memo: bridgeInvocationMemo(invocation),
    at: new Date().toISOString(),
  };
}

export function normalizeBridgeArgs(value: unknown): InvokeParams["args"] {
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
export function resolveSenderArgs(
  params: InvokeParams,
  address: string,
): InvokeParams {
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

export function normalizeBridgeOperation(value: unknown): string {
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

export function bridgeInvocationToParams(
  invocation: BridgeInvocation,
  signers?: InvokeParams["signers"],
): InvokeParams {
  const scriptHash = invocationContractHash(invocation);
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

const BRIDGE_SCOPE_LABELS: Array<[number, string]> = [
  [1, "CalledByEntry"],
  [16, "CustomContracts"],
  [32, "CustomGroups"],
  [64, "WitnessRules"],
  [128, "Global"],
];

export function bridgeScopeLabel(scope: number): string {
  if (scope === 0) return "None";
  const labels = BRIDGE_SCOPE_LABELS.filter(([bit]) => (scope & bit) !== 0).map(
    ([, label]) => label,
  );
  return labels.length ? labels.join("+") : `scope ${scope}`;
}

export function describeBridgeSignerScopes(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const labels = value
    .filter(isBridgeRecord)
    .map((entry: BridgeSigner) => bridgeScopeLabel(normalizeBridgeScope(entry.scopes)));
  return labels.join(", ");
}

export function describeSensitiveBridgeOperation(
  method: string,
  payload: unknown,
): string {
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
    // Mirror the execution path exactly (invocationContractHash +
    // normalizeBridgeOperation) so the approval prompt always names the same
    // contract and operation that the wallet will sign.
    const ops = invocations
      .map((inv: BridgeInvocation) => {
        const scriptHash = invocationContractHash(inv) || "?";
        const op =
          normalizeBridgeOperation(inv.operation ?? inv.method) || "?";
        return `${op} @ ${scriptHash}`;
      })
      .join(", ");
    const signerScopes = describeBridgeSignerScopes(rec.signers);
    return `submit a transaction (${ops || "no operations"})${
      signerScopes ? ` with signer scope ${signerScopes}` : ""
    }`;
  }
  return method;
}
