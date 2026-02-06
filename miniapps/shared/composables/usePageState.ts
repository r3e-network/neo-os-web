/**
 * Standard Page State Composable
 *
 * Provides common state management for page components including
 * loading state, error handling, and tab navigation.
 *
 * @example
 * ```ts
 * const { isLoading, error, activeTab, setError, clearError } = usePageState({ defaultTab: "game" });
 * ```
 */

import { ref } from "vue";

export interface PageStateOptions {
  /** Default active tab */
  defaultTab?: string;
}

export function usePageState(options: PageStateOptions = {}) {
  const { defaultTab = "main" } = options;

  // State
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const activeTab = ref(defaultTab);

  // Actions
  const setLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setError = (msg: string | null) => {
    error.value = msg;
  };

  const clearError = () => {
    error.value = null;
  };

  const switchTab = (tabId: string) => {
    activeTab.value = tabId;
  };

  return {
    /** Loading state */
    isLoading,
    /** Error message */
    error,
    /** Current active tab */
    activeTab,
    /** Set loading state */
    setLoading,
    /** Set error message */
    setError,
    /** Clear error message */
    clearError,
    /** Switch to a different tab */
    switchTab,
  };
}
