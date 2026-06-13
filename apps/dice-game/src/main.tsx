import { createObservable, defineMiniApp } from "@shared/react";
import { formatHash, toFixed8, fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { gasToWei, evmCall, decodeReturnWord } from "@shared/utils/evm-chain";
import type { EvmNetwork } from "@shared/utils/evm-chain";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { chainLabelOf, maxStakeOf, evmStatusToOutcome, maxPayableStakeOf } from "./dice-logic";
import type { RollOutcome } from "./dice-logic";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { createBetTracker } from "./bet-tracker";

const appId = "miniapp-dice-game";
const PAYOUT_MULTIPLIER = 5.7;
// The contract requires liquidity >= stake * 6 * 95% before paying a win
// (PlatformGame.Dice asserts GAS.BalanceOf(contract) >= amount*6*95/100 inside
// placeDiceBet). Mirror that exact multiple here so the pre-flight check refuses
// a stake the house cannot cover BEFORE the deposit lands and strands the GAS.
const LIQUIDITY_COVER_MULTIPLE = 6 * 0.95; // = 5.7

// Neo X (EVM) dice deployment. The Neo N3 path uses the kernel contract resolved
// by the host; the EVM path calls this contract directly.
const DICE_EVM_ADDRESS: Partial<Record<EvmNetwork, string>> = {
  "neo-x-mainnet": "0xFA795F814d38F218153d21838360096f3F5cb774",
};
const DICE_PLACE_BET_SELECTOR = "0x43046844"; // placeBet(uint8)
const DICE_GET_BET_SELECTOR = "0x061e494f"; //   getBet(uint256)
const DICE_BET_PLACED_TOPIC = "0xd8175cc91837f6ecc7efc5783d64298c19ccb0e81d4b0436c082fa056905d942";

function sanitizeFace(value: unknown): string {
  const face = Number(value);
  if (!Number.isInteger(face) || face < 1 || face > 6) return "6";
  return String(face);
}

function sanitizeAmount(value: unknown, max = 20): string {
  const raw = String(value ?? "").trim();
  if (raw.length === 0) return "0.10";
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return "0.10";
  if (amount < 0.05) return "0.05";
  if (amount > max) return max.toFixed(2).replace(/\.00$/, "");
  return amount.toFixed(2).replace(/\.00$/, "");
}

function payoutFor(amount: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "0 GAS";
  return `${(numeric * PAYOUT_MULTIPLIER).toFixed(2)} GAS`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read a Neo event-state field value defensively across indexer shapes. */
function eventStateValue(ev: unknown, index: number): unknown {
  const state = (ev as { state?: unknown })?.state ?? ev;
  if (Array.isArray(state)) {
    const item = state[index];
    return (item as { value?: unknown })?.value ?? item;
  }
  return undefined;
}
function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
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
    // Per-bet settlement tracking: history rows keyed by bet id, reveal state
    // pinned to the ACTIVE (most recent) bet so interleaved bets never stomp
    // each other's row or banner.
    const tracker = createBetTracker();
    const { rollHistory, lastRoll, lastOutcome, isResolving, isUnresolved } = tracker;
    // Re-run handle for the ACTIVE bet's settlement poll. When the poll times out
    // (the VRF oracle has not called back yet) the player can press "Check again"
    // to poll once more rather than face a frozen spinner. Only the most recent
    // bet's resolver is retained (older bets settle silently into their rows).
    let recheckActiveBet: (() => void) | null = null;
    // Multi-chain state.
    const chainLabel = createObservable("");
    const maxStake = createObservable(20);
    // House liquidity (GAS) and the player's standing app-scoped credit (GAS),
    // read on Neo N3. They drive the pre-flight max-payable-stake guard and the
    // recoverable-credit banner. The EVM path is atomic (a revert returns funds),
    // so these stay 0 there and the guard is skipped.
    const houseLiquidity = createObservable(0);
    const directCredit = createObservable(0);
    const maxPayableStake = createObservable(0);

    /**
     * Read the house GAS balance and the player's direct GAS credit on Neo N3.
     * The contract refuses (after the deposit lands) a stake it cannot pay 5.7x,
     * so quoting the live payable cap here lets the UI refuse first and surfaces
     * any stranded credit. Best-effort: a read failure leaves the prior values.
     */
    const refreshLiquidity = async (network: string): Promise<void> => {
      if (ctx.services.chain.isEvmNetwork(network)) {
        houseLiquidity.set(0);
        directCredit.set(0);
        maxPayableStake.set(0);
        return;
      }
      const contractHash = ctx.services.chain.contractAddress.get();
      let liquidity = 0;
      let credit = 0;
      try {
        if (contractHash) {
          const balRaw = await ctx.services.chain.read(
            "balanceOf",
            [{ type: "Hash160", value: contractHash }],
            { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
          );
          liquidity = fromFixed8(parseBigInt(balRaw));
        }
      } catch {
        liquidity = houseLiquidity.get();
      }
      try {
        const player = ctx.services.chain.address.get();
        if (player) {
          const creditRaw = await ctx.services.chain.read("getDirectGasCredit", [
            { type: "String", value: appId },
            { type: "Hash160", value: player },
          ]);
          credit = fromFixed8(parseBigInt(creditRaw));
        }
      } catch {
        credit = directCredit.get();
      }
      houseLiquidity.set(liquidity);
      directCredit.set(credit);
      maxPayableStake.set(maxPayableStakeOf(liquidity, credit, LIQUIDITY_COVER_MULTIPLE));
    };

    const refreshNetwork = async (): Promise<string> => {
      try {
        const net = await ctx.services.chain.detectNetwork();
        chainLabel.set(chainLabelOf(net));
        maxStake.set(maxStakeOf(net));
        await refreshLiquidity(net);
        return net;
      } catch {
        chainLabel.set(chainLabelOf("neo-n3"));
        maxStake.set(20);
        return "neo-n3";
      }
    };

    /**
     * On (re)load, seed history from the connected player's settled DiceBetResolved
     * events so a refresh during the resolve loop doesn't lose a payout that DID
     * land on-chain. DiceBetResolved params (verified against the PlatformGame
     * ABI): appId(0) player(1) chosenNumber(2) rolledNumber(3) payout(4) won(5)
     * betId(6). Only seeds when the in-memory history is empty (a fresh load).
     */
    const hydrateHistory = async (network: string): Promise<void> => {
      if (ctx.services.chain.isEvmNetwork(network)) return;
      const player = ctx.services.chain.address.get();
      if (!player || rollHistory.get().length > 0) return;
      try {
        const events = await ctx.services.chain.listEvents("DiceBetResolved", { limit: 60 });
        const mine = events
          .filter((ev) => ownerMatchesAddress(eventStateValue(ev, 1), player))
          // Newest first — the indexer returns oldest-first, so reverse.
          .reverse()
          .map((ev) => {
            const won = asBool(eventStateValue(ev, 5));
            const rolled = Number(eventStateValue(ev, 3)) || 0;
            const face = String(eventStateValue(ev, 2) ?? "");
            const payoutGas = fromFixed8(parseBigInt(eventStateValue(ev, 4)));
            const label = won ? ctx.t("outcomeWon") : ctx.t("outcomeLost");
            return {
              face,
              stake: "",
              result: rolled ? `${label} · 🎲 ${rolled}` : label,
              payout: won ? `${payoutGas.toFixed(2)} GAS` : "0 GAS",
              outcome: (won ? "won" : "lost") as RollOutcome,
              rolled: rolled ? String(rolled) : "",
              at: "",
            };
          });
        tracker.seedSettled(mine);
      } catch {
        /* indexer unreachable — history just starts empty */
      }
    };

    const syncSelection = (face: unknown, amount: unknown) => {
      const nextFace = sanitizeFace(face);
      const nextAmount = sanitizeAmount(amount, maxStake.get());
      selectedFace.set(nextFace);
      stakeAmount.set(`${nextAmount} GAS`);
      payoutPreview.set(payoutFor(nextAmount));
      return { nextFace, nextAmount };
    };

    // Reveal a settled bet: update ITS history row (matched by id — a later
    // bet may occupy row 0 by now) and, only when it is still the active bet,
    // the dice + result banner. A win on the active bet fires the host
    // fireworks via the success status.
    const finishResolve = (rowId: string, outcome: RollOutcome, rolled: number, amount: string) => {
      const won = outcome === "won";
      const label =
        won ? ctx.t("outcomeWon") : outcome === "refunded" ? ctx.t("outcomeRefunded") : ctx.t("outcomeLost");
      const isActive = tracker.settleBet(rowId, {
        outcome,
        rolled,
        result: rolled ? `${label} · 🎲 ${rolled}` : label,
        payout: won ? payoutFor(amount) : "0 GAS",
      });
      if (!isActive) return;
      if (won) {
        lastStatus.set(ctx.t("statusWon"));
        ctx.setStatus(ctx.t("statusWon"), "success");
      } else if (outcome === "refunded") {
        lastStatus.set(ctx.t("statusRefunded"));
        ctx.setStatus(ctx.t("statusRefunded"), "info");
      } else {
        lastStatus.set(ctx.t("statusLost"));
        ctx.setStatus(ctx.t("statusLost"), "info");
      }
    };

    // Neo X: poll getBet(requestId) until the VRF settles the bet on-chain.
    const resolveEvmBet = async (rowId: string, address: string, requestId: string, amount: string) => {
      for (let i = 0; i < 45; i += 1) {
        await sleep(4000);
        let raw: string;
        try {
          raw = await evmCall(address, DICE_GET_BET_SELECTOR, [requestId]);
        } catch {
          continue;
        }
        const status = Number(decodeReturnWord(raw, 4)); // Bet.status word
        if (status <= 1) continue; // None / Pending
        finishResolve(rowId, evmStatusToOutcome(status), Number(decodeReturnWord(raw, 3)), amount);
        return;
      }
      tracker.markUnresolved(rowId); // timed out — stays "rolling" in history
    };

    // Neo N3: poll DiceBetResolved (and DiceBetRefunded) for this bet id.
    const resolveN3Bet = async (rowId: string, betId: string, amount: string) => {
      if (!betId) {
        tracker.markUnresolved(rowId);
        return;
      }
      for (let i = 0; i < 36; i += 1) {
        await sleep(5000);
        try {
          const resolved = await ctx.services.chain.listEvents("DiceBetResolved", { limit: 40 });
          const hit = resolved.find((ev) => String(eventStateValue(ev, 6)) === String(betId));
          if (hit) {
            const won = asBool(eventStateValue(hit, 5));
            finishResolve(rowId, won ? "won" : "lost", Number(eventStateValue(hit, 3)) || 0, amount);
            return;
          }
          const refunded = await ctx.services.chain.listEvents("DiceBetRefunded", { limit: 40 });
          // DiceBetRefunded params: appId(0), player(1), amount(2), betId(3).
          const refundHit = refunded.find((ev) => String(eventStateValue(ev, 3)) === String(betId));
          if (refundHit) {
            finishResolve(rowId, "refunded", 0, amount);
            return;
          }
        } catch {
          /* transient indexer error — retry */
        }
      }
      tracker.markUnresolved(rowId);
    };

    // Host operation-panel "Fund Stake": pre-fund app-scoped GAS credit by
    // transferring GAS to the game contract with the same memo placeDiceBet uses
    // (miniapp-dice-game:stake). The credit funds subsequent rolls and recovers
    // any GAS left stranded by a post-deposit bet failure. Neo N3 only — the EVM
    // path is atomic (no pre-funded credit).
    ctx.registerAction("fundGameCredit", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { amount?: unknown };
      const network = await refreshNetwork();
      if (ctx.services.chain.isEvmNetwork(network)) {
        ctx.setStatus(ctx.t("statusNeoXNoCredit"), "error");
        return;
      }
      const amount = sanitizeAmount(form.amount, maxStake.get());
      const amountFixed8 = toFixed8(amount);
      const contractHash = ctx.services.chain.contractAddress.get();
      if (!contractHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      await ctx.services.notify.guard(async () => {
        const player = await ctx.services.chain.ensureWallet();
        await ctx.services.chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: player },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: amountFixed8 },
            { type: "String", value: `${appId}:stake` },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        );
        await refreshLiquidity(network);
      }, "statusCreditFunded");
    });

    ctx.registerAction("placeDiceBet", async (...args: unknown[]) => {
      if (isSubmitting.get()) return;
      const form = (args[0] ?? {}) as { chosenNumber?: unknown; amount?: unknown };

      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      let stakeSent = false;
      // Hoisted so the catch can re-read credit on the same network.
      let network = "neo-n3";
      try {
        // Auto-detect the chain from the connected wallet (also refreshes the UI
        // chain badge + per-network stake cap + house liquidity).
        network = await refreshNetwork();
        const submittedAmount = sanitizeAmount(form.amount, maxStake.get());
        const { nextFace, nextAmount } = syncSelection(form.chosenNumber, form.amount);
        const amountFixed8 = toFixed8(nextAmount);

        // The stake was silently clamped to the network cap (e.g. 10 GAS typed on
        // N3 then the wallet switched to Neo X's 2 GAS cap). Abort rather than bet
        // a different amount than the user asked for.
        if (Number(submittedAmount) !== Number(nextAmount)) {
          throw new Error(
            ctx.t("statusStakeClamped", {
              cap: maxStake.get().toString(),
              network: chainLabel.get(),
            }),
          );
        }

        let result;
        let resolver: (rowId: string) => void;
        if (ctx.services.chain.isEvmNetwork(network)) {
          const address = DICE_EVM_ADDRESS[network as EvmNetwork];
          if (!address) {
            throw new Error(ctx.t("statusNeoXMainnetOnly"));
          }
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
          const requestId = (result.event as { id?: string } | undefined)?.id ?? "";
          resolver = (rowId) => void resolveEvmBet(rowId, address, requestId, nextAmount);
        } else {
          const player = await ctx.services.chain.ensureWallet();
          // PRE-FLIGHT: the contract asserts house liquidity >= stake * 5.7 INSIDE
          // placeDiceBet — i.e. after the deposit already landed. With the live
          // liquidity (re-read here for freshness), refuse a stake the house
          // cannot pay BEFORE depositing, so the GAS is never stranded as credit.
          await refreshLiquidity(network);
          const cap = maxPayableStake.get();
          if (cap > 0 && Number(nextAmount) > cap) {
            throw new Error(
              ctx.t("statusStakeOverLiquidity", {
                max: cap.toFixed(2),
                tokenGas: ctx.t("tokenGas"),
              }),
            );
          }
          // stakeSent flips the moment the stake transfer broadcasts; a pre-transfer
          // failure stays a plain failure, a post-broadcast one is recoverable.
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
          const betId = String(eventStateValue(result.event, 4) ?? "");
          resolver = (rowId) => void resolveN3Bet(rowId, betId, nextAmount);
        }

        lastTxid.set(result.txid ?? "");
        lastStatus.set(ctx.t("statusRolling"));
        const rowId = tracker.beginBet({
          face: nextFace,
          stake: `${nextAmount} GAS`,
          result: ctx.t("statusRolling"),
          payout: payoutFor(nextAmount),
          outcome: "pending" as RollOutcome,
          txid: result.txid ?? "",
          at: new Date().toISOString(),
        });
        ctx.setStatus(
          `${ctx.t("statusRolling")}${result.txid ? `: ${formatHash(result.txid, 10, 8)}` : ""}`,
          "info",
        );
        // Retain a re-run handle so a timed-out (unresolved) settlement can be
        // re-polled from the UI's "Check again" action.
        recheckActiveBet = () => resolver(rowId);
        // Reveal the outcome asynchronously so the user can keep playing.
        resolver(rowId);
        return result;
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : ctx.t("statusFailed");
        // This bet never started resolving, so the tracker's reveal state is
        // left alone — a still-pending earlier bet keeps its rolling banner.
        if (stakeSent) {
          // The deposit landed but the bet didn't settle — the GAS is now held as
          // app-scoped credit on the contract and auto-funds the next roll (the
          // contract exposes no withdraw, so "credit" — not "refund" — is honest).
          // Re-read the credit so the banner shows the real standing amount.
          try {
            await refreshLiquidity(network);
          } catch {
            /* keep the prior credit value */
          }
          const recoverable = ctx.t("statusFundsRecoverable");
          lastStatus.set(recoverable);
          tracker.recordRow({
            face: sanitizeFace(form.chosenNumber),
            stake: stakeAmount.get(),
            result: recoverable,
            payout: "0 GAS",
            txid: "",
            at: new Date().toISOString(),
          });
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

    // "Check again": re-run the active bet's settlement poll after it timed out
    // unresolved (the VRF oracle had not called back yet). Re-runs the same
    // resolver, which flips back to "rolling" while it re-polls and settles the
    // row if the oracle has since resolved it.
    ctx.registerAction("recheckSettlement", async () => {
      if (!recheckActiveBet || isResolving.get()) return;
      isUnresolved.set(false);
      isResolving.set(true);
      lastStatus.set(ctx.t("statusRolling"));
      recheckActiveBet();
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
        chainLabel,
        maxStake,
        houseLiquidity,
        directCredit,
        maxPayableStake,
        lastRoll,
        lastOutcome,
        isResolving,
        isUnresolved,
      },
      loadData: async () => {
        const net = await refreshNetwork();
        await hydrateHistory(net);
      },
    };
  },
});
