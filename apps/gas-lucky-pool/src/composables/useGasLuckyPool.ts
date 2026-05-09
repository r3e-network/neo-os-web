import { createDerived, createObservable } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import {
  formatGas,
  formatHash,
  fromFixed8,
  toFixed8,
} from "@shared/utils/format";
import {
  getLaunchParam,
  type MiniAppLaunchContext,
} from "@shared/utils/launch-params";

const APP_ID = "miniapp-gas-lucky-pool";
const ONEGATE_VAULT_DAPP_ID = "23";
const ONEGATE_VAULT_APP_URL = `https://onegate.space/app/${ONEGATE_VAULT_DAPP_ID}`;
const ONE_GAS_FIXED8 = 100000000n;
const MAX_VAULT_REWARD_FIXED8 = 50n * ONE_GAS_FIXED8;

export type GasPoolStatus =
  | "draft"
  | "active"
  | "empty"
  | "expired"
  | "unknown";
export type GasPoolSuccessType =
  | ""
  | "create"
  | "claim"
  | "refund"
  | "fund"
  | "withdraw";

export interface GasLuckyPool {
  id: string;
  creator: string;
  totalAmount: bigint;
  minClaimAmount: bigint;
  maxClaimAmount: bigint;
  maxClaims: number;
  claimedCount: number;
  remainingAmount: bigint;
  bestLuckAddress: string;
  bestLuckAmount: bigint;
  expiryTime: number;
  active: boolean;
  status: GasPoolStatus;
}

export interface GasLuckyClaim {
  id: string;
  poolId: string;
  claimer: string;
  amount: bigint;
  txid?: string;
}

export interface CreatePoolForm {
  totalAmount?: string;
  minClaim?: string;
  maxClaim?: string;
  maxClaims?: string;
  expiryHours?: string;
}

export interface TopUpPoolForm {
  poolId?: string;
  amount?: string;
}

interface ClaimLaunchIdentity {
  poolId?: string;
  oneGateAppId?: string;
  appId?: string;
}

export interface UseGasLuckyPoolOptions {
  chain: ChainService;
  launchContext: MiniAppLaunchContext;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function asBigInt(value: unknown): bigint {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePool(id: string, raw: unknown): GasLuckyPool | null {
  if (!Array.isArray(raw) || raw.length < 11) return null;
  const expiryTime = asNumber(raw[9]);
  const claimedCount = asNumber(raw[5]);
  const maxClaims = asNumber(raw[4]);
  const remainingAmount = asBigInt(raw[6]);
  const active = Boolean(raw[10]);
  const expired = expiryTime > 0 && Math.floor(Date.now() / 1000) > expiryTime;
  const empty = remainingAmount <= 0n || claimedCount >= maxClaims;
  const status: GasPoolStatus = empty
    ? "empty"
    : expired
      ? "expired"
      : active
        ? "active"
        : "unknown";

  return {
    id,
    creator: String(raw[0] ?? ""),
    totalAmount: asBigInt(raw[1]),
    minClaimAmount: asBigInt(raw[2]),
    maxClaimAmount: asBigInt(raw[3]),
    maxClaims,
    claimedCount,
    remainingAmount,
    bestLuckAddress: String(raw[7] ?? ""),
    bestLuckAmount: asBigInt(raw[8]),
    expiryTime,
    active,
    status,
  };
}

function eventValue(entry: unknown, index: number): unknown {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
}

function isWalletUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /wallet (not detected|unavailable|not connected)|install a nep-21|neoline extension/i.test(
    message,
  );
}

export function normalizePoolId(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^\d{1,32}$/.test(raw) ? raw : "";
}

export function normalizeClaimKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_:-]{6,128}$/.test(raw) ? raw : "";
}

function normalizeClaimIdentity(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(raw) ? raw : "";
}

function luckPercentFromFixed8(value: unknown): string {
  const amount = asBigInt(value);
  const clamped =
    amount < 0n
      ? 0n
      : amount > MAX_VAULT_REWARD_FIXED8
        ? MAX_VAULT_REWARD_FIXED8
        : amount;
  const basisPoints = (clamped * 10000n) / MAX_VAULT_REWARD_FIXED8;
  return `${basisPoints / 100n}.${String(basisPoints % 100n).padStart(2, "0")}`;
}

