/**
 * useQuadraticContributions — the contribute flow, rewritten onto the MiniApp
 * framework SDK.
 *
 * Contribute consumes prepaid asset credit, so it rides
 * app.funds.prepayAndCall's asset deposit lane (`notify: 'silent'`): a NEP-17
 * transfer of the exact amount to the contract on the ASSET token with the
 * `miniapp-quadratic-funding:contribute` memo, a deposit-confirmation wait
 * (kit.settleDeposit), then the consuming `contribute` call. A bare invoke
 * faulted "insufficient prepaid asset". Messaging is owned by the shared flow
 * kit (banner + platform notify channel, byte-identical copy).
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { FrameworkPrepaidActionError, type MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import { truncateUtf8Bytes, type QuadraticFlowKit, type Translator } from "./quadraticFlowKit";
import type { QuadraticPendingTracker } from "./quadraticPending";
import type { ProjectItem, RoundItem } from "./quadraticTypes";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const APP_ID = "miniapp-quadratic-funding";

/**
 * Contract limit in the contract's unit — UTF-8 BYTES, not UTF-16 chars
 * (MiniAppQuadraticFunding.cs MAX_MEMO_LENGTH; see truncateUtf8Bytes in
 * quadraticFlowKit). contribute runs on the deposit-then-act lane, so an
 * over-byte memo reverting "memo too long" would strand the already-landed
 * contribution deposit as reclaimable-but-manual prepaid credit.
 */
const MAX_MEMO_BYTES = 160;

export interface UseQuadraticContributionsOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: Translator;
  /** Shared flow plumbing (guard/banner/preconditions). */
  kit: QuadraticFlowKit;
  /** Currently selected round (owned by useQuadraticRounds). */
  selectedRound: Observable<RoundItem | null>;
  refreshProjects: () => Promise<void>;
  refreshRounds: () => Promise<void>;
  ensureFundingWritesEnabled?: () => Promise<boolean>;
  pending?: QuadraticPendingTracker;
}

