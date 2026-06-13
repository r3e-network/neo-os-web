import { createObservable, createDerived, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import {
  useContractInteraction,
  waitForDepositConfirmation,
  DepositConfirmedActionFailedError,
} from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { parseBigInt, parseDateInput } from "@shared/utils/parsers";
import { ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import { extractTxid } from "@shared/utils/transaction";
import { BLOCKCHAIN_CONSTANTS, TIME_CONSTANTS, resolveNeoNetwork } from "@shared/constants";
import type { Network } from "@shared/utils/n3index";
import type { RoundItem } from "../pages/index/components/RoundList";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const APP_ID = "miniapp-quadratic-funding";

export function useQuadraticRounds() {
  const { t } = createUseI18n(messages)();
  const wallet = useWallet() as WalletSDK;
  const address = refToObservable(wallet.address);
  const chainType = refToObservable(wallet.chainType);
  const { read, invokeDirectly, ensureWallet } = useContractInteraction({
    appId: "miniapp-quadratic-funding",
    t,
    wallet,
  });
  const { ensure: ensureAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t("contractMissing") : t(key)
  );

  const rounds = createObservable<RoundItem[]>([]);
  const selectedRoundId = createObservable<string>("");
  const isRefreshingRounds = createObservable(false);
  const isCreatingRound = createObservable(false);
  const isAddingMatching = createObservable(false);
  const isFinalizing = createObservable(false);
  const isClaimingUnused = createObservable(false);
  const isCancelling = createObservable(false);
  // Display-order 0x hex of the platform admin (the only address the deployed
  // contract authorizes for FinalizeRound — see Methods.cs CheckWitness(Admin)).
  const adminHash = createObservable<string>("");
  const sm = useStatusMessage();
  const status = refToObservable(sm.status);
  const { setStatus } = sm;

  const selectedRound = createDerived(() => rounds.get().find((round) => round.id === selectedRoundId.get()) || null, []);

  // Round.creator arrives as a display-order 0x script hash (parseRound
  // normalizes it via parseHash160); ownerMatchesAddress converts the connected
  // base58 wallet address to the same form before comparing — the previous
  // hex-vs-base58 === check was always false, disabling every owner control.
  const isSelectedRoundCreator = createDerived(() => {
    const round = selectedRound.get();
    return Boolean(round && ownerMatchesAddress(round.creator, address.get()));
  }, []);

  const isAdmin = createDerived(() => {
    const admin = adminHash.get();
    return Boolean(admin && ownerMatchesAddress(admin, address.get()));
  }, []);

  const canManageSelectedRound = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isSelectedRoundCreator.get()) return false;
    return !round.cancelled && !round.finalized;
  }, []);

  // FinalizeRound is restricted to the platform admin (or gateway) on-chain, not
  // the round creator — gate the button on admin identity so it never lands an
  // "unauthorized" revert.
  const canFinalizeSelectedRound = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isAdmin.get()) return false;
    return !round.cancelled && !round.finalized;
  }, []);

  // CancelRound is creator-only AND requires the round to be pre-start with zero
  // contributions (the deployed contract asserts both).
  const canCancelSelectedRound = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isSelectedRoundCreator.get()) return false;
    if (round.cancelled || round.finalized) return false;
    if (round.totalContributed !== 0n) return false;
    return round.startTime === 0 || Date.now() < round.startTime;
  }, []);

  const canClaimUnused = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isSelectedRoundCreator.get()) return false;
    return round.finalized && !round.cancelled && round.matchingRemaining > 0n;
  }, []);

  const ensureContractAddress = async () => {
    return ensureAddress({ silentChainCheck: true });
  };

  const walletNetwork = (): Network => resolveNeoNetwork(chainType.get() ?? "");

  /**
   * Deposit-then-act for the credit-backed write methods.
   *
   * CreateRound / AddMatchingPool / Contribute consume prepaid asset credit
   * (ConsumeDirectAssetCredit) that must first be deposited via a NEP-17
   * transfer carrying a `miniapp-quadratic-funding:*` memo. A bare invoke faults
   * "insufficient prepaid asset". This transfers the exact amount, waits for the
   * deposit to land in a block, then fires the consuming call.
   */
  const depositThenInvoke = async (
    assetHash: string,
    amount: string,
    memo: string,
    operation: string,
    args: { type: string; value: unknown }[],
    contract: string,
  ) => {
    const from = address.get() as string;
    const transferTx = await invokeDirectly(
      "transfer",
      [
        { type: "Hash160", value: from },
        { type: "Hash160", value: contract },
        { type: "Integer", value: amount },
        { type: "String", value: memo },
      ],
      assetHash,
    );
    const depositTxid = extractTxid(transferTx.tx as unknown) || transferTx.txid;
    const settlement = await waitForDepositConfirmation(depositTxid, {
      network: walletNetwork(),
      contractHash: assetHash,
    });
    if (settlement === "unreachable") {
      await new Promise((resolve) => setTimeout(resolve, TIME_CONSTANTS.SECOND_MS * 4));
    }
    try {
      return await invokeDirectly(operation, args as never, contract);
    } catch (error) {
      if (settlement === "confirmed") {
        throw new DepositConfirmedActionFailedError(operation, depositTxid, error);
      }
      throw error;
    }
  };

  const refreshAdmin = async () => {
    try {
      const contract = await ensureContractAddress();
      const raw = await read("admin", [], contract);
      const hash = parseHash160(raw);
      adminHash.set(hash && hash !== `0x${"0".repeat(40)}` ? hash : "");
    } catch {
      adminHash.set("");
    }
  };

  const parseRound = (raw: Record<string, unknown>, id: string): RoundItem | null => {
    if (!raw || typeof raw !== "object") return null;
    const matchingPool = parseBigInt(raw.matchingPool);
    const matchingAllocated = parseBigInt(raw.matchingAllocated);
    const matchingWithdrawn = parseBigInt(raw.matchingWithdrawn);
    const matchingRemaining =
      raw.matchingRemaining !== undefined
        ? parseBigInt(raw.matchingRemaining)
        : matchingPool - matchingAllocated - matchingWithdrawn;

    const status = String(raw.status || "");
    // Normalize the contract's UInt160 creator to display-order 0x hex so
    // ownerMatchesAddress can compare it against the connected wallet.
    const creator = parseHash160(raw.creator) || String(raw.creator || "");
    return {
      id,
      creator,
      assetSymbol: String(raw.assetSymbol || ""),
      matchingPool,
      matchingRemaining,
      totalContributed: parseBigInt(raw.totalContributed),
      projectCount: parseBigInt(raw.projectCount),
      startTime: Number.parseInt(String(raw.startTime || "0"), 10) || 0,
      endTime: Number.parseInt(String(raw.endTime || "0"), 10) || 0,
      status,
      finalized: status === "finalized",
      cancelled: status === "cancelled",
      title: String(raw.title || ""),
      description: String(raw.description || ""),
    };
  };

  const fetchRoundIds = async () => {
    const contract = await ensureContractAddress();
    const parsed = await read("getRounds", [
      { type: "Integer", value: "0" },
      { type: "Integer", value: "30" },
    ], contract);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => Number.parseInt(String(value || "0"), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchRoundDetails = async (roundId: string) => {
    const contract = await ensureContractAddress();
    const parsed = await read("getRoundDetails", [{ type: "Integer", value: roundId }], contract);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseRound(parsed as Record<string, unknown>, roundId);
  };

  const refreshRounds = async () => {
    if (isRefreshingRounds.get()) return;
    try {
      isRefreshingRounds.set(true);
      if (!adminHash.get()) await refreshAdmin();
      const ids = await fetchRoundIds();
      const details = await Promise.all(ids.map(fetchRoundDetails));
      rounds.set(details.filter(Boolean) as RoundItem[]);
      if (!selectedRoundId.get() && rounds.get().length > 0) {
        selectedRoundId.set(rounds.get()[0].id);
      }
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isRefreshingRounds.set(false);
    }
  };

  const selectRound = (round: RoundItem) => {
    selectedRoundId.set(round.id);
  };

  const createRound = async (data: {
    title: string;
    description: string;
    asset: string;
    matchingPool: string;
    startTime: string;
    endTime: string;
  }) => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (isCreatingRound.get()) return;

    const title = data.title.trim().slice(0, 60);
    if (!title) {
      setStatus(t("invalidRound"), "error");
      return;
    }

    // parseDateInput returns SECONDS; the deployed contract clock (Runtime.Time)
    // and the stored round times are MILLISECONDS, so scale up before sending.
    const startSeconds = parseDateInput(data.startTime);
    const endSeconds = parseDateInput(data.endTime);
    if (!startSeconds || !endSeconds || startSeconds >= endSeconds) {
      setStatus(t("invalidRound"), "error");
      return;
    }
    const startTime = startSeconds * 1000;
    const endTime = endSeconds * 1000;
    // The contract asserts endTime > Runtime.Time — reject an end already in the
    // past client-side instead of surfacing an "end time in past" revert.
    if (endTime <= Date.now()) {
      setStatus(t("invalidEndTime"), "error");
      return;
    }

    const decimals = data.asset === "NEO" ? 0 : 8;
    const matchingPool = (() => {
      const [intPart = "", fracPart = ""] = data.matchingPool.split(".");
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const value = `${intPart.trim()}${normalized}`;
      return value.replace(/^0+/, "") || "0";
    })();

    // Reject negative / non-numeric amounts that survive the leading-zero strip.
    if (!/^\d+$/.test(matchingPool) || matchingPool === "0") {
      setStatus(t("invalidMatchingPool"), "error");
      return;
    }

    try {
      isCreatingRound.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const assetHash = data.asset === "NEO" ? NEO_HASH : GAS_HASH;
      const description = data.description.trim().slice(0, 240);

      await depositThenInvoke(
        assetHash,
        matchingPool,
        `${APP_ID}:create`,
        "createRound",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Hash160", value: assetHash },
          { type: "Integer", value: matchingPool },
          { type: "Integer", value: startTime.toString() },
          { type: "Integer", value: endTime.toString() },
          { type: "String", value: title },
          { type: "String", value: description },
        ],
        contract,
      );

      setStatus(t("roundCreated"), "success");
      await refreshRounds();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isCreatingRound.set(false);
    }
  };

  const addMatching = async (amount: string) => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (!selectedRound.get() || isAddingMatching.get()) return;

    const decimals = selectedRound.get().assetSymbol === "NEO" ? 0 : 8;
    const parsedAmount = (() => {
      const [intPart = "", fracPart = ""] = amount.split(".");
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const value = `${intPart.trim()}${normalized}`;
      return value.replace(/^0+/, "") || "0";
    })();

    // Reject negative / non-numeric amounts that survive the leading-zero strip.
    if (!/^\d+$/.test(parsedAmount) || parsedAmount === "0") {
      setStatus(t("invalidMatchingPool"), "error");
      return;
    }

    try {
      isAddingMatching.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const assetHash = selectedRound.get().assetSymbol === "NEO" ? NEO_HASH : GAS_HASH;
      await depositThenInvoke(
        assetHash,
        parsedAmount,
        `${APP_ID}:matching`,
        "addMatchingPool",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Integer", value: selectedRound.get().id },
          { type: "Integer", value: parsedAmount },
        ],
        contract,
      );

      setStatus(t("matchingAdded"), "success");
      await refreshRounds();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isAddingMatching.set(false);
    }
  };

  const parseJsonArray = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_e) {
      return null;
    }
  };

  const finalizeRound = async (projectIdsRaw: string, matchedRaw: string) => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (!selectedRound.get() || isFinalizing.get()) return;

    const projectIdsArray = parseJsonArray(projectIdsRaw.trim());
    const matchedArray = parseJsonArray(matchedRaw.trim());
    if (
      !projectIdsArray ||
      !matchedArray ||
      projectIdsArray.length !== matchedArray.length ||
      projectIdsArray.length === 0
    ) {
      setStatus(t("invalidRound"), "error");
      return;
    }

    const projectIds = projectIdsArray
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));

    const decimals = selectedRound.get().assetSymbol === "NEO" ? 0 : 8;
    const matchedAmounts = matchedArray.map((value) => {
      const [intPart = "", fracPart = ""] = String(value).split(".");
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const val = `${intPart.trim()}${normalized}`;
      return val.replace(/^0+/, "") || "0";
    });

    // Any bad project id or matched amount (negative / non-numeric / dropped by
    // the id filter) would desync the parallel arrays sent on-chain — reject
    // client-side instead of surfacing a confusing invoke failure.
    if (
      projectIds.length !== projectIdsArray.length ||
      matchedAmounts.some((value) => !/^\d+$/.test(value))
    ) {
      setStatus(t("invalidRound"), "error");
      return;
    }

    await submitFinalize(projectIds, matchedAmounts);
  };

  // Finalize from already-computed base-unit suggestions (the quadratic-match
  // preview table), bypassing the hand-typed JSON path.
  const finalizeSuggested = async (
    entries: { id: string; matchBaseUnits: string }[],
  ) => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (!selectedRound.get() || isFinalizing.get()) return;

    const projectIds = entries
      .map((entry) => Number.parseInt(String(entry.id), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
    const matchedAmounts = entries.map((entry) => entry.matchBaseUnits);
    if (
      projectIds.length === 0 ||
      projectIds.length !== entries.length ||
      matchedAmounts.some((value) => !/^\d+$/.test(value))
    ) {
      setStatus(t("invalidRound"), "error");
      return;
    }
    await submitFinalize(projectIds, matchedAmounts);
  };

  const submitFinalize = async (projectIds: string[], matchedAmounts: string[]) => {
    try {
      isFinalizing.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeDirectly(
        "finalizeRound",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Integer", value: selectedRound.get().id },
          { type: "Array", value: projectIds.map((value) => ({ type: "Integer", value })) },
          { type: "Array", value: matchedAmounts.map((value) => ({ type: "Integer", value })) },
        ],
        contract,
      );

      setStatus(t("roundFinalized"), "success");
      await refreshRounds();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isFinalizing.set(false);
    }
  };

  const claimUnused = async () => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (!selectedRound.get() || isClaimingUnused.get()) return;

    try {
      isClaimingUnused.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeDirectly(
        "claimUnusedMatching",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Integer", value: selectedRound.get().id },
        ],
        contract,
      );

      setStatus(t("unusedClaimed"), "success");
      await refreshRounds();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isClaimingUnused.set(false);
    }
  };

  const cancelRound = async () => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (!selectedRound.get() || isCancelling.get()) return;

    try {
      isCancelling.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeDirectly(
        "cancelRound",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Integer", value: selectedRound.get().id },
        ],
        contract,
      );

      setStatus(t("roundCancelled"), "success");
      await refreshRounds();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isCancelling.set(false);
    }
  };

  const roundStatusLabel = (statusValue: string) => {
    switch (statusValue) {
      case "upcoming":
        return t("roundStatusUpcoming");
      case "active":
        return t("roundStatusActive");
      case "ended":
        return t("roundStatusEnded");
      case "finalized":
        return t("roundStatusFinalized");
      case "cancelled":
        return t("roundStatusCancelled");
      default:
        return statusValue || t("roundStatusActive");
    }
  };

  const formatSchedule = (startTime: number, endTime: number) => {
    if (!startTime || !endTime) return t("dateUnknown");
    // Round times are stored in milliseconds on-chain — feed Date directly.
    const start = new Date(startTime);
    const end = new Date(endTime);
    return `${new Intl.DateTimeFormat(undefined).format(start)} - ${new Intl.DateTimeFormat(undefined).format(end)}`;
  };

  const formatAmount = (assetSymbolOrAmount: string | bigint | number | null | undefined, maybeAmount?: bigint | number | string | null) => {
    const assetSymbol =
      typeof maybeAmount === "undefined" || maybeAmount === null
        ? "GAS"
        : String(assetSymbolOrAmount || "GAS");
    const amountValue =
      typeof maybeAmount === "undefined" || maybeAmount === null
        ? assetSymbolOrAmount
        : maybeAmount;

    if (amountValue === null || amountValue === undefined || amountValue === "") return "0";
    if (assetSymbol === "NEO") return amountValue.toString();
    let str: string;
    try {
      str = BigInt(amountValue).toString().padStart(9, "0");
    } catch (_error) {
      return amountValue.toString();
    }
    const intPart = str.slice(0, -8) || "0";
    const fracPart = str.slice(-8);
    const normalized = fracPart.replace(/0+$/, "");
    return normalized ? `${intPart}.${normalized}` : intPart;
  };

  return {
    address,
    rounds,
    selectedRoundId,
    selectedRound,
    adminHash,
    isAdmin,
    isRefreshingRounds,
    isCreatingRound,
    isAddingMatching,
    isFinalizing,
    isClaimingUnused,
    isCancelling,
    canManageSelectedRound,
    canFinalizeSelectedRound,
    canClaimUnused,
    canCancelSelectedRound,
    status,
    refreshRounds,
    refreshAdmin,
    selectRound,
    createRound,
    addMatching,
    finalizeRound,
    finalizeSuggested,
    claimUnused,
    cancelRound,
    roundStatusLabel,
    formatSchedule,
    formatAmount,
    setStatus,
    ensureContractAddress,
  };
}
