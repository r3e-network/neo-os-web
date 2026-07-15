/**
 * useBurnLeague — Domain logic for the Burn League miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppBurnLeague)
 * via ctx.framework.chain. The earlier path routed burns through the OS
 * GameProxy/LeaderboardProxy/BadgeProxy edge functions, which moved nothing once
 * the kernel degraded and read a pool / leaderboard no contract maintained. This
 * composable drives the dedicated contract, an all-pay SEASONAL contest (no house
 * fee, pure redistribution): players burn GAS into the current season pool, the
 * top burner wins the WHOLE pool when the season is settled after its deadline,
 * and the next season starts lazily on the next burn — settle() is permissionless
 * (no oracle, no off-chain keeper).
 *
 * Contract interaction model (verified against MiniAppBurnLeague.cs / ABI):
 *
 *   READS (app.chain.readRaw, default app contract script hash; all GAS in BASE UNITS):
 *     currentSeason()        -> Integer (1-based; 0 before the first season)
 *     seasonEnd()            -> Integer (ms epoch; 0 = dormant)
 *     rewardPool()           -> Integer (current season pool, base units)
 *     totalBurned()          -> Integer (== rewardPool, base units)
 *     burnCount()            -> Integer
 *     userBurned(player)     -> Integer (player's CURRENT-season total, base units)
 *     topBurner()            -> Hash160 (zero address if none)
 *     topBurned()            -> Integer (the leader's season total, base units)
 *     creditOf(player)       -> Integer (prepaid burn credit, base units)
 *     minBurn() / maxBurn()  -> Integer (base units)
 *
 *   EVENTS (app.chain.events):
 *     Burned(seasonId, player, amount, userSeasonTotal) — the lag-free
 *       leaderboard source. state slots: [0]=seasonId, [1]=player(address),
 *       [2]=amount(base units), [3]=userSeasonTotal(base units). The board is the
 *       LATEST userSeasonTotal per player for the CURRENT season, ranked desc.
 *
 *   MUTATIONS (app.chain.invoke):
 *     1. DEPOSIT (fund a burn) — a GAS transfer to the contract with the memo
 *        "miniapp-burnleague:burn" so OnNEP17Payment credits the sender's prepaid
 *        burn balance (only topped up when creditOf(player) < amount):
 *          transfer(from, CONTRACT, amountBaseUnits, "miniapp-burnleague:burn")
 *          { scriptHash: GAS_HASH }
 *     2. burn(player, amountBaseUnits) -> userSeasonTotal. Lazily starts a season
 *        if none is active, moves the amount from prepaid credit into the pool,
 *        and adds to the player's season total. If step 1 lands but step 2
 *        reverts, the credit persists on the contract as reusable prepaid credit
 *        (reclaimable via withdraw) — no funds are lost.
 *     settle() — PERMISSIONLESS. After the deadline credits the WHOLE pool to the
 *        top burner's withdrawable balance and advances the season. Anyone may
 *        trigger it; the on-chain top burner is the winner regardless of who signs.
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS (GAS × 1e8). Human GAS
 * for the UI = base / 1e8 (fromBaseUnits). The human input is scaled to base units
 * in-process ONCE (toBaseUnits, no floats) — never double-scaled, never unscaled.
 * MIN_BURN 1 GAS, MAX_BURN 1000 GAS per burn, enforced both on-chain and here.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Burn-amount input + validation
 *   - Loading/burning/settling UI flags (double-submit guards)
 *   - Season lifecycle derivation (dormant / active / ended) + countdown
 *   - The leaderboard rebuilt from current-season Burned events
 *   - Formatted display values
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { gasToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { formatNumber, fromFixed8 } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { eventHashMatches as addrEq } from "@framework/gamefi";
import {
  createBurnOperationStore,
  createPendingBurnOperation,
  findBurnEventByExactTransaction,
  normalizeBurnOperationScope,
} from "../burn-operation-store";
import type {
  BurnOperationPhase,
  BurnOperationScope,
  PendingBurnOperation,
} from "../burn-operation-store";

// ============================================================================
// Constants
// ============================================================================

/** Minimum burn amount in GAS (mirrors the contract's MIN_BURN = 1 GAS). */
export const MIN_BURN = 1;
/** Maximum burn amount in GAS per burn (mirrors the contract's MAX_BURN). */
const MAX_BURN = 1_000;

/** MIN/MAX in base units (1e8 per GAS). */
const MIN_BURN_BASE = 1_00000000n;
const MAX_BURN_BASE = 1000_00000000n;

/** Demo deployments shorter than one hour are not safe production seasons. */
const MIN_PRODUCTION_SEASON_MS = 3_600_000;

/** Only this reviewed v1.1 TestNet deployment may accept new paid burns. */
export const BURN_LEAGUE_TESTNET_CONTRACT =
  "0x21a527b50b839efeb73721a886c9b5994a206316";
export const BURN_LEAGUE_TESTNET_NEF_CHECKSUM = 1958350116;

export function isVerifiedBurnLeagueContract(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === BURN_LEAGUE_TESTNET_CONTRACT;
}

/** Memo the contract requires on the burn-funding transfer (appId + ":burn"). */
const BURN_MEMO = "miniapp-burnleague:burn";

/** Defensive full-season event bound for the non-authoritative board preview. */
const BURNED_EVENTS_CAP = 2_000;

/** The zero script hash a contract returns for topBurner when none is set. */
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

// ============================================================================
// Amount helpers
// ============================================================================
// toBaseUnits (gasToBaseUnits) comes from @shared/utils/amounts — the SINGLE
// scaling point; the contract scales nothing.

/** Convert a contract base-unit Integer to whole GAS as a number (÷ 1e8). */
const fromBaseUnits = (base: bigint): number => Number(base) / 1e8;

/**
 * Is a parsed Hash160 / address value the zero address? Treats "", the 0x-zero
 * hash, and its case/length variants as empty (a contract with no top burner).
 */
const isZeroAddress = (value: string): boolean => {
  if (!value) return true;
  const v = value.trim();
  if (v === ZERO_HASH) return true;
  if (/^0x0{40}$/i.test(v)) return true;
  return false;
};

// ============================================================================
// Types
// ============================================================================

