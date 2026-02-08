import { reactive } from "vue";

/**
 * Template State Composable
 *
 * Generic reactive state manager that MiniAppTemplate binds to
 * for stat display and other template-driven data.
 *
 * @example
 * ```ts
 * const { state, update } = useTemplateState({
 *   totalGames: 0,
 *   wins: 0,
 *   winRate: "0%",
 * });
 *
 * // Update after game result
 * update({ totalGames: state.totalGames + 1, wins: state.wins + 1 });
 * ```
 */
export function useTemplateState<T extends Record<string, unknown>>(initial: T) {
  const state = reactive({ ...initial }) as T;

  /** Merge partial updates into state */
  const update = (patch: Partial<T>) => {
    Object.assign(state, patch);
  };

  /** Reset state to initial values */
  const reset = () => {
    Object.assign(state, initial);
  };

  return { state, update, reset };
}
