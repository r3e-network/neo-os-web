import { createObservable, defineMiniApp } from "@shared/react";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { ORACLE_CONTRACT_TESTNET, TESTNET_MAGIC } from "@shared/constants";
import { eventStateValue } from "@shared/utils/chain-events";
import { asNumber } from "@framework/game";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  canReleaseAfterGrace,
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  SETTLE_GRACE_MS,
  ruleOf,
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
import {
  eventHashMatches as addrEq,
  mapField,
  type RewardGameConfig,
  type RewardGameSession,
} from "@framework/gamefi";
import {
  calculateHitResult,
  evaluateHitResults,
  parseTargetPattern,
  type HitResult,
} from "./logic/aim-engine";
import { createGuestEngine } from "./logic/guest-engine";
import {
  AIM_MASTER_TESTNET_CHECKSUM,
  AIM_MASTER_TESTNET_CONTRACT,
  attestAimMasterContract,
} from "./aim-master-rpc";

const appId = "miniapp-aim-master";
// Operator-whitelisted engine pin (sha-256 of the reviewed aim engine wrapper).
const ENGINE_HASH = "701118ccc91941f1e36d8e71bdee6dc2f357ab42acd48fc754664915d570ca34";
export { AIM_MASTER_TESTNET_CHECKSUM, AIM_MASTER_TESTNET_CONTRACT };

/**
 * New paid starts stay fail-closed until a funded pool and one complete
 * start -> TEE replay -> settlement -> withdrawal run are proven on testnet.
 * Historical active games remain recoverable through the dormant path below.
 */
export const NEW_PAID_RUNS_ENABLED = false;

const OPS_STORAGE_PREFIX = "miniapp-aim-master:ops:";

// Aim Master Solved: gameId(0), player(1), difficulty(2), elapsedMs(3),
// score(4), payout(5), totalWon(6).
const SOLVED_SLOTS = {
  gameId: 0,
  player: 1,
  difficulty: 2,
  elapsedMs: 3,
  solvedPayout: 5,
  totalWon: 6,
  undos: 7,
};

type TeeOp = { type: "aim"; position: number } | { type: "undo" };

