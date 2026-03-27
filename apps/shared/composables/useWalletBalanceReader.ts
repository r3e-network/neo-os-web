import { computed } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult } from "@shared/utils/neo";

type AssetRef = "NEO" | "GAS" | string;

type ReadWalletBalanceOptions = {
  targetAddress?: string | null;
  decimals?: number;
  requireChain?: boolean;
};

const DEFAULT_DECIMALS_BY_ASSET: Record<string, number> = {
  NEO: TOKEN_CONSTANTS.NEO_DECIMALS,
  GAS: TOKEN_CONSTANTS.GAS_DECIMALS,
  [BLOCKCHAIN_CONSTANTS.NEO_HASH.toLowerCase()]: TOKEN_CONSTANTS.NEO_DECIMALS,
  [BLOCKCHAIN_CONSTANTS.GAS_HASH.toLowerCase()]: TOKEN_CONSTANTS.GAS_DECIMALS,
};

function resolveAssetHash(asset: AssetRef): string {
  if (asset === "NEO") return BLOCKCHAIN_CONSTANTS.NEO_HASH;
  if (asset === "GAS") return BLOCKCHAIN_CONSTANTS.GAS_HASH;
  return String(asset ?? "").trim();
}

function resolveAssetDecimals(asset: AssetRef, decimals?: number): number {
  if (typeof decimals === "number") return decimals;
  const normalized = resolveAssetHash(asset).toLowerCase();
  return DEFAULT_DECIMALS_BY_ASSET[asset] ?? DEFAULT_DECIMALS_BY_ASSET[normalized] ?? TOKEN_CONSTANTS.GAS_DECIMALS;
}

function parseBalanceBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function scaleBalance(raw: bigint, decimals: number): number {
  if (decimals <= 0) return Number(raw);
  return Number(raw) / 10 ** decimals;
}

export function useWalletBalanceReader() {
  const wallet = useWallet() as WalletSDK;
  const { address, chainType, invokeRead } = wallet;

  const currentAddress = computed(() => address.value || "");

  const readRawBalance = async (asset: AssetRef, options: ReadWalletBalanceOptions = {}): Promise<bigint> => {
    const owner = options.targetAddress ?? address.value;
    if (!owner) return 0n;
    if (options.requireChain !== false && !requireNeoChain(chainType, undefined, undefined, { silent: true })) {
      return 0n;
    }

    const result = await invokeRead({
      scriptHash: resolveAssetHash(asset),
      operation: "balanceOf",
      args: [{ type: "Hash160", value: owner }],
    });

    return parseBalanceBigInt(parseInvokeResult(result));
  };

  const readBalance = async (asset: AssetRef, options: ReadWalletBalanceOptions = {}): Promise<number> => {
    const raw = await readRawBalance(asset, options);
    return scaleBalance(raw, resolveAssetDecimals(asset, options.decimals));
  };

  return {
    address,
    currentAddress,
    chainType,
    readRawBalance,
    readBalance,
  };
}