export function useQuadraticContributions({
  app,
  t,
  kit,
  selectedRound,
  refreshProjects,
  refreshRounds,
  ensureFundingWritesEnabled = async () => true,
  pending,
}: UseQuadraticContributionsOptions) {
  const { arg } = app.chain;

  const isContributing = createObservable(false);

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

  const contributeForm = {
    roundId: "",
    projectId: "",
    amount: "",
    memo: "",
  };

  const selectProject = (project: ProjectItem) => {
    contributeForm.projectId = project.id;
    contributeForm.roundId = project.roundId;
  };

  /** Strict, never-throwing scaler; malformed and over-precision values reject. */
  const scaleContribution = (
    assetSymbol: string,
    raw: string,
  ): { ok: true; value: string } | { ok: false; reason: "fractionalNeo" | "invalid" } => {
    return kit.scaleAssetAmount(assetSymbol, raw);
  };

  const eventInteger = (event: unknown, index: number): bigint | null => {
    const value = eventStateValue(event, index);
    const text = String(value ?? "").trim();
    if (!/^-?\d+$/.test(text)) return null;
    try {
      return BigInt(text);
    } catch {
      return null;
    }
  };

  const contribute = async (data: {
    roundId: string;
    projectId: string;
    amount: string;
    memo: string;
  }): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (isContributing.get()) return false;
    const round = selectedRound.get();
    if (!round) {
      kit.setStatus(t("noSelectedRound"), "error");
      return false;
    }
    if (
      round.status !== "active"
      || Date.now() < round.startTime
      || Date.now() > round.endTime
    ) {
      kit.setStatus(t("roundNotActive"), "error");
      return false;
    }

    const parsedProjectId = data.projectId.trim();
    if (!/^[1-9]\d*$/.test(parsedProjectId)) {
      kit.setStatus(t("invalidContribution"), "error");
      return false;
    }

    const amountResult = scaleContribution(round.assetSymbol, data.amount);
    if (!amountResult.ok) {
      kit.setStatus(
        t(amountResult.reason === "fractionalNeo" ? "neoNoFractional" : "invalidContribution"),
        "error",
      );
      return false;
    }
    const amount = amountResult.value;
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;

    isContributing.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        // The deposit lane resolves the transfer recipient from the contract
        // accessor — fail with this app's copy before any funds move.
        await kit.ensureContract();
        // Truncate by UTF-8 BYTES (the contract's unit), not UTF-16 chars —
        // see MAX_MEMO_BYTES.
        const memo = truncateUtf8Bytes(data.memo.trim(), MAX_MEMO_BYTES);
        const assetHash = round.assetSymbol === "NEO" ? NEO_HASH : GAS_HASH;
        const [liveRoundRaw, liveProjectRaw] = await Promise.all([
          app.chain.readRaw("getRoundDetails", [arg.integer(round.id)]),
          app.chain.readRaw("getProjectDetails", [arg.integer(parsedProjectId)]),
        ]);
        if (!liveRoundRaw || typeof liveRoundRaw !== "object" || Array.isArray(liveRoundRaw)) {
          throw new Error(t("chainSnapshotUnavailable"));
        }
        const liveRound = liveRoundRaw as Record<string, unknown>;
        const liveStart = Number.parseInt(String(liveRound.startTime ?? "0"), 10);
        const liveEnd = Number.parseInt(String(liveRound.endTime ?? "0"), 10);
        if (
          String(liveRound.status ?? "") !== "active"
          || String(liveRound.assetSymbol ?? "") !== round.assetSymbol
          || Date.now() < liveStart
          || Date.now() > liveEnd
        ) {
          throw new Error(t("roundStateChanged"));
        }
        if (!liveProjectRaw || typeof liveProjectRaw !== "object" || Array.isArray(liveProjectRaw)) {
          throw new Error(t("projectStateChanged"));
        }
        const liveProject = liveProjectRaw as Record<string, unknown>;
        if (
          String(liveProject.roundId ?? "") !== round.id
          || !parseBool(liveProject.active)
          || parseBool(liveProject.claimed)
        ) {
          throw new Error(t("projectStateChanged"));
        }
        if (
          ownerMatchesAddress(parseHash160(liveProject.owner) || liveProject.owner, caller)
          || ownerMatchesAddress(parseHash160(liveRound.creator) || liveRound.creator, caller)
        ) {
          throw new Error(t("selfContributionBlocked"));
        }
        const contributionArgs = [
          arg.hash160(caller),
          arg.integer(round.id),
          arg.integer(parsedProjectId),
        ];
        const beforeRaw = await app.chain.readRaw("getContribution", contributionArgs);
        if (beforeRaw === null || beforeRaw === undefined || !/^-?\d+$/.test(String(beforeRaw))) {
          throw new Error(t("chainSnapshotUnavailable"));
        }
        const before = parseBigInt(beforeRaw);
        const expectedAfter = before + BigInt(amount);
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "contribute",
              eventName: "ContributionMade",
              wallet: caller,
              roundId: round.id,
              projectId: parsedProjectId,
              asset: round.assetSymbol === "NEO" ? "NEO" : "GAS",
              assetHash,
              amount,
              expectedAfter: expectedAfter.toString(),
            })
          : null;

        await revalidateFundingWriteScope();

        let result;
        try {
          result = await app.funds.prepayAndCall({
            operation: "contribute",
            args: [
              ...contributionArgs,
              arg.integer(amount),
              arg.string(memo),
            ],
            amountFixed8: amount,
            memo: `${APP_ID}:contribute`,
            deposit: {
              scriptHash: assetHash,
              confirm: (txid) => kit.settleDeposit(txid, assetHash),
            },
            waitForEvent: "ContributionMade",
            waitTimeoutMs: 30_000,
            ...(pendingDraft
              ? { onTransactionSent: (txid: string) => pending?.persistBroadcast(reservation!, pendingDraft, txid) }
              : {}),
            notify: "silent",
          });
        } catch (error) {
          if (error instanceof FrameworkPrepaidActionError && pendingDraft) {
            pending?.persistDeposit(reservation!, pendingDraft, error.txid);
          }
          throw error;
        }
        kit.requireVerifiedTransaction(
          result,
          (event) =>
            eventInteger(event, 0) === BigInt(round.id)
            && eventInteger(event, 1) === BigInt(parsedProjectId)
            && ownerMatchesAddress(eventStateValue(event, 2), caller)
            && eventInteger(event, 3) === BigInt(amount),
        );
        const afterRaw = await app.chain.readRaw("getContribution", contributionArgs);
        if (
          afterRaw === null
          || afterRaw === undefined
          || !/^-?\d+$/.test(String(afterRaw))
          || parseBigInt(afterRaw) < expectedAfter
        ) {
          throw new Error(t("chainReadbackMismatch"));
        }
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "contributionSent");
      if (ok) {
        await refreshProjects();
        await refreshRounds();
      }
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
      isContributing.set(false);
    }
  };

  return {
    isContributing,
    contributeForm,
    selectProject,
    contribute,
  };
}
