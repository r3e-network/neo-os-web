import { computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";

/**
 * Chain validation composable for miniapps
 *
 * Provides a standardized way to handle chain type validation
 * and display warnings when the wrong chain is connected.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useChainValidation } from "@shared/composables/useChainValidation";
 *
 * const { showWarning, switchToAppChain } = useChainValidation();
 * </script>
 *
 * <template>
 *   <ChainWarning v-if="showWarning" @switch="switchToAppChain" />
 * </template>
 * ```
 */
export function useChainValidation() {
  const { switchToAppChain: _switchToAppChain } = useWallet();

  /**
   * Whether to show the wrong chain warning
   * Neo N3-only platform: no additional warning needed
   */
  const showWarning = computed(() => {
    return false;
  });

  /**
   * Switch to the app's required chain (Neo N3)
   */
  const switchToAppChain = async () => {
    try {
      await _switchToAppChain();
    } catch (error) {
      console.error("[useChainValidation] Failed to switch chain:", error);
      throw error;
    }
  };

  return {
    showWarning,
    switchToAppChain,
  };
}

/**
 * Type guard for checking if current chain is non-N3
 *
 * @example
 * ```ts
 * if (isEvmChain(chainType)) {
 *   // Handle unsupported chain case
 * }
 * ```
 */
export function isEvmChain(chainType: unknown): boolean {
  void chainType;
  return false;
}

/**
 * Check if Neo N3 chain is connected
 * Returns true when running on Neo N3 networks
 *
 * @example
 * ```ts
 * if (requireNeoChain(chainType)) {
 *   // Safe to proceed with Neo operations
 * }
 * ```
 */
export function requireNeoChain(chainType: unknown): boolean {
  void chainType;
  return true;
}
