import { createObservable, defineMiniApp } from "@shared/react";
import {
  formatHash,
  parsePositiveFixed8,
  fromFixed8,
  sleep,
} from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import {
  gasToWei,
  evmCall,
  decodeReturnWord,
  detectEvmNetwork,
  getEvmAccount,
  getInjectedEthereum,
} from "@shared/utils/evm-chain";
import type { EvmNetwork } from "@shared/utils/evm-chain";
import PhaserPlayArea from "./PhaserPlayArea";
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
import { eventHashMatches as addrEq, mapField } from "@framework/gamefi";
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
import { createBetTracker } from "./bet-tracker";
import { createDiceGuestEngine } from "./logic/guest-engine";
import {
  createDicePendingBet,
  createDicePendingBetStore,
  findEventByExactTransaction,
  normalizeDicePendingScope,
} from "./pending-bet-store";
import type {
  DicePendingBet,
  DicePendingScope,
} from "./pending-bet-store";

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
// Neo N3 V2 commit/reveal pacing. The immutable result mixes the three fixed
// beacon blocks commit+1..commit+3, and settlement requires a strictly later
// height. Wait roughly four Neo blocks before the one automatic settlement
// attempt. If block production is slower, keep the exact bet unresolved and let
// the player retry explicitly instead of opening a burst of wallet prompts.
const SETTLE_INITIAL_WAIT_MS = 62_000;
const SETTLE_RETRY_DELAY_MS = 6_000;
const SETTLE_MAX_ATTEMPTS = 1;
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

type EvmPlacementReceiptState = "confirmed" | "faulted" | "unknown";

/**
 * Re-read the exact Neo X placement receipt by txid. This is only needed when
 * the original receipt confirmed but the event topic could not be decoded.
 * It never searches another transaction or another player's latest event.
 */
