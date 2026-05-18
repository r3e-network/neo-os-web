import {
  MAINNET_MAGIC,
  TESTNET_MAGIC,
  type NeoNetwork,
} from "../constants/rpc";
import type { NeoDapiInvocation } from "./nep21-provider";
import type {
  ContractArg,
  InvokeParams,
  InvokeResult,
  OneGateLegacyWallet,
  WalletSigner,
} from "./wallet-sdk-types";

const SIGNER_SCOPE_MAP: Record<string, number> = {
  none: 0,
  calledbyentry: 1,
  customcontracts: 16,
  customgroups: 32,
  rules: 64,
  global: 128,
};

export function normalizeOperationName(operation: string): string {
  const raw = String(operation || "").trim();
  if (!raw) return raw;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function normalizeSignerScope(scope: string | number): number {
  if (typeof scope === "number" && Number.isFinite(scope)) {
    return scope;
  }

  const raw = String(scope ?? "").trim();
  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  return SIGNER_SCOPE_MAP[raw.toLowerCase()] ?? 1;
}

export function mapSigners(signers?: WalletSigner[]) {
  return signers?.map((signer) => ({
    account: signer.account,
    scopes: normalizeSignerScope(signer.scopes),
    ...(signer.allowedContracts?.length
      ? { allowedContracts: signer.allowedContracts }
      : {}),
    ...(signer.allowedGroups?.length
      ? { allowedGroups: signer.allowedGroups }
      : {}),
    ...(signer.rules?.length ? { rules: signer.rules } : {}),
  }));
}

const DAPI_SCOPE_BY_NUMBER: Record<number, string> = {
  0: "None",
  1: "CalledByEntry",
  16: "CustomContracts",
  32: "CustomGroups",
  64: "WitnessRules",
  128: "Global",
};

const DAPI_SCOPE_BY_NAME: Record<string, string> = {
  none: "None",
  calledbyentry: "CalledByEntry",
  customcontracts: "CustomContracts",
  customgroups: "CustomGroups",
  rules: "WitnessRules",
  witnessrules: "WitnessRules",
  global: "Global",
};

function normalizeDapiSignerScope(scope: string | number): string {
  if (typeof scope === "number" && Number.isFinite(scope)) {
    if (DAPI_SCOPE_BY_NUMBER[scope]) return DAPI_SCOPE_BY_NUMBER[scope];
    const parts = Object.entries(DAPI_SCOPE_BY_NUMBER)
      .filter(
        ([bit]) => Number(bit) !== 0 && (scope & Number(bit)) === Number(bit),
      )
      .map(([, name]) => name);
    return parts.length ? parts.join(", ") : "CalledByEntry";
  }

  const raw = String(scope ?? "").trim();
  if (/^\d+$/.test(raw)) {
    return normalizeDapiSignerScope(parseInt(raw, 10));
  }
  if (raw.includes(",")) {
    const parts = raw
      .split(",")
      .map(
        (part) => DAPI_SCOPE_BY_NAME[part.trim().toLowerCase()] ?? part.trim(),
      )
      .filter(Boolean);
    return parts.length ? parts.join(", ") : "CalledByEntry";
  }

  return DAPI_SCOPE_BY_NAME[raw.toLowerCase()] ?? (raw || "CalledByEntry");
}

export function mapDapiSigners(
  signers?: WalletSigner[],
  accountHash?: string | null,
  currentAddress?: string | null,
) {
  return signers?.map((signer) => ({
    account:
      accountHash && currentAddress && signer.account === currentAddress
        ? accountHash
        : signer.account,
    scopes: normalizeDapiSignerScope(signer.scopes),
    ...(signer.allowedContracts?.length
      ? { allowedContracts: signer.allowedContracts }
      : {}),
    ...(signer.allowedGroups?.length
      ? { allowedGroups: signer.allowedGroups }
      : {}),
    ...(signer.rules?.length ? { rules: signer.rules } : {}),
  }));
}

export function mapDapiArgs(
  args?: ContractArg[],
  accountHash?: string | null,
  currentAddress?: string | null,
): ContractArg[] | undefined {
  if (!args?.length) return args;
  return args.map((arg) => {
    if (
      accountHash &&
      currentAddress &&
      String(arg.type).toLowerCase() === "hash160" &&
      arg.value === currentAddress
    ) {
      return { ...arg, value: accountHash };
    }
    return arg;
  });
}

export function resolveNetworkFromMagic(network?: number): NeoNetwork | null {
  if (network === MAINNET_MAGIC) return "mainnet";
  if (network === TESTNET_MAGIC) return "testnet";
  return null;
}

export function resolveNetworkFromChainId(
  chainIdValue?: string | null,
): NeoNetwork | null {
  const raw = String(chainIdValue ?? "")
    .trim()
    .toLowerCase();
  if (raw === "mainnet" || raw === "neo-n3-mainnet" || raw.includes("mainnet"))
    return "mainnet";
  if (raw === "testnet" || raw === "neo-n3-testnet" || raw.includes("testnet"))
    return "testnet";
  return null;
}

export function resolveNetworkFromUnknown(value: unknown): NeoNetwork | null {
  if (typeof value === "number") return resolveNetworkFromMagic(value);
  if (typeof value === "string") return resolveNetworkFromChainId(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      resolveNetworkFromUnknown(record.network) ||
      resolveNetworkFromUnknown(record.chainId) ||
      resolveNetworkFromUnknown(record.id)
    );
  }
  return null;
}

export async function readOneGateNetwork(
  provider: OneGateLegacyWallet,
): Promise<NeoNetwork | null> {
  const raw =
    typeof provider.getNetwork === "function"
      ? await provider.getNetwork().catch(() => undefined)
      : provider.network;
  return resolveNetworkFromUnknown(raw);
}

export function networkLabel(network: NeoNetwork): string {
  return network === "testnet" ? "Neo N3 Testnet" : "Neo N3 Mainnet";
}

export function chainTypeFromDapiNetwork(network?: number): string {
  const resolved = resolveNetworkFromMagic(network);
  return resolved ? `neo-n3-${resolved}` : "neo-n3";
}

export function buildDapiInvocation(
  params: InvokeParams,
  accountHash?: string | null,
  currentAddress?: string | null,
): NeoDapiInvocation {
  return {
    hash: params.scriptHash,
    operation: normalizeOperationName(params.operation),
    args: mapDapiArgs(params.args, accountHash, currentAddress) ?? [],
  };
}

export function normalizeTxResult(result: unknown): InvokeResult {
  if (typeof result === "string") return { txid: result, tx: result };
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const txid = String(record.txid ?? record.tx ?? record.hash ?? "");
    return {
      ...(result as InvokeResult),
      ...(txid ? { txid, tx: txid } : {}),
    };
  }
  return {};
}

export function normalizeBalanceResult(
  result: unknown,
  assetHash: string,
): string | number {
  if (typeof result === "string" || typeof result === "number") return result;
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (typeof record.amount === "string" || typeof record.amount === "number")
      return record.amount;

    const direct =
      record[assetHash] ??
      record[assetHash.toLowerCase()] ??
      record[assetHash.toUpperCase()];
    if (typeof direct === "string" || typeof direct === "number") return direct;

    if (Array.isArray(direct)) {
      const match = direct.find(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          (entry as Record<string, unknown>).contract === assetHash,
      );
      const amount = (match as Record<string, unknown> | undefined)?.amount;
      if (typeof amount === "string" || typeof amount === "number")
        return amount;
    }
  }
  return "0";
}
