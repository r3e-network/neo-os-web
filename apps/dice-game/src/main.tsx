import { createObservable, defineMiniApp } from "@shared/react";
import { formatHash, toFixed8 } from "@shared/utils/format";
import { gasToWei } from "@shared/utils/evm-chain";
import type { EvmNetwork } from "@shared/utils/evm-chain";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-dice-game";
const PAYOUT_MULTIPLIER = 5.7;

// Neo X (EVM) dice deployment + minimal ABI. The Neo N3 path uses the kernel
// contract resolved by the host; the EVM path calls this contract directly.
const DICE_EVM_ADDRESS: Partial<Record<EvmNetwork, string>> = {
  "neo-x-mainnet": "0xFA795F814d38F218153d21838360096f3F5cb774",
};
// placeBet(uint8) selector + DiceBetPlaced(uint256,address,uint8,uint256) topic.
const DICE_PLACE_BET_SELECTOR = "0x43046844";
const DICE_BET_PLACED_TOPIC = "0xd8175cc91837f6ecc7efc5783d64298c19ccb0e81d4b0436c082fa056905d942";

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
        // Auto-detect the chain from the connected wallet: Neo X (EVM) when an
        // injected EVM wallet is on a supported Neo X chain, else Neo N3.
        const network = await ctx.services.chain.detectNetwork();
        let result;
        if (ctx.services.chain.isEvmNetwork(network)) {
          const address = DICE_EVM_ADDRESS[network as EvmNetwork];
          if (!address) throw new Error(ctx.t("statusFailed"));
          await ctx.services.chain.ensureEvmWallet(network as EvmNetwork);
          // EVM placeBet is atomic: the stake (value) is sent with the call, so a
          // revert returns the funds — no recoverable-funds intermediate state.
          result = await ctx.services.chain.invokeEvmWithValue({
            address,
            selector: DICE_PLACE_BET_SELECTOR,
            uintArgs: [Number(nextFace)],
            valueWei: gasToWei(nextAmount).toString(),
            eventTopic: DICE_BET_PLACED_TOPIC,
          });
        } else {
          const player = await ctx.services.chain.ensureWallet();
          // stakeSent is flipped only by onPaymentSent below — i.e. the exact
          // moment the stake transfer is broadcast. A pre-transfer failure stays
          // a plain failure; only a failure after the stake has left the wallet
          // surfaces the recoverable-funds notice. (Neo N3 two-step path.)
          result = await ctx.services.chain.invokeWithPayment(
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
        }
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