const rewardGameConfig: RewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id: rule.difficulty,
    key: rule.key,
    entryFixed8: rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs: rule.limitMs,
    minSolveMs: rule.minSolveMs,
    target: rule.targetAccuracy,
  })),
  eventSlots: { solvedPayout: 5 },
  progression: { enabled: true },
};

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const obs = ctx.framework.game.session.observables(ctx.t);

    // Game-specific observables not covered by the shared session surface.
    const pattern = createObservable("");
    const ringsHit = createObservable(0);
    const roundIndex = createObservable(0);
    const roundResults = createObservable<HitResult[]>([]);
    const scorePoints = createObservable(0);
    const combo = createObservable(0);
    const maxCombo = createObservable(0);
    const targetAccuracy = createObservable(3);
    const selectedDifficulty = createObservable(0);
    // Mirror app.mode into the play-area state so PhaserPlayArea + scene copy can
    // branch GAS-centric labels into local/practice framing in guest mode.
    const mode = createObservable(app.mode.get());

    // Enclave session context for the active game.
    let session: RewardGameSession | null = null;

    // RFC P0-5: identity-diff account hook — fires only when the normalized
    // address actually changes (handler errors are isolated by the framework).
    // The previous-identity guard keeps the original "first connect is not a
    // change" semantics.
    const stopWalletSync = app.wallet.onAccountChanged(({ previous }) => {
      if (!previous || app.mode.isGuest()) return;
      session = null;
      if (
        obs.activeGameId.get() !== "0"
        && ["committed", "dealt", "unknown"].includes(obs.gameStatus.get())
      ) {
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("statusWalletChanged"));
        ctx.setStatus(ctx.t("statusWalletChanged"), "warning");
      }
    });

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local target engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      pattern,
      targetAccuracy,
      ringsHit,
      roundIndex,
      roundResults,
      scorePoints,
      combo,
      maxCombo,
      guestLeaderboard: app.mode.guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the surfaced mode in sync, and on switching to guest reset to a clean
    // local lobby + load the off-chain guest board (replacing the mount read).
    const stopModeSync = app.mode.onChange((next) => {
      mode.set(next);
      if (next === "guest") {
        session = null;
        void guest.enter();
      }
    });

    // Reward-game plumbing (session open/start/finalize/expire/withdraw + the
    // per-game op-log store) via the framework SDK. The storage prefix pins
    // the pre-migration localStorage keys so in-flight op-logs survive.
    const rewardGame = ctx.framework.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    // The wrapper methods delegate verbatim to the @framework/gamefi
    // startRewardGame / finalizeRewardGame orchestration; keep the canonical
    // SDK verbs at the entry/settlement call sites.
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    const applyRunEvaluation = (values: unknown): void => {
      const evaluated = evaluateHitResults(values);
      roundResults.set(evaluated.results);
      ringsHit.set(evaluated.summary.accuracyHits);
      roundIndex.set(evaluated.summary.totalShots);
      scorePoints.set(evaluated.summary.score);
      combo.set(evaluated.summary.combo);
      maxCombo.set(evaluated.summary.maxCombo);
    };

    /** Rehydrate the visible run from the append-only op log after reload. */
    const restoreRunFromStoredOps = (gameId: string): number => {
      const shots = rewardGame.storage
        .load(gameId)
        .filter((op): op is Extract<TeeOp, { type: "aim" }> => (
          op?.type === "aim" && Number.isFinite(op.position)
        ))
        .map((op) => calculateHitResult(op.position));
      applyRunEvaluation(shots);
      return shots.length;
    };

    const refreshBalances = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(ctx.framework.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch {
        /* keep the previous values — reads are best-effort */
      }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await ctx.framework.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    /**
     * Rebuild the global ranking from Solved events.
     */
    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await ctx.framework.game.leaderboard.load("Solved", SOLVED_SLOTS, 200);
      obs.leaderboard.set(ranked);
      const me = ranked.find(e => e.isUser);
      obs.myRank.set(me?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    // RFC P0-6: typed read lane — `asBigInt()` keeps the parseBigInt-to-0n
    // decode semantics; read errors still propagate to the caller.
    const readActiveGameId = async (playerHash: string): Promise<string> => String(
      await app.chain.query("activeGameOf", [app.chain.arg.hash160(playerHash)]).asBigInt(),
    );
    const readGame = (gameId: string): Promise<unknown> =>
      app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
    const contractBindingIsExact = (): boolean =>
      String(app.chain.contractAddress.get() ?? "").trim().toLowerCase()
        === AIM_MASTER_TESTNET_CONTRACT;
    const contractAttestationIsExact = async (): Promise<boolean> => {
      if (!contractBindingIsExact()) return false;
      const result = await attestAimMasterContract(
        String(app.chain.contractAddress.get() ?? ""),
      );
      return result.compatible;
    };
    const contractRuntimeReadiness = async (
      startDifficulty?: number,
    ): Promise<"ready" | "pool" | "paused" | "mismatch"> => {
      try {
        const [config, oracle, networkMagic, paused, freePool] = await Promise.all([
          app.chain.readRaw("getConfig"),
          app.chain.readRaw("oracle"),
          app.chain.readRaw("networkMagic"),
          app.chain.readRaw("isPaused"),
          app.chain.readRaw("freePool"),
        ]);
        const rulesMatch = DIFFICULTY_RULES.every((rule) => {
          const suffix = String(rule.difficulty);
          return parseBigInt(mapField(config, `entry${suffix}`)) === rule.entryFixed8
            && parseBigInt(mapField(config, `reward${suffix}`)) === rule.rewardFixed8
            && asNumber(mapField(config, `limitMs${suffix}`)) === rule.limitMs
            && asNumber(mapField(config, `minSolveMs${suffix}`)) === rule.minSolveMs
            && asNumber(mapField(config, `targetAccuracy${suffix}`)) === rule.targetAccuracy;
        });
        const bindingMatches = rulesMatch
          && asNumber(mapField(config, "maxUndos")) === 3
          && asNumber(mapField(config, "undoPenaltyPct")) === 30
          && asNumber(mapField(config, "settleGraceMs")) === SETTLE_GRACE_MS
          && addrEq(oracle, ORACLE_CONTRACT_TESTNET)
          && asNumber(networkMagic) === TESTNET_MAGIC;
        if (!bindingMatches) return "mismatch";
        if (parseBool(paused)) return "paused";
        if (
          startDifficulty !== undefined
          && parseBigInt(freePool) < ruleOf(startDifficulty).rewardFixed8
        ) return "pool";
        return "ready";
      } catch {
        return "mismatch";
      }
    };
    const durableOpsStorageAvailable = (): boolean => {
      const key = `${OPS_STORAGE_PREFIX}probe:${Date.now()}:${Math.floor(performance.now())}`;
      const token = `aim-${Date.now()}`;
      try {
        app.storage.local.set(key, token);
        return app.storage.local.get<string>(key, "") === token;
      } catch {
        return false;
      } finally {
        try { app.storage.local.delete(key); } catch { /* best effort probe cleanup */ }
      }
    };
    const gameMatchesIdentity = (
      game: unknown,
      gameId: string,
      playerHash: string,
      difficulty?: number,
    ): boolean => String(parseBigInt(mapField(game, "id")) ?? "0") === gameId
      && Boolean(playerHash)
      && addrEq(mapField(game, "player"), playerHash)
      && (difficulty === undefined || asNumber(mapField(game, "difficulty")) === difficulty);

    const sessionMatchesRule = (opened: RewardGameSession, difficulty: number): boolean => {
      const rule = ruleOf(difficulty);
      return opened.identity.appId === appId
        && opened.identity.engineHash.replace(/^0x/i, "").toLowerCase() === ENGINE_HASH
        && opened.identity.network === "testnet"
        && opened.identity.contractHash.toLowerCase() === AIM_MASTER_TESTNET_CONTRACT
        && opened.identity.difficulty === difficulty
        && opened.config.limitMs === rule.limitMs
        && opened.config.minSolveMs === rule.minSolveMs
        && opened.config.maxUndos === 3
        && opened.config.target === rule.targetAccuracy;
    };

    const verifyPlayingSession = async (
      opened: RewardGameSession,
      gameId: string,
      difficulty: number,
    ): Promise<unknown> => {
      const playerHash = app.game.player.scriptHash();
      const game = await readGame(gameId);
      if (
        !contractBindingIsExact()
        || !sessionMatchesRule(opened, difficulty)
        || opened.identity.gameId !== gameId
        || !gameMatchesIdentity(game, gameId, playerHash, difficulty)
        || asNumber(mapField(game, "status")) !== 1
      ) throw new Error(ctx.t("statusSessionMismatch"));
      return game;
    };

    const startResultMatchesIntent = async (
      started: Awaited<ReturnType<typeof startRewardGame>>,
      difficulty: number,
    ): Promise<boolean> => {
      const event = started.tx.event;
      const eventMatches = event != null
        && String(parseBigInt(eventStateValue(event, 0)) ?? "0") === started.gameId
        && addrEq(eventStateValue(event, 1), started.playerHash)
        && asNumber(eventStateValue(event, 2)) === difficulty;
      if (eventMatches) return true;
      const active = await readActiveGameId(started.playerHash);
      if (active !== started.gameId) return false;
      const game = await readGame(started.gameId);
      const rawStatus = asNumber(mapField(game, "status"));
      return gameMatchesIdentity(game, started.gameId, started.playerHash, difficulty)
        && (rawStatus === 0 || rawStatus === 1);
    };

    /**
     * Open the confidential enclave session for an already-active on-chain game:
     * the enclave generates the seeded target oscillation and returns the pattern
     * view + commitment. No on-chain effect.
     */
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(started, gameId, difficulty);
        const patternValue = String(started.view.pattern ?? "");
        if (parseTargetPattern(patternValue).length === 0) {
          throw new Error(ctx.t("statusPatternInvalid"));
        }
        session = started;
        pattern.set(patternValue);
        obs.commitment.set(started.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        restoreRunFromStoredOps(gameId);
        obs.gameStatus.set("dealt");
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(message, "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    /** Reattach to an active game after a reload. */
    const resumeSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(started, gameId, difficulty);
        const patternValue = String(started.view.pattern ?? "");
        if (parseTargetPattern(patternValue).length === 0) {
          throw new Error(ctx.t("statusPatternInvalid"));
        }
        if (obs.commitment.get() && started.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        const storedOps = rewardGame.storage.load(gameId);
        await rewardGame.replayOps(started, storedOps);
        session = started;
        pattern.set(patternValue);
        obs.commitment.set(started.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        restoreRunFromStoredOps(gameId);
        return true;
      } catch {
        session = null;
        obs.lastStatus.set(ctx.t("statusDealPending"));
        return false;
      }
    };

    /** Stream a single aim op to the enclave, recording it into the op-log. */
    const streamAim = async (position: number): Promise<void> => {
      if (!session) return;
      const op: TeeOp = { type: "aim", position };
      await rewardGame.recordOp(session, op);
    };

    ctx.framework.actions.register("selectDifficulty", (...args: unknown[]) => {
      const status = obs.gameStatus.get();
      if (!["idle", "solved", "expired", "refunded"].includes(status)) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const value = Number(form.difficulty);
      const difficulty = Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
      selectedDifficulty.set(difficulty);
    });

    ctx.framework.actions.register("aimHit", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        ringsHit?: unknown;
        totalRings?: unknown;
        roundResults?: unknown;
        totalPoints?: unknown;
      };
      if (app.mode.isGuest()) { guest.aimHit(form); return; }
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get()) return;
      if (!session) throw new Error(ctx.t("statusDealPending"));
      const evaluated = evaluateHitResults(form.roundResults);
      const previous = evaluateHitResults(roundResults.get());
      if (evaluated.results.length !== previous.results.length + 1) return;
      const prefixMatches = previous.results.every(
        (result, index) => result.offset === evaluated.results[index]?.offset,
      );
      if (!prefixMatches) return;

      const storedCount = rewardGame.storage
        .load(session.identity.gameId)
        .filter((op) => op?.type === "aim").length;
      if (storedCount !== previous.results.length) {
        restoreRunFromStoredOps(session.identity.gameId);
        obs.lastStatus.set(ctx.t("statusRunRecovered"));
        ctx.setStatus(ctx.t("statusRunRecovered"), "warning");
        throw new Error(ctx.t("statusRunRecovered"));
      }

      const latest = evaluated.results.at(-1);
      const offset = latest?.offset ?? 0;
      const position = Math.max(
        0,
        Math.min(300, Math.round(150 + (Number.isFinite(offset) ? offset : 0))),
      );
      try {
        // The visible shot is acknowledged only after the TEE step and local
        // op-log append succeed. A failed step must never become UI authority.
        await streamAim(position);
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusShotSyncFailed"));
        obs.lastStatus.set(ctx.t("statusShotSyncFailed"));
        ctx.setStatus(message, "error");
        throw error;
      }
      applyRunEvaluation(evaluated.results);
    });

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      if (app.mode.isGuest()) { guest.startGame(Number(form.difficulty ?? 0)); return; }
      if (!NEW_PAID_RUNS_ENABLED) {
        ctx.setStatus(ctx.t("gameFiMaintenanceShort"), "info");
        return;
      }
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || obs.activeGameId.get() !== "0"
        || !["idle", "solved", "expired", "refunded"].includes(obs.gameStatus.get())
      ) return;
      const rawDifficulty = Number(form.difficulty ?? selectedDifficulty.get());
      const difficulty = Math.max(
        0,
        Math.min(2, Number.isFinite(rawDifficulty) ? Math.round(rawDifficulty) : 0),
      );
      if (!contractBindingIsExact()) {
        ctx.setStatus(ctx.t("statusContractMismatch"), "error");
        return;
      }
      if (!await contractAttestationIsExact()) {
        ctx.setStatus(ctx.t("statusContractAttestationFailed"), "error");
        return;
      }
      const runtimeReadiness = await contractRuntimeReadiness(difficulty);
      if (runtimeReadiness !== "ready") {
        ctx.setStatus(
          runtimeReadiness === "pool"
            ? ctx.t("statusPoolLow")
            : runtimeReadiness === "paused"
              ? ctx.t("statusContractPaused")
              : ctx.t("statusContractAttestationFailed"),
          runtimeReadiness === "pool" || runtimeReadiness === "paused" ? "info" : "error",
        );
        return;
      }
      if (!durableOpsStorageAvailable()) {
        ctx.setStatus(ctx.t("statusStorageUnavailable"), "error");
        return;
      }
      const rule = ruleOf(difficulty);
      selectedDifficulty.set(difficulty);
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      let submittedGameId = "0";
      let submittedTx: Awaited<ReturnType<typeof startRewardGame>>["tx"] | undefined;
      try {
        const started = await startRewardGame(difficulty);
        const gameId = started.gameId;
        submittedGameId = gameId;
        submittedTx = started.tx;
        if (!await startResultMatchesIntent(started, difficulty)) {
          throw new Error(ctx.t("statusStartPending"));
        }
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        targetAccuracy.set(rule.targetAccuracy);
        ringsHit.set(0);
        roundIndex.set(0);
        roundResults.set([]);
        scorePoints.set(0);
        combo.set(0);
        maxCombo.set(0);
        pattern.set("");
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        // A wallet/network exception is not proof that no start landed. Recover
        // the exact active game when readable, or freeze a returned game id as
        // unknown so the player cannot pay for a duplicate entry.
        try {
          const playerHash = app.game.player.scriptHash();
          const active = playerHash ? await readActiveGameId(playerHash) : "0";
          const recoverableId = active !== "0" ? active : submittedGameId;
          if (recoverableId !== "0") {
            obs.activeGameId.set(recoverableId);
            obs.gameDifficulty.set(difficulty);
            targetAccuracy.set(rule.targetAccuracy);
            obs.gameStatus.set("unknown");
            obs.lastStatus.set(ctx.t("statusStartPending"));
            if (active !== "0") await refreshActiveGame();
            ctx.setStatus(ctx.t("statusStartPending"), "info");
            return submittedTx;
          }
        } catch {
          if (submittedGameId !== "0") {
            obs.activeGameId.set(submittedGameId);
            obs.gameDifficulty.set(difficulty);
            targetAccuracy.set(rule.targetAccuracy);
            obs.gameStatus.set("unknown");
            obs.lastStatus.set(ctx.t("statusStartPending"));
            ctx.setStatus(ctx.t("statusStartPending"), "info");
            return submittedTx;
          }
        }
        const message =
          error instanceof Error && "code" in error && error.code === "POOL_LOW"
            ? ctx.t("statusPoolLow")
            : error instanceof Error
              ? error.message
              : ctx.t("statusFailed");
        obs.lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    ctx.framework.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    ctx.framework.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      if (
        !await contractAttestationIsExact()
        || await contractRuntimeReadiness() === "mismatch"
      ) {
        ctx.setStatus(ctx.t("statusContractAttestationFailed"), "error");
        return;
      }
      const now = Date.now();
      const rule = ruleOf(obs.gameDifficulty.get());
      const timedOut = obs.deadline.get() > 0 && now >= obs.deadline.get();
      const targetReached = ringsHit.get() >= targetAccuracy.get();
      const minSolveReached = obs.dealtAt.get() > 0 && now >= obs.dealtAt.get() + rule.minSolveMs;
      if (!timedOut && (!targetReached || !minSolveReached)) return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) {
          await resumeSession(gameId, obs.gameDifficulty.get());
        }
        if (!session) throw new Error(ctx.t("statusFailed"));
        // The accuracy hits are re-derived by the kernel from the sealed aim
        // op-log (engine.replay); the client no longer signs a ring count.
        const finalized = await finalizeRewardGame(session);
        const settled = finalized.settlement;
        if (settled.status === "unknown") {
          // A broadcast finalize without an observed callback is not a loss and
          // not a completed game. Keep the active id + op log for exact refresh.
          session = null;
          obs.gameStatus.set("unknown");
          obs.lastPayout.set("");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }
        obs.lastPayout.set(`${settled.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(settled.elapsedMs);
        obs.gameStatus.set(settled.status);
        obs.activeGameId.set("0");
        session = null;
        if (settled.payoutGas > 0) {
          obs.lastStatus.set(ctx.t("statusSolved", { payout: settled.payoutGas.toFixed(2) }));
          ctx.setStatus(obs.lastStatus.get(), "success");
        } else {
          obs.lastStatus.set(ctx.t("statusExpired"));
          ctx.setStatus(ctx.t("statusExpired"), "info");
        }
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return finalized.tx;
      } catch (error) {
        // We cannot prove whether a wallet-broadcast finalize reached the
        // network from an exception alone. Freeze into a recoverable pending
        // state instead of reopening input and risking a duplicate settlement.
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("statusSettlementPending"));
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    const refreshActiveGame = async (allowResume = true): Promise<void> => {
      if (app.mode.isGuest()) return;
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      const snapshot = await rewardGame.snapshot(gameId);
      if (!gameMatchesIdentity(snapshot.raw, gameId, app.game.player.scriptHash())) {
        throw new Error(ctx.t("statusSessionMismatch"));
      }
      ctx.framework.game.session.applySnapshot(obs, snapshot.raw, statusOf);
      if (["solved", "expired", "refunded"].includes(snapshot.status)) {
        rewardGame.storage.forget(gameId);
        obs.activeGameId.set("0");
        session = null;
        obs.lastPayout.set(`${snapshot.payoutGas.toFixed(2)} GAS`);
        obs.lastElapsedMs.set(snapshot.solveMs);
        obs.lastStatus.set(
          snapshot.payoutGas > 0
            ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) })
            : ctx.t("statusExpired"),
        );
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        return;
      }
      if (snapshot.status === "dealt" && allowResume) {
        if (await resumeSession(gameId, snapshot.difficulty)) {
          obs.lastStatus.set(ctx.t("statusDealt"));
        }
        return;
      }
      if (snapshot.status === "committed" && allowResume) {
        obs.gameStatus.set("committed");
        void openSession(gameId, snapshot.difficulty);
        return;
      }
      session = null;
      obs.gameStatus.set("unknown");
      obs.lastStatus.set(ctx.t("statusSettlementPending"));
    };

    ctx.framework.actions.register("refreshGame", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      try {
        await refreshActiveGame();
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    ctx.framework.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      if (
        !await contractAttestationIsExact()
        || await contractRuntimeReadiness() === "mismatch"
      ) {
        ctx.setStatus(ctx.t("statusContractAttestationFailed"), "error");
        return;
      }
      if (!canReleaseAfterGrace(obs.deadline.get())) {
        ctx.setStatus(ctx.t("releaseNotReady"), "info");
        return;
      }
      try {
        await rewardGame.expire(gameId);
        session = null;
        // The invoke may be broadcast before the read endpoint sees it. Re-read
        // instead of claiming the reservation was released.
        await refreshActiveGame(false);
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("statusFailed"));
        ctx.setStatus(message, "error");
        throw error;
      }
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      if (
        !await contractAttestationIsExact()
        || await contractRuntimeReadiness() === "mismatch"
      ) {
        ctx.setStatus(ctx.t("statusContractAttestationFailed"), "error");
        return;
      }
      const playerHash = ctx.framework.game.player.scriptHash();
      if (!playerHash) {
        ctx.setStatus(ctx.t("statusFailed"), "error");
        return;
      }
      if (obs.credit.get() <= 0) {
        ctx.setStatus(ctx.t("noCreditToWithdraw"), "info");
        return;
      }
      await ctx.framework.notify.guard(async () => {
        // Re-read the exact fixed8 credit immediately before signing; the
        // rounded observable may be stale or shared with another tab.
        const before = await rewardGame.balances(playerHash);
        if (before.creditFixed8 <= 0n) throw new Error(ctx.t("noCreditToWithdraw"));
        const result = await rewardGame.withdrawCredit(before.creditFixed8);
        if (result.skipped) throw new Error(ctx.t("noCreditToWithdraw"));
        const exactEvent = result.tx.event != null
          && addrEq(eventStateValue(result.tx.event, 0), playerHash)
          && parseBigInt(eventStateValue(result.tx.event, 1)) === before.creditFixed8;
        const after = await rewardGame.balances(playerHash);
        obs.poolFree.set(after.poolFreeGas);
        obs.credit.set(after.creditGas);
        // Never show a success toast from a wallet response alone. The exact
        // event or a zero-credit readback must prove the withdrawal landed.
        if (!exactEvent && after.creditFixed8 !== 0n) {
          throw new Error(ctx.t("withdrawPending"));
        }
      }, { successKey: "creditWithdrawn" });
    });

    ctx.framework.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    return {
      // Keep the canonical pattern aliases adjacent: cross-game adoption guards
      // verify this bridge contract textually as well as at runtime.
      state: { ...obs, pattern, patternData: pattern,
        targetAccuracy,
        ringsHit,
        roundIndex,
        roundResults,
        scorePoints,
        combo,
        maxCombo,
        selectedDifficulty,
        mode,
      },
      loadData: async () => {
        // Guest is a purely local game: skip every chain read on mount and load
        // the off-chain guest board instead. (Guarded loaders below also early
        // return, but this keeps guest mount entirely chain-free.)
        if (app.mode.isGuest()) { await guest.enter(); return; }
        if (!contractBindingIsExact()) {
          obs.lastStatus.set(ctx.t("statusContractMismatch"));
          return;
        }
        if (!await contractAttestationIsExact()) {
          obs.lastStatus.set(ctx.t("statusContractAttestationFailed"));
          return;
        }
        if (await contractRuntimeReadiness() === "mismatch") {
          obs.lastStatus.set(ctx.t("statusContractAttestationFailed"));
          return;
        }
        await refreshBalances();
        const playerHash = ctx.framework.game.player.scriptHash();
        if (playerHash) {
          try {
            const active = await readActiveGameId(playerHash);
            if (active !== "0") {
              obs.activeGameId.set(active);
              const game = await readGame(active);
              if (!gameMatchesIdentity(game, active, playerHash)) {
                throw new Error(ctx.t("statusSessionMismatch"));
              }
              ctx.framework.game.session.applySnapshot(obs, game, statusOf);
              if (obs.gameStatus.get() === "dealt") {
                await resumeSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "committed") {
                void openSession(active, obs.gameDifficulty.get());
              } else if (obs.gameStatus.get() === "unknown") {
                session = null;
                obs.lastStatus.set(ctx.t("statusSettlementPending"));
              }
            }
          } catch (error) {
            // A failed read is not proof that no game exists. Keep any known id
            // frozen and surface an explicit recovery state instead of inviting
            // a duplicate paid start.
            session = null;
            if (obs.activeGameId.get() !== "0") obs.gameStatus.set("unknown");
            obs.lastStatus.set(ctx.t("statusRecoveryUnavailable"));
            ctx.setStatus(
              app.errors.messageOf(error, ctx.t("statusRecoveryUnavailable")),
              "warning",
            );
          }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") {
          obs.lastStatus.set(ctx.t("statusReady"));
        }
      },
      cleanup: () => {
        stopWalletSync();
        stopModeSync();
      },
    };
  },
});

export { gasDisplay };
