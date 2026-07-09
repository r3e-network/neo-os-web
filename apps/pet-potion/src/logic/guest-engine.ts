/**
 * Guest (free / local) engine for Pet Potion.
 *
 * Guest mode is a purely LOCAL pet-care game: the pet's initial stats are
 * generated with the Web-Crypto RNG (the local analog of the enclave seed),
 * every care action is resolved by a local rules simulation, and the run is
 * scored entirely client-side and (optionally) submitted to the OFF-CHAIN guest
 * leaderboard. The engine drives the SAME observables + dispatch actions the
 * Phaser scene reads (gameStatus / petHappiness / petHunger / petEnergy /
 * petStage / happinessAchieved / actionsUsed / lastStatus / …), so the frozen
 * scene contract is reused verbatim. It NEVER makes a chain, oracle, or reward
 * call — the framework guest guard therefore never fires.
 *
 * The care model is a small, self-contained resource loop that reuses the
 * difficulty tiers, action set, evolution stages, and move cap from the shared
 * `game-rules` module: raise happiness to the target by feeding, playing,
 * petting, and resting — but a starving or exhausted pet is harder to please,
 * so you have to balance every care action just like a reward run minus the
 * chain.
 */
import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import { MAX_MOVES, ruleOf, evolutionStage, type DifficultyRule } from "./game-rules";

/** Structural (method-syntax, so bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
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
  lastPayoutFixed8: Obs<bigint>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startGame(difficulty: number): void;
  recordAction(op: { type?: string } | undefined): void;
  submitSolution(): Promise<void>;
  expireGame(): void;
  retryDeal(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
}

const GUEST_GAME_ID = "guest";

type PetStats = { happiness: number; hunger: number; energy: number };

/** Per-action stat deltas for the local care simulation (0 = full, 100 = starving hunger). */
const CARE_EFFECTS: Record<string, PetStats> = {
  feed: { happiness: 4, hunger: -24, energy: 3 },
  play: { happiness: 16, hunger: 10, energy: -16 },
  pet: { happiness: 9, hunger: 6, energy: -6 },
  rest: { happiness: 2, hunger: 7, energy: 24 },
};

/** A starving pet is hard to please: hunger at/above this halves happiness gains. */
const HUNGER_DAMPEN_AT = 70;
/** An exhausted pet is hard to please: energy at/below this halves happiness gains. */
const ENERGY_DAMPEN_AT = 25;

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Uniform integer in [0, maxExclusive) from Web-Crypto (Math.random fallback). */
function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    webCrypto.getRandomValues(buffer);
    return (buffer[0] ?? 0) % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** Secret initial pet stats — happiness sits below every tier target so the run is a real climb. */
function seedStats(): PetStats {
  return {
    happiness: 28 + randomInt(14), // 28..41
    hunger: 42 + randomInt(22), // 42..63
    energy: 40 + randomInt(22), // 40..61
  };
}

/** Resolve one care action locally: coupled stat deltas + a wellbeing dampener on happiness. */
export function applyCare(stats: PetStats, action: string): PetStats {
  const effect = CARE_EFFECTS[action];
  if (!effect) return stats;
  let happinessDelta = effect.happiness;
  if (happinessDelta > 0) {
    if (stats.hunger >= HUNGER_DAMPEN_AT) happinessDelta = Math.round(happinessDelta * 0.5);
    if (stats.energy <= ENERGY_DAMPEN_AT) happinessDelta = Math.round(happinessDelta * 0.5);
  }
  return {
    happiness: clampStat(stats.happiness + happinessDelta),
    hunger: clampStat(stats.hunger + effect.hunger),
    energy: clampStat(stats.energy + effect.energy),
  };
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
    lastPayoutFixed8,
    guestLeaderboard,
    t,
    setStatus,
  } = deps;

  // Session-scoped guest record (never touches the chain).
  let guestBestHappiness = 0;
  let runsSolved = 0;

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

  const resetToLobby = (): void => {
    obs.gameStatus.set("idle");
    obs.activeGameId.set("0");
    obs.lastStatus.set("");
    obs.deadline.set(0);
    obs.dealtAt.set(0);
    obs.undosUsed.set(0);
    obs.commitment.set("");
    actionsUsed.set(0);
    actionHistory.set([]);
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
      happinessAchieved.set(0);
      lastPayoutFixed8.set(0n);
      publishStats(seedStats());
      const now = Date.now();
      obs.dealtAt.set(now);
      obs.deadline.set(now + rule.limitMs);
      obs.gameStatus.set("dealt");
      obs.lastStatus.set("dealt");
      obs.isStarting.set(false);
    },

    recordAction(op): void {
      const type = op?.type;
      if (!type || !CARE_EFFECTS[type]) return;
      if (obs.gameStatus.get() !== "dealt") return;
      if (actionsUsed.get() >= MAX_MOVES) return;
      const deadline = obs.deadline.get();
      if (deadline > 0 && Date.now() >= deadline) return; // run timed out
      publishStats(applyCare(currentStats(), type));
      actionsUsed.set(actionsUsed.get() + 1);
      actionHistory.set([...actionHistory.get(), type]);
      const target = ruleOf(obs.gameDifficulty.get()).targetHappiness;
      if (petHappiness.get() >= target) obs.lastStatus.set("all-correct");
    },

    async submitSolution(): Promise<void> {
      if (obs.gameStatus.get() !== "dealt") return;
      if (obs.isSubmitting.get()) return;
      obs.isSubmitting.set(true);
      obs.lastStatus.set("submitting");
      const achieved = Math.max(happinessAchieved.get(), petHappiness.get());
      const target = ruleOf(obs.gameDifficulty.get()).targetHappiness;
      const won = achieved >= target;
      obs.lastElapsedMs.set(Math.max(0, Date.now() - obs.dealtAt.get()));
      lastPayoutFixed8.set(0n);
      happinessAchieved.set(achieved);
      obs.activeGameId.set("0");
      obs.gameStatus.set(won ? "solved" : "expired");
      obs.lastStatus.set(won ? "solved" : "expired");
      if (won) {
        runsSolved += 1;
        obs.mySolves.set(runsSolved);
      }
      guestBestHappiness = Math.max(guestBestHappiness, achieved);
      obs.myTotalWon.set(guestBestHappiness);
      await submitScore(achieved);
      await refreshLeaderboard();
      setStatus(t("guestRunComplete", { happiness: achieved }), won ? "success" : "info");
      obs.isSubmitting.set(false);
    },

    expireGame(): void {
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
      obs.myTotalWon.set(guestBestHappiness);
      obs.mySolves.set(runsSolved);
      obs.myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
