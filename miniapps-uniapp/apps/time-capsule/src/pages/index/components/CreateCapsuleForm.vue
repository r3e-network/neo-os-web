<template>
  <NeoCard variant="erobo-neo">
    <view class="form-section">
      <text class="form-label">{{ t("titleLabel") }}</text>
      <view class="input-wrapper-clean">
        <NeoInput
          :modelValue="title"
          @update:modelValue="$emit('update:title', $event)"
          :placeholder="t('titlePlaceholder')"
        />
      </view>
    </view>

    <view class="form-section">
      <text class="form-label">{{ t("secretMessage") }}</text>
      <view class="input-wrapper-clean">
        <NeoInput
          :modelValue="content"
          @update:modelValue="$emit('update:content', $event)"
          :placeholder="t('secretMessagePlaceholder')"
          type="textarea"
          class="textarea-field"
        />
      </view>
      <text class="helper-text neutral">{{ t("contentStorageNote") }}</text>
    </view>

    <view class="form-section">
      <text class="form-label">{{ t("categoryLabel") }}</text>
      <view class="category-actions">
        <NeoButton
          v-for="category in categories"
          :key="category.id"
          size="sm"
          :variant="category.id === selectedCategory ? 'primary' : 'secondary'"
          @click="$emit('update:category', category.id)"
        >
          {{ t(category.label) }}
        </NeoButton>
      </view>
    </view>

    <view class="form-section">
      <text class="form-label">{{ t("unlockIn") }}</text>
      <view class="date-picker">
        <view class="input-wrapper-clean small">
          <NeoInput
            :modelValue="days"
            @update:modelValue="$emit('update:days', $event)"
            type="number"
            :placeholder="t('daysPlaceholder')"
            class="days-input"
          />
        </view>
        <text class="days-text">{{ t("days") }}</text>
      </view>
      <text class="helper-text">{{ t("unlockDateHelper") }}</text>
    </view>

    <view class="form-section">
      <text class="form-label">{{ t("visibility") }}</text>
      <view class="visibility-actions">
        <NeoButton size="sm" :variant="isPublic ? 'secondary' : 'primary'" @click="$emit('update:isPublic', false)">
          {{ t("private") }}
        </NeoButton>
        <NeoButton size="sm" :variant="isPublic ? 'primary' : 'secondary'" @click="$emit('update:isPublic', true)">
          {{ t("public") }}
        </NeoButton>
      </view>
      <text class="helper-text">{{ isPublic ? t("publicHint") : t("privateHint") }}</text>
    </view>

    <NeoButton
      variant="primary"
      size="lg"
      block
      :loading="isLoading"
      :disabled="isLoading || !canCreate"
      @click="$emit('create')"
      class="mt-6"
    >
      {{ isLoading ? t("creating") : t("createCapsuleButton") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";

const props = defineProps<{
  title: string;
  content: string;
  days: string;
  isPublic: boolean;
  category: number;
  isLoading: boolean;
  canCreate: boolean;
  t: (key: string, ...args: unknown[]) => string;
}>();

const categories = [
  { id: 1, label: "categoryPersonal" },
  { id: 2, label: "categoryGift" },
  { id: 3, label: "categoryMemorial" },
  { id: 4, label: "categoryAnnouncement" },
  { id: 5, label: "categorySecret" },
];

const selectedCategory = computed(() => props.category || 1);

defineEmits(["update:title", "update:content", "update:days", "update:isPublic", "update:category", "create"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.form-section {
  margin-bottom: $spacing-6;
}
.form-label {
  @include stat-label;
  margin-bottom: $spacing-2;
  display: block;
  letter-spacing: 0.05em;
}
.textarea-field {
  min-height: 120px;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  margin-bottom: $spacing-2;
}
.days-input {
  width: 100px;
}
.days-text {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 14px;
  color: var(--text-primary);
}

.helper-text {
  font-size: 10px;
  opacity: 0.6;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--capsule-helper);
}

.helper-text.neutral {
  color: var(--text-secondary);
  margin-top: $spacing-2;
}

.visibility-actions {
  display: flex;
  gap: $spacing-3;
  margin-bottom: $spacing-2;
}

.category-actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}
</style>
