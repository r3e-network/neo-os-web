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
import { FrameworkPrepaidActionError, type MiniAppFramework } from "@shared/react";
import { parseBigInt, parseDateInput } from "@shared/utils/parsers";
import { ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { truncateUtf8Bytes, type QuadraticFlowKit, type Translator } from "./quadraticFlowKit";
import type { RoundItem } from "./quadraticTypes";
import type { QuadraticPendingTracker } from "./quadraticPending";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const APP_ID = "miniapp-quadratic-funding";

/**
 * Contract limits in the contract's unit — UTF-8 BYTES, not UTF-16 chars
 * (MiniAppQuadraticFunding.cs MAX_TITLE_LENGTH / MAX_DESC_LENGTH; see
 * truncateUtf8Bytes in quadraticFlowKit). createRound runs on the
 * deposit-then-act lane, so an over-byte title reverting "title too long"
 * would strand the already-landed matching-pool deposit as
 * reclaimable-but-manual prepaid credit.
 */
const MAX_TITLE_BYTES = 60;
const MAX_DESC_BYTES = 240;

export interface UseQuadraticRoundsOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: Translator;
  /** Shared flow plumbing (guard/banner/preconditions/scaler). */
  kit: QuadraticFlowKit;
  /** Fail-closed capability gate for prepaid money-moving actions. */
  ensureFundingWritesEnabled?: () => Promise<boolean>;
  /** Reject finalization unless every live project is loaded and represented exactly once. */
  validateFinalizationSnapshot?: (projectIds: string[]) => boolean;
  pending?: QuadraticPendingTracker;
}

