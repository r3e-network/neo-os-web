/**
 * Pet Potion — virtual pet care game (refactored to unified game framework).
 *
 * All chain operations, wallet, oracle, state, lifecycle, and GameFi plumbing
 * are delegated to `ctx.framework`. Setup expresses only the game-specific
 * logic: pet stat management, care action recording, and solution finalization.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { eventStateValue } from "@shared/utils/chain-events";
import { eventHashMatches as addrEq, mapField, normalizedHash as normHash } from "@framework/gamefi";
import type { RewardGameSession } from "@framework/gamefi";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  DIFFICULTY_RULES,
  ENTRY_MEMO,
  ruleOf,
  statusOf,
  evolutionStage,
  emptyIngredientCounts,
  ingredientCountsOf,
  MAX_MOVES,
  canExpireAfterGrace,
  type IngredientCounts,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";
import { asNumber } from "@framework/game";

const appId       = "miniapp-pet-potion";
const ENGINE_HASH = "bde403c0627304cf8364003fba442ff3b3479f0426c07cff48afb0d13ee3bb03";

const LEADERBOARD_EVENT_LIMIT = 200;
const OPS_STORAGE_PREFIX      = "miniapp-pet-potion:ops:";
/** Manifest hiding is not authorization: new paid starts also fail closed here. */
export const NEW_PAID_RUNS_ENABLED = false;

type TeeOp = { type: "feed" } | { type: "play" } | { type: "pet" } | { type: "rest" };

const rewardGameConfig = {
  appId,
  engineHash: ENGINE_HASH,
  entryMemo:  ENTRY_MEMO,
  modes: DIFFICULTY_RULES.map((rule) => ({
    id:           rule.difficulty,
    entryFixed8:  rule.entry,
    rewardFixed8: rule.reward,
    limitMs:      rule.limitMs,
    minSolveMs:   rule.minSolveMs,
    target:       rule.targetHappiness,
  })),
  progression: { enabled: true },
};

// Pet-Potion SolveRow adds happinessAchieved
interface PetRow extends SolveRow {
  happinessAchieved: number;
}

export type { LeaderEntry };
export type { PetRow as SolveRow };

function sessionStatusOf(raw: number): GameSessionStatus {
  switch (statusOf(raw)) {
    case "awaiting-bind": return "committed";
    case "playing": return "dealt";
    case "solved": return "solved";
    case "expired": return "expired";
    case "refunded": return "refunded";
    default: return "unknown";
  }
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function petViewOf(view: Record<string, unknown>): Record<string, unknown> {
  const inner = view.view;
  return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : view;
}

function cleanHex(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/^0x/, "");
}

