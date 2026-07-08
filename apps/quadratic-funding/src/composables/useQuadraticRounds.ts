/**
 * useQuadraticRounds — round listing, identity gating and the round-level
 * write flows, rewritten onto the MiniApp framework SDK (ctx.framework).
 *
 * Legacy-stack rewrite (plan §3 Wave 5): reads go through app.chain.readRaw
 * (same stack-item parsing as before — the framework fronts the identical
 * host read lane), writes through app.chain.invoke, and the credit-backed
 * deposit-then-act methods (CreateRound / AddMatchingPool) through
 * app.funds.prepayAndCall's asset deposit lane with `notify: 'silent'` — the
 * flow kit owns ALL user-visible messaging (in-card banner + platform notify
 * channel) so the copy stays byte-identical to the pre-rewrite app.
 *
 * Every write flow resolves with an explicit success boolean (the flow kit's
 * app.notify.guardResult result) — the replacement for the legacy
 * `succeededSince` status-snapshot success detection.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { parseBigInt, parseDateInput } from "@shared/utils/parsers";
import { ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { QuadraticFlowKit, Translator } from "./quadraticFlowKit";
import type { RoundItem } from "./quadraticTypes";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const APP_ID = "miniapp-quadratic-funding";

export interface UseQuadraticRoundsOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: Translator;
  /** Shared flow plumbing (guard/banner/preconditions/scaler). */
  kit: QuadraticFlowKit;
}

