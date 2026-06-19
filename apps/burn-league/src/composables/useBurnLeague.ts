/**
 * useBurnLeague — Domain logic for the Burn League miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppBurnLeague)
 * via ctx.services.chain. The earlier path routed burns through the OS
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
 *   READS (chain.read, default app contract script hash; all GAS in BASE UNITS):
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
 *   EVENTS (chain.listEvents):
 *     Burned(seasonId, player, amount, userSeasonTotal) — the lag-free
 *       leaderboard source. state slots: [0]=seasonId, [1]=player(address),
 *       [2]=amount(base units), [3]=userSeasonTotal(base units). The board is the
 *       LATEST userSeasonTotal per player for the CURRENT season, ranked desc.
 *
 *   MUTATIONS (chain.invoke):
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
 *     settle() — PERMISSIONLESS. After the deadline pays the WHOLE pool to the top
 *        burner and advances the season. Anyone may trigger it; the on-chain top
 *        burner is the winner regardless of who signs.
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
import type { ChainService } from "@shared/services/ChainService";
import { gasToBaseUnits as toBaseUnits } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { formatNumber, fromFixed8 } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

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

/** Memo the contract requires on the burn-funding transfer (appId + ":burn"). */
const BURN_MEMO = "miniapp-burnleague:burn";

/** How many recent Burned events to page in when rebuilding the leaderboard. */
const BURNED_EVENTS_LIMIT = 200;

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
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Accessor for the connected wallet address (e.g. ctx.services.chain.address.get).
   * Used to resolve the current user's leaderboard rank and identity. Optional so
   * the composable degrades gracefully when no wallet is connected.
   */
  getAddress?: () => string | null | undefined;
}

/** Case-insensitive address equality (handles base58 and hex script-hash forms). */
function addressMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b || a.toLowerCase() === b.toLowerCase();
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