function difficultyInput(value: unknown): number {
  const raw = value && typeof value === "object"
    ? (value as { difficulty?: unknown }).difficulty
    : value;
  return Math.max(0, Math.min(2, Math.round(Number(raw) || 0)));
}

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // ── Reward-game runner ────────────────────────────────────────────────────
    const rewardGame = app.game.reward<TeeOp>(rewardGameConfig, {
      storagePrefix: OPS_STORAGE_PREFIX,
    });
    const { start: startRewardGame, finalize: finalizeRewardGame } = rewardGame;

    // ── Standard session observables ──────────────────────────────────────────
    const obs = app.game.session.observables<PetRow>(ctx.t);

    // ── Pet-specific observables ──────────────────────────────────────────────
    const actionsUsed        = createObservable(0);
    const happinessAchieved  = createObservable(0);
    const petHappiness       = createObservable(50);
    const petHunger          = createObservable(50);
    const petEnergy          = createObservable(50);
    const petStage           = createObservable(0);
    const actionHistory      = createObservable<string[]>([]);
    const ingredientCounts   = createObservable<IngredientCounts>(emptyIngredientCounts());
    const potionBrewed       = createObservable(false);
    const lastPayoutFixed8   = createObservable<bigint>(0n);
    const isActing           = createObservable(false);
    const isRecovering       = createObservable(false);
    const isConnectingWallet = createObservable(false);
    const walletConnected    = createObservable(app.wallet.isConnected());
    const inputSyncFailed    = createObservable(false);
    const newPaidRunsEnabled = createObservable(NEW_PAID_RUNS_ENABLED);

    // ── Play mode (guest | gamefi) ────────────────────────────────────────────
    // Mirror the launcher-selected mode into an observable the PlayArea/scene
    // read, so guest can drop the GAS-at-stake / pool / reward framing while the
    // GAMEFI lobby/copy stays exactly as-is.
    const appMode = createObservable<string>(app.mode.get());

    let session: RewardGameSession | null = null;
    let walletIdentity = String(app.chain.address.get() ?? "").trim().toLowerCase();

    // RFC P0-5: identity-diff account hook (fires only on real identity
    // changes; handler errors are isolated by the framework).
    const stopWalletSync = app.wallet.onAccountChanged(({ current }) => {
      const address = String(current ?? "").trim().toLowerCase();
      const identityChanged = Boolean(walletIdentity && address && walletIdentity !== address);
      walletIdentity = address;
      walletConnected.set(Boolean(address));
      if (!address || identityChanged) {
        session = null;
        const hasRecoverableRun = obs.activeGameId.get() !== "0" &&
          ["committed", "dealt", "unknown"].includes(obs.gameStatus.get());
        if (!app.mode.isGuest() && hasRecoverableRun) {
          inputSyncFailed.set(true);
          obs.lastStatus.set("input-sync-failed");
        }
      }
    });

    // ── Guest (free / local) engine ───────────────────────────────────────────
    // Guest mode reuses the SAME observables + dispatch actions the scene reads,
    // driven by a purely local pet-care simulation — no chain/oracle/reward calls.
    const guestLeaderboard = import.meta.env.DEV
      ? {
          async submit(): Promise<void> { return; },
          async get(): Promise<Array<{ user: string; score: string }>> { return []; },
        }
      : app.mode.guestLeaderboard;
    const guest = createGuestEngine({
      obs,
      actionsUsed,
      happinessAchieved,
      petHappiness,
      petHunger,
      petEnergy,
      petStage,
      actionHistory,
      ingredientCounts,
      potionBrewed,
      lastPayoutFixed8,
      guestLeaderboard,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Keep the mode observable in sync; switching to guest at the launcher resets
    // to a clean local lobby and loads the off-chain guest board (replacing the
    // on-chain read done on mount).
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") {
        inputSyncFailed.set(false);
        void guest.enter();
      }
    });

    // ── Pet view helpers ──────────────────────────────────────────────────────
    const publishView = (view: { happiness: number; hunger: number; energy: number; stage?: number }): void => {
      const happy = clampStat(view.happiness);
      petHappiness.set(happy);
      petHunger.set(clampStat(view.hunger));
      petEnergy.set(clampStat(view.energy));
      petStage.set(Number.isInteger(view.stage) ? Number(view.stage) : evolutionStage(happy));
      happinessAchieved.set(Math.max(happinessAchieved.get(), happy));
    };

    const applyStepView = (view: Record<string, unknown>): void => {
      const pet = petViewOf(view);
      publishView({
        happiness: Number(pet.happiness ?? petHappiness.get()),
        hunger:    Number(pet.hunger    ?? petHunger.get()),
        energy:    Number(pet.energy    ?? petEnergy.get()),
        stage:     Number(pet.stage     ?? petStage.get()),
      });
    };

    // ── Data refresh ──────────────────────────────────────────────────────────
    const refreshBalances = async () => {
      if (app.mode.isGuest()) return;
      try {
        const balances = await rewardGame.balances(app.game.player.scriptHash());
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

    // Pet-potion leaderboard uses `player`/`solved` field names.
    const loadLeaderboard = async () => {
      if (app.mode.isGuest()) return;
      const playerHash = app.game.player.scriptHash();
      try {
        const events = await app.chain.events("Solved", { limit: LEADERBOARD_EVENT_LIMIT });
        const bestByPlayer = new Map<string, LeaderEntry>();
        const mine: PetRow[] = [];
        for (const ev of events) {
          const who = normHash(eventStateValue(ev, 1));
          if (!who) continue;
          const totalWon = fromFixed8(parseBigInt(eventStateValue(ev, 6)));
          const prior    = bestByPlayer.get(who);
          bestByPlayer.set(who, {
            rank:     0,
            address:  String(eventStateValue(ev, 1) ?? who),
            totalWon: Math.max(prior?.totalWon ?? 0, totalWon),
            solves:   (prior?.solves ?? 0) + 1,
            isUser:   playerHash ? addrEq(eventStateValue(ev, 1), playerHash) : false,
          });
          if (playerHash && addrEq(eventStateValue(ev, 1), playerHash)) {
            mine.push({
              gameId:              String(parseBigInt(eventStateValue(ev, 0)) ?? ""),
              difficulty:          asNumber(eventStateValue(ev, 2)),
              solveMs:             asNumber(eventStateValue(ev, 3)),
              undos:               asNumber(eventStateValue(ev, 4)),
              payout:              `${fromFixed8(parseBigInt(eventStateValue(ev, 5))).toFixed(2)} GAS`,
              // Solved has no happiness slot. It is read back from this exact
              // game id below; never guess from a non-existent event field.
              happinessAchieved:   0,
            });
          }
        }
        const ranked = [...bestByPlayer.values()]
          .sort((a, b) => b.totalWon - a.totalWon)
          .map((e, i) => ({ ...e, rank: i + 1 }));
        obs.leaderboard.set(ranked);
        const me = playerHash ? ranked.find((e) => addrEq(e.address, playerHash)) : undefined;
        obs.myRank.set(me?.rank ?? 0);
        const recentMine = mine.reverse().slice(0, 12);
        const verifiedMine = await Promise.all(recentMine.map(async (row) => {
          try {
            const game = await app.chain.readRaw("getGame", [app.chain.arg.integer(row.gameId)]);
            return {
              ...row,
              happinessAchieved: asNumber(mapField(game, "happinessAchieved")),
            };
          } catch {
            return row;
          }
        }));
        obs.myHistory.set(verifiedMine);
      } catch { /* indexer unreachable */ }
    };

    // ── Session helpers ───────────────────────────────────────────────────────
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
      const difficultyMatches = difficulty === undefined || asNumber(mapField(game, "difficulty")) === difficulty;
      return idMatches && playerMatches && difficultyMatches;
    };

    const verifyPlayingSession = async (
      opened: RewardGameSession,
      gameId: string,
      difficulty: number,
    ): Promise<unknown> => {
      const playerHash = app.game.player.scriptHash();
      const game = await readGame(gameId);
      const commitmentMatches = cleanHex(mapField(game, "commitment")) === cleanHex(opened.commitment);
      if (
        !gameMatchesIdentity(game, gameId, playerHash, difficulty) ||
        asNumber(mapField(game, "status")) !== 1 ||
        !commitmentMatches
      ) {
        throw new Error(ctx.t("statusSessionMismatch"));
      }
      return game;
    };

    const openSession = async (gameId: string, difficulty: number): Promise<void> => {
      obs.isDealing.set(true);
      obs.lastStatus.set("shuffling");
      try {
        const opened = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(opened, gameId, difficulty);
        session = opened;
        obs.commitment.set(opened.commitment);
        publishView({
          happiness: Number(opened.view.happiness ?? 50),
          hunger:    Number(opened.view.hunger    ?? 50),
          energy:    Number(opened.view.energy    ?? 50),
          stage:     Number(opened.view.stage     ?? 0),
        });
        actionsUsed.set(0);
        actionHistory.set([]);
        ingredientCounts.set(emptyIngredientCounts());
        potionBrewed.set(false);
        inputSyncFailed.set(false);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        obs.undosUsed.set(0);
        obs.lastStatus.set("dealt");
        ctx.setStatus(ctx.t("statusDealt"), "success");
      } catch (error) {
        session = null;
        obs.lastStatus.set("deal-pending");
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        obs.isDealing.set(false);
      }
    };

    const resumeSession = async (gameId: string, difficulty: number): Promise<void> => {
      try {
        const restored = await rewardGame.openSession(gameId, difficulty);
        const game = await verifyPlayingSession(restored, gameId, difficulty);
        if (obs.commitment.get() && cleanHex(restored.commitment) !== cleanHex(obs.commitment.get())) {
          throw new Error(ctx.t("statusSessionMismatch"));
        }
        session = restored;
        obs.commitment.set(restored.commitment);
        obs.dealtAt.set(asNumber(mapField(game, "dealtAt")));
        obs.deadline.set(asNumber(mapField(game, "deadline")));
        obs.gameStatus.set("dealt");
        publishView({
          happiness: Number(restored.view.happiness ?? 50),
          hunger:    Number(restored.view.hunger    ?? 50),
          energy:    Number(restored.view.energy    ?? 50),
          stage:     Number(restored.view.stage     ?? 0),
        });
        const ops = rewardGame.storage.load(gameId);
        actionsUsed.set(ops.length);
        actionHistory.set(ops.map((op) => op.type));
        ingredientCounts.set(ingredientCountsOf(ops.map((op) => op.type)));
        potionBrewed.set(false);
        await rewardGame.replayOps(restored, ops, (step) => { applyStepView(step.view); });
        inputSyncFailed.set(false);
      } catch {
        session = null;
        obs.lastStatus.set("deal-pending");
      }
    };

    const finishFromSnapshot = async (
      gameId: string,
      snapshot: Awaited<ReturnType<typeof rewardGame.snapshot>>,
      announce = true,
    ): Promise<void> => {
      const achieved = asNumber(mapField(snapshot.raw, "happinessAchieved"));
      const undos = asNumber(mapField(snapshot.raw, "undos"));
      const rewarded = snapshot.status === "solved" && snapshot.payoutFixed8 > 0n;
      const uiStatus = snapshot.status === "solved" && !rewarded ? "expired" : snapshot.status;

      obs.gameDifficulty.set(snapshot.difficulty);
      obs.commitment.set(snapshot.commitment);
      obs.dealtAt.set(snapshot.dealtAt);
      obs.deadline.set(snapshot.deadline);
      obs.undosUsed.set(undos);
      obs.lastElapsedMs.set(snapshot.solveMs);
      happinessAchieved.set(achieved);
      petHappiness.set(achieved);
      petStage.set(evolutionStage(achieved));
      lastPayoutFixed8.set(snapshot.payoutFixed8);
      potionBrewed.set(snapshot.status === "solved");
      inputSyncFailed.set(false);
      obs.gameStatus.set(uiStatus as "solved" | "expired" | "refunded");
      obs.lastStatus.set(rewarded ? "solved" : "expired");
      obs.activeGameId.set("0");
      session = null;
      rewardGame.storage.forget(gameId);

      if (announce) {
        if (rewarded) {
          ctx.setStatus(ctx.t("statusSolved", { payout: snapshot.payoutGas.toFixed(2) }), "success");
        } else {
          ctx.setStatus(ctx.t("statusExpired"), "info");
        }
      }
      await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
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
        app.game.session.applySnapshot(obs, snapshot.raw, sessionStatusOf);
        const nextStatus = sessionStatusOf(asNumber(mapField(snapshot.raw, "status")));

        if (nextStatus === "committed") {
          obs.lastStatus.set("deal-pending");
          await openSession(gameId, snapshot.difficulty);
          return true;
        }
        if (nextStatus === "dealt") {
          obs.lastStatus.set("dealt");
          await resumeSession(gameId, snapshot.difficulty);
          return true;
        }
        if (nextStatus === "unknown") {
          session = null;
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          if (announce) ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return true;
        }

        await finishFromSnapshot(gameId, snapshot, announce);
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

    const startResultMatchesIntent = async (
      started: Awaited<ReturnType<typeof startRewardGame>>,
      difficulty: number,
    ): Promise<boolean> => {
      const event = started.tx.event;
      const eventMatches = event != null &&
        String(parseBigInt(eventStateValue(event, 0)) ?? "0") === started.gameId &&
        addrEq(eventStateValue(event, 1), started.playerHash) &&
        asNumber(eventStateValue(event, 2)) === difficulty;
      if (eventMatches) return true;

      const active = await readActiveGameId(started.playerHash);
      if (active !== started.gameId) return false;
      const game = await readGame(started.gameId);
      const rawStatus = asNumber(mapField(game, "status"));
      return gameMatchesIdentity(game, started.gameId, started.playerHash, difficulty) &&
        (rawStatus === 0 || rawStatus === 1);
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      const status = obs.gameStatus.get();
      if (!["idle", "solved", "expired", "refunded"].includes(status)) return;
      obs.gameDifficulty.set(difficultyInput(args[0]));
    });

    app.actions.register("connectWallet", async () => {
      if (app.mode.isGuest() || isConnectingWallet.get()) return;
      isConnectingWallet.set(true);
      try {
        await app.wallet.ensure();
        walletConnected.set(app.wallet.isConnected());
        // Connecting is terminal: hydrate identity and recovery state, but never
        // fall through into the paid start transaction in the same gesture.
        await Promise.all([refreshBalances(), refreshStats(), loadLeaderboard()]);
        await recoverCurrentGame(undefined, false);
        ctx.setStatus(ctx.t("walletConnected"), "success");
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isConnectingWallet.set(false);
      }
    });

    app.actions.register("startGame", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.startGame(difficultyInput(args[0])); return; }
      if (!NEW_PAID_RUNS_ENABLED) {
        ctx.setStatus(ctx.t("paidRunsUnavailable"), "info");
        return;
      }
      if (obs.isStarting.get() || obs.isDealing.get()) return;
      if (!app.wallet.isConnected()) {
        ctx.setStatus(ctx.t("connectWalletFirst"), "info");
        return;
      }
      const difficulty = difficultyInput(args[0]);
      let startedGameId = "0";
      obs.isStarting.set(true);
      obs.lastStatus.set("starting");
      try {
        const started = await startRewardGame(difficulty);
        startedGameId = started.gameId;
        if (!await startResultMatchesIntent(started, difficulty)) {
          throw new Error(ctx.t("statusStartPending"));
        }
        const gameId  = started.gameId;
        obs.activeGameId.set(gameId);
        obs.gameDifficulty.set(difficulty);
        obs.undosUsed.set(0);
        obs.commitment.set("");
        obs.lastElapsedMs.set(0);
        lastPayoutFixed8.set(0n);
        happinessAchieved.set(0);
        actionsUsed.set(0);
        actionHistory.set([]);
        ingredientCounts.set(emptyIngredientCounts());
        potionBrewed.set(false);
        inputSyncFailed.set(false);
        obs.gameStatus.set("committed");
        obs.lastStatus.set("started");
        await refreshBalances();
        await openSession(gameId, difficulty);
      } catch (error) {
        const recovered = await recoverCurrentGame(startedGameId, false);
        if (recovered) {
          ctx.setStatus(ctx.t("statusRecovered"), "info");
        } else {
          obs.lastStatus.set("failed");
          ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
        }
      } finally {
        obs.isStarting.set(false);
      }
    });

    app.actions.register("retryDeal", async () => {
      if (app.mode.isGuest()) { guest.retryDeal(); return; }
      const gameId = obs.activeGameId.get();
      if (!gameId || gameId === "0" || obs.isDealing.get()) return;
      await openSession(gameId, obs.gameDifficulty.get());
    });

    app.actions.register("recordAction", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.recordAction(args[0] as { type?: string } | undefined); return; }
      const op     = args[0] as TeeOp | undefined;
      const gameId = obs.activeGameId.get();
      if (
        isActing.get() ||
        inputSyncFailed.get() ||
        !op ||
        !(["feed", "play", "pet", "rest"] as string[]).includes(op.type) ||
        !gameId ||
        gameId === "0" ||
        !session ||
        obs.gameStatus.get() !== "dealt"
      ) return;
      if (
        actionsUsed.get() >= MAX_MOVES ||
        petHappiness.get() >= ruleOf(obs.gameDifficulty.get()).targetHappiness ||
        (obs.deadline.get() > 0 && Date.now() >= obs.deadline.get())
      ) return;
      isActing.set(true);
      try {
        const { step, opLog } = await rewardGame.recordOp(session, op);
        applyStepView(step.view);
        actionsUsed.set(opLog.length);
        const history = [...actionHistory.get(), op.type];
        actionHistory.set(history);
        ingredientCounts.set(ingredientCountsOf(history));
        inputSyncFailed.set(false);
        if (petHappiness.get() >= ruleOf(obs.gameDifficulty.get()).targetHappiness) {
          obs.lastStatus.set("all-correct");
        }
      } catch (error) {
        inputSyncFailed.set(true);
        obs.lastStatus.set("input-sync-failed");
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusInputSyncFailed")), "error");
      } finally {
        isActing.set(false);
      }
    });

    app.actions.register("brewPotion", async () => {
      if (app.mode.isGuest()) { guest.brewPotion(); return; }
      if (obs.gameStatus.get() !== "dealt" || potionBrewed.get()) return;
      const target = ruleOf(obs.gameDifficulty.get()).targetHappiness;
      if (petHappiness.get() < target) {
        ctx.setStatus(ctx.t("recipeNotReady"), "info");
        return;
      }
      // Presentation-only for historical recovery. The TEE settlement remains
      // authoritative and receives no invented client-side operation.
      potionBrewed.set(true);
      obs.lastStatus.set("potion-brewed");
    });

    app.actions.register("submitSolution", async () => {
      if (app.mode.isGuest()) { await guest.submitSolution(); return; }
      const gameId = obs.activeGameId.get();
      if (
        !gameId ||
        gameId === "0" ||
        obs.isSubmitting.get() ||
        isActing.get() ||
        obs.gameStatus.get() !== "dealt"
      ) return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      try {
        if (!session) await resumeSession(gameId, obs.gameDifficulty.get());
        if (!session) throw new Error(ctx.t("statusFailed"));
        const finalized = await finalizeRewardGame(session);
        const settled = finalized.settlement;
        session = null;
        if (settled.status === "unknown") {
          // Broadcast is not settlement. Retain the exact game id and op-log so
          // refresh/manual recovery can re-read this game without claiming a win.
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }

        const snapshot = await rewardGame.snapshot(gameId);
        if (snapshot.status === "unknown" || snapshot.status === "committed" || snapshot.status === "dealt") {
          obs.gameStatus.set("unknown");
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        // Finalization can have been broadcast before a timeout/error reached us.
        // Keep the run recoverable and never downgrade uncertainty to success.
        session = null;
        obs.gameStatus.set("unknown");
        obs.lastStatus.set("settlement-pending");
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
      if (!gameId || gameId === "0" || isRecovering.get()) return;
      if (!canExpireAfterGrace(obs.deadline.get())) {
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
          obs.lastStatus.set("settlement-pending");
          ctx.setStatus(ctx.t("statusSettlementPending"), "info");
          return;
        }
        await finishFromSnapshot(gameId, snapshot);
      } catch (error) {
        ctx.setStatus(app.errors.messageOf(error, ctx.t("statusFailed")), "error");
      } finally {
        isRecovering.set(false);
      }
    });

    const withdrawOp = app.operations.create("withdrawWinnings");
    app.actions.register("withdrawWinnings", async () => {
      if (app.mode.isGuest()) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (obs.credit.get() <= 0) { ctx.setStatus(ctx.t("noCreditToWithdraw"), "info"); return; }
      if (!app.wallet.isConnected()) { ctx.setStatus(ctx.t("connectWalletFirst"), "info"); return; }
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
      await Promise.all([loadLeaderboard(), refreshStats()]);
    });

    // ── State returned to PlayArea ────────────────────────────────────────────
    return {
      state: {
        ...obs,
        actionsUsed, happinessAchieved,
        petHappiness, petHunger, petEnergy, petStage,
        actionHistory, ingredientCounts, potionBrewed,
        lastPayoutFixed8, appMode, inputSyncFailed, newPaidRunsEnabled,
        isActing, isRecovering, isConnectingWallet, walletConnected,
      },
      loadData: async () => {
        // Guest is a purely local game: skip every mount-time chain read (the
        // guest engine's enter() already staged a clean local lobby + board).
        if (app.mode.isGuest()) { await guest.enter(); return; }
        await refreshBalances();
        await recoverCurrentGame(undefined, false);
        await Promise.all([refreshStats(), loadLeaderboard()]);
        if (obs.gameStatus.get() === "idle") obs.lastStatus.set("");
      },
      cleanup: () => {
        stopWalletSync();
        stopModeSync();
      },
    };
  },
});
