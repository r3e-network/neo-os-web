/**
 * Flappy Dash — endless runner bird game (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: pipe-layout seed delivery, flap recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import { createGameCreditsLane } from "@shared/react/game-credits";
import { createDerived } from "@shared/react/context";
import type { RewardGameSession } from "@framework/gamefi";
import { mapField } from "@framework/gamefi";
import { eventStateValue } from "@shared/utils/chain-events";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { DIFFICULTY_RULES, ENTRY_MEMO, statusOf, gasDisplay } from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import type { LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-flappy-dash";
const ENGINE_HASH = "401bb3de1c04a8b20c18d35a9f0750f33647361060884f275d6954d3c74c2b1c";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-flappy-dash:ops:";

type TeeOp = { type: "flap" } | { type: "undo" };

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
    target:       rule.targetPipes,
  })),
  progression: { enabled: true },
};

// Flappy-Dash SolveRow adds pipes count
interface FlappyRow extends SolveRow {
  pipes: number;
}

// Flappy Solved event: gameId(0) player(1) difficulty(2) elapsedMs(3) pipes(4) payout(5) totalWon(6)
const SOLVED_SLOTS = {
  gameId: 0, player: 1, difficulty: 2, elapsedMs: 3,
  solvedPayout: 5, totalWon: 6, undos: 7,
};

export type { LeaderEntry };
export type { FlappyRow as SolveRow };

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // Fail closed in direct-play and stale-host launches. The published
    // manifest exposes only free local practice until the Morpheus replay
    // cadence and deployed settlement timing have passed live validation.
    if (manifest.supportsGameFi === false && !app.mode.isGuest()) {
      app.mode.set("guest");
    }

    // ── Reward-game runner ────────────────────────────────────────────────────
    const reward = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = reward;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<FlappyRow>(ctx.t);

    // ── Flappy-specific observables ───────────────────────────────────────────
    const seed        = createObservable("");   // deterministic pipe layout seed
    const pipesPassed = createObservable(0);
    const walletConnected = createDerived(
      () => app.wallet.isConnected(),
      [app.chain.address],
    );
    const isConnectingWallet = createObservable(false);
    const inputSyncFailed = createObservable(false);
    const isRecovering = createObservable(false);

    // ── Play mode (guest | gamefi) mirrored into an observable for the PlayArea ─
    // The PlayArea/scene read this to switch to local (guest) framing and hide
    // the GAS-at-stake / pool / reward copy. Kept in sync with app.mode.
    const appMode = createObservable<string>(app.mode.get());

    let session: RewardGameSession | null = null;

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local runner — no chain/oracle/reward calls.
    // Standalone Vite has no OS guest-leaderboard proxy. Keep practice fully
    // local in development instead of emitting a noisy failed request.
    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> { return; },
          async get(): Promise<Array<{ user: string; score: string }>> { return []; },
        }
      : app.mode.guestLeaderboard;
    const guest = createGuestEngine({
      obs,
      seed,
      pipesPassed,
      guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // ── Platform credits (Credits v2 reference integration) ──────────────────
    // HUD balance chip + fail-overlay "instant retry" offer + buy prompt.
    // Renders only in GameFi mode on hosts that inject a credits config;
    // everywhere else (guest, dev without the ledger) it degrades away.
    const creditsLane = createGameCreditsLane({
      app,
      t: ctx.t,
      setStatus: ctx.setStatus,
      reviveAction: "revive",
      reviveCostCredits: 5,
      // Paid flights are fail-closed while supportsGameFi stays false; when
      // GameFi re-opens the offer follows the manifest with no code change.
      reviveEnabled: manifest.supportsGameFi !== false,
      onReviveUnlocked: async () => {
        await app.actions.run("startGame", { difficulty: obs.gameDifficulty.get() });
      },
    });

    // Switching to guest at the launcher resets to a clean local lobby and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      if (manifest.supportsGameFi === false && mode !== "guest") {
        app.mode.set("guest");
        return;
      }
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
      else void creditsLane.refresh();
    });

    // ── Data refresh ──────────────────────────────────────────────────────────
    // Every chain-reading loader early-returns in guest mode so a mount-time
    // gamefi read never clobbers the local guest surface after the switch.
    const refreshBalances = async () => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await reward.balances();
        obs.poolFree.set(balances.poolFreeGas);
        obs.credit.set(balances.creditGas);
      } catch { /* best-effort */ }
    };

    const refreshStats = async () => {
      if (app.mode.isGuest()) return;
      const { solves, totalWon } = await app.game.stats.load();
      obs.mySolves.set(solves);
      obs.myTotalWon.set(totalWon);
    };

    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const { ranked, mine } = await app.game.leaderboard.load<FlappyRow>(
        "Solved", SOLVED_SLOTS, LEADERBOARD_EVENT_LIMIT,
        (ev) => {
          return { pipes: asNumber(eventStateValue(ev, 4)) };
        },
      );
      obs.leaderboard.set(ranked as LeaderEntry[]);
      obs.myRank.set(ranked.find((e) => e.isUser)?.rank ?? 0);
      obs.myHistory.set(mine);
    };

    // ── Session helpers ───────────────────────────────────────────────────────
    const openSession = async (gameId: string, difficulty: number): Promise<boolean> => {
      obs.isDealing.set(true);
      obs.lastStatus.set(ctx.t("statusSealing"));
      try {
        // Read the contract clock before contacting the session host. If the
        // enclave is unavailable, the UI can still expose expiry recovery once
        // the on-chain settlement grace window has actually elapsed.
        const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(gameId)]);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        const started = await reward.openSession(gameId, difficulty);
        session = started;
        seed.set(String(started.view.seed ?? ""));
        obs.commitment.set(started.commitment);
        obs.gameStatus.set("dealt");
        pipesPassed.set(0);
        obs.lastStatus.set(ctx.t("statusDealt"));
        ctx.setStatus(ctx.t("statusDealt"), "success");
        return true;
      } catch (error) {
        obs.lastStatus.set(ctx.t("statusDealPending"));
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        return false;
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const started = await reward.openSession(gameId, difficulty);
        if (obs.commitment.get() && started.commitment !== obs.commitment.get()) {
          throw new Error(ctx.t("statusFailed"));
        }
        session = started;
        seed.set(String(started.view.seed ?? ""));
        obs.commitment.set(started.commitment);
      } catch {
        obs.lastStatus.set(ctx.t("statusDealPending"));
      }
    };

    const finishFromSnapshot = async (
      gameId: string,
      snapshot: Awaited<ReturnType<typeof reward.snapshot>>,
      announce = true,
    ): Promise<void> => {
      const rewarded = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;

      obs.gameDifficulty.set(snapshot.difficulty);
      obs.commitment.set(snapshot.commitment);
      obs.dealtAt.set(snapshot.dealtAt);
      obs.deadline.set(snapshot.deadline);
      obs.lastElapsedMs.set(snapshot.solveMs);
      obs.lastPayout.set(`${snapshot.payoutGas.toFixed(2)} GAS`);
      pipesPassed.set(asNumber(mapField(snapshot.raw, "pipesPassed") ?? 0));
      // The contract records a completed losing run with status 2 as well. A
      // zero-payout completion is therefore presented as an expired/lost run,
      // never as a false win.
      obs.gameStatus.set(rewarded ? "solved" : "expired");
      obs.activeGameId.set("0");
      session = null;
      reward.storage.forget(gameId);

      if (rewarded) {
        obs.lastStatus.set(ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) }));
        if (announce) ctx.setStatus(obs.lastStatus.get(), "success");
      } else {
        obs.lastStatus.set(ctx.t("statusExpired"));
        if (announce) ctx.setStatus(ctx.t("statusExpired"), "info");
      }
      // Settlement is already authoritative; auxiliary HUD/indexer refreshes
      // must never roll a terminal chain result back into an unknown state.
      await Promise.allSettled([refreshBalances(), refreshStats(), loadLeaderboard()]);
    };

    const recoverCurrentGame = async (
      preferredGameId?: string,
      announce = true,
    ): Promise<boolean> => {
      if (app.mode.isGuest() || isRecovering.get()) return false;
      const gameId = preferredGameId && preferredGameId !== "0"
        ? preferredGameId
        : obs.activeGameId.get();
      if (!gameId || gameId === "0") return false;

      isRecovering.set(true);
      try {
        const snapshot = await reward.snapshot(gameId);
        obs.activeGameId.set(gameId);
        app.game.session.applySnapshot(obs, snapshot.raw, statusOf);
        pipesPassed.set(asNumber(mapField(snapshot.raw, "pipesPassed") ?? 0));

        if (
          snapshot.status === "solved"
          || snapshot.status === "expired"
          || snapshot.status === "refunded"
        ) {
          await finishFromSnapshot(gameId, snapshot, announce);
          return true;
        }

        if (snapshot.status === "unknown") {
          session = null;
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          if (announce) ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return true;
        }

        if (snapshot.status === "dealt") {
          obs.lastStatus.set(ctx.t("statusDealt"));
          await resumeSession(gameId, snapshot.difficulty);
          return true;
        }

        obs.lastStatus.set(ctx.t("statusDealPending"));
        await openSession(gameId, snapshot.difficulty);
        return true;
      } catch (error) {
        if (announce) {
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        }
        return false;
      } finally {
        isRecovering.set(false);
      }
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      if (
        obs.isStarting.get()
        || obs.isDealing.get()
        || obs.isSubmitting.get()
        || ["dealt", "committed", "unknown"].includes(obs.gameStatus.get())
      ) return;
      const form = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Math.round(Number(form.difficulty) || 0)));
      obs.gameDifficulty.set(difficulty);
    });

    app.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get() || app.wallet.isConnected()) return;
      isConnectingWallet.set(true);
      try {
        const address = await app.wallet.ensure();
        if (!address) throw new Error(ctx.t("walletUnavailable"));
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        obs.lastStatus.set(ctx.t("walletConnectedReady"));
        ctx.setStatus(ctx.t("walletConnectedReady"), "success");
      } catch (error) {
        const message = app.errors.messageOf(error, ctx.t("walletUnavailable"));
        obs.lastStatus.set(message);
        ctx.setStatus(message, "error");
        throw error;
      } finally {
        isConnectingWallet.set(false);
      }
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { difficulty?: unknown };
        guest.startGame(Number(form.difficulty ?? 0));
        return;
      }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      const form       = (args[0] ?? {}) as { difficulty?: unknown };
      const difficulty = Math.max(0, Math.min(2, Number(form.difficulty ?? 0) || 0));
      obs.isStarting.set(true);
      obs.lastStatus.set(ctx.t("statusStarting"));
      try {
        const started = await startRewardGame(difficulty);
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        seed.set("");
        obs.commitment.set("");
        obs.dealtAt.set(0);
        obs.deadline.set(0);
        pipesPassed.set(0);
        inputSyncFailed.set(false);
        obs.gameStatus.set("committed");
        obs.lastStatus.set(ctx.t("statusStarted"));
        await refreshBalances();
        void openSession(gameId, difficulty);
        return started.tx;
      } catch (error) {
        const msg = error instanceof Error && "code" in error && error.code === "POOL_LOW"
          ? ctx.t("statusPoolLow")
          : error instanceof Error
            ? error.message
            : ctx.t("statusFailed");
        obs.lastStatus.set(msg);
        ctx.setStatus(msg, "error");
        throw error;
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0" || obs.isDealing.get() || obs.gameStatus.get() !== "committed") return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordFlap", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { pipes?: unknown };
        guest.recordFlap(Number(form.pipes ?? pipesPassed.get()));
        return;
      }
      const form    = (args[0] ?? {}) as { pipes?: unknown };
      const pipes   = Number(form.pipes ?? pipesPassed.get());
      const gameId  = obs.activeGameId.get();
      if (gameId === "0" || !session || obs.gameStatus.get() !== "dealt") return;
      try {
        await reward.recordOp(session, { type: "flap" });
        inputSyncFailed.set(false);
      } catch (error) {
        inputSyncFailed.set(true);
        const message = app.errors.messageOf(error, ctx.t("statusInputSyncFailed"));
        obs.lastStatus.set(ctx.t("statusInputSyncFailed"));
        ctx.setStatus(message, "error");
        throw error;
      }
      // Keep the immediate local score monotonic for older scene callers; the
      // regular one-second syncScore action owns HUD reporting.
      if (Number.isFinite(pipes)) pipesPassed.set(Math.max(pipesPassed.get(), pipes));
    });

    app.actions.register("syncScore", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { pipes?: unknown };
      const pipes = Number(form.pipes ?? pipesPassed.get());
      if (obs.gameStatus.get() !== "dealt" || !Number.isFinite(pipes)) return;
      if (app.mode.isGuest()) {
        guest.syncScore(pipes);
        return;
      }
      // UI-only progress: do not append an enclave operation here.
      pipesPassed.set(Math.max(0, pipes));
    });

    app.actions.register("submitSolution", async (...args: unknown[]) => {
      if (app.mode.isGuest()) {
        const form = (args[0] ?? {}) as { pipes?: unknown };
        await guest.submitSolution(Number(form.pipes ?? pipesPassed.get()));
        return;
      }
      const form       = (args[0] ?? {}) as { stateHash?: unknown; pipes?: unknown };
      const pipes      = Number(form.pipes ?? pipesPassed.get());
      const gameId     = obs.activeGameId.get();
      if (gameId === "0" || obs.isSubmitting.get() || obs.gameStatus.get() !== "dealt") return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set(ctx.t("statusSubmitting"));
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        pipesPassed.set(Math.max(pipesPassed.get(), pipes));
        const finalized = await finalizeRewardGame(session);
        const settled   = finalized.settlement;
        session = null;

        if (settled.status === "unknown") {
          // Broadcast is not confirmation. Preserve the exact game id and the
          // SDK's sealed op-log so refresh/recovery can inspect the callback
          // result without reopening or duplicating the paid run.
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }

        const snapshot = await reward.snapshot(gameId);
        if (snapshot.status === "unknown" || snapshot.status === "dealt" || snapshot.status === "committed") {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return finalized.tx;
        }
        await finishFromSnapshot(gameId, snapshot);
        return finalized.tx;
      } catch (error) {
        // A wallet/RPC timeout may arrive after broadcast. Keep the run
        // recoverable until an explicit chain snapshot proves a terminal state.
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set(ctx.t("statusSettlementPending"));
        const msg = app.errors.messageOf(error, ctx.t("statusFailed"));
        ctx.setStatus(msg, "error");
        throw error;
      } finally {
        obs.isSubmitting.set(false);
      }
    });

    app.actions.register("refreshGame", async () => {
      if (app.mode.isGuest()) return;
      await recoverCurrentGame(undefined, true);
    });

    app.actions.register("expireGame", async () => {
      if (app.mode.isGuest()) { guest.expireGame(); return; }
      const gameId = obs.activeGameId.get();
      if (gameId === "0") return;
      try {
        await reward.expire(gameId);
        session = null;
        // Invocation may be broadcast before its state transition is visible.
        // Re-read the exact game instead of claiming it was released.
        const recovered = await recoverCurrentGame(gameId, true);
        if (!recovered) {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set(ctx.t("statusSettlementPending"));
        }
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        throw error;
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.game.player.scriptHash()) { ctx.setStatus(ctx.t("statusFailed"), "error"); return; }
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      await withdrawOp.run(async () => {
        await reward.withdrawCredit(app.amount.gasToFixed8(obs.credit.get()));
        await refreshBalances();
      }, { successKey: "creditWithdrawn" });
    });

    app.actions.register("refreshLeaderboard", async () => {
      if (app.mode.isGuest()) { await guest.refreshLeaderboard(); return; }
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: {
        ...obs,
        seed,
        pipesPassed,
        appMode,
        walletConnected,
        isConnectingWallet,
        inputSyncFailed,
        isRecovering,
        ...creditsLane.state,
      },
      loadData: async () => {
        if (app.mode.isGuest()) { await guest.enter(); return; }
        void creditsLane.refresh();
        await refreshBalances();
        const playerHash = app.game.player.scriptHash();
        if (playerHash) {
          try {
            // RFC P0-6: typed read lane — `asBigInt()` keeps the
            // parseBigInt-to-0n decode semantics; read errors still land in
            // this catch.
            const active = String(
              await app.chain
                .query("activeGameOf", [app.chain.arg.hash160(playerHash)])
                .asBigInt(),
            );
            if (active !== "0") await recoverCurrentGame(active, false);
          } catch { /* no active game */ }
        }
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set(ctx.t("statusReady"));
      },
    };
  },
});

export { gasDisplay };
