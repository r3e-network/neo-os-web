export const ACTIONS = ["feed", "play", "pet", "rest"] as const;
export const ACTION_INDEX = {
  feed: 0,
  play: 1,
  pet: 2,
  rest: 3,
} as const;
export const MIN_ACTION_GAP_MS = 1500;

export type PetAction = (typeof ACTIONS)[number];
export interface PetStats {
  happiness: number;
  hunger: number;
  energy: number;
}

const START: PetStats = { happiness: 20, hunger: 40, energy: 60 };

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function newPet(): PetStats {
  return { ...START };
}

export function stageOf(happiness: number): number {
  if (happiness >= 60) return 2;
  if (happiness >= 30) return 1;
  return 0;
}

export function stepPet(state: PetStats, action: PetAction | number): PetStats {
  const name = typeof action === "number" ? ACTIONS[action] : action;
  const next = { ...state };
  switch (name) {
    case "feed": {
      const hungerGap = 100 - next.hunger;
      next.happiness = clamp(next.happiness + Math.min(8, Math.round(hungerGap / 8)));
      next.hunger = clamp(next.hunger + 30);
      break;
    }
    case "play": {
      const canPlay = Math.min(next.hunger, next.energy);
      const gain = canPlay >= 20 ? 12 : Math.round(canPlay / 4);
      next.happiness = clamp(next.happiness + gain);
      next.hunger = clamp(next.hunger - 20);
      next.energy = clamp(next.energy - 20);
      break;
    }
    case "pet":
      next.happiness = clamp(next.happiness + 4);
      next.energy = clamp(next.energy - 3);
      break;
    case "rest":
      next.energy = clamp(next.energy + 30);
      next.happiness = clamp(next.happiness + 2);
      next.hunger = clamp(next.hunger - 10);
      break;
    default:
      throw new Error("unknown pet action");
  }
  return next;
}

export function replayPet(actions: readonly (PetAction | number)[]): {
  happiness: number;
  peak: number;
  state: PetStats;
} {
  let state = newPet();
  let peak = state.happiness;
  for (const action of actions) {
    state = stepPet(state, action);
    peak = Math.max(peak, state.happiness);
  }
  return { happiness: state.happiness, peak, state };
}

export function petAnswer(peak: number, actions: readonly (PetAction | number)[]): string {
  const encoded = actions
    .map((action) => (typeof action === "number" ? action : ACTION_INDEX[action]))
    .join("");
  return `pet:${peak}:${encoded}`;
}
