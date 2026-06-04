import { createObservable, defineMiniApp } from "@shared/react";
import { formatHash, toFixed8 } from "@shared/utils/format";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-dice-game";
const PAYOUT_MULTIPLIER = 5.7;

type RollHistoryItem = {
  face: string;
  stake: string;
  result: string;
  payout: string;
  txid?: string;
  at: string;
};

function sanitizeFace(value: unknown): string {
  const face = Number(value);
  if (!Number.isInteger(face) || face < 1 || face > 6) return "6";
  return String(face);
}

function sanitizeAmount(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (raw.length === 0) return "0.10";
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
    const rollHistory = createObservable<RollHistoryItem[]>([]);

    const syncSelection = (face: unknown, amount: unknown) => {
      const nextFace = sanitizeFace(face);
      const nextAmount = sanitizeAmount(amount);
      selectedFace.set(nextFace);
      stakeAmount.set(`${nextAmount} GAS`);
      payoutPreview.set(payoutFor(nextAmount));
      return { nextFace, nextAmount };
    };

    ctx.registerAction("placeDiceBet", async (...args: unknown[]) => {
      if (isSubmitting.get()) return;
      const form = (args[0] ?? {}) as {
        chosenNumber?: unknown;
        amount?: unknown;
      };
      const { nextFace, nextAmount } = syncSelection(
        form.chosenNumber,
        form.amount,
      );
      const amountFixed8 = toFixed8(nextAmount);

      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      // Tracks whether the GAS stake transfer has been broadcast. invokeWithPayment
      // transfers the stake to the contract FIRST, then calls placeDiceBet. If the
      // contract call fails after the transfer is sent, the GAS has left the wallet
      // (tagged with the `${appId}:stake` memo) while no bet was registered, so the
      // failure must be surfaced as "funds recoverable via contract refund", not a
      // plain "Roll failed" that implies nothing happened.
      let stakeSent = false;
      try {
        const player = await ctx.services.chain.ensureWallet();
        // stakeSent is flipped only by onPaymentSent below — i.e. the exact moment
        // the stake transfer is broadcast (after ensureWallet/ensureContractAddress
        // succeed). A pre-transfer failure therefore stays a plain failure; only a
        // failure after the stake has actually left the wallet surfaces the
        // recoverable-funds notice.
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
          {
            waitForEvent: "DiceBetPlaced",
            waitTimeoutMs: 30_000,
            onPaymentSent: () => {
              stakeSent = true;
            },
          },
        );
        lastTxid.set(result.txid ?? "");
        lastStatus.set(ctx.t("statusSubmitted"));
        rollHistory.set([
          {
            face: nextFace,
            stake: `${nextAmount} GAS`,
            result: ctx.t("statusSubmitted"),
            payout: payoutFor(nextAmount),
            txid: result.txid ?? "",
            at: new Date().toISOString(),
          },
          ...rollHistory.get(),
        ].slice(0, 6));
        ctx.setStatus(
          `${ctx.t("statusSubmitted")}${result.txid ? `: ${formatHash(result.txid, 10, 8)}` : ""}`,
          "success",
        );
        return result;
      } catch (error) {
        const rawMessage =
          error instanceof Error ? error.message : ctx.t("statusFailed");
        if (stakeSent) {
          // The stake transfer was already broadcast but the bet did not settle.
          // Surface a recoverable-funds notice and record it in history so the
          // user knows the GAS is locked pending the contract's refund path
          // rather than silently lost. Tracking the intermediate transfer txid
          // for an automated refund requires a shared-service change.
          const recoverable = ctx.t("statusFundsRecoverable");
          lastStatus.set(recoverable);
          rollHistory.set([
            {
              face: nextFace,
              stake: `${nextAmount} GAS`,
              result: recoverable,
              payout: payoutFor(nextAmount),
              txid: "",
              at: new Date().toISOString(),
            },
            ...rollHistory.get(),
          ].slice(0, 6));
          ctx.setStatus(recoverable, "error");
        } else {
          lastStatus.set(rawMessage);
          ctx.setStatus(rawMessage, "error");
        }
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
        rollHistory,
      },
      loadData: async () => {},
    };
  },
});
