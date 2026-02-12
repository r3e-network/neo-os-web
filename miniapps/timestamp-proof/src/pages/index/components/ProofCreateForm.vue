<template>
  <view class="create-section">
    <text class="section-title">{{ t("createProof") }}</text>
    <textarea
      v-model="content"
      class="content-input"
      :placeholder="t('contentPlaceholder')"
      maxlength="1000"
    />
    <button class="create-button" :disabled="isCreating || !content.trim()" @click="$emit('create')">
      <text>{{ isCreating ? t("loading") : t("createProof") }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string) => string;
  isCreating: boolean;
}>();

defineEmits<{
  create: [];
}>();

const content = defineModel<string>("content", { required: true });
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../timestamp-proof-theme.scss";

.create-section {
  background: var(--proof-card-bg);
  border: 1px solid var(--proof-card-border);
  border-radius: var(--radius-lg, 12px);
  padding: var(--spacing-5, 20px);
}

.section-title {
  font-size: var(--font-size-xl, 20px);
  font-weight: 700;
  color: var(--proof-text-primary);
  margin-bottom: var(--spacing-4, 16px);
  letter-spacing: -0.3px;
}

.content-input {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  padding: var(--spacing-3, 12px);
  background: var(--proof-input-bg);
  border: 1px solid var(--proof-input-border);
  border-radius: var(--radius-md, 8px);
  color: var(--proof-text-primary);
  font-size: var(--font-size-md, 14px);
  margin-bottom: var(--spacing-4, 16px);
  transition: all var(--transition-normal);

  &:focus {
    outline: none;
    border-color: var(--proof-input-focus);
    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
  }

  &::placeholder {
    color: var(--proof-text-muted);
  }
}

.create-button {
  width: 100%;
  padding: var(--spacing-3, 14px);
  background: var(--proof-btn-primary);
  color: var(--proof-btn-primary-text);
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--font-size-lg, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal);

  &:hover:not(:disabled) {
    background: var(--proof-btn-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .create-button {
    transition: none;

    &:hover,
    &:active {
      transform: none;
    }
  }

  .content-input {
    transition: none;
  }
}
</style>
