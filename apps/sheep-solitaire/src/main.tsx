import { createObservable, defineMiniApp } from "@shared/react";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { getLocale, normalizeLocale, type Locale } from "@shared/utils/i18n";
import type { SolveRow as FrameworkSolveRow } from "@framework/game";
import type { RewardGameConfig, RewardGameSession } from "@framework/gamefi";
import type { FrameworkPlatformGameSnapshot } from "@framework/platform-game-surface";
import PhaserPlayArea from "./PhaserPlayArea";
import manifest from "./manifest";
import { messages } from "./locale/messages";
import {
  ENTRY_MEMO,
  SETTLE_GRACE_MS,
  ruleOf,
  gasDisplay,
} from "./logic/game-rules";
import {
  parseSheepSessionView,
  type CardView,
  type SheepSessionOp,
  type SheepSessionView,
} from "./logic/session-view";
import { createGuestEngine } from "./logic/guest-engine";

const appId = "miniapp-sheep-solitaire";
const ENGINE_HASH = "9faf4efb68f60a44783de900254c62da8ca3b0b724dcebec57b4707f14a364ef";
const LEADERBOARD_EVENT_LIMIT = 200;
/** Manifest hiding is not authorization: new paid starts also fail closed here. */
export const NEW_PAID_RUNS_ENABLED = false;

type FailureReason = "none" | "tray" | "timeout";

const rewardGameConfig: RewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo: ENTRY_MEMO,
  modes: [0, 1, 2].map((difficulty) => {
    const rule = ruleOf(difficulty);
    return {
      id: difficulty,
      key: rule.key,
      entryFixed8: rule.entryFixed8,
      rewardFixed8: rule.rewardFixed8,
      limitMs: rule.limitMs,
      minSolveMs: rule.minSolveMs,
      target: rule.cardTypes * 3,
    };
  }),
};

