import { ref, computed } from "vue";
import type { Turtle } from "./useTurtleMatch";
import { sleep } from "@shared/utils/format";

// Animation states
export type AnimationState = 
  | "idle"
  | "opening"
  | "revealing"
  | "moving"
  | "matching"
  | "celebrating"
  | "filling";

// Animation timing (ms)
export const TIMING = {
  BLINDBOX_OPEN: 1500,
  TURTLE_REVEAL: 800,
  MOVE_TO_GRID: 600,
  MATCH_CHECK: 300,
  MATCH_CELEBRATE: 1200,
  FILL_GRID: 500,
  DELAY_BETWEEN: 200,
};

export function useTurtleAnimation() {
  const state = ref<AnimationState>("idle");
  const revealedTurtle = ref<Turtle | null>(null);
  const matchedPair = ref<[Turtle, Turtle] | null>(null);
  const reward = ref<bigint>(BigInt(0));
  const isPlaying = ref(false);

  const isAnimating = computed(() => state.value !== "idle");

  async function playOpenAnimation() {
    state.value = "opening";
    await sleep(TIMING.BLINDBOX_OPEN);
  }

  async function playRevealAnimation(turtle: Turtle) {
    revealedTurtle.value = turtle;
    state.value = "revealing";
    await sleep(TIMING.TURTLE_REVEAL);
  }

  async function playMoveAnimation() {
    state.value = "moving";
    await sleep(TIMING.MOVE_TO_GRID);
  }

  async function playMatchAnimation(t1: Turtle, t2: Turtle, amount: bigint) {
    matchedPair.value = [t1, t2];
    reward.value = amount;
    state.value = "matching";
    await sleep(TIMING.MATCH_CHECK);
    state.value = "celebrating";
    await sleep(TIMING.MATCH_CELEBRATE);
    matchedPair.value = null;
    reward.value = BigInt(0);
  }

  async function playFillAnimation() {
    state.value = "filling";
    await sleep(TIMING.FILL_GRID);
  }

  function reset() {
    state.value = "idle";
    revealedTurtle.value = null;
    matchedPair.value = null;
    reward.value = BigInt(0);
    isPlaying.value = false;
  }

  return {
    // State
    state,
    revealedTurtle,
    matchedPair,
    reward,
    isPlaying,
    
    // Computed
    isAnimating,
    
    // Methods
    playOpenAnimation,
    playRevealAnimation,
    playMoveAnimation,
    playMatchAnimation,
    playFillAnimation,
    reset,
    
    // Constants
    TIMING,
  };
}
