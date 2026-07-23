/**
 * Sudoku Arena — miniapp entry point (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`.  The setup function now expresses only the
 * game-specific logic: puzzle session management, move recording, and solution
 * submission.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import type { RewardGameSession } from "@framework/gamefi";
import { eventHashMatches as addrEq, mapField } from "@framework/gamefi";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  GAMEFI_NEW_ENTRIES_ENABLED,
  SETTLEMENT_GRACE_MS,
  canExpireAfterGrace,
  statusOf,
  gasDisplay,
} from "./logic/game-rules";
import {
  applyUndo,
  configureBoardStorage,
  forgetBoard,
  persistBoard,
  replayBoardOps,
  restoreBoard,
} from "./logic/board-store";
import type { BoardOp } from "./logic/board-store";
import { createGuestEngine } from "./logic/guest-engine";
import { conflictsAt } from "./logic/sudoku-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-sudoku";
const ENGINE_HASH = "679aea4220667dec0e921eb364392f7983dae440a3aa9e43a215a4d054ab58c8";
const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-sudoku:ops:";

type TeeOp = BoardOp;

function sessionStatusOf(raw: number): GameSessionStatus {
  return statusOf(raw);
}

function cleanHex(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/^0x/, "");
}

function validatedClues(value: unknown): string | null {
  const clues = String(value ?? "");
  if (!/^[0-9]{81}$/.test(clues)) return null;
  const entries = [...clues].map((digit) => Number(digit));
  const givenCount = entries.filter((digit) => digit > 0).length;
  if (givenCount < 17) return null;
  for (let cell = 0; cell < entries.length; cell += 1) {
    const digit = entries[cell] ?? 0;
    if (digit > 0 && conflictsAt(entries, cell, digit).length > 0) {
      return null;
    }
  }
  return clues;
}

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo:  ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id:           rule.difficulty,
    key:          rule.key,
    entryFixed8:  rule.entryFixed8,
    rewardFixed8: rule.rewardFixed8,
    limitMs:      rule.limitMs,
    minSolveMs:   rule.minSolveMs,
  })),
  progression: { enabled: true },
};

// Slot layout for the Sudoku Solved event:
// gameId(0) player(1) difficulty(2) elapsedMs(3) undos(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  undos: 7, solvedPayout: 5, totalWon: 6,
};

export type { LeaderEntry, SolveRow };

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,
  // Pin the app.storage.local prefix so board-store's "board:<gameId>" key
  // resolves to the legacy "miniapp-sudoku:board:<gameId>" localStorage key
  // byte-for-byte — in-progress puzzles saved before the migration survive.
  storagePrefix: "miniapp-sudoku:",

  setup(ctx) {
    const app = ctx.framework;

    // Wire the pure board-store module to the framework local-storage surface
    // (app.storage.local); with the storagePrefix above the board keys stay
    // byte-identical to the pre-migration localStorage keys.
    configureBoardStorage(app.storage.local);

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard game session observables (replaces ~20 createObservable lines)
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    // Sudoku-specific extras (not in the base session factory)
    const clues             = createObservable("");
    const walletConnected   = createObservable(app.wallet.isConnected());
    const isConnectingWallet = createObservable(false);
    const isActing          = createObservable(false);
    const isRecovering      = createObservable(false);
    const inputSyncFailed   = createObservable(false);
    const rollbackNonce     = createObservable(0);
    const undoNonce         = createObservable(0);
    const boardRecoveryNonce = createObservable(0);
    const settlementGraceMs = createObservable(SETTLEMENT_GRACE_MS);
    const isPaused          = createObservable(false);
    const hintsUsed         = createObservable(0);
    const hintCell          = createObservable(-1);
    const hintDigit         = createObservable(0);
    const hintNonce         = createObservable(0);

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Mirror the launcher-selected mode into an observable the PlayArea reads, so
    // guest can drop the GAS-at-stake / pool / reward framing while the GAMEFI
    // copy stays exactly as-is.
    const appMode = createObservable<string>(app.mode.get());

    // Enclave session handle — rebuilt idempotently from the deterministic
    // session start; nothing needs durable storage.
    let session: RewardGameSession | null = null;

    // RFC P0-5: identity-diff account hook (fires only when the normalized
    // address actually changes; handler errors are isolated by the framework).
    const stopWalletSync = app.wallet.onAccountChanged(() => {
      const connected = app.wallet.isConnected();
      walletConnected.set(app.mode.isGuest() ? true : connected);
      if (!connected && !app.mode.isGuest()) {
        session = null;
        if (obs.activeGameId.get() !== "0" && obs.gameStatus.get() === "dealt") {
          inputSyncFailed.set(true);
          obs.lastStatus.set(ctx.t("statusInputSyncFailed"));
        }
      }
    });

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local Sudoku engine — no chain/oracle/reward calls.
    const guest = createGuestEngine({
      obs,
      clues,
      walletConnected,
      isPaused,
      hintsUsed,
      hintCell,
      hintDigit,
      hintNonce,
      storage: app.storage.local,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the mode observable in sync; switching to guest at the launcher resets
    // to a clean local lobby and loads the off-chain guest board (replacing the
    // on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") {
        session = null;
        inputSyncFailed.set(false);
        void guest.enter();
      }
    });

    // ── Derived convenience refs ──────────────────────────────────────────────
    const setStatus = (msg: string, type: "success" | "error" | "info" | "warning" = "info") => {
      obs.lastStatus.set(msg);
      ctx.setStatus(msg, type);
    };

    // ── Data refresh helpers ──────────────────────────────────────────────────
    const refreshBalances = async () => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* keep previous values — best-effort */ }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const refreshProgression = async () => {
      if (app.mode.isGuest()) return;
      try {
        const progression = await rewardGame.progression(2);
        obs.progressionRequiredDifficulty.set(progression.requiredDifficulty);
        obs.progressionMaxDifficulty.set(progression.maxDifficulty);
        obs.progressionHardChallengeLevel.set(progression.hardChallengeLevel);
        obs.progressionEffectiveLimitMs.set(progression.effectiveLimitMs ?? 0);
        if (obs.gameDifficulty.get() < progression.requiredDifficulty) {
          obs.gameDifficulty.set(progression.requiredDifficulty);
        }
        obs.progressionReady.set(true);
      } catch {
        obs.progressionReady.set(false);
      }
    };

    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await app.game.leaderboard.load<SolveRow>(
        "Solved", SOLVED_SLOTS, LEADERBOARD_EVENT_LIMIT,
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      const me = ranked.find((e) => e.isUser);
      obs.myRank.set(me?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    const refreshGameConfig = async () => {
      if (app.mode.isGuest()) return;
      try {
        const config = await app.chain.readRaw("getConfig", []);
        const grace = asNumber(mapField(config, "settleGraceMs"));
        settlementGraceMs.set(grace > 0 ? grace : SETTLEMENT_GRACE_MS);
      } catch {
        settlementGraceMs.set(SETTLEMENT_GRACE_MS);
      }
    };

    // ── Snapshot / session helpers ────────────────────────────────────────────
    const applySnapshot = (game: unknown) => {
      app.game.session.applySnapshot(obs, game, sessionStatusOf);
    };

    const readActiveGameId = async (playerHash: string): Promise<string> => String(
      parseBigInt(
        await app.chain.readRaw("activeGameOf", [app.chain.arg.hash160(playerHash)]),
      ) ?? "0",
    );

    const readGame = (gameId: string): Promise<unknown> =>
      app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);

    const gameMatchesIdentity = (
      game: unknown,
      gameId: string,
      playerHash: string,
      difficulty?: number,
    ): boolean => {
      const idMatches = String(parseBigInt(mapField(game, "id")) ?? "0") === gameId;
      const playerMatches = Boolean(playerHash) && addrEq(mapField(game, "player"), playerHash);
      const difficultyMatches = difficulty === undefined ||
        asNumber(mapField(game, "difficulty")) === difficulty;
      return idMatches && playerMatches && difficultyMatches;
    };

    const verifyPlayingSession = async (
      opened: RewardGameSession,
      gameId: string,
      difficulty: number,
    ): Promise<unknown> => {
      const playerHash = app.game.player.scriptHash();
      const game = await readGame(gameId);
      if (
        !gameMatchesIdentity(game, gameId, playerHash, difficulty) ||
        asNumber(mapField(game, "status")) !== 1 ||
        cleanHex(mapField(game, "commitment")) !== cleanHex(opened.commitment)
      ) {
        throw new Error(ctx.t("statusSessionMismatch"));
      }
      return game;
    };

    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(started, gameId, difficulty);
        const sealedClues = validatedClues(started.view.clues);
        if (!sealedClues) throw new Error(ctx.t("statusInvalidBoard"));
        session = started;
        clues.set(sealedClues);
        obs.commitment.set(started.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        inputSyncFailed.set(false);
        setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        obs.lastStatus.set(ctx.t("statusDealPending"));
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      try {
        const started = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(started, gameId, difficulty);
        const sealedClues = validatedClues(started.view.clues);
        if (!sealedClues) throw new Error(ctx.t("statusInvalidBoard"));
        if (
          obs.commitment.get() &&
          cleanHex(started.commitment) !== cleanHex(obs.commitment.get())
        ) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        const ops = rewardGame.storage.load(gameId);
        const recoveredBoard = replayBoardOps(sealedClues, ops);
        if (!recoveredBoard) throw new Error(ctx.t("statusInvalidBoard"));
        const localBoard = restoreBoard(gameId, sealedClues);
        recoveredBoard.notes = recoveredBoard.notes.map((_, cell) =>
          recoveredBoard.entries[cell] === 0 ? (localBoard.notes[cell] ?? 0) : 0,
        );
        await rewardGame.replayOps(started, ops);
        persistBoard(gameId, recoveredBoard);
        session = started;
        clues.set(sealedClues);
        obs.commitment.set(started.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.undosUsed.set(ops.filter((op) => op.type === "undo").length);
        obs.gameStatus.set("dealt");
        inputSyncFailed.set(false);
        boardRecoveryNonce.set(boardRecoveryNonce.get() + 1);
        return true;
      } catch {
        session = null;
        inputSyncFailed.set(true);
        obs.lastStatus.set(ctx.t("statusDealPending"));
        return false;
      }
    };

    const sendOp = async (op: TeeOp) => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      await rewardGame.recordOp(session, op);
    };

    const finishFromSnapshot = async (
      gameId: string,
      snapshot: Awaited<ReturnType<typeof rewardGame.snapshot>>,
      announce = true,
    ): Promise<void> => {
      const rewarded = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;
      const nextStatus = snapshot.status === "solved" && !rewarded
        ? "expired"
        : snapshot.status;
      obs.gameDifficulty.set(snapshot.difficulty);
      obs.commitment.set(snapshot.commitment);
      obs.dealtAt.set(snapshot.dealtAt);
      obs.deadline.set(snapshot.deadline);
      obs.undosUsed.set(asNumber(mapField(snapshot.raw, "undos")));
      obs.lastElapsedMs.set(snapshot.solveMs);
      obs.lastPayout.set(`${snapshot.payoutGas.toFixed(2)} GAS`);
      obs.gameStatus.set(nextStatus as GameSessionStatus);
      obs.lastStatus.set(
        rewarded
          ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) })
          : ctx.t("statusExpired"),
      );
      obs.activeGameId.set("0");
      forgetBoard(gameId);
      rewardGame.storage.forget(gameId);
      session = null;
      inputSyncFailed.set(false);
      if (announce) {
        setStatus(
          rewarded
            ? ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) })
            : ctx.t("statusExpired"),
          rewarded ? "success" : "info",
        );
      }
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard(), refreshProgression()]);
    };

    const recoverCurrentGame = async (
      preferredGameId?: string,
      announce = true,
    ): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      const playerHash = app.game.player.scriptHash();
      if (!playerHash) return false;
      isRecovering.set(true);
      try {
        let gameId = preferredGameId && preferredGameId !== "0"
          ? preferredGameId
          : obs.activeGameId.get();
        if (!gameId || gameId === "0") gameId = await readActiveGameId(playerHash);
        if (!gameId || gameId === "0") return false;

        const snapshot = await rewardGame.snapshot(gameId);
        if (!gameMatchesIdentity(snapshot.raw, gameId, playerHash)) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        obs.activeGameId.set(gameId);
        applySnapshot(snapshot.raw);
        const nextStatus = sessionStatusOf(asNumber(mapField(snapshot.raw, "status")));
        if (nextStatus === "committed" || nextStatus === "dealt") {
          return resumeSession(gameId, snapshot.difficulty);
        }
        if (nextStatus === "unknown") {
          session = null;
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          if (announce) ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return true;
        }
        await finishFromSnapshot(gameId, snapshot, announce);
        return true;
      } catch (error) {
        if (announce) {
          setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        }
        return false;
      } finally {
        isRecovering.set(false);
      }
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get()) return;
      isConnectingWallet.set(true);
      try {
        await app.wallet.ensure();
        walletConnected.set(app.wallet.isConnected());
        await Promise.all([
          refreshBalances(),
          refreshStats(),
          loadLeaderboard(),
          refreshProgression(),
          refreshGameConfig(),
        ]);
        await recoverCurrentGame(undefined, false);
        ctx.setStatus(ctx.t("walletConnected"), "success");
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isConnectingWallet.set(false);
      }
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.startGame(args[0]); return; }
      if (!GAMEFI_NEW_ENTRIES_ENABLED) {
        ctx.setStatus(ctx.t("gameFiMaintenanceBody"), "info");
        return;
      }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      if (obs.progressionReady.get() && difficulty < obs.progressionRequiredDifficulty.get()) return;
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      let startedGameId = "0";
      try {
        const started = await startRewardGame(difficulty);
        startedGameId = started.gameId;
        const gameId  = started.gameId;
        const playerHash = app.game.player.scriptHash();
        const active = await readActiveGameId(playerHash);
        const game = await readGame(gameId);
        if (
          active !== gameId ||
          !gameMatchesIdentity(game, gameId, playerHash, difficulty) ||
          asNumber(mapField(game, "status")) !== 1
        ) {
          throw new Error(ctx.t("statusStartPending"));
        }
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        clues.set("");
        obs.commitment.set("");
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        await openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const recovered = await recoverCurrentGame(startedGameId, false);
        if (recovered) {
          ctx.setStatus(ctx.t("statusRecovered"), "info");
          return;
        }
        const msg = app.errors.is(error, "POOL_LOW")
          ? ctx.t("statusPoolLow")
          : app.errors.messageOf(error, ctx.t("statusFailed"));
        setStatus(msg, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.selectDifficulty(args[0]); return; }
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      if (obs.progressionReady.get() && difficulty < obs.progressionRequiredDifficulty.get()) return;
      obs.gameDifficulty.set(difficulty);
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordMove", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.recordMove(args[0]); return; }
      const form = (args[0] ?? {}) as { cell?: unknown; digit?: unknown };
      const cell  = Number(form.cell);
      const digit = Number(form.digit);
      if (
        inputSyncFailed.get() ||
        isActing.get() ||
        obs.gameStatus.get() !== "dealt" ||
        !session ||
        !Number.isInteger(cell) ||
        cell < 0 ||
        cell >= 81 ||
        !Number.isInteger(digit) ||
        digit < 1 ||
        digit > 9
      ) return;
      isActing.set(true);
      try {
        await sendOp({ type: "place", cell, digit });
        inputSyncFailed.set(false);
      } catch (error) {
        // The canvas places optimistically for immediate feedback. Ask it to
        // roll that exact move back if the sealed operation log rejects it,
        // then freeze further paid input until authoritative recovery.
        const activeGameId = obs.activeGameId.get();
        if (activeGameId !== "0") {
          const rolledBack = applyUndo(restoreBoard(activeGameId, clues.get()));
          if (rolledBack.reverted !== null) persistBoard(activeGameId, rolledBack.board);
        }
        rollbackNonce.set(rollbackNonce.get() + 1);
        inputSyncFailed.set(true);
        setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isActing.set(false);
      }
    });

    app.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      const gameId = obs.activeGameId.get();
      if (
        inputSyncFailed.get() || gameId === "0" || obs.isUndoing.get() ||
        obs.gameStatus.get() !== "dealt"
      ) return;
      obs.isUndoing.set(true);
      try {
        await sendOp({ type: "undo" });
        const board = applyUndo(restoreBoard(gameId, clues.get()));
        if (board.reverted === null) throw new Error(ctx.t("statusInvalidBoard"));
        persistBoard(gameId, board.board);
        const undos = obs.undosUsed.get() + 1;
        obs.undosUsed.set(undos);
        undoNonce.set(undoNonce.get() + 1);
        setStatus(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }), "info");
      } catch (error) {
        inputSyncFailed.set(true);
        setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        obs.isUndoing.set(false);
      }
    });

    app.actions.register("requestHint", async (...args: unknown[]) => {
      if (app.mode.isGuest()) guest.requestHint(args[0]);
    });

    app.actions.register("togglePause", async () => {
      if (app.mode.isGuest()) guest.togglePause();
    });

    app.actions.register("restartGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) guest.restartGame(args[0]);
    });

    app.actions.register("submitSolution", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { await guest.submitSolution(args[0]); return; }
      const form     = (args[0] ?? {}) as { solution?: unknown };
      const solution = String(form.solution ?? "");
      const gameId   = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      if (inputSyncFailed.get()) {
        ctx.setStatus(ctx.t("statusInputSyncFailed"), "error");
        return;
      }
      if (!/^[1-9]{81}$/.test(solution)) {
        ctx.setStatus(ctx.t("statusBoardIncomplete"), "error");
        throw new Error(ctx.t("statusBoardIncomplete"));
      }
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        session = null;
        if (finalized.settlement.status === "unknown") {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }
        const snapshot = await rewardGame.snapshot(gameId);
        if (
          snapshot.status === "unknown" ||
          snapshot.status === "committed" ||
          snapshot.status === "dealt"
        ) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }
        await finishFromSnapshot(gameId, snapshot);
        return finalized.tx;
      } catch (error) {
        // Finalization may have broadcast before a timeout reached the UI.
        // Preserve the exact game id and board until authoritative readback.
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("statusSettlementPending"));
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("recoverGame", async () => {
      if (app.mode.isGuest()) return;
      await recoverCurrentGame(undefined, true);
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || isRecovering.get()) return;
      if (!canExpireAfterGrace(obs.deadline.get(), Date.now(), settlementGraceMs.get())) {
        ctx.setStatus(ctx.t("releaseNotReady"), "info");
        return;
      }
      isRecovering.set(true);
      try {
        await app.chain.invoke("expireGame", [app.chain.arg.integer(gameId)]);
        const snapshot = await app.chain.waitForState(
          () => rewardGame.snapshot(gameId),
          (next) => next.status === "expired" || next.status === "refunded",
          { attempts: 4, firstDelayMs: 2_500, delayMs: 4_000 },
        );
        if (!snapshot) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isRecovering.set(false);
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.wallet.isConnected() || !app.game.player.scriptHash()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withdrawOp.run(async () => {
        const playerHash = app.game.player.scriptHash();
        const result = await rewardGame.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        if (result.skipped) throw new Error(ctx.t("noCreditToWithdraw"));
        const exactEvent = result.tx.event != null &&
          addrEq(eventStateValue(result.tx.event, 0), playerHash) &&
          parseBigInt(eventStateValue(result.tx.event, 1)) > 0n;
        const balances = await rewardGame.balances(playerHash);
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
        if (!exactEvent && balances.creditFixed8 !== 0n) {
          throw new Error(ctx.t("withdrawPending"));
        }
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats(), refreshProgression()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: {
        ...obs,
        clues,
        walletConnected,
        isConnectingWallet,
        isActing,
        isRecovering,
        inputSyncFailed,
        rollbackNonce,
        undoNonce,
        boardRecoveryNonce,
        settlementGraceMs,
        isPaused,
        hintsUsed,
        hintCell,
        hintDigit,
        hintNonce,
        appMode,
      },
      loadData: async () => {
        // Guest mode is fully local — reset to a clean local lobby and load the
        // off-chain guest board instead of any chain read.
        if (app.mode.isGuest()) {
          inputSyncFailed.set(false);
          await guest.enter();
          return;
        }
        walletConnected.set(app.wallet.isConnected());
        await Promise.all([refreshBalances(), refreshGameConfig()]);
        await recoverCurrentGame(undefined, false);
        await Promise.all([refreshStats(), loadLeaderboard(), refreshProgression()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
      cleanup: () => {
        stopWalletSync();
        stopModeSync();
      },
    };
  },
});

export { gasDisplay };