export interface LeaderEntry {
  rank: number;
  address: string;
  burned: number;
  isUser: boolean;
}

export interface UseBurnLeagueOptions {
  /** MiniApp framework SDK from ctx.framework (chain args / reads / invokes). */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Accessor for the connected wallet address (e.g. ctx.framework.chain.address.get).
   * Used to resolve the current user's leaderboard rank and identity. Optional so
   * the composable degrades gracefully when no wallet is connected.
   */
  getAddress?: () => string | null | undefined;
}

export type BurnTransactionState =
  | "idle"
  | "broadcast"
  | "unknown"
  | "confirmed"
  | "failed";

export interface BurnSubmitResult {
  amount: number;
  status: "confirmed" | "unknown";
  txid: string;
  phase: BurnOperationPhase;
}

export type BurnRecoveryStatus =
  | "none"
  | "pending"
  | "deposit-confirmed"
  | "burn-confirmed";

export interface BurnRecoveryResult {
  status: BurnRecoveryStatus;
  operation: PendingBurnOperation | null;
}

export interface BurnAuxiliarySubmitResult {
  status: "confirmed" | "unknown";
  txid: string;
}

/** Case-insensitive address equality (handles base58 and hex script-hash forms). */
function addressMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b || a.toLowerCase() === b.toLowerCase();
}

/** Match a decoded base58 address or either-endian Hash160 event slot. */
function eventPlayerMatches(value: unknown, playerHash: string): boolean {
  if (addrEq(value, playerHash)) return true;
  const decodedHash = addressToScriptHash(String(value ?? ""));
  return Boolean(decodedHash && addrEq(decodedHash, playerHash));
}

/** Match an event/read identity that may be base58 or either-endian Hash160. */
function playerIdentityMatches(
  value: unknown,
  addressValue: string | null | undefined,
): boolean {
  if (!value || !addressValue) return false;
  const playerHash = addressToScriptHash(addressValue);
  return Boolean(
    (playerHash && eventPlayerMatches(value, playerHash)) ||
    addressMatches(String(value), addressValue),
  );
}

/**
 * Strict decimal parse for burn amounts. Accepts only a canonical, trimmed,
 * non-scientific decimal (optionally with a fractional part) and returns NaN for
 * anything else, so a malformed value is rejected by validation instead of
 * silently reaching a fund-moving call.
 */
const DECIMAL_RE = /^\d+(\.\d+)?$/;
function parseBurnAmount(input: string | null | undefined): number {
  const trimmed = String(input ?? "").trim();
  if (!DECIMAL_RE.test(trimmed)) return NaN;
  return Number(trimmed);
}

// ============================================================================
// Composable
// ============================================================================

