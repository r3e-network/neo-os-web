import { createObservable, defineMiniApp } from "@shared/react";
import { formatHash, toFixed8 } from "@shared/utils/format";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-dice-game";
const PAYOUT_MULTIPLIER = 5.7;

function sanitizeFace(value: unknown): string {
  const face = Number(value);
  if (!Number.isInteger(face) || face < 1 || face > 6) return "6";
  return String(face);
}

function sanitizeAmount(value: unknown): string {
  const raw = String(value ?? "").trim();
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return "0.10";
  if (amount < 0.05) return "0.05";
  if (amount > 20) return "20";
  return amount.toFixed(2).replace(/\.00$/, "");
}

function payoutFor(amount: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "0 GAS";
  return `${(numeric * PAYOUT_MULTIPLIER).toFixed(2)} GAS`;
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const launchFace = sanitizeFace(
      ctx.launchContext.params.face ?? ctx.launchContext.params.chosenNumber,
    );
    const launchAmount = sanitizeAmount(
      ctx.launchContext.params.amount ?? ctx.launchContext.params.stake,
    );

    const selectedFace = createObservable(launchFace);
    const stakeAmount = createObservable(`${launchAmount} GAS`);
    const payoutPreview = createObservable(payoutFor(launchAmount));
    const lastTxid = createObservable("");
    const lastStatus = createObservable(ctx.t("statusReady"));
    const isSubmitting = createObservable(false);

    const syncSelection = (face: unknown, amount: unknown) => {
      const nextFace = sanitizeFace(face);
      const nextAmount = sanitizeAmount(amount);
      selectedFace.set(nextFace);
      stakeAmount.set(`${nextAmount} GAS`);
      payoutPreview.set(payoutFor(nextAmount));
      return { nextFace, nextAmount };
    };

    ctx.registerAction("placeDiceBet", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        chosenNumber?: unknown;
        amount?: unknown;
      };
      const { nextFace, nextAmount } = syncSelection(
        form.chosenNumber,
        form.amount,
      );
      const amountFixed8 = toFixed8(nextAmount);
      const player = await ctx.services.chain.ensureWallet();

      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      try {
        const result = await ctx.services.chain.invokeWithPayment(
          amountFixed8,
          `${appId}:stake`,
          "placeDiceBet",
          [
            { type: "String", value: appId },
            { type: "Hash160", value: player },
            { type: "Integer", value: nextFace },
            { type: "Integer", value: amountFixed8 },
          ],
          { waitForEvent: "DiceBetPlaced", waitTimeoutMs: 30_000 },
        );
        lastTxid.set(result.txid ?? "");
        lastStatus.set(ctx.t("statusSubmitted"));
        ctx.setStatus(
          `${ctx.t("statusSubmitted")}${result.txid ? `: ${formatHash(result.txid, 10, 8)}` : ""}`,
          "success",
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : ctx.t("statusFailed");
        lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    });

    return {
      state: {
        selectedFace,
        stakeAmount,
        payoutPreview,
        lastTxid,
        lastStatus,
        isSubmitting,
      },
      loadData: async () => {},
    };
  },
});
