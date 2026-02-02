<template>
  <view v-if="hasError" class="error-boundary">
    <view class="error-container">
      <text class="error-icon">⚠️</text>
      <text class="error-title">{{ t('errorTitle') || 'Something went wrong' }}</text>
      <text class="error-message">{{ errorMessage }}</text>
      <view class="error-actions">
        <NeoButton variant="primary" @click="handleRetry">
          {{ t('retry') || 'Try Again' }}
        </NeoButton>
        <NeoButton variant="secondary" @click="handleReset">
          {{ t('reset') || 'Reset' }}
        </NeoButton>
      </view>
      <view v-if="showDetails" class="error-details">
        <text class="error-stack">{{ error?.stack || error?.message }}</text>
      </view>
    </view>
  </view>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, watch } from 'vue';
import NeoButton from './NeoButton.vue';

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

const hasError = ref(false);
const error = ref<Error | null>(null);
const errorMessage = ref('');

// Simple i18n fallback
const t = (key: string) => {
  const messages: Record<string, string> = {
    errorTitle: 'Something went wrong',
    retry: 'Try Again',
    reset: 'Reset',
  };
  return messages[key] || key;
};

onErrorCaptured((err: unknown) => {
  const capturedError = err instanceof Error ? err : new Error(String(err));
  
  error.value = capturedError;
  errorMessage.value = props.fallback || capturedError.message || 'An unexpected error occurred';
  hasError.value = true;
  
  // Report to parent
  emit('error', capturedError);
  props.onError?.(capturedError);
  
  // Prevent error from propagating
  return false;
});

const handleRetry = () => {
  hasError.value = false;
  error.value = null;
  emit('retry');
};

const handleReset = () => {
  hasError.value = false;
  error.value = null;
  errorMessage.value = '';
  emit('reset');
};

// Allow manual error setting
const setError = (err: Error | string) => {
  const errorObj = err instanceof Error ? err : new Error(err);
  error.value = errorObj;
  errorMessage.value = errorObj.message;
  hasError.value = true;
  emit('error', errorObj);
};

// Expose methods for parent
defineExpose({
  setError,
  clearError: handleReset,
});
</script>

<style scoped lang="scss">
.error-boundary {
  padding: 24px;
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
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 12px;
  display: block;
}

.error-message {
  font-size: 16px;
  color: var(--text-secondary, #666);
  margin-bottom: 24px;
  display: block;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.error-details {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-secondary, #f0f0f0);
  border-radius: 8px;
  text-align: left;
}

.error-stack {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary, #666);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
