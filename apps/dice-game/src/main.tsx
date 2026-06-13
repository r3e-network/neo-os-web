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
import { addressToScriptHash } from "@shared/utils/neo";
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
import { createBetTracker } from "./bet-tracker";

const appId = "miniapp-dice-game";
const PAYOUT_MULTIPLIER = 5.7;
// The standalone MiniAppDiceGame asserts bankroll >= amount * 47/10 inside
// roll() before paying a 5.70x win — a win returns the player's own stake and
// the house tops up the extra (5.7 - 1 = 4.7), so the house's NET exposure is
// covered purely by the bankroll (the stake is held in player credit, not the
// bankroll). Mirror that exact multiple here so the pre-flight check refuses a
// stake the house cannot cover BEFORE the deposit lands and strands the GAS.
const LIQUIDITY_COVER_MULTIPLE = 47 / 10; // = 4.7

// Memos the contract requires on the GAS-transfer deposits (OnNEP17Payment).
const STAKE_MEMO = `${appId}:stake`; // player bet credit
// Neo X (EVM) dice deployment. The Neo N3 path calls the self-contained
// MiniAppDiceGame (resolved by the host from the manifest) directly; the EVM
// path calls the EVM contract directly. The two branches are independent.
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

/** Normalize a Hash160-ish value (hex with/without 0x, big-endian, mixed case). */
function normHash(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^0x/, "");
}
/** Compare a Rolled-event player field (a script hash) to the player hash. */
function addrEq(eventValue: unknown, playerHash: string): boolean {
  const a = normHash(eventValue);
  const b = normHash(playerHash);
  if (!a || !b) return false;
  // Indexers may serialize the Hash160 big- or little-endian; accept either.
  const reversed = (b.match(/../g) ?? []).reverse().join("");
  return a === b || a === reversed;
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
    // Re-run handle for the ACTIVE EVM bet's settlement poll. When the poll times
    // out (the VRF oracle has not called back yet) the player can press "Check
    // again" to poll once more rather than face a frozen spinner. EVM-only — N3
    // rolls settle atomically in the bet tx, so they never set this.
    let recheckActiveBet: (() => void) | null = null;
    // Multi-chain state.
    const chainLabel = createObservable("");
    const maxStake = createObservable(20);
    // House bankroll (GAS) and the player's standing bet credit (GAS), read on
    // Neo N3 from the standalone contract (bankroll() / creditOf). They drive the
    // pre-flight max-payable-stake guard and the recoverable-credit banner +
    // Withdraw action. The EVM path is atomic (a revert returns funds), so these
    // stay 0 there and the guard is skipped.
    const houseLiquidity = createObservable(0);
    const directCredit = createObservable(0);
    const maxPayableStake = createObservable(0);

    /**
     * Read the house bankroll and the player's standing bet credit on Neo N3
     * from the standalone MiniAppDiceGame (bankroll() / creditOf(player)). The
     * contract refuses (after the deposit lands) a stake it cannot pay 5.70x —
     * its bankroll guard is bankroll >= stake * 4.7 — so quoting the live payable
     * cap here lets the UI refuse first and surfaces any stranded/over-deposited
     * credit (now withdrawable). Best-effort: a read failure leaves prior values.
     */
    const refreshLiquidity = async (network: string): Promise<void> => {
      if (ctx.services.chain.isEvmNetwork(network)) {
        houseLiquidity.set(0);
        directCredit.set(0);
        maxPayableStake.set(0);
        return;
      }
      let liquidity = 0;
      let credit = 0;
      try {
        liquidity = fromFixed8(parseBigInt(await ctx.services.chain.read("bankroll", [])));
      } catch {
        liquidity = houseLiquidity.get();
      }
      try {
        const player = ctx.services.chain.address.get();
        const playerHash = player ? addressToScriptHash(player) : "";
        if (playerHash) {
          const creditRaw = await ctx.services.chain.read("creditOf", [
            { type: "Hash160", value: playerHash },
          ]);
          credit = fromFixed8(parseBigInt(creditRaw));
        }
      } catch {
        credit = directCredit.get();
      }
      houseLiquidity.set(liquidity);
      directCredit.set(credit);
      // The house cover is the bankroll alone; standing credit holds the
      // player's stake (consumed on the roll) and does not raise the cap.
      maxPayableStake.set(maxPayableStakeOf(liquidity, LIQUIDITY_COVER_MULTIPLE));
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
     * On (re)load, seed history from the connected player's settled Rolled events
     * so a refresh doesn't lose a roll that DID land on-chain. The standalone
     * MiniAppDiceGame settles every N3 roll atomically in the bet tx and emits
     * Rolled(gameId, player, face, rolled, won, payout) — state slots: gameId(0),
     * player(1), face(2), rolled(3), won(4), payout(5). Only seeds when the
     * in-memory history is empty (a fresh load), newest-first.
     */
    const hydrateHistory = async (network: string): Promise<void> => {
      if (ctx.services.chain.isEvmNetwork(network)) return;
      const player = ctx.services.chain.address.get();
      const playerHash = player ? addressToScriptHash(player) : "";
      if (!playerHash || rollHistory.get().length > 0) return;
      try {
        const events = await ctx.services.chain.listEvents("Rolled", { limit: 60 });
        const mine = events
          .filter((ev) => addrEq(eventStateValue(ev, 1), playerHash))
          // Newest first — the indexer returns oldest-first, so reverse.
          .reverse()
          .map((ev) => {
            const won = asBool(eventStateValue(ev, 4));
            const rolled = Number(eventStateValue(ev, 3)) || 0;
            const face = String(eventStateValue(ev, 2) ?? "");
            const payoutGas = fromFixed8(parseBigInt(eventStateValue(ev, 5)));
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

    // Neo N3: re-read the Rolled event for an already-settled roll whose event
    // read timed out at submit (the tx halted, so the result IS on-chain). Used
    // only by the rare event-timeout "Check again" path; the normal N3 roll
    // settles synchronously from the bet tx's own Rolled event.
    const recheckN3Roll = async (rowId: string, txid: string, amount: string) => {
      const player = ctx.services.chain.address.get();
      const playerHash = player ? addressToScriptHash(player) : "";
      for (let i = 0; i < 6; i += 1) {
        await sleep(4000);
        try {
          const events = await ctx.services.chain.listEvents("Rolled", { limit: 40 });
          const hit = txid
            ? events.find((ev) => String((ev as { txid?: unknown })?.txid ?? "") === txid)
            : undefined;
          const mine =
            hit ??
            (playerHash
              ? [...events].reverse().find((ev) => addrEq(eventStateValue(ev, 1), playerHash))
              : undefined);
          if (mine) {
            const won = asBool(eventStateValue(mine, 4));
            finishResolve(rowId, won ? "won" : "lost", Number(eventStateValue(mine, 3)) || 0, amount);
            return;
          }
        } catch {
          /* transient indexer error — retry */
        }
      }
      tracker.markUnresolved(rowId);
    };

    // Host operation-panel "Fund Stake": pre-fund bet credit by transferring GAS
    // to the standalone game contract with the same memo roll() consumes
    // (miniapp-dice-game:stake) so OnNEP17Payment credits the player. The credit
    // funds subsequent rolls and is fully WITHDRAWABLE via the Withdraw action.
    // Neo N3 only — the EVM path is atomic (no pre-funded credit).
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
            { type: "String", value: STAKE_MEMO },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        );
        await refreshLiquidity(network);
      }, "statusCreditFunded");
    });

    // Withdraw the player's standing bet credit back to their wallet via the
    // standalone contract's Withdraw(account) method, then reconcile the credit
    // chip. This is the real refund for GAS stranded/over-deposited on the
    // contract (the core fix the kernel path lacked). Neo N3 only — the EVM path
    // is atomic and holds no withdrawable credit.
    ctx.registerAction("withdrawCredit", async () => {
      const network = await refreshNetwork();
      if (ctx.services.chain.isEvmNetwork(network)) {
        ctx.setStatus(ctx.t("statusNeoXNoCredit"), "error");
        return;
      }
      const player = ctx.services.chain.address.get();
      const playerHash = player ? addressToScriptHash(player) : "";
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (directCredit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.services.notify.guard(async () => {
        await ctx.services.chain.ensureWallet();
        await ctx.services.chain.invoke(
          "withdraw",
          [{ type: "Hash160", value: playerHash }],
          { waitForEvent: "CreditWithdrawn" },
        );
        await refreshLiquidity(network);
      }, "creditWithdrawn");
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

        if (ctx.services.chain.isEvmNetwork(network)) {
          // -- Neo X (EVM) — async VRF settle (UNCHANGED) ----------------------
          const address = DICE_EVM_ADDRESS[network as EvmNetwork];
          if (!address) {
            throw new Error(ctx.t("statusNeoXMainnetOnly"));
          }
          await ctx.services.chain.ensureEvmWallet(network as EvmNetwork);
          // EVM placeBet is atomic on the stake (value sent with the call, so a
          // revert returns the funds) but the OUTCOME is settled asynchronously
          // by the VRF callback — hence the begin-then-poll machinery below.
          const result = await ctx.services.chain.invokeEvmWithValue({
            address,
            selector: DICE_PLACE_BET_SELECTOR,
            uintArgs: [Number(nextFace)],
            valueWei: gasToWei(nextAmount).toString(),
            eventTopic: DICE_BET_PLACED_TOPIC,
          });
          const requestId = (result.event as { id?: string } | undefined)?.id ?? "";

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
          // Retain a re-run handle so a timed-out (unresolved) VRF settlement can
          // be re-polled from the UI's "Check again" action.
          recheckActiveBet = () => void resolveEvmBet(rowId, address, requestId, nextAmount);
          // Reveal the outcome asynchronously so the user can keep playing.
          void resolveEvmBet(rowId, address, requestId, nextAmount);
          return result;
        }

        // -- Neo N3 — self-contained, ATOMIC roll (settles in the bet tx) ------
        const player = await ctx.services.chain.ensureWallet();
        const playerHash = addressToScriptHash(player);
        if (!playerHash) {
          throw new Error(ctx.t("statusFailed"));
        }
        // PRE-FLIGHT: the standalone contract asserts bankroll >= stake * 4.7
        // INSIDE roll() — i.e. after the deposit already landed. With the live
        // bankroll (re-read here for freshness), refuse a stake the house cannot
        // pay BEFORE depositing, so the GAS is never stranded as credit.
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
        // DEPOSIT (miniapp-dice-game:stake) then roll(player, face, amount). The
        // roll settles ON-CHAIN in the SAME tx via Runtime.GetRandom and pays a
        // 5.70x win atomically — the outcome is read straight from the Rolled
        // event, no oracle, no pending state. stakeSent flips the moment the
        // stake transfer broadcasts so a post-deposit roll fault is surfaced as
        // recoverable (and now WITHDRAWABLE) credit.
        const result = await ctx.services.chain.invokeWithPayment(
          amountFixed8,
          STAKE_MEMO,
          "roll",
          [
            { type: "Hash160", value: playerHash },
            { type: "Integer", value: nextFace },
            { type: "Integer", value: amountFixed8 },
          ],
          {
            waitForEvent: "Rolled",
            waitTimeoutMs: 30_000,
            onPaymentSent: () => {
              stakeSent = true;
            },
          },
        );

        lastTxid.set(result.txid ?? "");
        const rowId = tracker.beginBet({
          face: nextFace,
          stake: `${nextAmount} GAS`,
          result: ctx.t("statusRolling"),
          payout: payoutFor(nextAmount),
          outcome: "pending" as RollOutcome,
          txid: result.txid ?? "",
          at: new Date().toISOString(),
        });
        // Rolled(gameId, player, face, rolled, won, payout): rolled slot 3,
        // won slot 4, payout slot 5. The roll is final the instant the tx halts,
        // so begin and settle the bet row in one shot — no polling. If the
        // indexer event read timed out (event null) the roll STILL settled
        // on-chain; rather than fabricate a win/loss, leave the row unresolved so
        // hydrateHistory reconciles the true result (from Rolled events) on the
        // next load — and the player can re-poll via "Check again".
        if (result.event != null) {
          const rolled = Number(eventStateValue(result.event, 3)) || 0;
          const won = asBool(eventStateValue(result.event, 4));
          finishResolve(rowId, won ? "won" : "lost", rolled, nextAmount);
        } else {
          tracker.markUnresolved(rowId);
          recheckActiveBet = () => void recheckN3Roll(rowId, result.txid ?? "", nextAmount);
          lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
        }
        // Reconcile bankroll + credit after the settled roll.
        try {
          await refreshLiquidity(network);
        } catch {
          /* keep the prior values */
        }
        return result;
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : ctx.t("statusFailed");
        // This bet never started resolving, so the tracker's reveal state is
        // left alone — a still-pending earlier (EVM) bet keeps its rolling banner.
        if (stakeSent || error instanceof DepositConfirmedActionFailedError) {
          // The deposit landed but roll() reverted (e.g. bankroll fell between the
          // pre-flight read and the on-chain check). The GAS is held as bet credit
          // on the contract: it auto-funds the next roll AND is fully withdrawable
          // via the Withdraw action — surface it as recoverable.
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
    // unresolved. On EVM this awaits the VRF callback; on N3 it only ever runs in
    // the rare case the Rolled-event read timed out at submit (the roll already
    // settled on-chain), re-reading the event. The N3 roll otherwise settles
    // synchronously from the bet tx and never enters this state.
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
