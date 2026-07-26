/**
 * Guest (free / local) engine for Pet Potion.
 *
 * Guest mode is a purely LOCAL pet-care game: the pet starts from the same
 * public deterministic stats as the reviewed Morpheus engine, every care
 * action is resolved by matching local rules, and the run is
 * scored entirely client-side and (optionally) submitted to the OFF-CHAIN guest
 * leaderboard. The engine drives the SAME observables + dispatch actions the
 * Phaser scene reads (gameStatus / petHappiness / petHunger / petEnergy /
 * petStage / happinessAchieved / actionsUsed / lastStatus / …), so the frozen
 * scene contract is reused verbatim. It NEVER makes a chain, oracle, or reward
 * call — the framework guest guard therefore never fires.
 *
 * The care model is a small, self-contained resource loop that reuses the
 * difficulty tiers, action set, evolution stages, recipe, and move cap from
 * `game-rules`: balance satiety and energy, collect every care essence, raise
 * happiness, brew the potion, and save it — without any chain or TEE call.
 */
import type { GameSessionObservables, LeaderEntry, SolveRow } from "@framework/game";
import {
  ACTION_NAMES,
  MAX_MOVES,
  emptyIngredientCounts,
  ingredientCountsOf,
  recipeReady,
  ruleOf,
  evolutionStage,
  type DifficultyRule,
  type IngredientCounts,
} from "./game-rules";
import { clampDifficulty } from "@framework/game-rules";
import type { Observable as Obs } from "@framework/reactive";
import type { FrameworkGuestLeaderboard as GuestLeaderboardApi } from "@framework/types";
import { newPet, stepPet, type PetAction, type PetStats } from "./pet-engine";

interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  actionsUsed: Obs<number>;
  happinessAchieved: Obs<number>;
  petHappiness: Obs<number>;
  petHunger: Obs<number>;
  petEnergy: Obs<number>;
  petStage: Obs<number>;
  actionHistory: Obs<string[]>;
  ingredientCounts: Obs<IngredientCounts>;
  potionBrewed: Obs<boolean>;
  lastPayoutFixed8: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  storage: LocalStore;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordAction(op: { type?: string } | undefined): void;
  brewPotion(): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";
const GUEST_PROFILE_KEY = "guest:profile";
const GUEST_ACTIVE_RUN_KEY = "guest:pet-potion:active-run:v1";

interface GuestProfile {
  bestHappiness: number;
  solves: number;
  history: SolveRow[];
}

interface PersistedGuestRun {
  difficulty?: unknown;
  dealtAt?: unknown;
  deadline?: unknown;
  actions?: unknown;
  potionBrewed?: unknown;
}

function nonNegativeInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function validHistory(value: unknown): SolveRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const gameId = typeof row.gameId === "string" ? row.gameId : "";
    if (!gameId.startsWith("guest-")) return [];
    return [{
      gameId,
      difficulty: clampDifficulty(Number(row.difficulty)),
      payout: "0 GAS",
      solveMs: nonNegativeInt(row.solveMs),
      undos: 0,
      bestHappiness: clampStat(Number(row.bestHappiness) || 0),
      actions: Math.min(MAX_MOVES, nonNegativeInt(row.actions)),
      won: row.won === true,
    } satisfies SolveRow];
  }).slice(0, 20);
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Matches the reviewed Morpheus pet engine's deterministic starting state. */
function seedStats(): PetStats {
  return newPet();
}

