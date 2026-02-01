/**
 * Game State Composable
 *
 * Provides standard game state management for game-like miniapps
 * (coin-flip, lottery, etc.) with statistics tracking.
 *
 * @example
 * ```ts
 * const { wins, losses, winRate, recordWin, recordLoss, reset } = useGameState();
 * ```
 */

import { ref, computed, type Ref } from "vue";
import type { GameState as GameStateType } from "@neo/types";

export interface GameStateOptions {
  /** Initial win count */
  initialWins?: number;
  /** Initial loss count */
  initialLosses?: number;
}

/** Reactive game state interface for Vue composables */
export interface GameState extends Omit<
  GameStateType,
  "wins" | "losses" | "totalGames" | "winRate"
> {
  /** Number of wins (reactive) */
  wins: Ref<number>;
  /** Number of losses (reactive) */
  losses: Ref<number>;
  /** Win percentage (0-100) (reactive) */
  winRate: Ref<number>;
  /** Total games played (reactive) */
  totalGames: Ref<number>;
  /** Record a win */
  recordWin: (amount?: number) => void;
  /** Record a loss */
  recordLoss: (amount?: number) => void;
  /** Reset all stats */
  reset: () => void;
}

export function useGameState(options: GameStateOptions = {}): GameState {
  const { initialWins = 0, initialLosses = 0 } = options;

  const wins = ref(initialWins);
  const losses = ref(initialLosses);

  const totalGames = computed(() => wins.value + losses.value);

  const winRate = computed(() => {
    if (totalGames.value === 0) return 0;
    return Math.round((wins.value / totalGames.value) * 100);
  });

  const recordWin = (amount?: number) => {
    wins.value++;
    // Could track total amount won
  };

  const recordLoss = (amount?: number) => {
    losses.value++;
    // Could track total amount lost
  };

  const reset = () => {
    wins.value = 0;
    losses.value = 0;
  };

  return {
    wins,
    losses,
    winRate,
    totalGames,
    recordWin,
    recordLoss,
    reset,
  };
}