export function useQuadraticRounds({ app, t, kit }: UseQuadraticRoundsOptions) {
  const { arg } = app.chain;
  const address = app.chain.address as Observable<string | null>;

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

  const selectedRound = createDerived(
    () => rounds.get().find((round) => round.id === selectedRoundId.get()) || null,
    [rounds, selectedRoundId],
  );

  // Round.creator arrives as a display-order 0x script hash (parseRound
  // normalizes it via parseHash160); ownerMatchesAddress converts the connected
  // base58 wallet address to the same form before comparing — the previous
  // hex-vs-base58 === check was always false, disabling every owner control.
  const isSelectedRoundCreator = createDerived(() => {
    const round = selectedRound.get();
    return Boolean(round && ownerMatchesAddress(round.creator, address.get()));
  }, [selectedRound, address]);

  const isAdmin = createDerived(() => {
    const admin = adminHash.get();
    return Boolean(admin && ownerMatchesAddress(admin, address.get()));
  }, [adminHash, address]);

  const canManageSelectedRound = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isSelectedRoundCreator.get()) return false;
    return !round.cancelled && !round.finalized;
  }, [selectedRound, isSelectedRoundCreator]);

  // FinalizeRound is restricted to the platform admin (or gateway) on-chain, not
  // the round creator — gate the button on admin identity so it never lands an
  // "unauthorized" revert.
  const canFinalizeSelectedRound = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isAdmin.get()) return false;
    return !round.cancelled && !round.finalized;
  }, [selectedRound, isAdmin]);

  // CancelRound is creator-only AND requires the round to be pre-start with zero
  // contributions (the deployed contract asserts both).
  const canCancelSelectedRound = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isSelectedRoundCreator.get()) return false;
    if (round.cancelled || round.finalized) return false;
    if (round.totalContributed !== 0n) return false;
    return round.startTime === 0 || Date.now() < round.startTime;
  }, [selectedRound, isSelectedRoundCreator]);

  const canClaimUnused = createDerived(() => {
    const round = selectedRound.get();
    if (!round || !isSelectedRoundCreator.get()) return false;
    return round.finalized && !round.cancelled && round.matchingRemaining > 0n;
  }, []);

  const refreshAdmin = async () => {
    try {
      const raw = await app.chain.readRaw("admin", []);
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
    const parsed = await app.chain.readRaw("getRounds", [
      arg.integer(0),
      arg.integer(30),
    ]);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => Number.parseInt(String(value || "0"), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchRoundDetails = async (roundId: string) => {
    const parsed = await app.chain.readRaw("getRoundDetails", [arg.integer(roundId)]);
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
      const firstRound = rounds.get()[0];
      if (!selectedRoundId.get() && firstRound) {
        selectedRoundId.set(firstRound.id);
      }
    } catch (e) {
      kit.reportError(e);
    } finally {
      isRefreshingRounds.set(false);
    }
  };

  const selectRound = (round: RoundItem) => {
    selectedRoundId.set(round.id);
  };

  /**
   * Deposit-then-act via the framework prepay lane. CreateRound /
   * AddMatchingPool consume prepaid asset credit (ConsumeDirectAssetCredit)
   * that must first be deposited via a NEP-17 transfer carrying a
   * `miniapp-quadratic-funding:*` memo — a bare invoke faults "insufficient
   * prepaid asset". The lane transfers the exact amount on the ASSET token
   * contract, waits for the deposit to land in a block (kit.settleDeposit),
   * then fires the consuming call; a consuming-call failure after the
   * broadcast deposit surfaces as the identity-stable
   * FrameworkPrepaidActionError whose recovery copy reaches the banner
   * verbatim (the credit remains withdrawable on the contract).
   */
  const prepayThenInvoke = async (
    assetHash: string,
    amount: string,
    memo: string,
    operation: string,
    args: ReturnType<typeof arg.integer>[],
  ) => {
    // The deposit lane resolves the transfer recipient from the same
    // contract-address accessor — fail with this app's copy before any funds move.
    await kit.ensureContract();
    await app.funds.prepayAndCall({
      operation,
      args,
      amountFixed8: amount,
      memo,
      deposit: {
        scriptHash: assetHash,
        confirm: (txid) => kit.settleDeposit(txid, assetHash),
      },
      notify: "silent",
    });
  };

  const createRound = async (data: {
    title: string;
    description: string;
    asset: string;
    matchingPool: string;
    startTime: string;
    endTime: string;
  }): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (isCreatingRound.get()) return false;

    const title = data.title.trim().slice(0, 60);
    if (!title) {
      kit.setStatus(t("invalidRound"), "error");
      return false;
    }

    // parseDateInput returns SECONDS; the deployed contract clock (Runtime.Time)
    // and the stored round times are MILLISECONDS, so scale up before sending.
    const startSeconds = parseDateInput(data.startTime);
    const endSeconds = parseDateInput(data.endTime);
    if (!startSeconds || !endSeconds || startSeconds >= endSeconds) {
      kit.setStatus(t("invalidRound"), "error");
      return false;
    }
    const startTime = startSeconds * 1000;
    const endTime = endSeconds * 1000;
    // The contract asserts endTime > Runtime.Time — reject an end already in the
    // past client-side instead of surfacing an "end time in past" revert.
    if (endTime <= Date.now()) {
      kit.setStatus(t("invalidEndTime"), "error");
      return false;
    }

    // Negative / non-numeric / zero amounts come back as a null parse (never a
    // throw) so this localized rejection path keeps working.
    const matchingPoolResult = kit.scaleAssetAmount(data.asset, data.matchingPool);
    if (!matchingPoolResult.ok) {
      kit.setStatus(
        t(matchingPoolResult.reason === "fractionalNeo" ? "neoNoFractional" : "invalidMatchingPool"),
        "error",
      );
      return false;
    }
    const matchingPool = matchingPoolResult.value;

    isCreatingRound.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const assetHash = data.asset === "NEO" ? NEO_HASH : GAS_HASH;
        const description = data.description.trim().slice(0, 240);

        await prepayThenInvoke(
          assetHash,
          matchingPool,
          `${APP_ID}:create`,
          "createRound",
          [
            arg.hash160(caller),
            arg.hash160(assetHash),
            arg.integer(matchingPool),
            arg.integer(startTime.toString()),
            arg.integer(endTime.toString()),
            arg.string(title),
            arg.string(description),
          ],
        );
      }, "roundCreated");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      isCreatingRound.set(false);
    }
  };

  const addMatching = async (amount: string): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isAddingMatching.get()) return false;

    const parsedAmountResult = kit.scaleAssetAmount(
      selectedRound.get()!.assetSymbol,
      amount,
    );
    if (!parsedAmountResult.ok) {
      kit.setStatus(
        t(parsedAmountResult.reason === "fractionalNeo" ? "neoNoFractional" : "invalidMatchingPool"),
        "error",
      );
      return false;
    }
    const parsedAmount = parsedAmountResult.value;

    isAddingMatching.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const assetHash = selectedRound.get()!.assetSymbol === "NEO" ? NEO_HASH : GAS_HASH;
        await prepayThenInvoke(
          assetHash,
          parsedAmount,
          `${APP_ID}:matching`,
          "addMatchingPool",
          [
            arg.hash160(caller),
            arg.integer(selectedRound.get()!.id),
            arg.integer(parsedAmount),
          ],
        );
      }, "matchingAdded");
      if (ok) await refreshRounds();
      return ok;
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

  const finalizeRound = async (
    projectIdsRaw: string,
    matchedRaw: string,
  ): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isFinalizing.get()) return false;

    const projectIdsArray = parseJsonArray(projectIdsRaw.trim());
    const matchedArray = parseJsonArray(matchedRaw.trim());
    if (
      !projectIdsArray ||
      !matchedArray ||
      projectIdsArray.length !== matchedArray.length ||
      projectIdsArray.length === 0
    ) {
      kit.setStatus(t("invalidRound"), "error");
      return false;
    }

    const projectIds = projectIdsArray
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));

    const matchedResults = matchedArray.map((value) =>
      kit.scaleAssetAmount(selectedRound.get()!.assetSymbol, String(value)),
    );
    if (matchedResults.some((result) => !result.ok && result.reason === "fractionalNeo")) {
      kit.setStatus(t("neoNoFractional"), "error");
      return false;
    }
    const matchedAmounts = matchedResults.map((result) => (result.ok ? result.value : "invalid"));

    // Any bad project id or matched amount (negative / non-numeric / dropped by
    // the id filter) would desync the parallel arrays sent on-chain — reject
    // client-side instead of surfacing a confusing invoke failure.
    if (
      projectIds.length !== projectIdsArray.length ||
      matchedAmounts.some((value) => !/^\d+$/.test(value))
    ) {
      kit.setStatus(t("invalidRound"), "error");
      return false;
    }

    return submitFinalize(projectIds, matchedAmounts);
  };

  // Finalize from already-computed base-unit suggestions (the quadratic-match
  // preview table), bypassing the hand-typed JSON path.
  const finalizeSuggested = async (
    entries: { id: string; matchBaseUnits: string }[],
  ): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isFinalizing.get()) return false;

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
      kit.setStatus(t("invalidRound"), "error");
      return false;
    }
    return submitFinalize(projectIds, matchedAmounts);
  };

  const submitFinalize = async (
    projectIds: string[],
    matchedAmounts: string[],
  ): Promise<boolean> => {
    isFinalizing.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        await app.chain.invoke("finalizeRound", [
          arg.hash160(caller),
          arg.integer(selectedRound.get()!.id),
          arg.array(projectIds.map((value) => arg.integer(value))),
          arg.array(matchedAmounts.map((value) => arg.integer(value))),
        ]);
      }, "roundFinalized");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      isFinalizing.set(false);
    }
  };

  const claimUnused = async (): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isClaimingUnused.get()) return false;

    isClaimingUnused.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        await app.chain.invoke("claimUnusedMatching", [
          arg.hash160(caller),
          arg.integer(selectedRound.get()!.id),
        ]);
      }, "unusedClaimed");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      isClaimingUnused.set(false);
    }
  };

  const cancelRound = async (): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isCancelling.get()) return false;

    isCancelling.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        await app.chain.invoke("cancelRound", [
          arg.hash160(caller),
          arg.integer(selectedRound.get()!.id),
        ]);
      }, "roundCancelled");
      if (ok) await refreshRounds();
      return ok;
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
  };
}