export function useQuadraticRounds({
  app,
  t,
  kit,
  ensureFundingWritesEnabled = async () => true,
  validateFinalizationSnapshot = () => true,
  pending,
}: UseQuadraticRoundsOptions) {
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

  const reservePendingWrite = (): string | undefined | null => {
    if (!pending) return undefined;
    const reservation = pending.reserve();
    if (!reservation) kit.setStatus(t("pendingBlocksWrites"), "error");
    return reservation;
  };
  const revalidateFundingWriteScope = async () => {
    if (!(await ensureFundingWritesEnabled())) {
      throw new Error(t("fundingWriteScopeChanged"));
    }
  };

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
    return !round.cancelled && !round.finalized && Date.now() >= round.endTime;
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
  }, [selectedRound, isSelectedRoundCreator]);

  const eventInteger = (event: unknown, index: number): bigint | null => {
    const value = eventStateValue(event, index);
    if (typeof value === "bigint") return value;
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = String(value).trim();
    if (!/^-?\d+$/.test(text)) return null;
    try {
      return BigInt(text);
    } catch {
      return null;
    }
  };

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
    const totalRaw = await app.chain.readRaw("totalRounds", []);
    if (totalRaw === null || totalRaw === undefined || !/^\d+$/.test(String(totalRaw))) {
      throw new Error(t("chainSnapshotUnavailable"));
    }
    const total = parseBigInt(totalRaw);
    const maxRounds = 5_000n;
    if (total < 0n || total > maxRounds) throw new Error(t("collectionTooLarge"));
    const ids: string[] = [];
    const pageSize = 30;
    for (let offset = 0; BigInt(offset) < total; offset += pageSize) {
      const parsed = await app.chain.readRaw("getRounds", [
        arg.integer(offset),
        arg.integer(pageSize),
      ]);
      if (!Array.isArray(parsed)) throw new Error(t("chainSnapshotUnavailable"));
      const page = parsed
        .map((value) => String(value ?? "").trim())
        .filter((value) => /^[1-9]\d*$/.test(value));
      ids.push(...page);
      if (parsed.length < pageSize && BigInt(ids.length) < total) {
        throw new Error(t("chainSnapshotUnavailable"));
      }
    }
    const unique = [...new Set(ids)];
    if (BigInt(unique.length) !== total) throw new Error(t("chainSnapshotUnavailable"));
    return unique;
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
      const details: Array<RoundItem | null> = [];
      for (let offset = 0; offset < ids.length; offset += 25) {
        details.push(...await Promise.all(ids.slice(offset, offset + 25).map(fetchRoundDetails)));
      }
      if (details.some((round) => !round)) throw new Error(t("chainSnapshotUnavailable"));
      const next = (details as RoundItem[]).sort((left, right) => {
        const priority: Record<string, number> = { active: 0, upcoming: 1, ended: 2, finalized: 3, cancelled: 4 };
        const rank = (priority[left.status] ?? 5) - (priority[right.status] ?? 5);
        return rank || Number(right.id) - Number(left.id);
      });
      rounds.set(next);
      const currentStillExists = next.some((round) => round.id === selectedRoundId.get());
      if (!currentStillExists) {
        selectedRoundId.set(next[0]?.id ?? "");
      }
    } catch (e) {
      rounds.set([]);
      selectedRoundId.set("");
      // This runs on mount, so it is the first thing a visitor triggers. With
      // no wallet or host bridge there is no contract to read and this throw
      // was inevitable — reporting it as "Contract address not configured"
      // greeted every new visitor with an amber fault they had not caused and
      // could not fix. An empty round list is the honest outcome, and the desk
      // already renders it as an invitation to load or create a round.
      if (await kit.hasChainContext()) kit.reportError(e);
      else kit.clearStatus();
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
    eventName: string,
    matches: (event: unknown) => boolean,
    onTransactionSent?: (txid: string) => void,
  ) => {
    // The deposit lane resolves the transfer recipient from the same
    // contract-address accessor — fail with this app's copy before any funds move.
    await kit.ensureContract();
    const result = await app.funds.prepayAndCall({
      operation,
      args,
      amountFixed8: amount,
      memo,
      deposit: {
        scriptHash: assetHash,
        confirm: (txid) => kit.settleDeposit(txid, assetHash),
      },
      waitForEvent: eventName,
      waitTimeoutMs: 30_000,
      ...(onTransactionSent ? { onTransactionSent } : {}),
      notify: "silent",
    });
    kit.requireVerifiedTransaction(result, matches);
    return result;
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

    // Truncate by UTF-8 BYTES (the contract's unit), not UTF-16 chars — see
    // MAX_TITLE_BYTES. Computed once so the sent args, the pending-write
    // record and the readback comparison can never disagree.
    const title = truncateUtf8Bytes(data.title.trim(), MAX_TITLE_BYTES);
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
    if (data.asset === "GAS" && BigInt(matchingPool) < 10_000_000n) {
      kit.setStatus(t("matchingPoolMinimumGas"), "error");
      return false;
    }
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;

    isCreatingRound.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const assetHash = data.asset === "NEO" ? NEO_HASH : GAS_HASH;
        const description = truncateUtf8Bytes(data.description.trim(), MAX_DESC_BYTES);
        let createdRoundId = "";
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "create-round",
              eventName: "RoundCreated",
              wallet: caller,
              asset: data.asset === "NEO" ? "NEO" : "GAS",
              assetHash,
              amount: matchingPool,
              name: title,
              description,
              startTime: startTime.toString(),
              endTime: endTime.toString(),
            })
          : null;

        await revalidateFundingWriteScope();

        let result;
        try {
          result = await prepayThenInvoke(
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
            "RoundCreated",
            (event) => {
              const eventId = eventInteger(event, 0);
              if (eventId && eventId > 0n) createdRoundId = eventId.toString();
              return Boolean(createdRoundId)
                && ownerMatchesAddress(eventStateValue(event, 1), caller)
                && ownerMatchesAddress(eventStateValue(event, 2), assetHash)
                && eventInteger(event, 3) === BigInt(matchingPool);
            },
            pendingDraft
              ? (txid) => pending?.persistBroadcast(reservation!, pendingDraft, txid)
              : undefined,
          );
        } catch (error) {
          if (error instanceof FrameworkPrepaidActionError && pendingDraft) {
            pending?.persistDeposit(reservation!, pendingDraft, error.txid);
          }
          throw error;
        }

        const readback = await fetchRoundDetails(createdRoundId);
        if (
          !readback
          || !ownerMatchesAddress(readback.creator, caller)
          || readback.assetSymbol !== data.asset
          || readback.matchingPool !== BigInt(matchingPool)
          || readback.startTime !== startTime
          || readback.endTime !== endTime
          || readback.title !== title
        ) {
          throw new Error(t("chainReadbackMismatch"));
        }
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "roundCreated");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
      isCreatingRound.set(false);
    }
  };

  const addMatching = async (amount: string): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    const targetRound = selectedRound.get();
    if (!targetRound || isAddingMatching.get()) return false;

    const parsedAmountResult = kit.scaleAssetAmount(
      targetRound.assetSymbol,
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
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;

    isAddingMatching.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const liveRound = await fetchRoundDetails(targetRound.id);
        if (
          !liveRound
          || liveRound.cancelled
          || liveRound.finalized
          || liveRound.assetSymbol !== targetRound.assetSymbol
        ) {
          throw new Error(t("roundStateChanged"));
        }
        const assetHash = liveRound.assetSymbol === "NEO" ? NEO_HASH : GAS_HASH;
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "add-matching",
              eventName: "MatchingPoolAdded",
              wallet: caller,
              roundId: liveRound.id,
              asset: liveRound.assetSymbol === "NEO" ? "NEO" : "GAS",
              assetHash,
              amount: parsedAmount,
              expectedPool: (liveRound.matchingPool + BigInt(parsedAmount)).toString(),
            })
          : null;
        await revalidateFundingWriteScope();
        let eventTotalPool: bigint | null = null;
        let result;
        try {
          result = await prepayThenInvoke(
            assetHash,
            parsedAmount,
            `${APP_ID}:matching`,
            "addMatchingPool",
            [
              arg.hash160(caller),
              arg.integer(liveRound.id),
              arg.integer(parsedAmount),
            ],
            "MatchingPoolAdded",
            (event) => {
              eventTotalPool = eventInteger(event, 3);
              return eventInteger(event, 0) === BigInt(liveRound.id)
                && ownerMatchesAddress(eventStateValue(event, 1), caller)
                && eventInteger(event, 2) === BigInt(parsedAmount)
                && eventTotalPool !== null
                && eventTotalPool >= liveRound.matchingPool + BigInt(parsedAmount);
            },
            pendingDraft
              ? (txid) => pending?.persistBroadcast(reservation!, pendingDraft, txid)
              : undefined,
          );
        } catch (error) {
          if (error instanceof FrameworkPrepaidActionError && pendingDraft) {
            pending?.persistDeposit(reservation!, pendingDraft, error.txid);
          }
          throw error;
        }
        const readback = await fetchRoundDetails(liveRound.id);
        if (
          !readback
          || eventTotalPool === null
          || readback.matchingPool < eventTotalPool
        ) {
          throw new Error(t("chainReadbackMismatch"));
        }
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "matchingAdded");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
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

    const projectIds = projectIdsArray.map((value) => String(value).trim());

    if (new Set(projectIds).size !== projectIds.length) {
      kit.setStatus(t("invalidRound"), "error");
      return false;
    }

    const matchedResults = matchedArray.map((value) =>
      kit.scaleAssetAmount(selectedRound.get()!.assetSymbol, String(value), { allowZero: true }),
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
      projectIds.some((value) => !/^[1-9]\d*$/.test(value)) ||
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

    const projectIds = entries.map((entry) => String(entry.id).trim());
    const matchedAmounts = entries.map((entry) => entry.matchBaseUnits);
    if (
      projectIds.length === 0 ||
      projectIds.length !== entries.length ||
      projectIds.some((value) => !/^[1-9]\d*$/.test(value)) ||
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
    const round = selectedRound.get();
    if (!round || !canFinalizeSelectedRound.get()) {
      kit.setStatus(t("finalizeAdminOnly"), "error");
      return false;
    }
    const totalMatched = matchedAmounts.reduce((sum, value) => sum + BigInt(value), 0n);
    if (!validateFinalizationSnapshot(projectIds)) {
      kit.setStatus(t("incompleteProjectSnapshot"), "error");
      return false;
    }
    if (totalMatched > round.matchingPool) {
      kit.setStatus(t("matchExceedsPool"), "error");
      return false;
    }
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;
    isFinalizing.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const [liveRound, liveProjects] = await Promise.all([
          fetchRoundDetails(round.id),
          Promise.all(projectIds.map(async (projectId) => {
            const raw = await app.chain.readRaw("getProjectDetails", [arg.integer(projectId)]);
            return Boolean(raw && typeof raw === "object" && !Array.isArray(raw)
              && String((raw as Record<string, unknown>).roundId ?? "") === round.id);
          })),
        ]);
        if (
          !liveRound
          || liveRound.status !== "ended"
          || liveRound.cancelled
          || liveRound.finalized
          || liveRound.matchingPool !== round.matchingPool
          || liveRound.projectCount !== BigInt(projectIds.length)
          || !liveProjects.every(Boolean)
        ) {
          throw new Error(t("incompleteProjectSnapshot"));
        }
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "finalize-round",
              eventName: "RoundFinalized",
              wallet: caller,
              roundId: round.id,
              projectIds: [...projectIds],
              matchedAmounts: [...matchedAmounts],
              expectedAllocated: totalMatched.toString(),
            })
          : null;
        await revalidateFundingWriteScope();
        const result = await app.chain.invoke("finalizeRound", [
          arg.hash160(caller),
          arg.integer(round.id),
          arg.array(projectIds.map((value) => arg.integer(value))),
          arg.array(matchedAmounts.map((value) => arg.integer(value))),
        ], {
          waitForEvent: "RoundFinalized",
          waitTimeoutMs: 30_000,
          ...(pendingDraft
            ? { onTransactionSent: (txid: string) => pending?.persistBroadcast(reservation!, pendingDraft, txid) }
            : {}),
        });
        kit.requireVerifiedTransaction(
          result,
          (event) =>
            eventInteger(event, 0) === BigInt(round.id)
            && eventInteger(event, 1) === totalMatched,
        );
        const [readback, allocationReadbacks] = await Promise.all([
          fetchRoundDetails(round.id),
          Promise.all(projectIds.map(async (projectId, index) => {
            const raw = await app.chain.readRaw("getProjectDetails", [arg.integer(projectId)]);
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
            const project = raw as Record<string, unknown>;
            return String(project.roundId ?? "") === round.id
              && parseBigInt(project.matchedAmount) === BigInt(matchedAmounts[index]!);
          })),
        ]);
        if (
          !readback?.finalized
          || readback.matchingRemaining !== round.matchingPool - totalMatched
          || !allocationReadbacks.every(Boolean)
        ) {
          throw new Error(t("chainReadbackMismatch"));
        }
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "roundFinalized");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
      isFinalizing.set(false);
    }
  };

  const claimUnused = async (): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isClaimingUnused.get()) return false;

    const round = selectedRound.get()!;
    if (!canClaimUnused.get()) {
      kit.setStatus(t("roundStateChanged"), "error");
      return false;
    }
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;
    isClaimingUnused.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "claim-unused",
              eventName: "MatchingWithdrawn",
              wallet: caller,
              roundId: round.id,
              amount: round.matchingRemaining.toString(),
            })
          : null;
        await revalidateFundingWriteScope();
        const result = await app.chain.invoke("claimUnusedMatching", [
          arg.hash160(caller),
          arg.integer(round.id),
        ], {
          waitForEvent: "MatchingWithdrawn",
          waitTimeoutMs: 30_000,
          ...(pendingDraft
            ? { onTransactionSent: (txid: string) => pending?.persistBroadcast(reservation!, pendingDraft, txid) }
            : {}),
        });
        kit.requireVerifiedTransaction(
          result,
          (event) =>
            eventInteger(event, 0) === BigInt(round.id)
            && ownerMatchesAddress(eventStateValue(event, 1), caller)
            && eventInteger(event, 2) === round.matchingRemaining,
        );
        const readback = await fetchRoundDetails(round.id);
        if (!readback || readback.matchingRemaining !== 0n) {
          throw new Error(t("chainReadbackMismatch"));
        }
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "unusedClaimed");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
      isClaimingUnused.set(false);
    }
  };

  const cancelRound = async (): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (!selectedRound.get() || isCancelling.get()) return false;

    const round = selectedRound.get()!;
    if (!canCancelSelectedRound.get()) {
      kit.setStatus(t("roundStateChanged"), "error");
      return false;
    }
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;
    isCancelling.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "cancel-round",
              eventName: "RoundCancelled",
              wallet: caller,
              roundId: round.id,
            })
          : null;
        await revalidateFundingWriteScope();
        const result = await app.chain.invoke("cancelRound", [
          arg.hash160(caller),
          arg.integer(round.id),
        ], {
          waitForEvent: "RoundCancelled",
          waitTimeoutMs: 30_000,
          ...(pendingDraft
            ? { onTransactionSent: (txid: string) => pending?.persistBroadcast(reservation!, pendingDraft, txid) }
            : {}),
        });
        kit.requireVerifiedTransaction(
          result,
          (event) =>
            eventInteger(event, 0) === BigInt(round.id)
            && ownerMatchesAddress(eventStateValue(event, 1), caller),
        );
        const readback = await fetchRoundDetails(round.id);
        if (!readback?.cancelled) throw new Error(t("chainReadbackMismatch"));
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "roundCancelled");
      if (ok) await refreshRounds();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
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