/** Resolve exactly the same care deltas as engines/pet.js (hunger means satiety). */
export function applyCare(stats: PetStats, action: string): PetStats {
  if (!(["feed", "play", "pet", "rest"] as string[]).includes(action)) return stats;
  return stepPet(stats, action as PetAction);
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
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
    storage,
    t,
    setStatus,
  } = deps;

  const loadProfile = (): GuestProfile => {
    try {
      const raw = storage.get<Partial<GuestProfile>>(GUEST_PROFILE_KEY, {});
      return {
        bestHappiness: clampStat(Number(raw?.bestHappiness) || 0),
        solves: Math.max(0, Math.floor(Number(raw?.solves) || 0)),
        history: validHistory(raw?.history),
      };
    } catch {
      return { bestHappiness: 0, solves: 0, history: [] };
    }
  };

  const saveProfile = (profile: GuestProfile): void => {
    try {
      storage.set(GUEST_PROFILE_KEY, profile);
    } catch {
      // Local storage policy/quota failures never block the care loop.
    }
  };

  const currentStats = (): PetStats => ({
    happiness: petHappiness.get(),
    hunger: petHunger.get(),
    energy: petEnergy.get(),
  });

  const publishStats = (stats: PetStats): void => {
    const happy = clampStat(stats.happiness);
    petHappiness.set(happy);
    petHunger.set(clampStat(stats.hunger));
    petEnergy.set(clampStat(stats.energy));
    petStage.set(evolutionStage(happy));
    happinessAchieved.set(Math.max(happinessAchieved.get(), happy));
  };

  const clearActiveRun = (): void => {
    try {
      storage.delete(GUEST_ACTIVE_RUN_KEY);
    } catch {
      // A terminal local run is already safe in memory.
    }
  };

  const saveActiveRun = (): void => {
    if (obs.gameStatus.get() !== "dealt") return;
    try {
      storage.set(GUEST_ACTIVE_RUN_KEY, {
        difficulty: obs.gameDifficulty.get(),
        dealtAt: obs.dealtAt.get(),
        deadline: obs.deadline.get(),
        actions: actionHistory.get(),
        potionBrewed: potionBrewed.get(),
      });
    } catch {
      // Private browsing or quota failures must not stop care interactions.
    }
  };

  const restoreActiveRun = (): boolean => {
    try {
      const raw = storage.get<PersistedGuestRun>(GUEST_ACTIVE_RUN_KEY, null);
      if (!raw) return false;
      const dealtAt = nonNegativeInt(raw.dealtAt);
      const deadline = nonNegativeInt(raw.deadline);
      const difficulty = clampDifficulty(Number(raw.difficulty));
      const actions = Array.isArray(raw.actions)
        ? raw.actions.filter((value): value is string =>
            typeof value === "string" && (ACTION_NAMES as readonly string[]).includes(value),
          ).slice(0, MAX_MOVES)
        : [];
      if (dealtAt <= 0 || deadline <= dealtAt || actions.length !== (raw.actions as unknown[])?.length) {
        clearActiveRun();
        return false;
      }

      let stats = seedStats();
      for (const action of actions) stats = applyCare(stats, action);
      const counts = ingredientCountsOf(actions);
      const target = ruleOf(difficulty).targetHappiness;
      const brewed = raw.potionBrewed === true
        && stats.happiness >= target
        && recipeReady(counts);

      obs.gameDifficulty.set(difficulty);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.dealtAt.set(dealtAt);
      obs.deadline.set(deadline);
      actionsUsed.set(actions.length);
      actionHistory.set(actions);
      ingredientCounts.set(counts);
      potionBrewed.set(brewed);
      happinessAchieved.set(stats.happiness);
      publishStats(stats);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set(t("guestRunRecovered"));
      return true;
    } catch {
      clearActiveRun();
      return false;
    }
  };

  const resetToLobby = (): void => {
    obs.isStarting.set(false);
    obs.isDealing.set(false);
    obs.isSubmitting.set(false);
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.lastStatus.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.commitment.set("");
    actionsUsed.set(0);
    actionHistory.set([]);
    ingredientCounts.set(emptyIngredientCounts());
    potionBrewed.set(false);
    happinessAchieved.set(0);
    lastPayoutFixed8.set(0n);
    petHappiness.set(50);
    petHunger.set(50);
    petEnergy.set(50);
    petStage.set(0);
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
    }
  };

  const refreshLeaderboard = async (): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const ranked: LeaderEntry[] = rows
        .map((row) => ({ address: row.user, score: Number(row.score) || 0 }))
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({
          rank: index + 1,
          address: row.address,
          totalWon: row.score,
          solves: 1,
          isUser: false,
        }));
      obs.leaderboard.set(ranked);
    } catch {
      obs.leaderboard.set([]);
    }
  };

  return {
    startGame(difficulty: number): void {
      if (obs.isStarting.get() || obs.gameStatus.get() === "dealt") return;
      const diff = clampDifficulty(difficulty);
      const rule: DifficultyRule = ruleOf(diff);
      obs.isStarting.set(true);
      obs.lastStatus.set("starting");
      obs.gameDifficulty.set(diff);
      obs.activeGameId.set(GUEST_GAME_ID);
      obs.commitment.set("");
      obs.undosUsed.set(0);
      actionsUsed.set(0);
      actionHistory.set([]);
      ingredientCounts.set(emptyIngredientCounts());
      potionBrewed.set(false);
      happinessAchieved.set(0);
      lastPayoutFixed8.set(0n);
      publishStats(seedStats());
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set("dealt");
      saveActiveRun();
      obs.isStarting.set(false);
    },

    recordAction(op): void {
      const type = op?.type;
      if (!type || !(ACTION_NAMES as readonly string[]).includes(type)) return;
      if (obs.gameStatus.get() !== "dealt") return;
      if (actionsUsed.get() >= MAX_MOVES) return;
      const deadline = obs.deadline.get();
      if (deadline > 0 && Date.now() >= deadline) return; // run timed out
      publishStats(applyCare(currentStats(), type));
      actionsUsed.set(actionsUsed.get() + 1);
      const history = [...actionHistory.get(), type];
      actionHistory.set(history);
      ingredientCounts.set(ingredientCountsOf(history));
      const target = ruleOf(obs.gameDifficulty.get()).targetHappiness;
      if (petHappiness.get() >= target) {
        obs.lastStatus.set(recipeReady(ingredientCounts.get()) ? "recipe-ready" : "target-ready");
      }
      saveActiveRun();
    },

    brewPotion(): void {
      if (obs.gameStatus.get() !== "dealt" || potionBrewed.get()) return;
      const target = ruleOf(obs.gameDifficulty.get()).targetHappiness;
      if (petHappiness.get() < target || !recipeReady(ingredientCounts.get())) {
        setStatus(t("recipeNotReady"), "info");
        return;
      }
      potionBrewed.set(true);
      obs.lastStatus.set("potion-brewed");
      saveActiveRun();
      setStatus(t("potionBrewedStatus"), "success");
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.isSubmitting.get()) return;
      const target = ruleOf(obs.gameDifficulty.get()).targetHappiness;
      const timedOut = obs.deadline.get() > 0 && Date.now() >= obs.deadline.get();
      const moveCapReached = actionsUsed.get() >= MAX_MOVES;
      if (!timedOut && !moveCapReached && (!potionBrewed.get() || petHappiness.get() < target)) {
        setStatus(t("recipeNotReady"), "info");
        return;
      }
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      const achieved = Math.max(happinessAchieved.get(), petHappiness.get());
      const won = !timedOut && potionBrewed.get() && achieved >= target;
      const profile = loadProfile();
      const nextProfile = {
        bestHappiness: Math.max(profile.bestHappiness, achieved),
        solves: profile.solves + (won ? 1 : 0),
        history: [{
          gameId: `guest-${Date.now()}`,
          difficulty: obs.gameDifficulty.get(),
          payout: "0 GAS",
          solveMs: Math.max(0, Date.now() - obs.dealtAt.get()),
          undos: 0,
          bestHappiness: achieved,
          actions: actionsUsed.get(),
          won,
        }, ...profile.history].slice(0, 20),
      };
      saveProfile(nextProfile);
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      lastPayoutFixed8.set(0n);
      happinessAchieved.set(achieved);
      obs.activeGameId.set("0");
      clearActiveRun();
      obs.gameStatus.set(won ? "solved" : "expired");
      obs.lastStatus.set(won ? "solved" : "expired");
      obs.mySolves.set(nextProfile.solves);
      obs.myTotalWon.set(nextProfile.bestHappiness);
      obs.myHistory.set(nextProfile.history);
      // Only a fully brewed, on-time potion is eligible for the public guest
      // board. An expired attempt may still update device-local progress.
      if (won) await submitScore(achieved);
      await refreshLeaderboard();
      setStatus(
        t(won ? "guestRunComplete" : "guestRunExpired", { happiness: achieved }),
        won ? "success" : "info",
      );
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
      clearActiveRun();
      resetToLobby();
    },

    retryDeal(): void {
      /* guest deals instantly — nothing to re-request. */
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      resetToLobby();
      // Guest never reads the chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      obs.credit.set(0);
      obs.poolFree.set(0);
      obs.myRank.set(0);
      const profile = loadProfile();
      obs.myTotalWon.set(profile.bestHappiness);
      obs.mySolves.set(profile.solves);
      obs.myHistory.set(profile.history);
      if (!restoreActiveRun()) obs.lastStatus.set(t("statusReady"));
      await refreshLeaderboard();
    },
  };
}
