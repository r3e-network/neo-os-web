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
import type { MiniAppFramework } from "@shared/react";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { QuadraticFlowKit, Translator } from "./quadraticFlowKit";
import type { ProjectItem, RoundItem } from "./quadraticTypes";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const APP_ID = "miniapp-quadratic-funding";

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
}

export function useQuadraticContributions({
  app,
  t,
  kit,
  selectedRound,
  refreshProjects,
  refreshRounds,
}: UseQuadraticContributionsOptions) {
  const { arg } = app.chain;

  const isContributing = createObservable(false);

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

  /**
   * Legacy contribution scaler, on the framework's never-throwing parse lane.
   * Kept quirks (all pinned by the shared flows tests):
   *  - splits on "." and IGNORES everything past the second segment
   *    ("1.2.3" contributes 1.2);
   *  - NEO with ANY fraction digits → the distinct indivisible reject;
   *  - GAS fractions are TRUNCATED to 8 places, not rejected;
   *  - every other invalid form (zero, negative, non-numeric) → null.
   */
  const scaleContribution = (
    assetSymbol: string,
    raw: string,
  ): { ok: true; value: string } | { ok: false; reason: "fractionalNeo" | "invalid" } => {
    const [intPart = "", fracPart = ""] = raw.split(".");
    if (assetSymbol === "NEO") {
      // NEO is indivisible — reject fractional amounts explicitly.
      if (fracPart.length > 0) return { ok: false, reason: "fractionalNeo" };
      const scaled = app.amount.parseNeoToUnits(intPart.trim());
      return scaled === null ? { ok: false, reason: "invalid" } : { ok: true, value: scaled };
    }
    const scaled = app.amount.parseGasToFixed8(
      `${intPart.trim() || "0"}.${fracPart.slice(0, 8) || "0"}`,
    );
    return scaled === null ? { ok: false, reason: "invalid" } : { ok: true, value: scaled };
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

    const parsedProjectId = Number.parseInt(data.projectId.trim(), 10);
    if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0) {
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

    isContributing.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        // The deposit lane resolves the transfer recipient from the contract
        // accessor — fail with this app's copy before any funds move.
        await kit.ensureContract();
        const memo = data.memo.trim().slice(0, 160);
        const assetHash = round.assetSymbol === "NEO" ? NEO_HASH : GAS_HASH;

        await app.funds.prepayAndCall({
          operation: "contribute",
          args: [
            arg.hash160(caller),
            arg.integer(round.id),
            arg.integer(String(parsedProjectId)),
            arg.integer(amount),
            arg.string(memo),
          ],
          amountFixed8: amount,
          memo: `${APP_ID}:contribute`,
          deposit: {
            scriptHash: assetHash,
            confirm: (txid) => kit.settleDeposit(txid, assetHash),
          },
          notify: "silent",
        });
      }, "contributionSent");
      if (ok) {
        await refreshProjects();
        await refreshRounds();
      }
      return ok;
    } finally {
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