function buildClaimKeyUrl(
  claimKey: string,
  network?: MiniAppLaunchContext["network"],
  identity: ClaimLaunchIdentity = {},
) {
  const key = normalizeClaimKey(claimKey);
  if (!key) return "";
  const appId = normalizeClaimIdentity(identity.oneGateAppId) || ONEGATE_VAULT_DAPP_ID;
  const url = new URL(`https://onegate.space/app/${encodeURIComponent(appId)}`);
  url.searchParams.set("key", key);
  if (identity.poolId) url.searchParams.set("pool", identity.poolId);
  if (network) url.searchParams.set("network", network);
  return url.toString();
}

function buildLegacyPoolClaimUrl(
  poolId: string,
  network?: MiniAppLaunchContext["network"],
) {
  const id = normalizePoolId(poolId);
  if (!id) return "";
  const url = new URL(ONEGATE_VAULT_APP_URL);
  url.searchParams.set("pool", id);
  if (network) url.searchParams.set("network", network);
  return url.toString();
}

export function useGasLuckyPool({
  chain,
  launchContext,
  t,
}: UseGasLuckyPoolOptions) {
  const launchIdentity: ClaimLaunchIdentity = {
    poolId:
      normalizeClaimIdentity(
        getLaunchParam(launchContext, ["poolId", "pool", "campaignId"], ""),
      ) || undefined,
    oneGateAppId:
      normalizeClaimIdentity(
        getLaunchParam(
          launchContext,
          ["oneGateAppId", "oneGateId", "onegateAppId"],
          "",
        ),
      ) || undefined,
    appId: normalizeClaimIdentity(launchContext.appId) || APP_ID,
  };
  const currentPoolId = createObservable(
    normalizePoolId(
      getLaunchParam(launchContext, ["poolId", "pool", "id"], ""),
    ),
  );
  const currentClaimKey = createObservable(
    normalizeClaimKey(
      getLaunchParam(launchContext, ["claimKey", "key", "code", "k"], ""),
    ),
  );
  const currentPool = createObservable<GasLuckyPool | null>(null);
  const recentPools = createObservable<GasLuckyPool[]>([]);
  const recentClaims = createObservable<GasLuckyClaim[]>([]);
  const isLoading = createObservable(false);
  const isCreating = createObservable(false);
  const isClaiming = createObservable(false);
  const isRefunding = createObservable(false);
  const isFunding = createObservable(false);
  const isCreditLoading = createObservable(false);
  const isWithdrawingCredit = createObservable(false);
  const lastTxid = createObservable("");
  const lastClaimAmount = createObservable<bigint>(0n);
  const lastClaimPoolId = createObservable("");
  const lastClaimKey = createObservable("");
  const lastClaimLuckPercent = createObservable("");
  const claimStatus = createObservable<"" | "submitted" | "paid" | "failed">(
    "",
  );
  const lastRefundAmount = createObservable<bigint>(0n);
  const lastRefundPoolId = createObservable("");
  const lastFundAmount = createObservable<bigint>(0n);
  const lastFundPoolId = createObservable("");
  const lastSuccessType = createObservable<GasPoolSuccessType>("");
  const lastError = createObservable("");
  const gasCredit = createObservable<bigint>(0n);

  const poolCount = createDerived(
    () => recentPools.get().length,
    [recentPools],
  );
  const claimCount = createDerived(
    () => recentClaims.get().length,
    [recentClaims],
  );
  const activePoolCount = createDerived(
    () => recentPools.get().filter((pool) => pool.status === "active").length,
    [recentPools],
  );
  const totalRemaining = createDerived(
    () =>
      recentPools.get().reduce((sum, pool) => sum + pool.remainingAmount, 0n),
    [recentPools],
  );
  const totalRemainingGas = createDerived(
    () => Number(totalRemaining.get()) / 100000000,
    [totalRemaining],
  );
  const gasCreditGas = createDerived(
    () => Number(gasCredit.get()) / 100000000,
    [gasCredit],
  );
  const currentShareUrl = createDerived(
    () =>
      currentClaimKey.get()
        ? buildClaimKeyUrl(
            currentClaimKey.get(),
            launchContext.network,
            launchIdentity,
          )
        : currentPoolId.get()
          ? buildLegacyPoolClaimUrl(currentPoolId.get(), launchContext.network)
          : "",
    [currentClaimKey, currentPoolId],
  );
  const currentRange = createDerived(() => {
    const pool = currentPool.get();
    if (!pool) return "1-50 GAS";
    return `${formatGas(pool.minClaimAmount, 2)}-${formatGas(pool.maxClaimAmount, 2)} GAS`;
  }, [currentPool]);

  async function loadPool(poolId = currentPoolId.get()) {
    const id = normalizePoolId(poolId);
    if (!id) {
      currentPool.set(null);
      return null;
    }
    const raw = await chain.readArray("getRangeGasPool", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: id },
    ]);
    const parsed = parsePool(id, raw);
    currentPool.set(parsed);
    return parsed;
  }

  async function loadRecentPools() {
    try {
      const events = await chain.listEvents("RangeGasPoolCreated", {
        limit: 10,
      });
      const items = events
        .map((event) => {
          const appId = String(eventValue(event, 0) ?? "");
          if (appId !== APP_ID) return null;
          const poolId = String(eventValue(event, 1) ?? "");
          if (!poolId) return null;
          return {
            id: poolId,
            creator: String(eventValue(event, 2) ?? ""),
            totalAmount: asBigInt(eventValue(event, 3)),
            minClaimAmount: asBigInt(eventValue(event, 4)),
            maxClaimAmount: asBigInt(eventValue(event, 5)),
            maxClaims: asNumber(eventValue(event, 6)),
            claimedCount: 0,
            remainingAmount: asBigInt(eventValue(event, 3)),
            bestLuckAddress: "",
            bestLuckAmount: 0n,
            expiryTime: 0,
            active: true,
            status: "active" as const,
          };
        })
        .filter((entry): entry is GasLuckyPool => Boolean(entry))
        .slice(0, 10);
      recentPools.set(items);
    } catch {
      recentPools.set([]);
    }
  }

  async function loadRecentClaims() {
    try {
      const events = await chain.listEvents("RangeGasPoolClaimed", {
        limit: 12,
      });
      const items = events
        .map((event) => {
          const appId = String(eventValue(event, 0) ?? "");
          if (appId !== APP_ID) return null;
          const poolId = String(eventValue(event, 1) ?? "");
          const claimer = String(eventValue(event, 2) ?? "");
          return {
            id: `${poolId}:${claimer}`,
            poolId,
            claimer,
            amount: asBigInt(eventValue(event, 3)),
          };
        })
        .filter((entry): entry is GasLuckyClaim => Boolean(entry))
        .slice(0, 12);
      recentClaims.set(items);
    } catch {
      recentClaims.set([]);
    }
  }

  async function loadAll() {
    if (isLoading.get()) return;
    isLoading.set(true);
    lastError.set("");
    try {
      const tasks: Promise<unknown>[] = [loadRecentPools(), loadRecentClaims()];
      if (currentPoolId.get()) tasks.unshift(loadPool(currentPoolId.get()));
      else currentPool.set(null);
      await Promise.all(tasks);
    } catch (error) {
      if (!isWalletUnavailableError(error)) {
        lastError.set(error instanceof Error ? error.message : t("loadFailed"));
      }
    } finally {
      isLoading.set(false);
    }
  }

  function validateCreateForm(form: CreatePoolForm) {
    const total = asBigInt(toFixed8(form.totalAmount || "0"));
    const min = asBigInt(toFixed8(form.minClaim || "0"));
    const max = asBigInt(toFixed8(form.maxClaim || "0"));
    const maxClaims = Math.floor(Number(form.maxClaims || 0));
    const expiryHours = Number(form.expiryHours || 0);

    if (total < ONE_GAS_FIXED8) throw new Error(t("invalidTotal"));
    if (min < ONE_GAS_FIXED8 || max > MAX_VAULT_REWARD_FIXED8 || min > max)
      throw new Error(t("invalidRange"));
    if (!Number.isFinite(maxClaims) || maxClaims < 1 || maxClaims > 100)
      throw new Error(t("invalidClaimSlots"));
    if (!Number.isFinite(expiryHours) || expiryHours <= 0 || expiryHours > 720)
      throw new Error(t("invalidExpiry"));
    if (total < min * BigInt(maxClaims)) throw new Error(t("poolBelowMinimum"));
    if (total > max * BigInt(maxClaims)) throw new Error(t("poolAboveMaximum"));

    return {
      total,
      min,
      max,
      maxClaims,
      expirySeconds: Math.round(expiryHours * 3600),
    };
  }

  async function createPool(form: CreatePoolForm) {
    if (isCreating.get()) return null;
    const parsed = validateCreateForm(form);
    isCreating.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const creator = await chain.ensureWallet();
      const result = await chain.invokeWithPayment(
        parsed.total.toString(),
        `gas-lucky-pool:create:${parsed.maxClaims}`,
        "createRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Hash160", value: creator },
          { type: "Integer", value: parsed.total.toString() },
          { type: "Integer", value: parsed.min.toString() },
          { type: "Integer", value: parsed.max.toString() },
          { type: "Integer", value: String(parsed.maxClaims) },
          { type: "Integer", value: String(parsed.expirySeconds) },
        ],
        { waitForEvent: "RangeGasPoolCreated", waitTimeoutMs: 30_000 },
      );
      lastTxid.set(result.txid);
      lastSuccessType.set("create");
      const createdPoolId = String(eventValue(result.event, 1) ?? "");
      if (createdPoolId) {
        currentPoolId.set(createdPoolId);
        await Promise.all([loadPool(createdPoolId), loadRecentPools()]);
      } else {
        await loadRecentPools();
      }
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("createFailed"));
      await loadGasCredit().catch(() => undefined);
      throw error;
    } finally {
      isCreating.set(false);
    }
  }

  async function loadGasCredit() {
    if (isCreditLoading.get()) return gasCredit.get();
    isCreditLoading.set(true);
    lastError.set("");
    try {
      const user = await chain.ensureWallet();
      const raw = await chain.read("getDirectGasCredit", [
        { type: "Hash160", value: user },
      ]);
      const amount = asBigInt(raw);
      gasCredit.set(amount);
      return amount;
    } catch (error) {
      lastError.set(error instanceof Error ? error.message : t("loadFailed"));
      throw error;
    } finally {
      isCreditLoading.set(false);
    }
  }

  async function withdrawGasCredit(amount = gasCredit.get()) {
    if (isWithdrawingCredit.get()) return null;
    const credit = asBigInt(amount);
    if (credit <= 0n) throw new Error(t("noGasCredit"));
    isWithdrawingCredit.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const user = await chain.ensureWallet();
      const result = await chain.invoke(
        "withdrawGasCredit",
        [
          { type: "Hash160", value: user },
          { type: "Integer", value: credit.toString() },
        ],
        { waitForEvent: "GasCreditWithdrawn", waitTimeoutMs: 30_000 },
      );
      lastTxid.set(result.txid);
      lastSuccessType.set("withdraw");
      gasCredit.set(0n);
      await loadGasCredit().catch(() => undefined);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(
        error instanceof Error ? error.message : t("withdrawGasCreditFailed"),
      );
      throw error;
    } finally {
      isWithdrawingCredit.set(false);
    }
  }

  function claimInputValue(input: unknown, key: "claimKey" | "poolId") {
    if (input && typeof input === "object")
      return (input as Record<string, unknown>)[key];
    return input;
  }

  function claimIdentityFromInput(input: unknown): ClaimLaunchIdentity {
    const record =
      input && typeof input === "object"
        ? (input as Record<string, unknown>)
        : {};
    return {
      poolId:
        normalizeClaimIdentity(
          record.poolId ?? record.pool ?? record.campaignId,
        ) ||
        launchIdentity.poolId ||
        undefined,
      oneGateAppId:
        normalizeClaimIdentity(
          record.oneGateAppId ?? record.oneGateId ?? record.onegateAppId,
        ) ||
        launchIdentity.oneGateAppId ||
        undefined,
      appId:
        normalizeClaimIdentity(record.appId ?? record.miniappId) ||
        launchIdentity.appId ||
        APP_ID,
    };
  }

  function addClaimIdentity(
    target: URLSearchParams | Record<string, string>,
    identity: ClaimLaunchIdentity,
  ) {
    const entries = {
      poolId: identity.poolId,
      oneGateAppId: identity.oneGateAppId,
      appId: identity.appId || APP_ID,
    };
    for (const [key, value] of Object.entries(entries)) {
      if (!value) continue;
      if (target instanceof URLSearchParams) target.set(key, value);
      else target[key] = value;
    }
  }

  async function fetchClaimStatus(
    claimKey: string,
    address: string,
    identity: ClaimLaunchIdentity = launchIdentity,
  ) {
    const search = new URLSearchParams({
      claimKey,
      address,
      network: launchContext.network ?? "mainnet",
    });
    addClaimIdentity(search, identity);
    const response = await fetch(
      `/api/onegate-vault/status?${search.toString()}`,
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof body?.error?.message === "string"
          ? body.error.message
          : t("claimStatusFailed");
      throw new Error(message);
    }
    return body as {
      status?: "submitted" | "paid";
      amountFixed8?: string;
      luckPercent?: string;
      txHash?: string;
      requestId?: string;
    };
  }

  async function claimKeyThroughBackend(
    claimKey: string,
    identity: ClaimLaunchIdentity = launchIdentity,
  ) {
    if (isClaiming.get()) return null;
    isClaiming.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("submitted");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const address = await chain.ensureWallet();
      const request: Record<string, string> = {
        claimKey,
        address,
        network: launchContext.network ?? "mainnet",
      };
      addClaimIdentity(request, identity);
      const response = await fetch("/api/onegate-vault/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof body?.error?.message === "string"
            ? body.error.message
            : t("claimFailed");
        throw new Error(message);
      }

      const result = body as {
        status?: "submitted" | "paid";
        amountFixed8?: string;
        luckPercent?: string;
        txHash?: string;
      };
      currentClaimKey.set(claimKey);
      lastClaimKey.set(claimKey);
      lastTxid.set(String(result.txHash || ""));
      lastSuccessType.set("claim");
      claimStatus.set(result.status === "paid" ? "paid" : "submitted");
      const amount = asBigInt(result.amountFixed8);
      if (amount > 0n) lastClaimAmount.set(amount);
      lastClaimLuckPercent.set(
        String(
          result.luckPercent || luckPercentFromFixed8(result.amountFixed8),
        ),
      );

      if (result.status !== "paid") {
        await pollClaimStatus(claimKey, address, identity).catch(
          () => undefined,
        );
      }

      return {
        txid: String(result.txHash || ""),
        success: true,
        amountFixed8: result.amountFixed8,
        status: result.status,
      };
    } catch (error) {
      lastSuccessType.set("");
      claimStatus.set("failed");
      lastError.set(error instanceof Error ? error.message : t("claimFailed"));
      throw error;
    } finally {
      isClaiming.set(false);
    }
  }

  async function pollClaimStatus(
    claimKey: string,
    address: string,
    identity: ClaimLaunchIdentity = launchIdentity,
  ) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      const status = await fetchClaimStatus(claimKey, address, identity);
      if (status.amountFixed8) {
        const amount = asBigInt(status.amountFixed8);
        if (amount > 0n) lastClaimAmount.set(amount);
        lastClaimLuckPercent.set(
          String(
            status.luckPercent || luckPercentFromFixed8(status.amountFixed8),
          ),
        );
      }
      if (status.txHash) lastTxid.set(String(status.txHash));
      if (status.status === "paid") {
        claimStatus.set("paid");
        return status;
      }
      if (status.status === "submitted") claimStatus.set("submitted");
    }
    return null;
  }

  async function checkClaimStatus(input: unknown = currentClaimKey.get()) {
    const explicitClaimKey =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).claimKey
        : input;
    const key = normalizeClaimKey(explicitClaimKey);
    if (!key) throw new Error(t("claimKeyRequired"));
    const address = await chain.ensureWallet();
    const identity = claimIdentityFromInput(input);
    const status = await fetchClaimStatus(key, address, identity);
    lastClaimKey.set(key);
    if (status.txHash) lastTxid.set(String(status.txHash));
    if (status.amountFixed8) {
      const amount = asBigInt(status.amountFixed8);
      if (amount > 0n) lastClaimAmount.set(amount);
      lastClaimLuckPercent.set(
        String(
          status.luckPercent || luckPercentFromFixed8(status.amountFixed8),
        ),
      );
    }
    claimStatus.set(status.status === "paid" ? "paid" : "submitted");
    if (status.status === "paid") lastSuccessType.set("claim");
    return status;
  }

  async function claimPool(
    input: unknown = currentClaimKey.get() || currentPoolId.get(),
  ) {
    const explicitClaimKey =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).claimKey
        : currentClaimKey.get() || (!normalizePoolId(input) ? input : "");
    const claimKey = normalizeClaimKey(explicitClaimKey);
    if (claimKey) {
      return claimKeyThroughBackend(claimKey, claimIdentityFromInput(input));
    }

    const poolId = claimInputValue(input, "poolId") ?? currentPoolId.get();
    const id = normalizePoolId(poolId);
    if (!id) throw new Error(t("poolIdRequired"));
    if (isClaiming.get()) return null;
    isClaiming.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const claimer = await chain.ensureWallet();
      const result = await chain.invoke(
        "claimRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Integer", value: id },
          { type: "Hash160", value: claimer },
        ],
        { waitForEvent: "RangeGasPoolClaimed", waitTimeoutMs: 30_000 },
      );
      currentPoolId.set(id);
      lastTxid.set(result.txid);
      lastSuccessType.set("claim");
      lastClaimPoolId.set(id);
      const claimedAmount = asBigInt(eventValue(result.event, 3));
      if (claimedAmount > 0n) {
        lastClaimAmount.set(claimedAmount);
        lastClaimLuckPercent.set(luckPercentFromFixed8(claimedAmount));
      }
      await Promise.all([loadPool(id), loadRecentClaims()]);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("claimFailed"));
      throw error;
    } finally {
      isClaiming.set(false);
    }
  }

  async function refundPool(poolId = currentPoolId.get()) {
    const id = normalizePoolId(poolId);
    if (!id) throw new Error(t("poolIdRequired"));
    if (isRefunding.get()) return null;
    isRefunding.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const result = await chain.invoke(
        "refundRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Integer", value: id },
        ],
        { waitForEvent: "RangeGasPoolRefunded", waitTimeoutMs: 30_000 },
      );
      lastTxid.set(result.txid);
      lastSuccessType.set("refund");
      lastRefundPoolId.set(String(eventValue(result.event, 1) ?? id));
      lastRefundAmount.set(asBigInt(eventValue(result.event, 3)));
      await loadPool(id);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("refundFailed"));
      throw error;
    } finally {
      isRefunding.set(false);
    }
  }

  async function topUpPool(form: TopUpPoolForm = {}) {
    const id = normalizePoolId(form.poolId ?? currentPoolId.get());
    if (!id) throw new Error(t("poolIdRequired"));
    const amount = asBigInt(toFixed8(form.amount || "0"));
    if (amount <= 0n) throw new Error(t("invalidTopUpAmount"));
    if (isFunding.get()) return null;
    isFunding.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const creator = await chain.ensureWallet();
      const result = await chain.invokeWithPayment(
        amount.toString(),
        `gas-lucky-pool:fund:${id}`,
        "fundRangeGasPool",
        [
          { type: "String", value: APP_ID },
          { type: "Integer", value: id },
          { type: "Hash160", value: creator },
          { type: "Integer", value: amount.toString() },
        ],
        { waitForEvent: "RangeGasPoolFunded", waitTimeoutMs: 30_000 },
      );
      currentPoolId.set(id);
      lastTxid.set(result.txid);
      lastSuccessType.set("fund");
      lastFundPoolId.set(String(eventValue(result.event, 1) ?? id));
      lastFundAmount.set(asBigInt(eventValue(result.event, 3)));
      await loadPool(id);
      return result;
    } catch (error) {
      lastSuccessType.set("");
      lastError.set(error instanceof Error ? error.message : t("topUpFailed"));
      await loadGasCredit().catch(() => undefined);
      throw error;
    } finally {
      isFunding.set(false);
    }
  }

  function setPoolId(poolId: string) {
    currentPoolId.set(String(poolId || "").trim());
  }

  function setClaimKey(claimKey: string) {
    currentClaimKey.set(normalizeClaimKey(claimKey));
  }

  return {
    currentPoolId,
    currentClaimKey,
    currentPool,
    recentPools,
    recentClaims,
    isLoading,
    isCreating,
    isClaiming,
    isRefunding,
    isFunding,
    isCreditLoading,
    isWithdrawingCredit,
    lastTxid,
    lastClaimAmount,
    lastClaimPoolId,
    lastClaimKey,
    lastClaimLuckPercent,
    claimStatus,
    lastRefundAmount,
    lastRefundPoolId,
    lastFundAmount,
    lastFundPoolId,
    lastSuccessType,
    lastError,
    gasCredit,
    gasCreditGas,
    poolCount,
    claimCount,
    activePoolCount,
    totalRemaining,
    totalRemainingGas,
    currentShareUrl,
    currentRange,
    loadAll,
    loadGasCredit,
    loadPool,
    createPool,
    claimPool,
    checkClaimStatus,
    refundPool,
    topUpPool,
    withdrawGasCredit,
    setPoolId,
    setClaimKey,
    formatPoolGas: (value: bigint | number | string) => formatGas(value, 4),
    formatPoolAddress: (value: string) => formatHash(value, 8, 6),
    fromFixed8,
    buildClaimUrl: (claimKey: string) =>
      buildClaimKeyUrl(claimKey, launchContext.network, launchIdentity),
    buildLegacyPoolClaimUrl: (poolId: string) =>
      buildLegacyPoolClaimUrl(poolId, launchContext.network),
  };
}

export type UseGasLuckyPoolReturn = ReturnType<typeof useGasLuckyPool>;
