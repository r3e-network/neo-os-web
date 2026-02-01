<template>
  <NeoCard variant="erobo-neo">
    <template #header-extra>
      <text class="upload-icon">📤</text>
    </template>

    <text class="upload-subtitle mb-6 text-center block opacity-70">{{ t("uploadSubtitle") }}</text>

    <NeoInput
      :modelValue="recordContent"
      @update:modelValue="$emit('update:recordContent', $event)"
      :label="t('recordContent')"
      :placeholder="t('contentPlaceholder')"
      type="textarea"
      class="mb-2"
    />
    <view class="hash-note-glass mb-6">
      <text class="hash-note-text">🔒 {{ t("hashNote") }}</text>
    </view>

    <NeoInput
      :modelValue="recordRating"
      @update:modelValue="$emit('update:recordRating', $event)"
      :label="t('rating')"
      type="number"
      min="1"
      max="5"
      class="mb-8"
    />

    <view class="category-select mb-4">
      <text class="category-label mb-2 block">{{ t("category") }}</text>
      <view class="category-options">
        <view
          v-for="cat in categories"
          :key="cat.value"
          class="category-option"
          :class="{ active: recordCategory === cat.value }"
          @click="$emit('update:recordCategory', cat.value)"
        >
          <text>{{ cat.label }}</text>
        </view>
      </view>
    </view>

    <NeoButton variant="primary" size="lg" block @click="$emit('create')" :loading="isLoading" :disabled="!canCreate">
      {{ t("createRecord") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

const props = defineProps<{
  recordContent: string;
  recordRating: string;
  recordCategory: number;
  isLoading: boolean;
  canCreate: boolean;
  t: (key: string) => string;
}>();

defineEmits(["update:recordContent", "update:recordRating", "update:recordCategory", "create"]);

const categories = computed(() => [
  { label: props.t("catGeneral"), value: 0 },
  { label: props.t("catPhoto"), value: 1 },
  { label: props.t("catLetter"), value: 2 },
  { label: props.t("catVideo"), value: 3 },
  { label: props.t("catAudio"), value: 4 },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.upload-icon {
  font-size: 20px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.upload-subtitle {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  border-left: 2px solid #00E599;
  padding-left: 12px;
  text-align: left !important;
  background: rgba(0, 229, 153, 0.05);
  padding: 8px 12px;
  border-radius: 0 8px 8px 0;
}

.hash-note-glass {
  background: rgba(159, 157, 243, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.2);
}

.hash-note-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #9f9df3;
  letter-spacing: 0.05em;
}

.category-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: #666;
}

.category-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-option {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.5);
  
  &.active {
    background: #333;
    color: #f0f0f0;
    border-color: #333;
    box-shadow: 2px 2px 0 rgba(0,0,0,0.2);
  }
}
</style>