export function useBurnLeague({ app, t, getAddress }: UseBurnLeagueOptions) {
  // ── State (all GAS values in whole GAS for display) ──────────────────
  const totalBurned = createObservable(0);
  const rewardPool = createObservable(0);
  const userBurned = createObservable(0);
  const rank = createObservable(0);
  const burnCount = createObservable(0);
  const leaderboard = createObservable<LeaderEntry[]>([]);
  const isBurning = createObservable(false);
  const isSettling = createObservable(false);
  const isLoading = createObservable(false);
  const leagueDataAvailable = createObservable(false);
  const serviceNotice = createObservable("");
  const actionNotice = createObservable("");
  const burnValidationError = createObservable<string | null>(null);
  const lastSubmittedAmount = createObservable("");
  const burnTransactionState = createObservable<BurnTransactionState>("idle");
  const pendingBurnTxid = createObservable("");
  const pendingBurnPhase = createObservable<BurnOperationPhase | "">("");
  const operationStore = createBurnOperationStore(app.storage.local);
  /**
   * Outcome of the most recent successful settle, captured at settle time from
   * the leader/pool that existed BEFORE the season rolled forward. Drives the
   * win/payout celebration. `won` is true only when the connected wallet was the
   * recorded top burner who receives claimable pool credit; `amount` is the pool that was
   * awarded (display string). A non-empty `token` marks a fresh result so the
   * UI can fire the celebration exactly once per settle.
   */
  const lastSettleResult = createObservable<{
    won: boolean;
    amount: string;
    token: number;
  } | null>(null);

  // ── Season lifecycle state ───────────────────────────────────────────
  /** 1-based season id (0 before the very first season). */
  const seasonId = createObservable(0);
  /** Season deadline in ms epoch; 0 = dormant (no active season). */
  const seasonEndMs = createObservable(0);
  /** The current leader's address (top burner), "" when none. */
  const topBurnerAddress = createObservable<string | null>(null);
  /** The current leader's season total, in whole GAS. */
  const topBurnedGas = createObservable(0);
  /** Season length in ms read from seasonDuration() (0 until first load). */
  const seasonDurationMs = createObservable(0);
  /** Connected wallet's unused prepaid burn-credit (human GAS). */
  const prepaidCredit = createObservable(0);
  /** Wall clock for the countdown / ended derivation, ticked once per second. */
  const now = createObservable(Date.now());

  // ── Local UI state managed by the composable ─────────────────────────
  const burnAmount = createObservable("1");

  // On-chain burn bounds (whole GAS). Default to the contract's compile-time
  // MIN_BURN/MAX_BURN literals and are overwritten by the live minBurn()/maxBurn()
  // reads in loadStats — so validation and the burnRange copy track the contract
  // even if the deployed bounds ever differ from the literals. Fall back to the
  // literals when the read is unavailable.
  const minBurnGas = createObservable(MIN_BURN);
  const maxBurnGas = createObservable(MAX_BURN);

  // Connected wallet address (synced from main.tsx / chain).
  const resolveAddress = (): string | null =>
    (getAddress?.() ?? app.chain.address.get()) ?? null;
  const address = createObservable<string | null>(resolveAddress());

  const setAddress = (addr: string | null) => {
    if (!addressMatches(address.get(), addr)) {
      pendingBurnTxid.set("");
      pendingBurnPhase.set("");
      burnTransactionState.set("idle");
      userBurned.set(0);
      prepaidCredit.set(0);
      rank.set(0);
      leaderboard.set(
        leaderboard.get().map((entry) => ({ ...entry, isUser: false })),
      );
    }
    address.set(addr ?? null);
  };

  const updateNow = () => { now.set(Date.now()); };

  // ── Season lifecycle (derived) ──────────────────────────────────────
  /**
   * "dormant"  — no active season (seasonEnd == 0); the first burn starts one.
   * "active"   — now < seasonEnd; players can burn and the countdown runs.
   * "ended"    — now >= seasonEnd (seasonEnd != 0); needs settle() to award the
   *              pool to the leader and roll the season forward.
   */
  const seasonPhase = createDerived<"dormant" | "active" | "ended">(() => {
    const end = seasonEndMs.get();
    if (end === 0) return "dormant";
    return now.get() < end ? "active" : "ended";
  }, [seasonEndMs, now]);

  /** True while the season is open for burns. */
  const isSeasonActive = createDerived(() => seasonPhase.get() === "active", [seasonPhase]);

  /** True once the season deadline has passed and the pool still needs settling. */
  const needsSettle = createDerived(() => seasonPhase.get() === "ended", [seasonPhase]);

  /** Remaining seconds until the season deadline (0 once ended / dormant). */
  const timeRemainingSeconds = createDerived(() => {
    const end = seasonEndMs.get();
    if (end === 0) return 0;
    return Math.max(0, Math.floor((end - now.get()) / 1000));
  }, [seasonEndMs, now]);

  /** HH:MM:SS countdown to the season deadline. */
  const countdown = createDerived(() => {
    const total = timeRemainingSeconds.get();
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }, [timeRemainingSeconds]);

  /** Human-readable status line for the season phase. */
  const seasonStatusLabel = createDerived(() => {
    switch (seasonPhase.get()) {
      case "active": return t("seasonActive");
      case "ended": return t("seasonEnded");
      default: return t("seasonDormant");
    }
  }, [seasonPhase]);

  const formattedSeason = createDerived(() => {
    const id = seasonId.get();
    return id > 0 ? `#${id}` : "--";
  }, [seasonId]);

  /** True when the connected wallet has unused prepaid burn-credit to withdraw. */
  const hasCredit = createDerived(() => prepaidCredit.get() > 0, [prepaidCredit]);
  const hasUnknownBurn = createDerived(
    () =>
      burnTransactionState.get() === "broadcast" ||
      burnTransactionState.get() === "unknown",
    [burnTransactionState],
  );

  /**
   * Humanized season length read from seasonDuration() — disclosed so a first
   * burner knows how long the round they are opening will run. "--" until the
   * duration has been read. Sub-hour durations (e.g. the 120s testnet/demo
   * value) are shown in minutes/seconds so the figure is never rounded to "0h".
   */
  const seasonDurationLabel = createDerived(() => {
    const ms = seasonDurationMs.get();
    if (ms <= 0) return "--";
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return t("durationSeconds", { count: totalSeconds });
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) return t("durationMinutes", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("durationHours", { count: hours });
    const days = Math.round(hours / 24);
    return t("durationDays", { count: days });
  }, [seasonDurationMs]);

  /** Prepaid burn-credit, formatted for display. */
  const prepaidCreditDisplay = createDerived(
    () => `${formatNumber(prepaidCredit.get(), 2)} ${t("tokenGas")}`,
    [prepaidCredit],
  );

  // ── Formatted display values ─────────────────────────────────────────
  const totalBurnedDisplay = createDerived(
    () => `${formatNumber(totalBurned.get(), 2)} ${t("tokenGas")}`,
    [totalBurned],
  );
  const userBurnedDisplay = createDerived(
    () => `${formatNumber(userBurned.get(), 2)} ${t("tokenGas")}`,
    [userBurned],
  );
  const rewardPoolDisplay = createDerived(
    () => `${formatNumber(rewardPool.get(), 2)} ${t("tokenGas")}`,
    [rewardPool],
  );
  /**
   * Rank 0 means "this wallet has not burned yet" — the expected first-run
   * state, not a missing read. Collapsing it to "--" printed an em-dash void
   * into every surface that renders this one value (the Phaser rank tile, the
   * in-game HUD "Your Rank" tile, the sidebar and the platform stat strip), so
   * a first-time visitor met a row of dashes before touching anything. State
   * the zero-state honestly instead; the "#N" shape is unchanged once ranked.
   */
  const formattedRank = createDerived(
    () => rank.get() > 0 ? `#${rank.get()}` : t("rankUnranked"),
    [rank],
  );
  const leaderboardSize = createDerived(() => leaderboard.get().length, [leaderboard]);

  /**
   * The prize for the current season — the WHOLE reward pool, credited to the
   * top burner at settle for withdrawal. This replaces the bogus 0.1x estimate: the prize is the
   * pool, not a fraction of the player's own burn.
   */
  const prizePoolDisplay = createDerived(
    () => `${formatNumber(rewardPool.get(), 2)} ${t("tokenGas")}`,
    [rewardPool],
  );

  /** The current leader's burned total, formatted for display. */
  const topBurnedDisplay = createDerived(
    () => `${formatNumber(topBurnedGas.get(), 2)} ${t("tokenGas")}`,
    [topBurnedGas],
  );

  /** Short, display-friendly leader address ("--" when no leader yet). */
  const leaderLabel = createDerived(() => {
    const addr = topBurnerAddress.get();
    if (!addr) return "--";
    if (addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [topBurnerAddress]);

  /**
   * Whether the connected wallet is the CURRENT leader (the top burner who would
   * win the pool if the season settled now). Compared case-insensitively against
   * the connected address; false when there is no leader or no wallet.
   */
  const userIsLeader = createDerived(() => {
    return playerIdentityMatches(topBurnerAddress.get(), address.get());
  }, [topBurnerAddress, address]);

  const projectedTotalBurnedDisplay = createDerived(() => {
    const amount = parseFloat(burnAmount.get());
    const projected = userBurned.get() + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    return `${formatNumber(projected, 2)} ${t("tokenGas")}`;
  }, [burnAmount, userBurned]);

  /** Top 10 entries for the leaderboard preview. */
  const leaderboardPreview = createDerived(() => leaderboard.get().slice(0, 10), [leaderboard]);

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Read the authoritative season state from the contract: id, deadline, pool,
   * counts, the connected player's season total, and the current leader. All
   * amounts are scaled from base units to whole GAS for display.
   */
  const loadStats = async (): Promise<boolean> => {
    const configuredContract = app.chain.contractAddress.get();
    if (!isVerifiedBurnLeagueContract(configuredContract)) {
      leagueDataAvailable.set(false);
      serviceNotice.set(t("burnDeploymentUnverified"));
      return false;
    }
    try {
      // RFC P0-6: typed read lane — the `as*` decoders keep the exact
      // parseBigInt-based coercions (malformed values decode to 0 / 0n);
      // read errors still land in this try/catch.
      const [
        seasonIdValue,
        seasonEndValue,
        poolFixed8,
        burnCountValue,
        topBurnerValue,
        topBurnedFixed8,
        durationMs,
        minBurnFixed8,
        maxBurnFixed8,
      ] = await Promise.all([
        app.chain.query("currentSeason", []).asInt(),
        app.chain.query("seasonEnd", []).asInt(),
        app.chain.query("rewardPool", []).asBigInt(),
        app.chain.query("burnCount", []).asInt(),
        app.chain.query("topBurner", []).asString(),
        app.chain.query("topBurned", []).asBigInt(),
        app.chain.query("seasonDuration", []).asInt(),
        app.chain.query("minBurn", []).asBigInt(),
        app.chain.query("maxBurn", []).asBigInt(),
      ]);

      seasonId.set(seasonIdValue);
      seasonEndMs.set(seasonEndValue);
      // Disclose the season length so a first burner knows how long the round
      // they open will run (live mainnet value is currently 120s).
      seasonDurationMs.set(durationMs);

      // Bind the burn bounds to the live contract values (base units → whole
      // GAS), keeping the literals when a read returns a non-positive value.
      const minGas = fromBaseUnits(minBurnFixed8);
      const maxGas = fromBaseUnits(maxBurnFixed8);
      if (minGas > 0) minBurnGas.set(minGas);
      if (maxGas > 0) maxBurnGas.set(maxGas);

      const poolGas = fromBaseUnits(poolFixed8);
      // TotalBurned() == RewardPool() on the contract — both are the season pool.
      totalBurned.set(poolGas);
      rewardPool.set(poolGas);
      burnCount.set(burnCountValue);

      const topAddr = topBurnerValue.trim();
      topBurnerAddress.set(isZeroAddress(topAddr) ? "" : topAddr);
      topBurnedGas.set(fromBaseUnits(topBurnedFixed8));

      // The connected player's CURRENT-season total via userBurned(player) and
      // their unused prepaid burn-credit via creditOf(player) (the withdraw
      // affordance stays honest after every action).
      const myAddr = resolveAddress();
      const myHash = myAddr ? addressToScriptHash(myAddr) || null : null;
      if (myHash) {
        try {
          const userFixed8 = await app.chain
            .query("userBurned", [app.chain.arg.hash160(myHash)])
            .asBigInt();
          userBurned.set(fromBaseUnits(userFixed8));
        } catch (e) {
          console.warn("[useBurnLeague] userBurned read failed:", errorMessage(e));
          userBurned.set(0);
        }
        try {
          const creditFixed8 = await app.chain
            .query("creditOf", [app.chain.arg.hash160(myHash)])
            .asBigInt();
          prepaidCredit.set(fromFixed8(creditFixed8));
        } catch (e) {
          console.warn("[useBurnLeague] creditOf read failed:", errorMessage(e));
        }
      } else {
        userBurned.set(0);
        prepaidCredit.set(0);
      }

      if (!Number.isFinite(durationMs) || durationMs < MIN_PRODUCTION_SEASON_MS) {
        leagueDataAvailable.set(false);
        serviceNotice.set(t("seasonDurationUnsafe", {
          duration: seasonDurationLabel.get(),
        }));
        return false;
      }

      leagueDataAvailable.set(true);
      serviceNotice.set("");
      return true;
    } catch (e) {
      leagueDataAvailable.set(false);
      serviceNotice.set(t("burnServiceUnavailable"));
      console.warn("[useBurnLeague] loadStats failed:", errorMessage(e));
      return false;
    }
  };

  /**
   * Rebuild the leaderboard from Burned events, scoped to the CURRENT season.
   *
   * Each Burned event carries (seasonId, player, amount, userSeasonTotal). The
   * board is the LATEST userSeasonTotal per player for the active season, ranked
   * descending. Because the events arrive newest-first, the FIRST event seen for
   * a player is their latest total. The user's rank is resolved by wallet
   * identity (independent of the userBurned read, so it doesn't race loadStats).
   */
  const loadLeaderboard = async () => {
    try {
      const currentSeason = seasonId.get();
      if (currentSeason <= 0) {
        leaderboard.set([]);
        rank.set(0);
        return;
      }

      const events = await app.events.listAll("Burned", { cap: BURNED_EVENTS_CAP });

      // Newest-first: keep the FIRST (= latest) userSeasonTotal seen per player
      // within the current season.
      const latestByPlayer = new Map<string, number>();
      for (const event of events) {
        const evtSeason = Number(parseBigInt(eventValue(event, 0)));
        if (evtSeason !== currentSeason) continue;
        const player = String(eventValue(event, 1) ?? "").trim();
        if (!player) continue;
        if (latestByPlayer.has(player)) continue; // already have the newest total
        const seasonTotal = fromBaseUnits(parseBigInt(eventValue(event, 3)));
        latestByPlayer.set(player, seasonTotal);
      }

      const myAddress = resolveAddress();
      const ranked: LeaderEntry[] = Array.from(latestByPlayer.entries())
        .map(([player, burned]) => ({ player, burned }))
        .sort((a, b) => b.burned - a.burned)
        .map((entry, idx) => ({
          rank: idx + 1,
          address: entry.player,
          burned: entry.burned,
          isUser: playerIdentityMatches(entry.player, myAddress),
        }));

      leaderboard.set(ranked);

      const userEntry = ranked.find((entry) => entry.isUser);
      rank.set(userEntry ? userEntry.rank : 0);
    } catch (e) {
      console.warn("[useBurnLeague] loadLeaderboard failed:", errorMessage(e));
    }
  };

  /**
   * Load all data (season stats + leaderboard). Called by defineMiniApp on mount
   * and when the wallet connects. The leaderboard depends on the season id read
   * by loadStats, so it runs after.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      setAddress(resolveAddress());
      await loadStats();
      await loadLeaderboard();
    } finally {
      isLoading.set(false);
    }
  };

  // ── Validation ──────────────────────────────────────────────────────

  const validateBurnAmount = (burnAmountInput?: string) => {
    const amountStr = burnAmountInput ?? burnAmount.get();
    const amount = parseBurnAmount(amountStr);
    // Validate against the live on-chain bounds (with the literals as the
    // fallback the observables default to).
    const min = minBurnGas.get();
    const max = maxBurnGas.get();
    if (!Number.isFinite(amount) || amount < min) {
      return t("minBurn", { amount: min, tokenGas: t("tokenGas") });
    }
    if (amount > max) {
      return t("maxBurn", { amount: max, tokenGas: t("tokenGas") });
    }
    return null;
  };

  // ── Durable irreversible-operation recovery ───────────────────────

  const resolveOperationScope = async (
    playerHash?: string,
    contractHash?: string,
  ): Promise<BurnOperationScope | null> => {
    const currentAddress = resolveAddress();
    const resolvedPlayer = playerHash || addressToScriptHash(currentAddress || "");
    const resolvedContract = contractHash || app.chain.contractAddress.get() || "";
    if (!resolvedPlayer || !resolvedContract) return null;
    const network = await app.chain.detectNetwork();
    return normalizeBurnOperationScope({
      player: resolvedPlayer,
      network,
      contract: resolvedContract,
    });
  };

  const showPendingOperation = (
    operation: PendingBurnOperation,
    state: BurnTransactionState,
  ) => {
    pendingBurnTxid.set(operation.txid);
    pendingBurnPhase.set(operation.phase);
    burnTransactionState.set(state);
  };

  const clearPendingOperation = (
    scope: BurnOperationScope,
    state: BurnTransactionState = "idle",
  ) => {
    operationStore.clear(scope);
    pendingBurnTxid.set("");
    pendingBurnPhase.set("");
    burnTransactionState.set(state);
  };

  const persistOperation = (
    scope: BurnOperationScope,
    phase: BurnOperationPhase,
    txid: string,
    amount: string,
    amountBase: bigint,
    transactionAmountBase: bigint,
  ): PendingBurnOperation | null => {
    if (!String(txid ?? "").trim()) return null;
    const operation = operationStore.set(
      createPendingBurnOperation({
        ...scope,
        phase,
        txid,
        amount,
        amountBase: amountBase.toString(),
        transactionAmountBase: transactionAmountBase.toString(),
      }),
    );
    showPendingOperation(operation, "broadcast");
    return operation;
  };

  const eventMatchesOperation = (
    event: unknown,
    operation: Pick<
      PendingBurnOperation,
      "phase" | "player" | "transactionAmountBase"
    >,
  ): boolean => {
    if (!event) return false;
    const playerSlot = operation.phase === "deposit" ? 0 : 1;
    const amountSlot = operation.phase === "deposit" ? 1 : 2;
    return (
      eventPlayerMatches(eventValue(event, playerSlot), operation.player) &&
      parseBigInt(eventValue(event, amountSlot)).toString() ===
        operation.transactionAmountBase
    );
  };

  /** A tx event is only a clue; confirm its resulting canonical contract state. */
  const operationReadbackMatches = async (
    operation: Pick<
      PendingBurnOperation,
      "phase" | "player" | "transactionAmountBase"
    >,
    event: unknown,
  ): Promise<boolean> => {
    try {
      if (operation.phase === "deposit") {
        const credit = parseBigInt(
          await app.chain.readRaw("creditOf", [
            app.chain.arg.hash160(operation.player),
          ]),
        );
        return credit >= BigInt(operation.transactionAmountBase);
      }

      const eventSeason = parseBigInt(eventValue(event, 0));
      const eventUserTotal = parseBigInt(eventValue(event, 3));
      if (eventSeason <= 0n || eventUserTotal <= 0n) return false;
      const [liveSeasonRaw, liveUserTotalRaw] = await Promise.all([
        app.chain.readRaw("currentSeason", []),
        app.chain.readRaw("userBurned", [
          app.chain.arg.hash160(operation.player),
        ]),
      ]);
      const liveSeason = parseBigInt(liveSeasonRaw);
      const liveUserTotal = parseBigInt(liveUserTotalRaw);
      return liveSeason === eventSeason && liveUserTotal >= eventUserTotal;
    } catch {
      return false;
    }
  };

  const markUnknown = (operation: PendingBurnOperation): BurnSubmitResult => {
    showPendingOperation(operation, "unknown");
    actionNotice.set(
      t(operation.phase === "deposit" ? "burnDepositUnknown" : "burnTransactionUnknown"),
    );
    return {
      amount: Number(operation.amount),
      status: "unknown",
      txid: operation.txid,
      phase: operation.phase,
    };
  };

  /**
   * Reconcile a persisted deposit/burn using the EXACT broadcast transaction.
   * A matching event must also carry the expected player and transaction amount;
   * a same-player event from a different retry can never clear this operation.
   */
  const recheckPendingBurn = async (): Promise<BurnRecoveryResult> => {
    const scope = await resolveOperationScope();
    if (!scope) {
      return { status: "none", operation: null };
    }
    const operation = operationStore.get(scope);
    if (!operation) {
      if (hasUnknownBurn.get()) {
        pendingBurnTxid.set("");
        pendingBurnPhase.set("");
        burnTransactionState.set("idle");
      }
      return { status: "none", operation: null };
    }

    showPendingOperation(operation, "broadcast");
    const eventName = operation.phase === "deposit" ? "Credited" : "Burned";
    try {
      const events = await app.events.listAll(eventName, { cap: 300 });
      const exact = findBurnEventByExactTransaction(events, operation.txid);
      if (
        !exact ||
        !eventMatchesOperation(exact, operation) ||
        !(await operationReadbackMatches(operation, exact))
      ) {
        showPendingOperation(operation, "unknown");
        actionNotice.set(
          t(operation.phase === "deposit" ? "burnDepositUnknown" : "burnTransactionUnknown"),
        );
        return { status: "pending", operation };
      }

      clearPendingOperation(
        scope,
        operation.phase === "burn" ? "confirmed" : "idle",
      );
      if (operation.phase === "deposit") {
        actionNotice.set(t("burnDepositReady"));
        await loadAll();
        return { status: "deposit-confirmed", operation };
      }

      burnAmount.set("1");
      lastSubmittedAmount.set(
        `${formatNumber(Number(operation.amount), 2)} ${t("tokenGas")}`,
      );
      actionNotice.set(t("burnSubmitted"));
      await loadAll();
      return { status: "burn-confirmed", operation };
    } catch (error) {
      showPendingOperation(operation, "unknown");
      actionNotice.set(t("burnRecoveryUnavailable"));
      console.warn("[useBurnLeague] pending burn recovery failed:", errorMessage(error));
      return { status: "pending", operation };
    }
  };

  /** Restore a refresh-surviving operation without ever replaying a burn. */
  const restorePendingBurn = recheckPendingBurn;

  // ── Actions (direct chain invocations) ──────────────────────────────

  /**
   * Burn GAS into the current season pool (deposit-then-act).
   *
   * Two signed steps, both by the player:
   *   1. DEPOSIT — only when creditOf(player) < amount, transfer the amount in
   *      GAS to the contract with the "miniapp-burnleague:burn" memo so
   *      OnNEP17Payment credits the player's prepaid burn balance. The amount is
   *      already in BASE UNITS here (scaled once, no floats).
   *   2. burn(player, amountBaseUnits) — moves the amount from prepaid credit
   *      into the pool, lazily starting a season if none is active, and adds to
   *      the player's season total. The new total is read from the Burned event.
   *
   * If step 1 lands but step 2 reverts, the credit persists on the contract as
   * reusable prepaid credit (reclaimable via withdraw) — no funds are lost. A
   * burn on an already-ended season faults with "season ended; settle first"; we
   * surface the settle requirement rather than letting it fault opaquely.
   *
   * @returns the validated human burn amount on success.
   */
  const burnTokens = async (burnAmountInput?: string): Promise<BurnSubmitResult> => {
    // Double-submit guard before any await.
    if (isBurning.get()) throw new Error(t("burnBusy"));
    if (hasUnknownBurn.get()) throw new Error(t("burnPendingBlocksNew"));

    const amountStr = burnAmountInput ?? burnAmount.get();
    const validation = validateBurnAmount(amountStr);
    if (validation) {
      burnValidationError.set(validation);
      throw new Error(validation);
    }
    burnValidationError.set(null);

    const amount = parseBurnAmount(amountStr);
    const amountBase = toBaseUnits(amountStr);
    if (amountBase < MIN_BURN_BASE || amountBase > MAX_BURN_BASE) {
      // Report the bound actually violated — an over-max amount previously threw
      // the "minimum burn" message.
      const msg =
        amountBase > MAX_BURN_BASE
          ? t("maxBurn", { amount: MAX_BURN, tokenGas: t("tokenGas") })
          : t("minBurn", { amount: MIN_BURN, tokenGas: t("tokenGas") });
      burnValidationError.set(msg);
      throw new Error(msg);
    }

    // Block a burn on a season that has already ended — it must be settled first.
    if (seasonPhase.get() === "ended") {
      const msg = t("settleBeforeBurn");
      actionNotice.set(msg);
      throw new Error(msg);
    }

    // A financial action NEVER opens the wallet and then spends in the same
    // gesture. main.tsx exposes connectWallet as a separate primary action.
    const playerAddr = resolveAddress();
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) {
      const msg = t("burnWalletUnavailable");
      actionNotice.set(msg);
      throw new Error(msg);
    }
    setAddress(playerAddr);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) {
      const msg = t("missingContract");
      actionNotice.set(msg);
      throw new Error(msg);
    }
    if (!leagueDataAvailable.get()) {
      const msg = serviceNotice.get() || t("burnServiceUnavailable");
      actionNotice.set(msg);
      throw new Error(msg);
    }

    const scope = await resolveOperationScope(playerHash, contractHash);
    if (!scope) {
      const msg = t("burnRecoveryUnavailable");
      actionNotice.set(msg);
      throw new Error(msg);
    }
    const restoredOperation = operationStore.get(scope);
    if (restoredOperation) {
      showPendingOperation(restoredOperation, "unknown");
      const msg = t("burnPendingBlocksNew");
      actionNotice.set(msg);
      throw new Error(msg);
    }

    actionNotice.set(t("burnPreparing", {
      amount: `${formatNumber(amount, 2)} ${t("tokenGas")}`,
    }));
    isBurning.set(true);
    let burnLanded = false;
    let confirmedBurnTxid = "";
    let depositSettled = false;
    try {
      // Step 1: DEPOSIT — only top up when existing burn credit can't cover the
      // amount (credit may persist from a prior aborted burn). The contract
      // scales nothing; the amount is already in BASE UNITS here.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await app.chain.readRaw("creditOf", [app.chain.arg.hash160(playerHash)]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < amountBase) {
        const shortfall = amountBase - credit;
        let walletBalance: bigint;
        try {
          walletBalance = await app.wallet.raw("GAS", playerAddr);
        } catch {
          throw new Error(t("burnBalanceUnavailable"));
        }
        if (walletBalance < shortfall) {
          throw new Error(
            t("burnInsufficientBalance", {
              required: formatNumber(fromBaseUnits(shortfall), 8),
              available: formatNumber(fromBaseUnits(walletBalance), 8),
              tokenGas: t("tokenGas"),
            }),
          );
        }

        // Deposit only the SHORTFALL beyond any prepaid credit left from a prior
        // aborted burn, and wait for the contract's "Credited" event so the
        // deposit is confirmed in a block before burn() consumes it — an
        // unconfirmed deposit lets burn() execute first and fault (the shared
        // invokeWithDirectPrepaidGas path confirms the deposit for the same
        // reason: intra-block ordering is fee/hash-based).
        const operationInput = {
          ...scope,
          phase: "deposit" as const,
          player: scope.player,
          transactionAmountBase: shortfall.toString(),
        };
        let depositResult;
        try {
          depositResult = await app.chain.invoke(
            "transfer",
            [
              app.chain.arg.hash160(playerHash),
              app.chain.arg.hash160(contractHash),
              app.chain.arg.integer(shortfall),
              app.chain.arg.string(BURN_MEMO),
            ],
            {
              scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
              waitForEvent: "Credited",
              onTransactionSent: (txid) => {
                persistOperation(scope, "deposit", txid, amountStr, amountBase, shortfall);
              },
            },
          );
        } catch (depositError) {
          const pending = operationStore.get(scope);
          if (pending?.phase === "deposit") return markUnknown(pending);
          throw depositError;
        }
        const deposited =
          operationStore.get(scope) ??
          persistOperation(
            scope,
            "deposit",
            depositResult.txid,
            amountStr,
            amountBase,
            shortfall,
          );
        if (!deposited && (depositResult.success === false || !depositResult.txid)) {
          throw new Error(t("burnActionUnavailable"));
        }
        if (
          depositResult.verified !== true ||
          !eventMatchesOperation(depositResult.event, operationInput) ||
          !(await operationReadbackMatches(operationInput, depositResult.event))
        ) {
          if (deposited) return markUnknown(deposited);
          burnTransactionState.set("unknown");
          actionNotice.set(t("burnDepositUnknown"));
          return {
            amount,
            status: "unknown",
            txid: depositResult.txid,
            phase: "deposit",
          };
        }
        clearPendingOperation(scope, "idle");
        depositSettled = true;
      }

      // Step 2: burn — moves the amount from prepaid credit into the pool. If the
      // deposit landed but this reverts, the credit persists as reusable prepaid
      // credit (reclaimable via withdraw); surface that distinctly.
      try {
        const burnResult = await app.chain.invoke(
          "burn",
          [
            app.chain.arg.hash160(playerHash),
            app.chain.arg.integer(amountBase),
          ],
          {
            waitForEvent: "Burned",
            onTransactionSent: (txid) => {
              persistOperation(scope, "burn", txid, amountStr, amountBase, amountBase);
            },
          },
        );
        const pending =
          operationStore.get(scope) ??
          persistOperation(
            scope,
            "burn",
            burnResult.txid,
            amountStr,
            amountBase,
            amountBase,
          );
        if (!pending && (burnResult.success === false || !burnResult.txid)) {
          throw new Error(t("burnActionUnavailable"));
        }
        const expectedBurn = {
          ...scope,
          phase: "burn" as const,
          player: scope.player,
          transactionAmountBase: amountBase.toString(),
        };
        if (
          burnResult.verified !== true ||
          !eventMatchesOperation(burnResult.event, expectedBurn) ||
          !(await operationReadbackMatches(expectedBurn, burnResult.event))
        ) {
          if (pending) return markUnknown(pending);
          burnTransactionState.set("unknown");
          actionNotice.set(t("burnTransactionUnknown"));
          return {
            amount,
            status: "unknown",
            txid: burnResult.txid,
            phase: "burn",
          };
        }
        clearPendingOperation(scope, "confirmed");
        confirmedBurnTxid = burnResult.txid;
        burnLanded = true;
      } catch (burnErr) {
        const pending = operationStore.get(scope);
        if (pending?.phase === "burn") return markUnknown(pending);
        const raw = errorMessage(burnErr);
        if (/settle first|season ended/i.test(raw)) {
          throw new Error(t("settleBeforeBurn"));
        }
        if (depositSettled) {
          throw new Error(t("burnDepositHeld"));
        }
        throw new Error(raw || t("burnActionUnavailable"));
      }

      burnAmount.set("1");
      lastSubmittedAmount.set(`${formatNumber(amount, 2)} ${t("tokenGas")}`);
      actionNotice.set(t("burnSubmitted"));

      return {
        amount,
        status: "confirmed",
        txid: confirmedBurnTxid,
        phase: "burn",
      };
    } catch (error) {
      const pending = operationStore.get(scope);
      if (pending) return markUnknown(pending);
      burnTransactionState.set("failed");
      const raw = errorMessage(error);
      if (depositSettled) {
        actionNotice.set(t("burnDepositHeld"));
        // Preserve the actionable settle instruction in the toast while the
        // persistent in-arena notice explains that the deposit is safe credit.
        if (raw === t("settleBeforeBurn") || /settle first|season ended/i.test(raw)) {
          throw new Error(t("settleBeforeBurn"));
        }
        throw new Error(t("burnDepositHeld"));
      }
      actionNotice.set(raw || t("burnActionUnavailable"));
      throw error;
    } finally {
      isBurning.set(false);
      // Refresh once the burn has actually landed so the UI reflects the new
      // pool / season total / leaderboard rather than stale pre-burn data.
      if (burnLanded) {
        await loadAll().catch((refreshErr) => {
          console.warn("[useBurnLeague] post-burn refresh failed:", errorMessage(refreshErr));
        });
      }
    }
  };

  /**
   * Settle the current season against the standalone contract.
   *
   * settle() is PERMISSIONLESS: once the season deadline has passed it pays the
   * WHOLE pool to the recorded top burner's claimable credit (NOT the caller) and advances the
   * season. Anyone may trigger it; the winner is credited regardless
   * of who signs. The UI surfaces this through the needsSettle affordance once the
   * season has ended.
   */
  const settleSeason = async (): Promise<BurnAuxiliarySubmitResult> => {
    if (isSettling.get()) throw new Error(t("burnBusy"));

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    // Connection is an explicit separate action; settle cannot connect-and-sign.
    const callerAddr = resolveAddress();
    const callerHash = addressToScriptHash(callerAddr || "");
    if (!callerAddr || !callerHash) throw new Error(t("burnWalletUnavailable"));
    setAddress(callerAddr);

    isSettling.set(true);
    // Snapshot the leader + pool that are about to be settled — loadAll() rolls
    // the season forward and zeroes both, so the celebration must read them now.
    const settlingSeasonId = seasonId.get();
    let broadcastTxid = "";
    try {
      const result = await app.chain.invoke("settle", [], {
        waitForEvent: "SeasonSettled",
        onTransactionSent: (txid) => {
          broadcastTxid = txid;
        },
      });
      broadcastTxid ||= result.txid;
      if (result.success === false || !broadcastTxid) {
        throw new Error(t("settleActionUnavailable"));
      }
      const settledId = Number(parseBigInt(eventValue(result.event, 0)));
      const settledWinner = eventValue(result.event, 1);
      const settledPoolBase = parseBigInt(eventValue(result.event, 2));
      if (
        result.verified !== true ||
        !result.event ||
        (settlingSeasonId > 0 && settledId !== settlingSeasonId) ||
        settledPoolBase <= 0n ||
        isZeroAddress(String(settledWinner ?? ""))
      ) {
        actionNotice.set(t("settleTransactionUnknown"));
        await loadAll().catch((refreshError) => {
          console.warn("[useBurnLeague] post-settle reconciliation failed:", errorMessage(refreshError));
        });
        return { status: "unknown", txid: broadcastTxid };
      }
      lastSettleResult.set({
        // Derive both winner and amount from the verified event, not from a
        // potentially stale pre-submit UI snapshot.
        won: eventPlayerMatches(settledWinner, callerHash),
        amount: `${formatNumber(fromBaseUnits(settledPoolBase), 2)} ${t("tokenGas")}`,
        token: Date.now(),
      });
      await loadAll();
      return { status: "confirmed", txid: broadcastTxid };
    } catch (error) {
      if (broadcastTxid) {
        actionNotice.set(t("settleTransactionUnknown"));
        await loadAll().catch((refreshError) => {
          console.warn("[useBurnLeague] failed-settle reconciliation failed:", errorMessage(refreshError));
        });
        return { status: "unknown", txid: broadcastTxid };
      }
      throw error;
    } finally {
      isSettling.set(false);
    }
  };

  /**
   * Withdraw the connected wallet's claimable credit via withdraw(account).
   * Credit includes unused deposits and settled winnings; the contract pays the
   * WHOLE balance back to the wallet. Returns the withdrawn amount in human GAS (from the
   * "CreditWithdrawn" event, state[1] = amount).
   */
  const withdrawCredit = async (): Promise<{
    amount: number;
    status: "confirmed" | "unknown";
    txid: string;
  }> => {
    if (isLoading.get() || isBurning.get() || isSettling.get() || hasUnknownBurn.get()) {
      throw new Error(t("burnBusy"));
    }

    const accountAddr = resolveAddress();
    const accountHash = addressToScriptHash(accountAddr || "");
    if (!accountAddr || !accountHash) throw new Error(t("burnWalletUnavailable"));
    setAddress(accountAddr);

    isLoading.set(true);
    let broadcastTxid = "";
    try {
      // Read the live credit first — the contract reverts "no credit" on an empty
      // balance, so surface a clean message before prompting the wallet.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await app.chain.readRaw("creditOf", [app.chain.arg.hash160(accountHash)]),
        );
      } catch {
        credit = 0n;
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      const result = await app.chain.invoke(
        "withdraw",
        [app.chain.arg.hash160(accountHash)],
        {
          waitForEvent: "CreditWithdrawn",
          onTransactionSent: (txid) => {
            broadcastTxid = txid;
          },
        },
      );
      broadcastTxid ||= result.txid;
      if (result.success === false || !broadcastTxid) {
        throw new Error(t("withdrawActionUnavailable"));
      }

      const amountBase = parseBigInt(eventValue(result.event, 1));

      if (
        result.verified !== true ||
        !result.event ||
        !eventPlayerMatches(eventValue(result.event, 0), accountHash) ||
        amountBase <= 0n ||
        amountBase !== credit
      ) {
        actionNotice.set(t("withdrawTransactionUnknown"));
        await loadAll().catch((refreshError) => {
          console.warn("[useBurnLeague] post-withdraw reconciliation failed:", errorMessage(refreshError));
        });
        return { amount: 0, status: "unknown", txid: broadcastTxid };
      }

      // OnCreditWithdrawn(account, amount) — amount is state index 1.
      const amount = fromFixed8(amountBase);

      await loadAll();
      return { amount, status: "confirmed", txid: broadcastTxid };
    } catch (error) {
      if (broadcastTxid) {
        actionNotice.set(t("withdrawTransactionUnknown"));
        await loadAll().catch((refreshError) => {
          console.warn("[useBurnLeague] failed-withdraw reconciliation failed:", errorMessage(refreshError));
        });
        return { amount: 0, status: "unknown", txid: broadcastTxid };
      }
      throw error;
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    totalBurned,
    rewardPool,
    userBurned,
    rank,
    burnCount,
    leaderboard,
    isBurning,
    isSettling,
    isLoading,
    leagueDataAvailable,
    serviceNotice,
    actionNotice,
    burnValidationError,
    lastSubmittedAmount,
    prepaidCredit,
    hasCredit,
    burnTransactionState,
    pendingBurnTxid,
    pendingBurnPhase,
    hasUnknownBurn,
    address,

    // ── Season lifecycle ────────────────────────────────────────────
    seasonId,
    seasonEndMs,
    seasonDurationMs,
    seasonDurationLabel,
    topBurnerAddress,
    topBurnedGas,
    seasonPhase,
    isSeasonActive,
    needsSettle,
    countdown,
    timeRemainingSeconds,
    seasonStatusLabel,
    formattedSeason,
    updateNow,

    // ── Local UI state ──────────────────────────────────────────────
    burnAmount,
    minBurnGas,
    maxBurnGas,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    totalBurnedDisplay,
    userBurnedDisplay,
    rewardPoolDisplay,
    formattedRank,
    leaderboardSize,
    projectedTotalBurnedDisplay,

    // ── Derived values (for PlayArea presentation) ──────────────────
    prizePoolDisplay,
    topBurnedDisplay,
    leaderLabel,
    leaderboardPreview,
    prepaidCreditDisplay,
    userIsLeader,
    lastSettleResult,

    // ── Actions ─────────────────────────────────────────────────────
    setAddress,
    burnTokens,
    settleSeason,
    withdrawCredit,
    loadAll,
    validateBurnAmount,
    recheckPendingBurn,
    restorePendingBurn,
  };
}

/** Return type of useBurnLeague for use in typing */
export type UseBurnLeagueReturn = ReturnType<typeof useBurnLeague>;

// ============================================================================
// Pure Helpers (exported for PlayArea presentation)
// ============================================================================

/** Format a number for display with 2 decimal places */
export { formatNum } from "@shared/utils/format";
