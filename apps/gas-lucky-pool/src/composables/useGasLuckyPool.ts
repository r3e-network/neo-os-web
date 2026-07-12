import { createDerived, createObservable } from "@shared/react/context";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  formatGas,
  formatHash,
  fromFixed8,
  parsePositiveFixed8,
} from "@shared/utils/format";
import { getLaunchParam } from "@shared/utils/launch-params";
import {
  ONEGATE_ADDRESS_DETECTION_TIMEOUT_MS,
  buildClaimKeyUrl,
  buildLegacyPoolClaimUrl,
  createOneGateAddressDiagnostics,
  luckPercentFromFixed8,
  startOneGateDapiProviderDiscovery,
  throwOneGateAddressRequiredError,
  waitForOneGateInjectedAddress,
  walletAddressFromParams,
} from "./useGasLuckyPool.onegate";
import {
  APP_ID,
  MAX_VAULT_REWARD_FIXED8,
  ONEGATE_VAULT_DAPP_ID,
  ONE_GAS_FIXED8,
  asBigInt,
  asNumber,
  eventValue,
  isWalletUnavailableError,
  normalizeClaimIdentity,
  normalizeClaimKey,
  normalizeNeoAddress,
  normalizePoolId,
  parsePool,
  parsePoolAccount,
  type ClaimLaunchIdentity,
  type CreatePoolForm,
  type GasLuckyClaim,
  type GasLuckyPool,
  type GasPoolClaimProgress,
  type GasPoolStatus,
  type GasPoolSuccessType,
  type TopUpPoolForm,
  type UseGasLuckyPoolOptions,
} from "./useGasLuckyPool.shared";

export { normalizeClaimKey, normalizePoolId } from "./useGasLuckyPool.shared";
export type {
  CreatePoolForm,
  GasLuckyClaim,
  GasLuckyPool,
  GasPoolClaimProgress,
  GasPoolStatus,
  GasPoolSuccessType,
  TopUpPoolForm,
  UseGasLuckyPoolOptions,
} from "./useGasLuckyPool.shared";

