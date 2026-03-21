<template>
  <div v-if="hasError" class="error-boundary" role="alert">
    <div class="error-container">
      <span class="error-icon" aria-hidden="true">⚠️</span>
      <span class="error-title">{{ i18nT("errorTitle") }}</span>
      <span class="error-message">{{ errorMessage }}</span>
      <div class="error-actions">
        <NeoButton variant="primary" type="button" @click="handleRetry" :aria-label="i18nT('retry')">
          {{ i18nT("retry") }}
        </NeoButton>
        <NeoButton variant="secondary" type="button" @click="handleReset" :aria-label="i18nT('reset')">
          {{ i18nT("reset") }}
        </NeoButton>
      </div>
      <div v-if="showDetails" class="error-details">
        <span class="error-stack">{{ error?.stack || error?.message }}</span>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";
import NeoButton from "./NeoButton.vue";
import { useI18n } from "@shared/composables/useI18n";

interface Props {
  showDetails?: boolean;
  onError?: (error: Error) => void;
  fallback?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false,
});

const emit = defineEmits<{
  retry: [];
  reset: [];
  error: [error: Error];
}>();

const { t: i18nT } = useI18n()();

const hasError = ref(false);
const error = ref<Error | null>(null);
const errorMessage = ref("");

onErrorCaptured((err: unknown) => {
  const capturedError = err instanceof Error ? err : new Error(String(err));

  error.value = capturedError;
  errorMessage.value = props.fallback || capturedError.message || i18nT("unexpectedError");
  hasError.value = true;

  // Report to parent
  emit("error", capturedError);
  props.onError?.(capturedError);

  // Prevent error from propagating
  return false;
});

const handleRetry = () => {
  hasError.value = false;
  error.value = null;
  emit("retry");
};

const handleReset = () => {
  hasError.value = false;
  error.value = null;
  errorMessage.value = "";
  emit("reset");
};

// Allow manual error setting
const setError = (err: Error | string) => {
  const errorObj = err instanceof Error ? err : new Error(err);
  error.value = errorObj;
  errorMessage.value = errorObj.message;
  hasError.value = true;
  emit("error", errorObj);
};

// Expose methods for parent
defineExpose({
  setError,
  clearError: handleReset,
});
</script>

<style scoped lang="scss">
@use "../styles/tokens.scss" as *;

.error-boundary {
  padding: $spacing-6;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary, #f5f5f5);
}

.error-container {
  max-width: 480px;
  width: 100%;
  text-align: center;
  background: var(--surface-primary, white);
  border-radius: $spacing-4;
  padding: $spacing-8;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

.error-icon {
  font-size: $spacing-12;
  margin-bottom: $spacing-4;
  display: block;
}

.error-title {
  font-size: $spacing-6;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: $spacing-3;
  display: block;
}

.error-message {
  font-size: $spacing-4;
  color: var(--text-secondary, #666);
  margin-bottom: $spacing-6;
  display: block;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: $spacing-3;
  justify-content: center;
  margin-bottom: $spacing-4;
}

.error-details {
  margin-top: $spacing-4;
  padding: $spacing-4;
  background: var(--bg-secondary, #f0f0f0);
  border-radius: $spacing-2;
  text-align: left;
}

.error-stack {
  font-family: monospace;
  font-size: $font-size-xs;
  color: var(--text-secondary, #666);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
