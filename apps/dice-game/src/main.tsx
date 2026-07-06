import { createObservable, defineMiniApp } from "@shared/react";
import {
  formatHash,
  parsePositiveFixed8,
  fromFixed8,
  sleep,
} from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { gasToWei, evmCall, decodeReturnWord } from "@shared/utils/evm-chain";
import type { EvmNetwork } from "@shared/utils/evm-chain";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  chainLabelOf,
  maxStakeOf,
  evmStatusToOutcome,
  maxPayableStakeOf,
} from "./dice-logic";
import type { RollOutcome } from "./dice-logic";
import { addressToScriptHash } from "@shared/utils/neo";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches as addrEq } from "@framework/gamefi";
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
// UNCHANGED from v1 — the v2 commit() escrows the wager via this same memo.
const STAKE_MEMO = `${appId}:stake`; // player bet credit / commit wager
// Neo N3 commit/reveal pacing. After commit, the outcome is drawn from the
// GetRandom of a block STRICTLY LATER than the commit block, so the result is
// unknowable at commit and cannot be aborted on a loss. We wait roughly one
// block before the first settle attempt, then retry — settle() reverts (and is
// safe to retry) until Ledger.CurrentIndex has advanced past the commit block.
const SETTLE_INITIAL_WAIT_MS = 18_000; // ~1 Neo N3 block (15s) + margin
const SETTLE_RETRY_DELAY_MS = 6_000; // between settle re-attempts
const SETTLE_MAX_ATTEMPTS = 8; // ~18s + 8×6s ≈ 66s total before giving up
// Neo X (EVM) dice deployment. The Neo N3 path calls the self-contained
// MiniAppDiceGame (resolved by the host from the manifest) directly; the EVM
// path calls the EVM contract directly. The two branches are independent.
const DICE_EVM_ADDRESS: Partial<Record<EvmNetwork, string>> = {
  "neo-x-mainnet": "0xFA795F814d38F218153d21838360096f3F5cb774",
};
const DICE_PLACE_BET_SELECTOR = "0x43046844"; // placeBet(uint8)
const DICE_GET_BET_SELECTOR = "0x061e494f"; //   getBet(uint256)
const DICE_BET_PLACED_TOPIC =
  "0xd8175cc91837f6ecc7efc5783d64298c19ccb0e81d4b0436c082fa056905d942";
const MIN_STAKE_FIXED8 = 5_000_000n; // 0.05 GAS

function sanitizeFace(value: unknown): string {
  const face = Number(value);
  if (!Number.isInteger(face) || face < 1 || face > 6) return "6";
  return String(face);
}

export function sanitizeAmount(value: unknown, max = 20): string {
  const raw = String(value ?? "").trim();
  if (raw.length === 0) return "0.10";
  const fixed8 = parsePositiveFixed8(raw);
  if (!fixed8) return "0.10";
  const amount = BigInt(fixed8);
  const maxFixed8 = BigInt(parsePositiveFixed8(String(max)) ?? "0");
  if (amount < MIN_STAKE_FIXED8) return "0.05";
  if (maxFixed8 > 0n && amount > maxFixed8) {
    return fixed8ToStakeDisplay(maxFixed8.toString());
  }
  return fixed8ToStakeDisplay(fixed8);
}

