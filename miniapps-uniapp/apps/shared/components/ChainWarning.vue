<template>
  <view v-if="showWarning" class="chain-warning mb-4 px-4" role="alert" aria-live="assertive">
    <NeoCard variant="danger">
      <view class="flex flex-col items-center gap-2 py-1">
        <text class="text-center font-bold text-red-400">{{ title }}</text>
        <text v-if="message" class="text-center text-xs text-white opacity-80">{{ message }}</text>
        <NeoButton size="sm" variant="secondary" class="mt-2" :loading="isLoading" @click="handleSwitch">
          {{ buttonText }}
        </NeoButton>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard, NeoButton } from ".";
import { useChainValidation } from "../composables/useChainValidation";

/**
 * ChainWarning Component
 *
 * Displays a warning when the user is connected to the wrong chain
 * and provides a button to switch to the correct chain.
 *
 * @example
 * ```ts
 * // In your component:
 * // <ChainWarning
 * //   :title="t('wrongChain')"
 * //   :message="t('wrongChainMessage')"
 * //   :button-text="t('switchToNeo')"
 * // />
 * ```
 */

interface Props {
  /** Title text for the warning */
  title?: string;
  /** Optional detailed message */
  message?: string;
  /** Button text */
  buttonText?: string;
  /** Whether to show the warning (auto-detected from chain if not provided) */
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Wrong Network",
  message: "Switch to Neo N3 Mainnet to continue.",
  buttonText: "Switch Network",
  show: undefined,
});

const emit = defineEmits<{
  (e: "switch"): void;
  (e: "switch-complete"): void;
  (e: "switch-error", error: Error): void;
}>();

const { showWarning: autoShowWarning, switchToAppChain } = useChainValidation();

const isLoading = ref(false);

const showWarning = computed(() => {
  return props.show !== undefined ? props.show : autoShowWarning.value;
});

const handleSwitch = async () => {
  if (isLoading.value) return;

  isLoading.value = true;
  emit("switch");

  try {
    await switchToAppChain();
    emit("switch-complete");
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    emit("switch-error", err);
    console.error("[ChainWarning] Failed to switch chain:", err);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.chain-warning {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chain-warning {
    animation: none;
  }
}
</style>