async function recoverEvmRequestFromReceipt(
  txid: string,
  contract: string,
): Promise<{ state: EvmPlacementReceiptState; requestId: string }> {
  const provider = getInjectedEthereum();
  if (!provider || !txid) return { state: "unknown", requestId: "" };
  try {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txid],
    })) as {
      status?: string;
      logs?: Array<{ address?: string; topics?: string[] }>;
    } | null;
    if (!receipt) return { state: "unknown", requestId: "" };
    if (receipt.status !== undefined && receipt.status !== "0x1") {
      return { state: "faulted", requestId: "" };
    }
    const topic = DICE_BET_PLACED_TOPIC.toLowerCase();
    const expectedContract = contract.toLowerCase();
    const log = (receipt.logs ?? []).find(
      (entry) =>
        (entry.address ?? "").toLowerCase() === expectedContract &&
        (entry.topics?.[0] ?? "").toLowerCase() === topic,
    );
    const encoded = log?.topics?.[1];
    return {
      state: "confirmed",
      requestId: encoded ? BigInt(encoded).toString() : "",
    };
  } catch {
    return { state: "unknown", requestId: "" };
  }
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    // Route the Neo N3 ad-hoc arg-building / reads / invokes / events through the
    // MiniApp framework SDK. Behaviour-preserving: arg.* builders emit the
    // identical stack items, and readRaw/invoke/invokeWithPayment/events/
    // detectNetwork are raw passthroughs to the host chain service the
    // framework wraps. The EVM branch stays on the raw chain service — its
    // isEvmNetwork / ensureEvmWallet / invokeEvmWithValue helpers are not part of
    // the N3-only framework chain surface (see the framework-exempt tags below).
    const app = ctx.framework;
    const launchFace = sanitizeFace(
      ctx.launchContext.params.face ?? ctx.launchContext.params.chosenNumber,
    );
    const launchAmount = sanitizeAmount(
      ctx.launchContext.params.amount ?? ctx.launchContext.params.stake,
    );

    const selectedFace = createObservable(launchFace);
    const initialGuestMode = app.mode.isGuest();
    const initialUnit = initialGuestMode ? ctx.t("guestUnit") : "GAS";
    const stakeAmount = createObservable(`${launchAmount} ${initialUnit}`);
    const payoutPreview = createObservable(
      initialGuestMode
        ? `${(Number(launchAmount) * PAYOUT_MULTIPLIER).toFixed(2)} ${initialUnit}`
        : payoutFor(launchAmount),
    );
    const lastTxid = createObservable("");
    const lastStatus = createObservable(ctx.t("statusReady"));
    const isSubmitting = createObservable(false);
    // Per-bet settlement tracking: history rows keyed by bet id, reveal state
    // pinned to the ACTIVE (most recent) bet so interleaved bets never stomp
    // each other's row or banner.
    const tracker = createBetTracker();
    const {
      rollHistory,
      lastRoll,
      lastOutcome,
      lastPayout,
      isResolving,
      isUnresolved,
    } = tracker;
    const pendingStore = createDicePendingBetStore(app.storage.local);
    // Each durable wager keeps its own retry closure. A manual recheck runs all
    // unresolved exact ids, so an older concurrent bet cannot be abandoned just
    // because a newer row owns the result banner.
    const recheckPendingBets = new Map<string, () => void>();
    const pendingRows = new Map<string, string>();
    let activePendingLocalId: string | null = null;
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
    const gasBalance = app.wallet.observeBalance("GAS");
    // Keep the authoritative base-unit credit alongside its display number so
    // the next commit can pay only the exact shortfall without float rounding.
    let directCreditFixed8 = 0n;
    let directCreditOwner = "";

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Surfaced to the PlayArea + scene so GAS-at-stake copy can be reframed for
    // guest (local practice) play. Kept in sync with the launcher-selected
    // app.mode; defaults to "gamefi" so existing behavior is unchanged.
    const mode = createObservable(app.mode.get());

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local crypto-RNG dice table — no chain/oracle/reward
    // calls, so the framework guest guard never fires.
    const guest = createDiceGuestEngine({
      tracker,
      selectedFace,
      stakeAmount,
      payoutPreview,
      lastStatus,
      isSubmitting,
      chainLabel,
      houseLiquidity,
      directCredit,
      maxPayableStake,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Track mode changes for the UI and, on switching to guest, reset to a clean
    // local table (replacing the on-chain reads done on mount).
    app.mode.onChange((next) => {
      mode.set(next);
      if (next === "guest") void guest.enter();
    });

    /**
     * Read the house bankroll and the player's standing bet credit on Neo N3
     * from the standalone MiniAppDiceGame (bankroll() / creditOf(player)). The
     * contract refuses (after the deposit lands) a stake it cannot pay 5.70x —
     * its bankroll guard is bankroll >= stake * 4.7 — so quoting the live payable
     * cap here lets the UI refuse first and surfaces any stranded/over-deposited
     * credit (now withdrawable). Best-effort: a read failure leaves prior values.
     */
    const refreshLiquidity = async (network: string): Promise<void> => {
      // framework-exempt: EVM lane (plan §3.6) — EVM/N3 split stays on the raw
      // chain service; the framework chain surface is N3-only.
      if (ctx.services.chain.isEvmNetwork(network)) {
        houseLiquidity.set(0);
        directCredit.set(0);
        maxPayableStake.set(0);
        directCreditFixed8 = 0n;
        directCreditOwner = "";
        return;
      }
      let liquidity = 0;
      let credit = 0;
      // RFC P0-6: typed read lane — `asBigInt()` keeps the parseBigInt-to-0n
      // decode semantics; read errors still land in the catch fallbacks below.
      try {
        liquidity = fromFixed8(await app.chain.query("bankroll", []).asBigInt());
      } catch {
        liquidity = houseLiquidity.get();
      }
      try {
        const player = app.chain.address.get();
        const playerHash = player ? addressToScriptHash(player) : "";
        if (playerHash) {
          directCreditFixed8 = await app.chain
            .query("creditOf", [app.chain.arg.hash160(playerHash)])
            .asBigInt();
          directCreditOwner = playerHash.toLowerCase();
          credit = fromFixed8(directCreditFixed8);
        } else {
          directCreditFixed8 = 0n;
          directCreditOwner = "";
        }
      } catch {
        const player = app.chain.address.get();
        const playerHash = player ? addressToScriptHash(player) : "";
        if (playerHash && playerHash.toLowerCase() === directCreditOwner) {
          credit = directCredit.get();
        } else {
          directCreditFixed8 = 0n;
          directCreditOwner = "";
          credit = 0;
        }
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

    const pendingScopeForNetwork = async (
      network: string,
    ): Promise<DicePendingScope | null> => {
      if (ctx.services.chain.isEvmNetwork(network)) {
        const contract = DICE_EVM_ADDRESS[network as EvmNetwork] ?? "";
        const player = await getEvmAccount();
        if (!contract || !player) return null;
        return normalizeDicePendingScope({ player, network, contract });
      }
      const walletAddress = app.chain.address.get();
      const player = walletAddress ? addressToScriptHash(walletAddress) : "";
      const contract = app.chain.contractAddress.get() ?? "";
      if (!player || !contract) return null;
      return normalizeDicePendingScope({ player, network, contract });
    };

    const isCurrentPendingScope = async (
      record: DicePendingBet,
    ): Promise<boolean> => {
      if (record.lane === "evm") {
        const network = await detectEvmNetwork();
        if (network !== record.network) return false;
        const player = (await getEvmAccount()).toLowerCase();
        return (
          player === record.player &&
          (DICE_EVM_ADDRESS[network] ?? "").toLowerCase() === record.contract
        );
      }
      const network = (await app.chain.detectNetwork()).toLowerCase();
      if (ctx.services.chain.isEvmNetwork(network) || network !== record.network) {
        return false;
      }
      const walletAddress = app.chain.address.get();
      const player = walletAddress
        ? addressToScriptHash(walletAddress).toLowerCase()
        : "";
      const contract = (app.chain.contractAddress.get() ?? "").toLowerCase();
      return player === record.player && contract === record.contract;
    };

    ctx.framework.actions.register("setSelectedFace", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { face?: unknown };
      selectedFace.set(sanitizeFace(form.face));
    });

    ctx.framework.actions.register("setStakeAmount", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { amount?: unknown };
      const nextAmount = sanitizeAmount(form.amount, maxStake.get());
      const unit = app.mode.isGuest() ? ctx.t("guestUnit") : "GAS";
      stakeAmount.set(`${nextAmount} ${unit}`);
      payoutPreview.set(
        app.mode.isGuest()
          ? `${(Number(nextAmount) * PAYOUT_MULTIPLIER).toFixed(2)} ${unit}`
          : payoutFor(nextAmount),
      );
    });

    ctx.framework.actions.register("connectWallet", async () => {
      if (app.mode.isGuest()) return;
      await app.wallet.ensure();
      await gasBalance.refresh();
    });

    /**
     * On (re)load, seed history from the connected player's Settled events so a
     * refresh doesn't lose a bet that DID settle on-chain. The v2
     * MiniAppDiceGameV2 reveals each bet in a separate settle() tx and emits
     * Settled(betId, player, face, rolled, won, payout) — state slots: betId(0),
     * player(1), face(2), rolled(3), won(4), payout(5). Only seeds when the
     * in-memory history is empty (a fresh load), newest-first.
     */
    const hydrateHistory = async (network: string): Promise<void> => {
      // framework-exempt: EVM lane (plan §3.6) — N3-only Settled-event seeding.
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
              result: rolled ? `${label} · ${ctx.t("rolledLabel")} ${rolled}` : label,
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

    const beginPendingRow = (
      record: DicePendingBet,
      result: string,
    ): string => {
      const rowId = tracker.beginBet({
        face: record.selection,
        stake: `${record.amount} GAS`,
        result,
        payout: payoutFor(record.amount),
        outcome: "pending" as RollOutcome,
        txid: record.txid,
        at: new Date(record.createdAt).toISOString(),
      });
      pendingRows.set(record.localId, rowId);
      activePendingLocalId = record.localId;
      return rowId;
    };

    const markPendingUnknown = (
      rowId: string,
      record: DicePendingBet,
    ) => {
      pendingStore.markUnknown(record);
      tracker.markUnresolved(rowId);
      if (record.localId === activePendingLocalId) {
        lastStatus.set(ctx.t("statusSettlementPending"));
        ctx.setStatus(ctx.t("statusSettlementPending"), "info");
      }
    };

    // Reveal a settled bet from an exact bet/request id. The durable record is
    // cleared only after this chain-backed terminal outcome is known.
    const finishResolve = (
      rowId: string,
      record: DicePendingBet,
      outcome: RollOutcome,
      rolled: number,
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
        result: rolled ? `${label} · ${ctx.t("rolledLabel")} ${rolled}` : label,
        payout: won ? payoutFor(record.amount) : "0 GAS",
      });
      pendingStore.clear(record, "confirmed");
      recheckPendingBets.delete(record.localId);
      pendingRows.delete(record.localId);
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

    const finishFaultedPlacement = (
      rowId: string,
      record: DicePendingBet,
    ) => {
      const label = ctx.t("outcomeRefunded");
      tracker.settleBet(rowId, {
        outcome: "refunded",
        rolled: 0,
        result: label,
        payout: "0 GAS",
      });
      pendingStore.clear(record, "faulted");
      recheckPendingBets.delete(record.localId);
      pendingRows.delete(record.localId);
      if (record.localId === activePendingLocalId) {
        lastStatus.set(ctx.t("statusRefunded"));
        ctx.setStatus(ctx.t("statusRefunded"), "info");
      }
    };

    const ensureEvmRequestId = async (
      rowId: string,
      record: DicePendingBet,
    ): Promise<DicePendingBet | null> => {
      if (record.requestId) return record;
      const receipt = await recoverEvmRequestFromReceipt(
        record.txid,
        record.contract,
      );
      if (receipt.state === "faulted") {
        finishFaultedPlacement(rowId, record);
        return null;
      }
      if (!receipt.requestId) {
        markPendingUnknown(rowId, record);
        return null;
      }
      return pendingStore.updateIdentity(
        record,
        { requestId: receipt.requestId },
        "pending",
      );
    };

    const readEvmOutcome = async (
      record: DicePendingBet,
    ): Promise<{ outcome: RollOutcome; rolled: number } | null> => {
      if (!record.requestId || !(await isCurrentPendingScope(record))) {
        return null;
      }
      try {
        const raw = await evmCall(record.contract, DICE_GET_BET_SELECTOR, [
          record.requestId,
        ]);
        const status = Number(decodeReturnWord(raw, 4));
        if (status <= 1) return null;
        return {
          outcome: evmStatusToOutcome(status),
          rolled: Number(decodeReturnWord(raw, 3)),
        };
      } catch {
        return null;
      }
    };

    // Neo X: poll getBet(requestId) until the VRF settles the exact request.
    const resolveEvmBet = async (
      rowId: string,
      storedRecord: DicePendingBet,
    ) => {
      const record = await ensureEvmRequestId(rowId, storedRecord);
      if (!record) return;
      recheckPendingBets.set(record.localId, () => {
        void resolveEvmBet(rowId, record);
      });
      for (let i = 0; i < 45; i += 1) {
        await sleep(4000);
        const settled = await readEvmOutcome(record);
        if (!settled) continue;
        finishResolve(rowId, record, settled.outcome, settled.rolled);
        return;
      }
      markPendingUnknown(rowId, record);
    };

    /**
     * Read the exact persisted bet directly from the ABI. A txid or indexer event
     * is never enough to reveal a result: the canonical record must bind id,
     * player, face, exact wager, terminal status, roll range, win predicate and
     * payout arithmetic before the UI labels it confirmed.
     */
    const revealFromPendingBetRead = async (
      rowId: string,
      record: DicePendingBet,
    ): Promise<boolean> => {
      if (!record.betId || !(await isCurrentPendingScope(record))) return false;
      try {
        const raw = await app.chain.readRaw("getPendingBet", [
          app.chain.arg.integer(record.betId),
        ]);
        if (
          parseBetId(mapField(raw, "id")) !== record.betId ||
          !addrEq(mapField(raw, "player"), record.player) ||
          String(parseBigInt(mapField(raw, "face"))) !== record.selection ||
          String(parseBigInt(mapField(raw, "wager"))) !== record.amountFixed8 ||
          !asBool(mapField(raw, "settled"))
        ) {
          return false;
        }
        const rolled = Number(parseBigInt(mapField(raw, "rolled"))) || 0;
        const won = asBool(mapField(raw, "won"));
        const payout = parseBigInt(mapField(raw, "payout"));
        const wager = BigInt(record.amountFixed8);
        const expectedWon = rolled === Number(record.selection);
        const expectedPayout = expectedWon ? (wager * 57n) / 10n : 0n;
        if (
          rolled < 1 ||
          rolled > 6 ||
          won !== expectedWon ||
          payout !== expectedPayout
        ) {
          return false;
        }
        finishResolve(rowId, record, won ? "won" : "lost", rolled);
        return true;
      } catch {
        return false;
      }
    };

    const reconcileSettledN3 = async (
      rowId: string,
      record: DicePendingBet,
    ): Promise<boolean> => revealFromPendingBetRead(rowId, record);

    /**
     * Neo N3 v2 — settle a committed bet. The outcome stays unknowable until its
     * fixed three-block beacon exists, so we wait through the required later
     * height before one automatic permissionless settle(betId) attempt. Canonical
     * getPendingBet state, not a tx broadcast or event envelope, confirms the
     * result. A fault or timeout leaves the exact bet unresolved so the player can
     * press "Reveal result" to retry deliberately.
     */
    const settleN3Bet = async (
      rowId: string,
      record: DicePendingBet,
      initialWaitMs = SETTLE_INITIAL_WAIT_MS,
    ) => {
      if (!record.betId || !(await isCurrentPendingScope(record))) {
        markPendingUnknown(rowId, record);
        return;
      }
      recheckPendingBets.set(record.localId, () => {
        void settleN3Bet(rowId, record, 0);
      });
      // Wait through the fixed three-block beacon and its strictly-later gate.
      if (initialWaitMs > 0) await sleep(initialWaitMs);
      for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt += 1) {
        // Another caller (settle is permissionless) may have settled it already.
        if (await reconcileSettledN3(rowId, record)) return;
        try {
          await app.chain.invoke(
            "settle",
            [app.chain.arg.integer(record.betId)],
            { waitForEvent: "Settled", waitTimeoutMs: 30_000 },
          );
          // The settle tx may have halted, but only the exact persisted record can
          // confirm the result. A broadcast or event envelope alone stays pending.
          if (await reconcileSettledN3(rowId, record)) return;
        } catch {
          // settle() reverted (beacon not complete yet, or already settled) —
          // re-check canonical state then back off and retry.
          if (await reconcileSettledN3(rowId, record)) return;
        }
        if (attempt + 1 < SETTLE_MAX_ATTEMPTS) {
          await sleep(SETTLE_RETRY_DELAY_MS);
        }
      }
      // Out of attempts — leave it unresolved with a retry handle.
      markPendingUnknown(rowId, record);
    };

    const exactCommittedBetId = async (
      record: DicePendingBet,
    ): Promise<string> => {
      if (!record.txid || !(await isCurrentPendingScope(record))) return "";
      try {
        const events = await app.chain.events("Committed", { limit: 100 });
        const event = findEventByExactTransaction(events, record.txid);
        if (
          !event ||
          !addrEq(eventStateValue(event, 1), record.player) ||
          String(parseBigInt(eventStateValue(event, 2))) !== record.selection ||
          String(parseBigInt(eventStateValue(event, 3))) !== record.amountFixed8
        ) {
          return "";
        }
        return parseBetId(eventStateValue(event, 0));
      } catch {
        return "";
      }
    };

    /**
     * Neo N3 v2 — recover a betId from the Committed event log when the commit
     * tx's own event read timed out (the tx halted, so the bet IS committed). We
     * locate only the event carrying the persisted txid, verify player/face/
     * amount, then drive the normal wait→settle flow. There is deliberately no
     * "player's newest event" fallback because concurrent wagers make it unsafe.
     */
    const recoverAndSettleN3 = async (
      rowId: string,
      storedRecord: DicePendingBet,
    ) => {
      let record = storedRecord;
      recheckPendingBets.set(record.localId, () => {
        void recoverAndSettleN3(rowId, record);
      });
      for (let i = 0; i < 6; i += 1) {
        await sleep(SETTLE_RETRY_DELAY_MS);
        const betId = await exactCommittedBetId(record);
        if (betId) {
          record = pendingStore.updateIdentity(record, { betId }, "pending");
          recheckPendingBets.set(record.localId, () => {
            void settleN3Bet(rowId, record, 0);
          });
          await settleN3Bet(rowId, record, 0);
          return;
        }
      }
      markPendingUnknown(rowId, record);
    };

    const restorePendingBets = async (network: string): Promise<number> => {
      const scope = await pendingScopeForNetwork(network);
      if (!scope) return 0;
      const records = pendingStore.list(scope);
      if (records.length === 0) return 0;

      const restored = records.map((record) => ({
        record,
        rowId: beginPendingRow(
          record,
          record.lane === "n3"
            ? ctx.t("statusRevealing")
            : ctx.t("statusRolling"),
        ),
      }));

      // Reconcile once, read-only, on refresh. Never pop a wallet signature just
      // because the app mounted; unresolved writes stay behind "Reveal result".
      for (const item of restored) {
        let { record } = item;
        const { rowId } = item;
        if (record.lane === "evm") {
          const recovered = await ensureEvmRequestId(rowId, record);
          if (!recovered) continue;
          record = recovered;
          const settled = await readEvmOutcome(record);
          if (settled) {
            finishResolve(rowId, record, settled.outcome, settled.rolled);
            continue;
          }
          recheckPendingBets.set(record.localId, () => {
            void resolveEvmBet(rowId, record);
          });
          markPendingUnknown(rowId, record);
          continue;
        }

        if (!record.betId) {
          const betId = await exactCommittedBetId(record);
          if (betId) {
            record = pendingStore.updateIdentity(record, { betId }, "pending");
          }
        }
        if (record.betId && (await reconcileSettledN3(rowId, record))) continue;
        recheckPendingBets.set(record.localId, () => {
          if (record.betId) void settleN3Bet(rowId, record, 0);
          else void recoverAndSettleN3(rowId, record);
        });
        markPendingUnknown(rowId, record);
      }
      return records.length;
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
      if (app.mode.isGuest()) { guest.fundGameCredit(); return; }
      const form = (args[0] ?? {}) as { amount?: unknown };
      const network = await refreshNetwork();
      // framework-exempt: EVM lane (plan §3.6) — pre-funded credit is N3-only.
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
      if (app.mode.isGuest()) { guest.withdrawCredit(); return; }
      const network = await refreshNetwork();
      // framework-exempt: EVM lane (plan §3.6) — no withdrawable credit on EVM.
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
      if (app.mode.isGuest()) {
        guest.placeDiceBet((args[0] ?? {}) as { chosenNumber?: unknown; amount?: unknown });
        return;
      }
      if (isSubmitting.get()) return;
      const form = (args[0] ?? {}) as {
        chosenNumber?: unknown;
        amount?: unknown;
      };

      isSubmitting.set(true);
      lastStatus.set(ctx.t("statusSubmitting"));
      let stakeSent = false;
      let broadcastPending: DicePendingBet | null = null;
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

        // framework-exempt: EVM lane (plan §3.6) — the whole Neo X branch below
        // (isEvmNetwork gate, ensureEvmWallet, invokeEvmWithValue) stays on the
        // raw chain service; the framework chain surface is N3-only.
        if (ctx.services.chain.isEvmNetwork(network)) {
          // -- Neo X (EVM) — async VRF settle (UNCHANGED) ----------------------
          const address = DICE_EVM_ADDRESS[network as EvmNetwork];
          if (!address) {
            throw new Error(ctx.t("statusNeoXMainnetOnly"));
          }
          const evmPlayer = await ctx.services.chain.ensureEvmWallet(
            network as EvmNetwork,
          );
          // EVM placeBet is atomic on the stake (value sent with the call, so a
          // revert returns the funds) but the OUTCOME is settled asynchronously
          // by the VRF callback — hence the begin-then-poll machinery below.
          const result = await ctx.services.chain.invokeEvmWithValue({
            address,
            selector: DICE_PLACE_BET_SELECTOR,
            uintArgs: [Number(nextFace)],
            valueWei: gasToWei(nextAmount).toString(),
            eventTopic: DICE_BET_PLACED_TOPIC,
            onTransactionSent: (txid) => {
              if (!txid) return;
              broadcastPending = createDicePendingBet({
                lane: "evm",
                player: evmPlayer,
                network,
                contract: address,
                txid,
                amount: nextAmount,
                amountFixed8,
                selection: nextFace,
                phase: "broadcast",
              });
              pendingStore.upsert(broadcastPending);
            },
          });
          const requestId =
            (result.event as { id?: string } | undefined)?.id ?? "";
          if (!result.txid) throw new Error(ctx.t("statusFailed"));
          const broadcast =
            broadcastPending ??
            createDicePendingBet({
              lane: "evm",
              player: evmPlayer,
              network,
              contract: address,
              txid: result.txid,
              amount: nextAmount,
              amountFixed8,
              selection: nextFace,
              phase: "broadcast",
            });
          const pending = requestId
            ? pendingStore.updateIdentity(
                broadcast,
                { requestId },
                "pending",
              )
            : pendingStore.markUnknown(broadcast);

          lastTxid.set(result.txid ?? "");
          lastStatus.set(ctx.t("statusRolling"));
          const rowId = beginPendingRow(pending, ctx.t("statusRolling"));
          ctx.setStatus(
            `${ctx.t("statusRolling")}${result.txid ? `: ${formatHash(result.txid, 10, 8)}` : ""}`,
            "info",
          );
          recheckPendingBets.set(pending.localId, () => {
            void resolveEvmBet(rowId, pending);
          });
          // Reveal the outcome asynchronously so the user can keep playing.
          void resolveEvmBet(rowId, pending);
          return result;
        }

        // -- Neo N3 v2 — COMMIT → fixed three-block beacon → SETTLE ------------
        const player = await app.chain.ensureWallet();
        const playerHash = addressToScriptHash(player);
        if (!playerHash) {
          throw new Error(ctx.t("statusFailed"));
        }
        const contract = app.chain.contractAddress.get() ?? "";
        if (!contract) throw new Error(ctx.t("statusFailed"));
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
        // STEP 1 — COMMIT. Top up only the shortfall beyond reusable contract
        // credit, then commit(player, face, amount): the wager is escrowed and
        // the house exposure reserved. The outcome is drawn from three fixed
        // consecutive later block hashes, so it is unknowable now and the bet
        // cannot be aborted on a loss (the v1 same-tx drain is gone).
        // The contract emits Committed(betId, player, face, commitIndex) — we read
        // the betId from it. stakeSent flips the moment the wager transfer
        // broadcasts so a post-deposit commit fault is surfaced as recoverable
        // (and WITHDRAWABLE) credit.
        const wagerFixed8 = BigInt(amountFixed8);
        const reusableCredit = directCreditOwner === playerHash.toLowerCase()
          ? directCreditFixed8
          : 0n;
        const paymentShortfall = wagerFixed8 > reusableCredit
          ? wagerFixed8 - reusableCredit
          : 0n;
        const commitArgs = [
          app.chain.arg.hash160(playerHash),
          app.chain.arg.integer(nextFace),
          app.chain.arg.integer(amountFixed8),
        ];
        const onTransactionSent = (txid: string) => {
          if (!txid) return;
          broadcastPending = createDicePendingBet({
            lane: "n3",
            player: playerHash,
            network,
            contract,
            txid,
            amount: nextAmount,
            amountFixed8,
            selection: nextFace,
            phase: "broadcast",
          });
          pendingStore.upsert(broadcastPending);
        };
        const result = paymentShortfall > 0n
          ? await app.chain.invokeWithPayment(
              paymentShortfall.toString(),
              STAKE_MEMO,
              "commit",
              commitArgs,
              {
                waitForEvent: "Committed",
                waitTimeoutMs: 30_000,
                onPaymentSent: () => {
                  stakeSent = true;
                },
                onTransactionSent,
              },
            )
          : await app.chain.invoke("commit", commitArgs, {
              waitForEvent: "Committed",
              waitTimeoutMs: 30_000,
              onTransactionSent,
            });

        lastTxid.set(result.txid ?? "");
        // Committed(betId, player, face, amount, commitIndex): betId is slot 0
        // (a BigInteger counter). The wager is now escrowed; reflect a clear
        // pending "waiting for beacon" state. The bet is irrevocable.
        if (!result.txid) throw new Error(ctx.t("statusFailed"));
        const eventMatchesIntent =
          result.event != null &&
          addrEq(eventStateValue(result.event, 1), playerHash) &&
          String(parseBigInt(eventStateValue(result.event, 2))) === nextFace &&
          String(parseBigInt(eventStateValue(result.event, 3))) === amountFixed8;
        const betId = eventMatchesIntent
          ? parseBetId(eventStateValue(result.event, 0))
          : "";
        const broadcast =
          broadcastPending ??
          createDicePendingBet({
            lane: "n3",
            player: playerHash,
            network,
            contract,
            txid: result.txid,
            amount: nextAmount,
            amountFixed8,
            selection: nextFace,
            phase: "broadcast",
          });
        const pending = betId
          ? pendingStore.updateIdentity(broadcast, { betId }, "pending")
          : pendingStore.updateIdentity(broadcast, {}, "broadcast");
        const rowId = beginPendingRow(pending, ctx.t("statusRevealing"));
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
          recheckPendingBets.set(pending.localId, () => {
            void recoverAndSettleN3(rowId, pending);
          });
          void recoverAndSettleN3(rowId, pending);
          return result;
        }
        // STEP 2 + 3 — wait for the fixed three-block beacon, then settle(betId).
        // Canonical record readback reveals the outcome. Runs asynchronously;
        // "Reveal result" re-runs settlement deliberately if the attempt times out.
        recheckPendingBets.set(pending.localId, () => {
          void settleN3Bet(rowId, pending, 0);
        });
        void settleN3Bet(rowId, pending);
        return result;
      } catch (error) {
        const rawMessage =
          error instanceof Error ? error.message : ctx.t("statusFailed");
        // Assignments happen inside broadcast callbacks, which TypeScript's
        // synchronous control-flow analysis cannot observe here.
        const failedPending = broadcastPending as DicePendingBet | null;
        // A target tx broadcast is durable pending state even when the caller
        // later fails; pre-target failures remain recoverable credit/rejection.
        if (failedPending) {
          if (
            failedPending.lane === "evm" &&
            /transaction reverted/i.test(rawMessage)
          ) {
            // Neo X value transfer and bet call are atomic; a reverted receipt is
            // a definitive fault and no pending wager remains.
            pendingStore.clear(failedPending, "faulted");
            lastStatus.set(rawMessage);
            ctx.setStatus(rawMessage, "error");
          } else {
            // The exact target txid exists but confirmation/recovery failed.
            // Retain it across refresh and expose a safe id-specific recheck.
            const pending = pendingStore.markUnknown(failedPending);
            const rowId =
              pendingRows.get(pending.localId) ??
              beginPendingRow(
                pending,
                pending.lane === "n3"
                  ? ctx.t("statusRevealing")
                  : ctx.t("statusRolling"),
              );
            recheckPendingBets.set(pending.localId, () => {
              if (pending.lane === "n3") {
                void recoverAndSettleN3(rowId, pending);
              } else {
                void resolveEvmBet(rowId, pending);
              }
            });
            markPendingUnknown(rowId, pending);
          }
        } else if (stakeSent || error instanceof DepositConfirmedActionFailedError) {
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

    // "Reveal result": re-run every durable unresolved exact id. This covers
    // concurrent wagers without ever substituting another player's/latest event.
    ctx.framework.actions.register("recheckSettlement", async () => {
      if (app.mode.isGuest()) { guest.recheckSettlement(); return; }
      if (recheckPendingBets.size === 0 || isResolving.get()) return;
      isUnresolved.set(false);
      isResolving.set(true);
      lastStatus.set(ctx.t("statusRevealing"));
      for (const retry of [...recheckPendingBets.values()]) retry();
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
        walletConnected: app.chain.address,
        walletGasBalance: gasBalance.balance,
        lastRoll,
        lastOutcome,
        lastPayout,
        isResolving,
        isUnresolved,
        mode,
      },
      loadData: async () => {
        // Guest is a purely local table — never touch the chain on load, and
        // never let a mount-time gamefi read clobber the guest surface.
        if (app.mode.isGuest()) return;
        const net = await refreshNetwork();
        await gasBalance.refresh();
        const restored = await restorePendingBets(net);
        if (restored === 0) await hydrateHistory(net);
      },
    };
  },
});