export function useGasLuckyPool({
  app,
  launchContext,
  t,
  paidLaneEnabled = false,
  oneGateClaimEnabled = false,
}: UseGasLuckyPoolOptions) {
  const launchClaimKey = normalizeClaimKey(
    getLaunchParam(launchContext, ["claimKey", "key", "code", "k"], ""),
  );
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
      ) ||
      (launchClaimKey ? ONEGATE_VAULT_DAPP_ID : undefined),
    appId: normalizeClaimIdentity(launchContext.appId) || APP_ID,
    walletAddress: walletAddressFromParams(launchContext) || undefined,
  };
  if (
    oneGateClaimEnabled &&
    (Boolean(launchClaimKey) ||
      launchContext.source === "onegate" ||
      Boolean(launchIdentity.oneGateAppId))
  ) {
    startOneGateDapiProviderDiscovery();
  }
  const currentPoolId = createObservable(
    normalizePoolId(
      getLaunchParam(launchContext, ["poolId", "pool", "id"], ""),
    ),
  );
  const currentClaimKey = createObservable(
    launchClaimKey,
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
  const claimProgress = createObservable<GasPoolClaimProgress>("");
  const lastRefundAmount = createObservable<bigint>(0n);
  const lastRefundPoolId = createObservable("");
  const lastFundAmount = createObservable<bigint>(0n);
  const lastFundPoolId = createObservable("");
  const lastSuccessType = createObservable<GasPoolSuccessType>("");
  const lastError = createObservable("");
  const gasCredit = createObservable<bigint>(0n);

  function assertPaidLane(): void {
    if (!paidLaneEnabled) {
      throw new Error(t("gameFiMaintenanceBody"));
    }
  }

  function assertOneGateLane(): void {
    if (!oneGateClaimEnabled) {
      throw new Error(t("gameFiMaintenanceBody"));
    }
  }

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
    assertPaidLane();
    const id = normalizePoolId(poolId);
    if (!id) {
      currentPool.set(null);
      return null;
    }
    const raw = await app.chain.readArray("getRangeGasPool", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: id },
    ]);
    const parsed = parsePool(id, raw);
    currentPool.set(parsed);
    return parsed;
  }

  async function loadRecentPools() {
    assertPaidLane();
    try {
      const events = await app.chain.events("RangeGasPoolCreated", {
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
            creator: parsePoolAccount(eventValue(event, 2)),
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
            status: "active" as GasPoolStatus,
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
    assertPaidLane();
    try {
      const events = await app.chain.events("RangeGasPoolClaimed", {
        limit: 12,
      });
      const items = events
        .map((event) => {
          const appId = String(eventValue(event, 0) ?? "");
          if (appId !== APP_ID) return null;
          const poolId = String(eventValue(event, 1) ?? "");
          const claimer = parsePoolAccount(eventValue(event, 2));
          if (!poolId || !claimer) return null;
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
    assertPaidLane();
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
        lastError.set(app.errors.messageOf(error, t("loadFailed")));
      }
    } finally {
      isLoading.set(false);
    }
  }

  function parseGasAmountFixed8(value: unknown): bigint | null {
    const fixed8 = parsePositiveFixed8(String(value ?? "0"));
    return fixed8 ? BigInt(fixed8) : null;
  }

  function validateCreateForm(form: CreatePoolForm) {
    const total = parseGasAmountFixed8(form.totalAmount);
    const min = parseGasAmountFixed8(form.minClaim);
    const max = parseGasAmountFixed8(form.maxClaim);
    const maxClaims = Math.floor(Number(form.maxClaims || 0));
    const expiryHours = Number(form.expiryHours || 0);

    if (!total || total < ONE_GAS_FIXED8) throw new Error(t("invalidTotal"));
    if (!min || !max || min < ONE_GAS_FIXED8 || max > MAX_VAULT_REWARD_FIXED8 || min > max)
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
      // CreateRangeGasPool expects the lifetime in MILLISECONDS (Runtime.Time is
      // ms on Neo N3 — see PlatformSocial.Envelope.RangePool.cs). Sending seconds
      // made a 24h pool expire in ~86s. 3600 s/h × 1000 ms/s.
      expiryMs: Math.round(expiryHours * 3600 * 1000),
    };
  }

  async function createPool(form: CreatePoolForm) {
    assertPaidLane();
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
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const creator = await app.chain.ensureWallet();
      const result = await app.chain.invokeWithPayment(
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
          { type: "Integer", value: String(parsed.expiryMs) },
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
      lastError.set(app.errors.messageOf(error, t("createFailed")));
      await loadGasCredit().catch(() => undefined);
      throw error;
    } finally {
      isCreating.set(false);
    }
  }

  async function loadGasCredit() {
    assertPaidLane();
    if (isCreditLoading.get()) return gasCredit.get();
    isCreditLoading.set(true);
    lastError.set("");
    try {
      const user = await app.chain.ensureWallet();
      const amount = await app.chain
        .query("getDirectGasCredit", [{ type: "Hash160", value: user }])
        .asBigInt();
      gasCredit.set(amount);
      return amount;
    } catch (error) {
      lastError.set(app.errors.messageOf(error, t("loadFailed")));
      throw error;
    } finally {
      isCreditLoading.set(false);
    }
  }

  async function withdrawGasCredit(amount = gasCredit.get()) {
    assertPaidLane();
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
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const user = await app.chain.ensureWallet();
      const result = await app.chain.invoke(
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
      lastError.set(app.errors.messageOf(error, t("withdrawGasCreditFailed")));
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
      walletAddress:
        [
          record.address,
          record.wallet,
          record.walletAddress,
          record.wallet_address,
          record.account,
          record.accountAddress,
          record.account_address,
          record.neoAddress,
          record.neo_address,
          record.recipient,
          record.recipientAddress,
          record.recipient_address,
          record.userAddress,
          record.user_address,
          record.toAddress,
          record.to_address,
        ]
          .map(normalizeNeoAddress)
          .find(Boolean) ||
        launchIdentity.walletAddress ||
        undefined,
    };
  }

  async function resolveClaimAddress(identity: ClaimLaunchIdentity) {
    const diagnostics = createOneGateAddressDiagnostics();
    const explicitOneGateLaunch =
      launchContext.source === "onegate" ||
      !!identity.oneGateAppId ||
      !!currentClaimKey.get();
    if (explicitOneGateLaunch) {
      const injectedAddress = await waitForOneGateInjectedAddress(
        ONEGATE_ADDRESS_DETECTION_TIMEOUT_MS,
        diagnostics,
        launchContext.network,
      );
      if (injectedAddress) return injectedAddress;
      await throwOneGateAddressRequiredError({
        message: t("oneGateWalletAddressRequired"),
        diagnostics,
        launchContext,
        identity,
      });
    }

    const launchAddress = normalizeNeoAddress(identity.walletAddress);
    if (launchAddress) return launchAddress;

    const currentAddress = normalizeNeoAddress(app.chain.address?.get?.());
    if (currentAddress) return currentAddress;

    try {
      const walletAddress = await app.chain.ensureWallet();
      diagnostics.wallet = "available";
      const normalizedWalletAddress = normalizeNeoAddress(walletAddress);
      return normalizedWalletAddress || walletAddress;
    } catch (error) {
      if (isWalletUnavailableError(error)) {
        diagnostics.wallet = "unavailable";
        await throwOneGateAddressRequiredError({
          message: t("oneGateWalletAddressRequired"),
          diagnostics,
          launchContext,
          identity,
        });
      }
      diagnostics.wallet = "error";
      throw error;
    }
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
    assertOneGateLane();
    const search = new URLSearchParams({
      claimKey,
      address,
      network: launchContext.network ?? "mainnet",
    });
    addClaimIdentity(search, identity);
    const response = await fetchWithTimeout(
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
      status?: "submitted" | "paid" | "failed";
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
    assertOneGateLane();
    if (isClaiming.get()) return null;
    isClaiming.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("submitted");
    claimProgress.set("wallet");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const address = await resolveClaimAddress(identity);
      claimProgress.set("submitting");
      const request: Record<string, string> = {
        claimKey,
        address,
        network: launchContext.network ?? "mainnet",
      };
      addClaimIdentity(request, identity);
      const response = await fetchWithTimeout("/api/onegate-vault/claim", {
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
      claimStatus.set(result.status === "paid" ? "paid" : "submitted");
      claimProgress.set(result.status === "paid" ? "paid" : "confirming");
      if (result.status === "paid") {
        lastSuccessType.set("claim");
        const amount = asBigInt(result.amountFixed8);
        if (amount > 0n) lastClaimAmount.set(amount);
        lastClaimLuckPercent.set(
          String(
            result.luckPercent || luckPercentFromFixed8(result.amountFixed8),
          ),
        );
      }

      if (result.status !== "paid") {
        const finalStatus = await pollClaimStatus(
          claimKey,
          address,
          identity,
        ).catch(() => undefined);
        if (finalStatus?.status === "failed") {
          throw new Error(t("claimFailed"));
        }
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
      claimProgress.set("failed");
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
    assertOneGateLane();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      const status = await fetchClaimStatus(claimKey, address, identity);
      if (status.status === "paid" && status.amountFixed8) {
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
        claimProgress.set("paid");
        lastSuccessType.set("claim");
        return status;
      }
      if (status.status === "submitted") {
        claimStatus.set("submitted");
        claimProgress.set("confirming");
      }
      if (status.status === "failed") {
        claimStatus.set("failed");
        claimProgress.set("failed");
        lastSuccessType.set("");
        lastError.set(t("claimFailed"));
        return status;
      }
    }
    return null;
  }

  async function checkClaimStatus(input: unknown = currentClaimKey.get()) {
    assertOneGateLane();
    const explicitClaimKey =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).claimKey
        : input;
    const key = normalizeClaimKey(explicitClaimKey);
    if (!key) throw new Error(t("claimKeyRequired"));
    const identity = claimIdentityFromInput(input);
    const address = await resolveClaimAddress(identity);
    const status = await fetchClaimStatus(key, address, identity);
    lastClaimKey.set(key);
    if (status.txHash) lastTxid.set(String(status.txHash));
    if (status.status === "paid" && status.amountFixed8) {
      const amount = asBigInt(status.amountFixed8);
      if (amount > 0n) lastClaimAmount.set(amount);
      lastClaimLuckPercent.set(
        String(
          status.luckPercent || luckPercentFromFixed8(status.amountFixed8),
        ),
      );
    }
    claimStatus.set(
      status.status === "paid"
        ? "paid"
        : status.status === "failed"
          ? "failed"
          : "submitted",
    );
    claimProgress.set(
      status.status === "paid"
        ? "paid"
        : status.status === "failed"
          ? "failed"
          : "confirming",
    );
    if (status.status === "paid") lastSuccessType.set("claim");
    if (status.status === "failed") {
      lastSuccessType.set("");
      lastError.set(t("claimFailed"));
    }
    return status;
  }

  async function claimPool(
    input: unknown = currentClaimKey.get() || currentPoolId.get(),
  ) {
    assertPaidLane();
    const explicitClaimKey =
      input && typeof input === "object"
        ? (input as Record<string, unknown>).claimKey
        : currentClaimKey.get() || (!normalizePoolId(input) ? input : "");
    const claimKey = normalizeClaimKey(explicitClaimKey);
    if (claimKey) {
      assertOneGateLane();
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
    claimProgress.set("wallet");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const claimer = await app.chain.ensureWallet();
      claimProgress.set("submitting");
      const result = await app.chain.invoke(
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
      claimStatus.set("paid");
      claimProgress.set("paid");
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
      claimStatus.set("failed");
      claimProgress.set("failed");
      lastError.set(error instanceof Error ? error.message : t("claimFailed"));
      throw error;
    } finally {
      isClaiming.set(false);
    }
  }

  async function refundPool(poolId = currentPoolId.get()) {
    assertPaidLane();
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
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const result = await app.chain.invoke(
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
      lastError.set(app.errors.messageOf(error, t("refundFailed")));
      throw error;
    } finally {
      isRefunding.set(false);
    }
  }

  async function topUpPool(form: TopUpPoolForm = {}) {
    assertPaidLane();
    const id = normalizePoolId(form.poolId ?? currentPoolId.get());
    if (!id) throw new Error(t("poolIdRequired"));
    const amount = parseGasAmountFixed8(form.amount);
    if (!amount || amount <= 0n) throw new Error(t("invalidTopUpAmount"));
    if (isFunding.get()) return null;
    isFunding.set(true);
    lastError.set("");
    lastSuccessType.set("");
    lastClaimAmount.set(0n);
    lastClaimPoolId.set("");
    lastClaimKey.set("");
    lastClaimLuckPercent.set("");
    claimStatus.set("");
    claimProgress.set("");
    lastRefundAmount.set(0n);
    lastRefundPoolId.set("");
    lastFundAmount.set(0n);
    lastFundPoolId.set("");
    try {
      const creator = await app.chain.ensureWallet();
      const result = await app.chain.invokeWithPayment(
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
      lastError.set(app.errors.messageOf(error, t("topUpFailed")));
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
    claimProgress,
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
