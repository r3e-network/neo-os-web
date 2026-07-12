export type CoinSide = "heads" | "tails";

export const FOGPLAY_COIN_PHASES = ["launch", "flip", "land", "result"] as const;
export type CoinMotionPhase = "idle" | (typeof FOGPLAY_COIN_PHASES)[number];

/** Map the wager result to the physical face that must be visible after landing. */
export function landedSide(choice: CoinSide, result: string): CoinSide {
  if (result === "lost") return choice === "heads" ? "tails" : "heads";
  return choice;
}

/**
 * Monotonic token used by Scene tween/timer callbacks. Starting or cancelling a
 * motion invalidates every callback captured by an older generation.
 */
export class CoinMotionGeneration {
  private value = 0;

  begin(): number {
    this.value += 1;
    return this.value;
  }

  cancel(): void {
    this.value += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.value;
  }
}
