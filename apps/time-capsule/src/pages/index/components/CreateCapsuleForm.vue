<template>
  <NeoCard variant="erobo-neo">
    <div class="form-section">
      <span class="form-label">{{ t("titleLabel") }}</span>
      <div class="input-wrapper-clean">
        <NeoInput
          :modelValue="title"
          @update:modelValue="$emit('update:title', $event)"
          :placeholder="t('titlePlaceholder')"
        />
      </div>
    </div>

    <div class="form-section">
      <span class="form-label">{{ t("secretMessage") }}</span>
      <div class="input-wrapper-clean">
        <NeoInput
          :modelValue="content"
          @update:modelValue="$emit('update:content', $event)"
          :placeholder="t('secretMessagePlaceholder')"
          type="textarea"
          class="textarea-field"
        />
      </div>
      <span class="helper-text neutral">{{ t("contentStorageNote") }}</span>
    </div>

    <div class="form-section">
      <span class="form-label">{{ t("categoryLabel") }}</span>
      <div class="category-actions">
        <NeoButton
          v-for="category in categories"
          :key="category.id"
          size="sm"
          :variant="category.id === selectedCategory ? 'primary' : 'secondary'"
          @click="$emit('update:category', category.id)"
        >
          {{ t(category.label) }}
        </NeoButton>
      </div>
    </div>

    <div class="form-section">
      <span class="form-label">{{ t("unlockIn") }}</span>
      <div class="date-picker">
        <div class="input-wrapper-clean small">
          <NeoInput
            :modelValue="days"
            @update:modelValue="$emit('update:days', $event)"
            type="number"
            :placeholder="t('daysPlaceholder')"
            class="days-input"
          />
        </div>
        <span class="days-text">{{ t("days") }}</span>
      </div>
      <span class="helper-text">{{ t("unlockDateHelper") }}</span>
    </div>

    <div class="form-section">
      <span class="form-label">{{ t("visibility") }}</span>
      <div class="visibility-actions">
        <NeoButton size="sm" :variant="isPublic ? 'secondary' : 'primary'" @click="$emit('update:isPublic', false)">
          {{ t("private") }}
        </NeoButton>
        <NeoButton size="sm" :variant="isPublic ? 'primary' : 'secondary'" @click="$emit('update:isPublic', true)">
          {{ t("public") }}
        </NeoButton>
      </div>
      <span class="helper-text">{{ isPublic ? t("publicHint") : t("privateHint") }}</span>
    </div>

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

defineEmits<{
  (e: "update:title", value: string): void;
  (e: "update:content", value: string): void;
  (e: "update:days", value: string): void;
  (e: "update:isPublic", value: boolean): void;
  (e: "update:category", value: number): void;
  (e: "create"): void;
}>();
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