export function fixed8ToStakeDisplay(fixed8: string): string {
  const raw = BigInt(fixed8);
  const whole = raw / 100_000_000n;
  const fraction = raw % 100_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(8, "0").replace(/0+$/, "")}`;
}

export function parseStakeFixed8(value: unknown, max = 20): string | null {
  const fixed8 = parsePositiveFixed8(String(value ?? "").trim());
  if (!fixed8) return null;
  const amount = BigInt(fixed8);
  const maxFixed8 = BigInt(parsePositiveFixed8(String(max)) ?? "0");
  if (amount < MIN_STAKE_FIXED8) return null;
  if (maxFixed8 > 0n && amount > maxFixed8) return null;
  return fixed8;
}

function payoutFor(amount: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "0 GAS";
  return `${(numeric * PAYOUT_MULTIPLIER).toFixed(2)} GAS`;
}

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/**
 * The v2 contract's betId is a BigInteger (incrementing counter). Indexers may
 * serialize it as a decimal string, a number, or a little-endian hex byte
 * string. Normalize any of those to a canonical decimal string ("" if unknown)
 * so it can be compared and passed back as an Integer arg to settle().
 */
function parseBetId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value))
    return String(Math.trunc(value));
  if (typeof value === "bigint") return value.toString();
  const raw = String(value).trim();
  if (raw.length === 0) return "";
  // Plain decimal (the common indexer shape).
  if (/^\d+$/.test(raw)) return raw;
  // Hex (with/without 0x) — Neo serializes integers little-endian, so reverse
  // the byte order before interpreting.
  const hex = raw.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]+$/.test(hex) && hex.length % 2 === 0) {
    try {
      const le = (hex.match(/../g) ?? []).reverse().join("");
      return BigInt(`0x${le}`).toString();
    } catch {
      return "";
    }
  }
  return "";
}

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    // Route the Neo N3 ad-hoc arg-building / reads / invokes / events through the
    // MiniApp framework SDK. Behaviour-preserving: arg.* builders emit the
    // identical stack items, and readRaw/invoke/invokeWithPayment/events/
    // detectNetwork are raw passthroughs to the same ctx.services.chain the
    // framework wraps. The EVM branch keeps ctx.services.chain directly — its
    // isEvmNetwork / ensureEvmWallet / invokeEvmWithValue helpers are not part of
    // the framework chain surface.
    const app = ctx.framework;
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
    const { rollHistory, lastRoll, lastOutcome, isResolving, isUnresolved } =
      tracker;
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
        liquidity = fromFixed8(
          parseBigInt(await app.chain.readRaw("bankroll", [])),
        );
      } catch {
        liquidity = houseLiquidity.get();
      }
      try {
        const player = app.chain.address.get();
        const playerHash = player ? addressToScriptHash(player) : "";
        if (playerHash) {
          const creditRaw = await app.chain.readRaw("creditOf", [
            app.chain.arg.hash160(playerHash),
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
      maxPayableStake.set(
        maxPayableStakeOf(liquidity, LIQUIDITY_COVER_MULTIPLE),
      );
    };

    const refreshNetwork = async (): Promise<string> => {
      try {
        const net = await app.chain.detectNetwork();
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
     * On (re)load, seed history from the connected player's Settled events so a
     * refresh doesn't lose a bet that DID settle on-chain. The v2
     * MiniAppDiceGameV2 reveals each bet in a separate settle() tx and emits
     * Settled(betId, player, face, rolled, won, payout) — state slots: betId(0),
     * player(1), face(2), rolled(3), won(4), payout(5). Only seeds when the
     * in-memory history is empty (a fresh load), newest-first.
     */
    const hydrateHistory = async (network: string): Promise<void> => {
      if (ctx.services.chain.isEvmNetwork(network)) return;
      const player = app.chain.address.get();
      const playerHash = player ? addressToScriptHash(player) : "";
      if (!playerHash || rollHistory.get().length > 0) return;
      try {
        const events = await app.chain.events("Settled", {
          limit: 60,
        });
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

    // Reveal a settled bet: update ITS history row (matched by id — a later
    // bet may occupy row 0 by now) and, only when it is still the active bet,
    // the dice + result banner. A win on the active bet fires the host
    // fireworks via the success status.
    const finishResolve = (
      rowId: string,
      outcome: RollOutcome,
      rolled: number,
      amount: string,
    ) => {
      const won = outcome === "won";
      const label = won
        ? ctx.t("outcomeWon")
        : outcome === "refunded"
          ? ctx.t("outcomeRefunded")
          : ctx.t("outcomeLost");
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
    const resolveEvmBet = async (
      rowId: string,
      address: string,
      requestId: string,
      amount: string,
    ) => {
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
        finishResolve(
          rowId,
          evmStatusToOutcome(status),
          Number(decodeReturnWord(raw, 3)),
          amount,
        );
        return;
      }
      tracker.markUnresolved(rowId); // timed out — stays "rolling" in history
    };

    // Neo N3 v2 — find a betId's already-recorded Settled outcome by scanning the
    // Settled event log (the settle() tx halted, so the result IS on-chain even if
    // the event-wait timed out, or another caller settled it first). Returns the
    // matching event or null. betId (slot 0) is compared as a canonical decimal.
    const findSettledEvent = async (betId: string): Promise<unknown | null> => {
      if (!betId) return null;
      try {
        const events = await app.chain.events("Settled", {
          limit: 60,
        });
        const hit = [...events]
          .reverse()
          .find((ev) => parseBetId(eventStateValue(ev, 0)) === betId);
        return hit ?? null;
      } catch {
        return null;
      }
    };

    // Reveal a settled betId from its Settled event (slots: betId(0), player(1),
    // face(2), rolled(3), won(4), payout(5)). Returns true if revealed.
    const revealFromSettledEvent = (
      rowId: string,
      event: unknown,
      amount: string,
    ): boolean => {
      if (event == null) return false;
      const rolled = Number(eventStateValue(event, 3)) || 0;
      const won = asBool(eventStateValue(event, 4));
      finishResolve(rowId, won ? "won" : "lost", rolled, amount);
      return true;
    };

    /**
     * Neo N3 v2 — settle a committed bet. The outcome is unknowable until a block
     * strictly LATER than the commit block, so we wait ~1 block then call the
     * PERMISSIONLESS settle(betId), waiting for the Settled event. settle()
     * reverts until Ledger.CurrentIndex passes the commit block and is safe to
     * retry, so a revert/timeout simply re-attempts (after first checking the
     * Settled log in case it already landed). On success the outcome is read from
     * the Settled event; if all attempts are exhausted the bet is left unresolved
     * so the player can press "Reveal result" to retry.
     */
    const settleN3Bet = async (
      rowId: string,
      betId: string,
      amount: string,
      initialWaitMs = SETTLE_INITIAL_WAIT_MS,
    ) => {
      if (!betId) {
        tracker.markUnresolved(rowId);
        lastStatus.set(ctx.t("statusSettlementPending"));
        ctx.setStatus(ctx.t("statusSettlementPending"), "info");
        return;
      }
      // Wait roughly one block so the reveal block exists before the first settle.
      if (initialWaitMs > 0) await sleep(initialWaitMs);
      for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt += 1) {
        // Another caller (settle is permissionless) may have settled it already —
        // or a prior attempt's event read timed out though the tx halted.
        const prior = await findSettledEvent(betId);
        if (revealFromSettledEvent(rowId, prior, amount)) return;
        try {
          const result = await app.chain.invoke(
            "settle",
            [app.chain.arg.integer(betId)],
            { waitForEvent: "Settled", waitTimeoutMs: 30_000 },
          );
          if (revealFromSettledEvent(rowId, result.event, amount)) return;
          // The settle tx halted but the event read timed out — re-read the log.
          const settled = await findSettledEvent(betId);
          if (revealFromSettledEvent(rowId, settled, amount)) return;
        } catch {
          // settle() reverted (reveal block not reached yet, or already settled) —
          // re-check the log then back off and retry.
          const settled = await findSettledEvent(betId);
          if (revealFromSettledEvent(rowId, settled, amount)) return;
        }
        await sleep(SETTLE_RETRY_DELAY_MS);
      }
      // Out of attempts — leave it unresolved with a retry handle.
      tracker.markUnresolved(rowId);
      recheckActiveBet = () => void settleN3Bet(rowId, betId, amount, 0);
      lastStatus.set(ctx.t("statusSettlementPending"));
      ctx.setStatus(ctx.t("statusSettlementPending"), "info");
    };

    /**
     * Neo N3 v2 — recover a betId from the Committed event log when the commit
     * tx's own event read timed out (the tx halted, so the bet IS committed). We
     * locate the Committed event by txid (falling back to the player's newest
     * Committed event), read its betId (slot 0), then drive the normal
     * wait→settle flow. If the betId can't be recovered the bet stays unresolved
     * for a manual retry.
     */
    const recoverAndSettleN3 = async (
      rowId: string,
      txid: string,
      playerHash: string,
      amount: string,
    ) => {
      for (let i = 0; i < 6; i += 1) {
        await sleep(SETTLE_RETRY_DELAY_MS);
        try {
          const events = await app.chain.events("Committed", {
            limit: 40,
          });
          const hit = txid
            ? events.find(
                (ev) => String((ev as { txid?: unknown })?.txid ?? "") === txid,
              )
            : undefined;
          const mine =
            hit ??
            (playerHash
              ? [...events]
                  .reverse()
                  .find((ev) => addrEq(eventStateValue(ev, 1), playerHash))
              : undefined);
          const betId = mine ? parseBetId(eventStateValue(mine, 0)) : "";
          if (betId) {
            await settleN3Bet(rowId, betId, amount, 0);
            return;
          }
        } catch {
          /* transient indexer error — retry */
        }
      }
      tracker.markUnresolved(rowId);
      lastStatus.set(ctx.t("statusSettlementPending"));
      ctx.setStatus(ctx.t("statusSettlementPending"), "info");
    };

    // Framework operation wrappers keep the old notify.guard semantics: success
    // toast only after the transfer/withdraw really lands, error toast + swallow
    // on failure — while the validation early-returns above them stay silent (a
    // blanket action successKey would fire a success toast on those aborts).
    const fundCreditOp = app.operations.create("fundGameCredit");
    const withdrawCreditOp = app.operations.create("withdrawCredit");

    // Host operation-panel "Fund Stake": pre-fund bet credit by transferring GAS
    // to the standalone game contract with the same memo roll() consumes
    // (miniapp-dice-game:stake) so OnNEP17Payment credits the player. The credit
    // funds subsequent rolls and is fully WITHDRAWABLE via the Withdraw action.
    // Neo N3 only — the EVM path is atomic (no pre-funded credit).
    ctx.framework.actions.register("fundGameCredit", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { amount?: unknown };
      const network = await refreshNetwork();
      if (ctx.services.chain.isEvmNetwork(network)) {
        ctx.setStatus(ctx.t("statusNeoXNoCredit"), "error");
        return;
      }
      const amountFixed8 = parseStakeFixed8(form.amount, maxStake.get());
      if (!amountFixed8) {
        ctx.setStatus(ctx.t("invalidStake"), "error");
        throw new Error(ctx.t("invalidStake"));
      }
      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      await fundCreditOp.run(async () => {
        const player = await app.chain.ensureWallet();
        await app.chain.invoke(
          "transfer",
          [
            app.chain.arg.hash160(player),
            app.chain.arg.hash160(contractHash),
            app.chain.arg.integer(amountFixed8),
            app.chain.arg.string(STAKE_MEMO),
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        );
        await refreshLiquidity(network);
      }, { successKey: "statusCreditFunded" });
    });

    // Withdraw the player's standing bet credit back to their wallet via the
    // standalone contract's Withdraw(account) method, then reconcile the credit
    // chip. This is the real refund for GAS stranded/over-deposited on the
    // contract (the core fix the kernel path lacked). Neo N3 only — the EVM path
    // is atomic and holds no withdrawable credit.
    ctx.framework.actions.register("withdrawCredit", async () => {
      const network = await refreshNetwork();
      if (ctx.services.chain.isEvmNetwork(network)) {
        ctx.setStatus(ctx.t("statusNeoXNoCredit"), "error");
        return;
      }
      const player = app.chain.address.get();
      const playerHash = player ? addressToScriptHash(player) : "";
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (directCredit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await withdrawCreditOp.run(async () => {
        await app.chain.ensureWallet();
        await app.chain.invoke(
          "withdraw",
          [app.chain.arg.hash160(playerHash)],
          { waitForEvent: "CreditWithdrawn" },
        );
        await refreshLiquidity(network);
      }, { successKey: "creditWithdrawn" });
    });

    ctx.framework.actions.register("placeDiceBet", async (...args: unknown[]) => {
      if (isSubmitting.get()) return;
      const form = (args[0] ?? {}) as {
        chosenNumber?: unknown;
        amount?: unknown;
      };

      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      let stakeSent = false;
      // Hoisted so the catch can re-read credit on the same network.
      let network = "neo-n3";
      try {
        // Auto-detect the chain from the connected wallet (also refreshes the UI
        // chain badge + per-network stake cap + house liquidity).
        network = await refreshNetwork();
        const rawFixed8 = parsePositiveFixed8(String(form.amount ?? "").trim());
        if (!rawFixed8 || BigInt(rawFixed8) < MIN_STAKE_FIXED8) {
          throw new Error(ctx.t("invalidStake"));
        }
        const maxFixed8 = BigInt(
          parsePositiveFixed8(String(maxStake.get())) ?? "0",
        );

        // The stake was silently clamped to the network cap (e.g. 10 GAS typed on
        // N3 then the wallet switched to Neo X's 2 GAS cap). Abort rather than bet
        // a different amount than the user asked for.
        if (maxFixed8 > 0n && BigInt(rawFixed8) > maxFixed8) {
          throw new Error(
            ctx.t("statusStakeClamped", {
              cap: maxStake.get().toString(),
              network: chainLabel.get(),
            }),
          );
        }
        const amountFixed8 = rawFixed8;
        const nextAmount = fixed8ToStakeDisplay(amountFixed8);
        const nextFace = sanitizeFace(form.chosenNumber);
        selectedFace.set(nextFace);
        stakeAmount.set(`${nextAmount} GAS`);
        payoutPreview.set(payoutFor(nextAmount));

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
          const requestId =
            (result.event as { id?: string } | undefined)?.id ?? "";

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
          recheckActiveBet = () =>
            void resolveEvmBet(rowId, address, requestId, nextAmount);
          // Reveal the outcome asynchronously so the user can keep playing.
          void resolveEvmBet(rowId, address, requestId, nextAmount);
          return result;
        }

        // -- Neo N3 v2 — COMMIT → wait one block → SETTLE (anti-abort) ---------
        const player = await app.chain.ensureWallet();
        const playerHash = addressToScriptHash(player);
        if (!playerHash) {
          throw new Error(ctx.t("statusFailed"));
        }
        // PRE-FLIGHT: commit() reserves the house exposure (bankroll >= stake *
        // 4.7) when the wager is escrowed. With the live free bankroll (re-read
        // here for freshness), refuse a stake the house cannot cover a win on
        // BEFORE depositing, so the GAS is never stranded as credit.
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
        // STEP 1 — COMMIT. DEPOSIT (miniapp-dice-game:stake) then
        // commit(player, face, amount) in the SAME tx: the wager is escrowed and
        // the house exposure reserved. The outcome is drawn from the GetRandom of
        // a block STRICTLY LATER than this commit block, so it is unknowable now
        // and the bet cannot be aborted on a loss (the v1 same-tx drain is gone).
        // The contract emits Committed(betId, player, face, commitIndex) — we read
        // the betId from it. stakeSent flips the moment the wager transfer
        // broadcasts so a post-deposit commit fault is surfaced as recoverable
        // (and WITHDRAWABLE) credit.
        const result = await app.chain.invokeWithPayment(
          amountFixed8,
          STAKE_MEMO,
          "commit",
          [
            app.chain.arg.hash160(playerHash),
            app.chain.arg.integer(nextFace),
            app.chain.arg.integer(amountFixed8),
          ],
          {
            waitForEvent: "Committed",
            waitTimeoutMs: 30_000,
            onPaymentSent: () => {
              stakeSent = true;
            },
          },
        );

        lastTxid.set(result.txid ?? "");
        // Committed(betId, player, face, amount, commitIndex): betId is slot 0
        // (a BigInteger counter). The wager is now escrowed; reflect a clear
        // pending "revealing on the next block" state. The bet is irrevocable.
        const betId =
          result.event != null
            ? parseBetId(eventStateValue(result.event, 0))
            : "";
        const rowId = tracker.beginBet({
          face: nextFace,
          stake: `${nextAmount} GAS`,
          result: ctx.t("statusRevealing"),
          payout: payoutFor(nextAmount),
          outcome: "pending" as RollOutcome,
          txid: result.txid ?? "",
          at: new Date().toISOString(),
        });
        lastStatus.set(ctx.t("statusBetPlaced"));
        ctx.setStatus(
          `${ctx.t("statusBetPlaced")}${result.txid ? `: ${formatHash(result.txid, 10, 8)}` : ""}`,
          "info",
        );
        // Reconcile bankroll + credit after the wager was escrowed.
        try {
          await refreshLiquidity(network);
        } catch {
          /* keep the prior values */
        }
        if (!betId) {
          // The commit tx halted but the Committed event read timed out — without
          // the betId we cannot settle. Recover the betId from the Committed log
          // by txid, then settle; offer a manual retry meanwhile.
          recheckActiveBet = () =>
            void recoverAndSettleN3(
              rowId,
              result.txid ?? "",
              playerHash,
              nextAmount,
            );
          void recoverAndSettleN3(
            rowId,
            result.txid ?? "",
            playerHash,
            nextAmount,
          );
          return result;
        }
        // STEP 2 + 3 — wait one block then settle(betId), revealing the outcome
        // from the Settled event. Runs asynchronously so the user can keep
        // playing; "Reveal result" re-runs settle if it times out.
        recheckActiveBet = () => void settleN3Bet(rowId, betId, nextAmount, 0);
        void settleN3Bet(rowId, betId, nextAmount);
        return result;
      } catch (error) {
        const rawMessage =
          error instanceof Error ? error.message : ctx.t("statusFailed");
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

    // "Reveal result": re-run the active bet's reveal after the settle poll timed
    // out unresolved. On EVM this awaits the VRF callback; on N3 v2 it re-calls
    // the PERMISSIONLESS settle(betId) (safe to retry — a revert simply means the
    // reveal block isn't reached yet, and an "already settled" revert is
    // reconciled by re-reading the Settled event). The wager is escrowed and the
    // outcome is fixed once a later block exists, so this never loses funds.
    ctx.framework.actions.register("recheckSettlement", async () => {
      if (!recheckActiveBet || isResolving.get()) return;
      isUnresolved.set(false);
      isResolving.set(true);
      lastStatus.set(ctx.t("statusRevealing"));
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