function asNumber(value: unknown): number {
  const parsed = Number(parseBigInt(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  solves: number;
  isUser: boolean;
}

export interface SolveRow {
  gameId: string;
  difficulty: number;
  elapsedMs: number;
  undos: number;
  payout: string;
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const storedLanguage = app.storage.local.get<string>("language", null);
    const language = createObservable<Locale>(
      storedLanguage === "zh" || storedLanguage === "ja" || storedLanguage === "en"
        ? storedLanguage
        : getLocale(),
    );
    const rewardGame = app.game.reward<SheepSessionOp>(rewardGameConfig, {
      storagePrefix: `neo:${appId}:ops/`,
    });

    const credit = createObservable(0);
    const poolFree = createObservable(0);
    const activeGameId = createObservable("0");
    const gameStatus = createObservable("idle");
    const gameDifficulty = createObservable(0);
    const commitment = createObservable("");
    const startedAt = createObservable(0);
    const dealtAt = createObservable(0);
    const deadline = createObservable(0);
    const undosUsed = createObservable(0);
    const pileCards = createObservable<CardView[]>([]);
    const slotCards = createObservable<CardView[]>([]);
    const isMatching = createObservable(false);
    const isGameOver = createObservable(false);
    const failureReason = createObservable<FailureReason>("none");
    const shuffleLeft = createObservable(1);
    const remove3Left = createObservable(1);
    const isPicking = createObservable(false);
    const lastPayout = createObservable("");
    const lastElapsedMs = createObservable(0);
    const leaderboard = createObservable<LeaderEntry[]>([]);
    const myRank = createObservable(0);
    const myTotalWon = createObservable(0);
    const mySolves = createObservable(0);
    const myHistory = createObservable<SolveRow[]>([]);
    const isStarting = createObservable(false);
    const isDealing = createObservable(false);
    const isSubmitting = createObservable(false);
    const isUndoing = createObservable(false);
    const isTeeBusy = createObservable(false);
    const isRecovering = createObservable(false);
    const isFinancialAction = createObservable(false);
    const newPaidRunsEnabled = createObservable(NEW_PAID_RUNS_ENABLED);
    const level = createObservable(1);
    const dailyDate = createObservable(0);
    const revivesLeft = createObservable(0);
    const playMode = createObservable<string>("practice");
    const lastStatus = createObservable(ctx.t("statusReady"));
    const appMode = createObservable<"guest" | "gamefi">(app.mode.get());

    let session: RewardGameSession | null = null;
    let financialInFlight = false;
    let teeInFlight = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
    let matchTimer: ReturnType<typeof setTimeout> | null = null;

    const clearDeadlineTimer = (): void => {
      if (deadlineTimer !== null) {
        clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
    };

    const clearMatchTimer = (): void => {
      if (matchTimer !== null) {
        clearTimeout(matchTimer);
        matchTimer = null;
      }
    };

    const withFinancialLock = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      if (financialInFlight) return undefined;
      financialInFlight = true;
      isFinancialAction.set(true);
      try {
        return await work();
      } finally {
        financialInFlight = false;
        isFinancialAction.set(false);
      }
    };

    const withTeeLock = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      if (teeInFlight || financialInFlight) return undefined;
      teeInFlight = true;
      isTeeBusy.set(true);
      try {
        return await work();
      } finally {
        teeInFlight = false;
        isTeeBusy.set(false);
      }
    };

    const guest = createGuestEngine({
      gameStatus,
      activeGameId,
      gameDifficulty,
      commitment,
      dealtAt,
      deadline,
      undosUsed,
      pileCards,
      slotCards,
      isMatching,
      isGameOver,
      failureReason,
      shuffleLeft,
      remove3Left,
      isStarting,
      isDealing,
      isSubmitting,
      isUndoing,
      isPicking,
      lastPayout,
      lastElapsedMs,
      leaderboard,
      myRank,
      myTotalWon,
      mySolves,
      myHistory,
      credit,
      poolFree,
      lastStatus,
      level,
      dailyDate,
      revivesLeft,
      mode: playMode,
      guestLeaderboard: app.mode.guestLeaderboard,
      storage: {
        get: <T,>(key: string, fallback: T): T => app.storage.local.get<T>(key, fallback) ?? fallback,
        set: (key: string, value: unknown): void => app.storage.local.set(key, value),
        delete: (key: string): void => app.storage.local.delete(key),
      },
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      clearDeadlineTimer();
      clearMatchTimer();
      if (mode === "guest") {
        session = null;
        void guest.enter();
      } else {
        guest.dispose();
      }
    });

    const refreshBalances = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const balances = await rewardGame.balances(app.game.player.scriptHash());
      poolFree.set(balances.poolFreeGas);
      credit.set(balances.creditGas);
    };

    const refreshStats = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      const stats = await app.game.stats.load();
      mySolves.set(stats.solves);
      myTotalWon.set(stats.totalWon);
    };

    const loadLeaderboard = async (): Promise<void> => {
      if (app.mode.isGuest()) return;
      try {
        const { ranked, mine } = await app.game.leaderboard.load<FrameworkSolveRow>(
          "Solved",
          { solvedPayout: 5, totalWon: 6, undos: 7 },
          LEADERBOARD_EVENT_LIMIT,
          (event) => ({ score: asNumber(eventStateValue(event, 4)) }),
        );
        leaderboard.set(ranked);
        const me = ranked.find((entry) => entry.isUser);
        myRank.set(me?.rank ?? 0);
        myHistory.set(mine.slice(0, 12).map((row) => ({
          gameId: row.gameId,
          difficulty: row.difficulty,
          elapsedMs: row.solveMs,
          undos: row.undos,
          payout: row.payout,
        })));
      } catch {
        /* rankings are best-effort */
      }
    };

    const markDeadlineFailure = (): void => {
      if ((gameStatus.get() !== "dealt" && gameStatus.get() !== "solved") || Date.now() < deadline.get()) return;
      isGameOver.set(true);
      failureReason.set("timeout");
      lastStatus.set(ctx.t("timeUpHint"));
    };

    const scheduleDeadlineFailure = (): void => {
      clearDeadlineTimer();
      const expiresAt = deadline.get();
      if (expiresAt <= 0 || (gameStatus.get() !== "dealt" && gameStatus.get() !== "solved")) return;
      const delay = expiresAt - Date.now();
      if (delay <= 0) {
        markDeadlineFailure();
        return;
      }
      deadlineTimer = setTimeout(markDeadlineFailure, delay);
    };

    const applyGameSnapshot = (game: FrameworkPlatformGameSnapshot): void => {
      gameStatus.set(game.status);
      gameDifficulty.set(game.difficulty);
      if (game.commitment) commitment.set(game.commitment);
      startedAt.set(game.startTime);
      dealtAt.set(game.dealtAt);
      deadline.set(game.deadline);
      undosUsed.set(game.undos);
      if (game.status === "dealt") scheduleDeadlineFailure();
      else clearDeadlineTimer();
    };

    const applySessionView = (view: SheepSessionView): void => {
      pileCards.set(view.cards.filter((card) => !card.picked));
      slotCards.set(view.slots);
      isGameOver.set(view.gameOver);
      failureReason.set(view.gameOver ? "tray" : "none");
      shuffleLeft.set(view.shuffleLeft);
      remove3Left.set(view.remove3Left);
    };

    const restoreSession = async (gameId: string, difficulty: number): Promise<SheepSessionView> => {
      const started = await rewardGame.openSession(gameId, difficulty);
      const ops = rewardGame.storage.load(gameId);
      let rawView = started.currentView;
      if (started.opCount === 0 && ops.length > 0) {
        const replayed = await rewardGame.replayOps(started, ops);
        rawView = replayed.at(-1)?.view ?? started.view;
      } else if (started.opCount !== ops.length) {
        throw new Error(ctx.t("statusRecoveryUnavailable"));
      }
      const view = parseSheepSessionView(rawView);
      session = started;
      applySessionView(view);
      commitment.set(started.commitment);
      return view;
    };

    const openSharedSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      isDealing.set(true);
      lastStatus.set(ctx.t("statusSealing"));
      try {
        const view = await restoreSession(gameId, difficulty);
        const game = await app.platformGame.getGame(gameId);
        if (!game || game.difficulty !== difficulty || game.statusCode !== 1) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        applyGameSnapshot(game);
        if (view.won) gameStatus.set("solved");
        scheduleDeadlineFailure();
        lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        session = null;
        gameStatus.set("unknown");
        lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        isDealing.set(false);
      }
    };

    const sendOp = async (op: SheepSessionOp): Promise<SheepSessionView> => {
      if (!session) throw new Error(ctx.t("statusFailed"));
      const result = await rewardGame.recordOp(session, op);
      return parseSheepSessionView(result.step.view, { requireResultFlags: true });
    };

    const clearTerminalState = (gameId: string): void => {
      clearDeadlineTimer();
      clearMatchTimer();
      session = null;
      activeGameId.set("0");
      rewardGame.storage.forget(gameId);
      pileCards.set([]);
      slotCards.set([]);
      isGameOver.set(false);
      failureReason.set("none");
    };

    const finishSettlement = async (
      gameId: string,
      status: "solved" | "expired" | "refunded",
      payoutGas = 0,
      elapsedMs = 0,
    ): Promise<void> => {
      clearTerminalState(gameId);
      gameStatus.set(status);
      lastElapsedMs.set(elapsedMs);
      if (status === "solved") {
        lastPayout.set(`${payoutGas.toFixed(2)} GAS`);
        lastStatus.set(ctx.t("statusSolved", { payout: payoutGas.toFixed(2) }));
        ctx.setStatus(lastStatus.get(), "success");
      } else {
        lastPayout.set("");
        lastStatus.set(ctx.t("statusExpired"));
        ctx.setStatus(lastStatus.get(), "info");
      }
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
    };

    const recoverCurrentGame = async (announce = true): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      isRecovering.set(true);
      try {
        const recovered = await rewardGame.recoverActive();
        if (recovered.gameId === "0") return false;
        const game = await app.platformGame.getGame(recovered.gameId);
        if (!game) throw new Error(ctx.t("statusSessionMismatch"));
        activeGameId.set(recovered.gameId);
        applyGameSnapshot(game);
        if (game.statusCode === 1) {
          const view = await restoreSession(recovered.gameId, game.difficulty);
          if (view.won) gameStatus.set("solved");
          scheduleDeadlineFailure();
          if (announce) ctx.setStatus(ctx.t("statusRecovered"), "success");
          return true;
        }
        gameStatus.set("unknown");
        lastStatus.set(ctx.t("statusSettlementPending"));
        return true;
      } catch (error) {
        gameStatus.set("unknown");
        lastStatus.set(ctx.t("statusSettlementPending"));
        if (announce) ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        isRecovering.set(false);
      }
    };

    const canExpireCurrentGame = (): boolean => {
      const status = gameStatus.get();
      return (status === "dealt" || status === "solved")
        && deadline.get() > 0
        && Date.now() > deadline.get() + SETTLE_GRACE_MS;
    };

    ctx.framework.actions.register("startGame", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { difficulty?: unknown; mode?: unknown; level?: unknown };
      if (app.mode.isGuest()) {
        guest.startGame({
          mode: form.mode === "daily" ? "daily" : "practice",
          level: form.level === 2 ? 2 : 1,
          difficulty: Number(form.difficulty ?? 0),
        });
        return;
      }
      if (!NEW_PAID_RUNS_ENABLED || manifest.supportsGameFi === false) {
        ctx.setStatus(ctx.t("paidRunsUnavailable"), "info");
        return;
      }
      if (isStarting.get() || isDealing.get() || isRecovering.get()) return;
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      return withFinancialLock(async () => {
        isStarting.set(true);
        lastStatus.set(ctx.t("statusStarting"));
        try {
          const result = await rewardGame.start(difficulty);
          activeGameId.set(result.gameId);
          gameDifficulty.set(difficulty);
          undosUsed.set(0);
          commitment.set("");
          startedAt.set(Date.now());
          dealtAt.set(0);
          deadline.set(0);
          pileCards.set([]);
          slotCards.set([]);
          isGameOver.set(false);
          failureReason.set("none");
          shuffleLeft.set(1);
          remove3Left.set(1);
          gameStatus.set("dealt");
          lastStatus.set(ctx.t("statusStarted"));
          await refreshBalances();
          await openSharedSession(result.gameId, difficulty);
          return result.tx;
        } catch (error) {
          const recovered = await recoverCurrentGame(false);
          if (!recovered) {
            const message = app.errors.messageOf(error, ctx.t("statusFailed"));
            lastStatus.set(message);
            ctx.setStatus(message, "error");
          }
          return undefined;
        } finally {
          isStarting.set(false);
        }
      });
    });

    ctx.framework.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) return;
      const gameId = activeGameId.get();
      if (gameId === "0" || isDealing.get()) return;
      await withFinancialLock(() => openSharedSession(gameId, gameDifficulty.get()));
    });

    ctx.framework.actions.register("pickCard", async (...args: unknown[]) => {
      const cardId = Number((args[0] as { cardId?: unknown } | undefined)?.cardId);
      if (!Number.isInteger(cardId) || cardId < 0) return;
      if (app.mode.isGuest()) { guest.pickCard(cardId); return; }
      if (!session || gameStatus.get() !== "dealt" || isPicking.get() || isGameOver.get()) return;
      if (deadline.get() > 0 && Date.now() >= deadline.get()) return;
      await withTeeLock(async () => {
        isPicking.set(true);
        try {
          const view = await sendOp({ type: "pick", cardId });
          applySessionView(view);
          if (view.matched) {
            isMatching.set(true);
            clearMatchTimer();
            matchTimer = setTimeout(() => {
              isMatching.set(false);
              matchTimer = null;
            }, 600);
          }
          if (view.won) {
            gameStatus.set("solved");
            lastStatus.set(ctx.t("statusWonTitle"));
            ctx.setStatus(lastStatus.get(), "success");
          } else if (view.gameOver) {
            lastStatus.set(ctx.t("gameOverBanner"));
          }
        } catch (error) {
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        } finally {
          isPicking.set(false);
        }
      });
    });

    ctx.framework.actions.register("useUndo", async () => {
      if (app.mode.isGuest()) { guest.useUndo(); return; }
      if (activeGameId.get() === "0" || isUndoing.get() || gameStatus.get() !== "dealt") return;
      if (slotCards.get().length === 0 || (deadline.get() > 0 && Date.now() >= deadline.get())) return;
      await withTeeLock(async () => {
        isUndoing.set(true);
        try {
          const view = await sendOp({ type: "undo" });
          applySessionView(view);
          const undos = undosUsed.get() + 1;
          undosUsed.set(undos);
          lastStatus.set(ctx.t("statusUndoUsed", { pct: String(100 - 30 * undos) }));
          ctx.setStatus(lastStatus.get(), "info");
        } catch (error) {
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        } finally {
          isUndoing.set(false);
        }
      });
    });

    ctx.framework.actions.register("useShuffle", async () => {
      if (app.mode.isGuest()) { guest.useShuffle(); return; }
      if (activeGameId.get() === "0" || gameStatus.get() !== "dealt" || shuffleLeft.get() <= 0) return;
      if (deadline.get() > 0 && Date.now() >= deadline.get()) return;
      await withTeeLock(async () => {
        try {
          const view = await sendOp({ type: "shuffle" });
          applySessionView(view);
          ctx.setStatus(ctx.t("shuffleAction", { left: view.shuffleLeft }), "info");
        } catch (error) {
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        }
      });
    });

    ctx.framework.actions.register("useRemove3", async () => {
      if (app.mode.isGuest()) { guest.useRemove3(); return; }
      if (activeGameId.get() === "0" || gameStatus.get() !== "dealt" || remove3Left.get() <= 0) return;
      if (slotCards.get().length < 3 || (deadline.get() > 0 && Date.now() >= deadline.get())) return;
      await withTeeLock(async () => {
        try {
          const view = await sendOp({ type: "remove3" });
          applySessionView(view);
          ctx.setStatus(ctx.t("remove3Action", { left: view.remove3Left }), "info");
        } catch (error) {
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        }
      });
    });

    ctx.framework.actions.register("submitRun", async () => {
      if (app.mode.isGuest()) { await guest.submitRun(); return; }
      const gameId = activeGameId.get();
      const status = gameStatus.get();
      if (gameId === "0" || isSubmitting.get() || isTeeBusy.get()) return;
      if (status !== "dealt" && status !== "solved" && status !== "unknown") return;
      return withFinancialLock(async () => {
        isSubmitting.set(true);
        lastStatus.set(ctx.t("statusSubmitting"));
        try {
          if (status === "unknown") {
            await recoverCurrentGame(true);
            return undefined;
          }
          if (!session) await restoreSession(gameId, gameDifficulty.get());
          if (!session) throw new Error(ctx.t("statusRecoveryUnavailable"));
          const result = await rewardGame.finalize(session);
          if (result.settlement.status === "unknown") {
            gameStatus.set("unknown");
            lastStatus.set(ctx.t("statusSettlementPending"));
            ctx.setStatus(lastStatus.get(), "info");
            return result.tx;
          }
          const terminal = result.settlement.status === "solved" ? "solved" : "expired";
          await finishSettlement(
            gameId,
            terminal,
            result.settlement.payoutGas,
            result.settlement.elapsedMs,
          );
          return result.tx;
        } catch (error) {
          gameStatus.set("unknown");
          lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(app.errors.messageOf(error, lastStatus.get()), "error");
          return undefined;
        } finally {
          isSubmitting.set(false);
        }
      });
    });

    ctx.framework.actions.register("returnToLobby", async () => {
      if (app.mode.isGuest()) { guest.returnToLobby(); return; }
      if (isSubmitting.get() || isDealing.get() || isStarting.get() || isRecovering.get()) return;
      if (activeGameId.get() !== "0") return;
      gameStatus.set("idle");
      session = null;
      clearDeadlineTimer();
      clearMatchTimer();
      pileCards.set([]);
      slotCards.set([]);
      startedAt.set(0);
      dealtAt.set(0);
      deadline.set(0);
      isGameOver.set(false);
      failureReason.set("none");
      lastStatus.set(ctx.t("statusReady"));
    });

    ctx.framework.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = activeGameId.get();
      if (gameId === "0" || isRecovering.get() || !canExpireCurrentGame()) {
        if (gameId !== "0") ctx.setStatus(ctx.t("releaseNotReady"), "info");
        return;
      }
      await withFinancialLock(async () => {
        try {
          await rewardGame.expire(gameId);
          await finishSettlement(gameId, "expired");
        } catch (error) {
          gameStatus.set("unknown");
          lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(app.errors.messageOf(error, lastStatus.get()), "error");
        }
      });
    });

    ctx.framework.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withFinancialLock(async () => {
        try {
          const result = await rewardGame.withdrawCredit();
          await refreshBalances();
          ctx.setStatus(result.skipped ? ctx.t("noCreditToWithdraw") : ctx.t("creditWithdrawn"), result.skipped ? "info" : "success");
        } catch (error) {
          await refreshBalances();
          ctx.setStatus(app.errors.messageOf(error, ctx.t("withdrawPending")), "error");
        }
      });
    });

    ctx.framework.actions.register("recoverGame", async () => {
      if (app.mode.isGuest()) return;
      await withFinancialLock(() => recoverCurrentGame(true));
    });
    ctx.framework.actions.register("advanceLevel", async () => {
      if (app.mode.isGuest()) guest.advanceLevel();
    });
    ctx.framework.actions.register("revive", async () => {
      if (app.mode.isGuest()) guest.revive();
    });
    ctx.framework.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });
    ctx.framework.actions.register("setLanguage", async (...args: unknown[]) => {
      const next = normalizeLocale(String(args[0] ?? ""));
      language.set(next);
      app.storage.local.set("language", next);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("languageChange", { detail: { language: next } }));
      }
    });

    return {
      state: {
        credit,
        poolFree,
        activeGameId,
        gameStatus,
        gameDifficulty,
        commitment,
        startedAt,
        dealtAt,
        deadline,
        undosUsed,
        pileCards,
        slotCards,
        isMatching,
        isGameOver,
        failureReason,
        shuffleLeft,
        remove3Left,
        isPicking,
        lastPayout,
        lastElapsedMs,
        leaderboard,
        myRank,
        myTotalWon,
        mySolves,
        myHistory,
        isStarting,
        isDealing,
        isSubmitting,
        isUndoing,
        isTeeBusy,
        isRecovering,
        isFinancialAction,
        newPaidRunsEnabled,
        level,
        dailyDate,
        revivesLeft,
        playMode,
        lastStatus,
        appMode,
        language,
      },
      loadData: async () => {
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        await recoverCurrentGame(false);
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (gameStatus.get() === "idle") lastStatus.set(ctx.t("statusReady"));
      },
      cleanup: () => {
        stopModeSync();
        guest.dispose();
        clearDeadlineTimer();
        clearMatchTimer();
      },
    };
  },
});

export { gasDisplay };
