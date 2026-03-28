<template>
  <!-- Soft loading indicator (when data exists) -->
  <div v-if="hasData && loading" class="soft-loading" role="status" aria-live="polite">
    <AppIcon name="loader" :size="16" class="animate-spin" aria-hidden="true" />
    <span class="soft-loading-text">{{ t("refreshing") }}</span>
  </div>

  <!-- Initial loading skeleton (no data yet) -->
  <div v-else-if="!hasData && loading" class="loading-container" role="status" aria-live="polite">
    <div class="skeleton-card mb-4" aria-hidden="true"></div>
    <div class="loading-overlay">
      <AppIcon name="loader" :size="48" class="mb-4 animate-spin" aria-hidden="true" />
      <span class="loading-label">{{ t("loading") }}</span>
    </div>
  </div>

  <!-- Error state -->
  <div v-else-if="error" class="error-container" role="alert">
    <AppIcon name="alert-circle" :size="48" class="text-danger mb-4" aria-hidden="true" />
    <span class="error-label">{{ error }}</span>
    <NeoButton type="button" variant="primary" class="mt-4" @click="$emit('retry')">
      {{ t("retry") }}
    </NeoButton>
  </div>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  loading: boolean;
  error: string;
  hasData: boolean;
}>();

defineEmits<{
  retry: [];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.soft-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--treasury-soft-bg);
  color: var(--treasury-gold);
  border: 1px solid var(--treasury-soft-border);
  border-radius: 99px;
  box-shadow: 0 0 16px rgba(255, 222, 89, 0.12);
}

.soft-loading-text {
  font-family: var(--font-family-display, "Cinzel", serif);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.loading-container {
  display: flex;
  flex-direction: column;
  padding: 16px;
  position: relative;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--treasury-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.skeleton-card {
  height: 120px;
  background: var(--treasury-skeleton-bg);
  border: 1px solid var(--treasury-skeleton-border);
  border-radius: 20px;
  animation: pulse 2s infinite;
}

.error-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.loading-label,
.error-label {
  font-family: var(--font-family-display, "Cinzel", serif);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--treasury-gold);
  letter-spacing: 0.05em;
}

.text-danger {
  color: var(--treasury-danger);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-card,
  .animate-spin {
    animation: none;
  }
}
</style>