export function useBurnLeague({ chain, t, getAddress }: UseBurnLeagueOptions) {
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
  /**
   * Outcome of the most recent successful settle, captured at settle time from
   * the leader/pool that existed BEFORE the season rolled forward. Drives the
   * win/payout celebration. `won` is true only when the connected wallet was the
   * recorded top burner who is paid the pool; `amount` is the pool that was
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
    (getAddress?.() ?? chain.address.get()) ?? null;
  const address = createObservable<string | null>(resolveAddress());

  const setAddress = (addr: string | null) => {
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
  const totalBurnedDisplay = createDerived(() => `${formatNumber(totalBurned.get(), 2)} ${t("tokenGas")}`, []);
  const userBurnedDisplay = createDerived(() => `${formatNumber(userBurned.get(), 2)} ${t("tokenGas")}`, []);
  const rewardPoolDisplay = createDerived(() => `${formatNumber(rewardPool.get(), 2)} ${t("tokenGas")}`, []);
  const formattedRank = createDerived(() => rank.get() > 0 ? `#${rank.get()}` : "--", []);
  const leaderboardSize = createDerived(() => leaderboard.get().length, []);

  /**
   * The prize for the current season — the WHOLE reward pool, paid to the top
   * burner at settle. This replaces the bogus 0.1x estimate: the prize is the
   * pool, not a fraction of the player's own burn.
   */
  const prizePoolDisplay = createDerived(() => `${formatNumber(rewardPool.get(), 2)} ${t("tokenGas")}`, []);

  /** The current leader's burned total, formatted for display. */
  const topBurnedDisplay = createDerived(() => `${formatNumber(topBurnedGas.get(), 2)} ${t("tokenGas")}`, []);

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
    const top = (topBurnerAddress.get() ?? "").trim().toLowerCase();
    const me = (address.get() ?? "").trim().toLowerCase();
    return top !== "" && me !== "" && top === me;
  }, [topBurnerAddress, address]);

  const projectedTotalBurnedDisplay = createDerived(() => {
    const amount = parseFloat(burnAmount.get());
    const projected = userBurned.get() + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    return `${formatNumber(projected, 2)} ${t("tokenGas")}`;
  }, []);

  /** Top 10 entries for the leaderboard preview. */
  const leaderboardPreview = createDerived(() => leaderboard.get().slice(0, 10), []);

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Read the authoritative season state from the contract: id, deadline, pool,
   * counts, the connected player's season total, and the current leader. All
   * amounts are scaled from base units to whole GAS for display.
   */
  const loadStats = async (): Promise<boolean> => {
    try {
      const [
        seasonRaw,
        endRaw,
        poolRaw,
        countRaw,
        topBurnerRaw,
        topBurnedRaw,
        durationRaw,
        minBurnRaw,
        maxBurnRaw,
      ] = await Promise.all([
        chain.read("currentSeason", []),
        chain.read("seasonEnd", []),
        chain.read("rewardPool", []),
        chain.read("burnCount", []),
        chain.read("topBurner", []),
        chain.read("topBurned", []),
        chain.read("seasonDuration", []),
        chain.read("minBurn", []),
        chain.read("maxBurn", []),
      ]);

      seasonId.set(Number(parseBigInt(seasonRaw)));
      seasonEndMs.set(Number(parseBigInt(endRaw)));
      // Disclose the season length so a first burner knows how long the round
      // they open will run (live mainnet value is currently 120s).
      seasonDurationMs.set(Number(parseBigInt(durationRaw)));

      // Bind the burn bounds to the live contract values (base units → whole
      // GAS), keeping the literals when a read returns a non-positive value.
      const minGas = fromBaseUnits(parseBigInt(minBurnRaw));
      const maxGas = fromBaseUnits(parseBigInt(maxBurnRaw));
      if (minGas > 0) minBurnGas.set(minGas);
      if (maxGas > 0) maxBurnGas.set(maxGas);

      const poolGas = fromBaseUnits(parseBigInt(poolRaw));
      // TotalBurned() == RewardPool() on the contract — both are the season pool.
      totalBurned.set(poolGas);
      rewardPool.set(poolGas);
      burnCount.set(Number(parseBigInt(countRaw)));

      const topAddr = String(topBurnerRaw ?? "").trim();
      topBurnerAddress.set(isZeroAddress(topAddr) ? "" : topAddr);
      topBurnedGas.set(fromBaseUnits(parseBigInt(topBurnedRaw)));

      // The connected player's CURRENT-season total via userBurned(player) and
      // their unused prepaid burn-credit via creditOf(player) (the withdraw
      // affordance stays honest after every action).
      const myAddr = resolveAddress();
      const myHash = myAddr ? addressToScriptHash(myAddr) || null : null;
      if (myHash) {
        try {
          const userRaw = await chain.read("userBurned", [
            { type: "Hash160", value: myHash },
          ]);
          userBurned.set(fromBaseUnits(parseBigInt(userRaw)));
        } catch (e) {
          console.warn("[useBurnLeague] userBurned read failed:", errorMessage(e));
          userBurned.set(0);
        }
        try {
          const creditRaw = await chain.read("creditOf", [
            { type: "Hash160", value: myHash },
          ]);
          prepaidCredit.set(fromFixed8(parseBigInt(creditRaw)));
        } catch (e) {
          console.warn("[useBurnLeague] creditOf read failed:", errorMessage(e));
        }
      } else {
        userBurned.set(0);
        prepaidCredit.set(0);
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

      const events = await chain.listEvents("Burned", { limit: BURNED_EVENTS_LIMIT });

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
          isUser: addressMatches(entry.player, myAddress),
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
  const burnTokens = async (burnAmountInput?: string) => {
    // Double-submit guard before any await.
    if (isBurning.get()) return;

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

    const playerAddr = resolveAddress() || (await chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) {
      const msg = t("burnWalletUnavailable");
      actionNotice.set(msg);
      throw new Error(msg);
    }
    setAddress(playerAddr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) {
      const msg = t("missingContract");
      actionNotice.set(msg);
      throw new Error(msg);
    }

    actionNotice.set(t("burnPreparing", {
      amount: `${formatNumber(amount, 2)} ${t("tokenGas")}`,
    }));
    isBurning.set(true);
    let burnLanded = false;
    let depositSettled = false;
    try {
      // Step 1: DEPOSIT — only top up when existing burn credit can't cover the
      // amount (credit may persist from a prior aborted burn). The contract
      // scales nothing; the amount is already in BASE UNITS here.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("creditOf", [{ type: "Hash160", value: playerHash }]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < amountBase) {
        // Deposit only the SHORTFALL beyond any prepaid credit left from a prior
        // aborted burn, and wait for the contract's "Credited" event so the
        // deposit is confirmed in a block before burn() consumes it — an
        // unconfirmed deposit lets burn() execute first and fault (the shared
        // invokeWithDirectPrepaidGas path confirms the deposit for the same
        // reason: intra-block ordering is fee/hash-based).
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: playerHash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: (amountBase - credit).toString() },
            { type: "String", value: BURN_MEMO },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "Credited" },
        );
        depositSettled = true;
      }

      // Step 2: burn — moves the amount from prepaid credit into the pool. If the
      // deposit landed but this reverts, the credit persists as reusable prepaid
      // credit (reclaimable via withdraw); surface that distinctly.
      try {
        await chain.invoke(
          "burn",
          [
            { type: "Hash160", value: playerHash },
            { type: "Integer", value: amountBase.toString() },
          ],
          { waitForEvent: "Burned" },
        );
        burnLanded = true;
      } catch (burnErr) {
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

      return amount;
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
   * WHOLE pool to the recorded top burner (NOT the caller) and advances the
   * season. Anyone may trigger it; the winner is paid by the contract regardless
   * of who signs. The UI surfaces this through the needsSettle affordance once the
   * season has ended.
   */
  const settleSeason = async () => {
    if (isSettling.get()) return;

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    // The signer just triggers the settle; ensure a wallet is available to sign.
    const callerAddr = resolveAddress() || (await chain.ensureWallet());
    if (!callerAddr) throw new Error(t("burnWalletUnavailable"));
    setAddress(callerAddr);

    isSettling.set(true);
    // Snapshot the leader + pool that are about to be settled — loadAll() rolls
    // the season forward and zeroes both, so the celebration must read them now.
    const awardedPool = prizePoolDisplay.get();
    const winnerWasMe = userIsLeader.get();
    try {
      await chain.invoke("settle", [], { waitForEvent: "SeasonSettled" });
      lastSettleResult.set({
        won: winnerWasMe,
        amount: awardedPool,
        token: Date.now(),
      });
      await loadAll();
    } finally {
      isSettling.set(false);
    }
  };

  /**
   * Withdraw the connected wallet's unused prepaid burn-credit via
   * withdraw(account). The contract pays the WHOLE credit back to the wallet —
   * the recovery path when a deposit landed but burn() never completed (the
   * burnDepositHeld case). Returns the withdrawn amount in human GAS (from the
   * "CreditWithdrawn" event, state[1] = amount).
   */
  const withdrawCredit = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) return { amount: 0 };

    const accountAddr = resolveAddress() || (await chain.ensureWallet());
    const accountHash = addressToScriptHash(accountAddr || "");
    if (!accountAddr || !accountHash) throw new Error(t("burnWalletUnavailable"));
    setAddress(accountAddr);

    isLoading.set(true);
    try {
      // Read the live credit first — the contract reverts "no credit" on an empty
      // balance, so surface a clean message before prompting the wallet.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("creditOf", [{ type: "Hash160", value: accountHash }]),
        );
      } catch {
        credit = 0n;
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      const result = await chain.invoke(
        "withdraw",
        [{ type: "Hash160", value: accountHash }],
        { waitForEvent: "CreditWithdrawn" },
      );

      // OnCreditWithdrawn(account, amount) — amount is state index 1.
      const amountBase = parseBigInt(eventValue(result.event, 1));
      const amount = amountBase > 0n ? fromFixed8(amountBase) : fromFixed8(credit);

      await loadAll();
      return { amount };
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
  };
}

/** Return type of useBurnLeague for use in typing */
export type UseBurnLeagueReturn = ReturnType<typeof useBurnLeague>;

// ============================================================================
// Pure Helpers (exported for PlayArea presentation)
// ============================================================================

/** Format a number for display with 2 decimal places */
export const formatNum = (n: number): string => formatNumber(n, 2);

/** Get medal icon name for top-3 leaderboard ranks */
export const getMedalIcon = (rank: number): string => {
  if (rank === 1) return "medal_gold";
  if (rank === 2) return "medal_silver";
  if (rank === 3) return "medal_bronze";
  return "";
};
