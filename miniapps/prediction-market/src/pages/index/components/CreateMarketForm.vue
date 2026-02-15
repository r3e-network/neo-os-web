<template>
  <FormCard
    :title="t('createMarket')"
    :description="t('createMarket')"
    :submit-label="isCreating ? t('loading') : t('createMarket')"
    :submit-loading="isCreating"
    :submit-disabled="isCreating || !isFormValid()"
    @submit="submitForm"
  >
    <!-- Question -->
    <view class="form-field">
      <text class="field-label">{{ t("question") }} *</text>
      <textarea
        v-model="formData.question"
        class="field-input field-textarea"
        :placeholder="t('questionPlaceholder')"
        maxlength="200"
      />
      <text class="field-hint">{{ formData.question.length }}/200</text>
    </view>

    <!-- Description -->
    <view class="form-field">
      <text class="field-label">{{ t("description") }}</text>
      <textarea
        v-model="formData.description"
        class="field-input field-textarea"
        :placeholder="t('descriptionPlaceholder')"
        maxlength="1000"
      />
      <text class="field-hint">{{ formData.description.length }}/1000</text>
    </view>

    <!-- Category -->
    <view class="form-field">
      <text class="field-label">{{ t("category") }} *</text>
      <view class="category-grid">
        <view
          v-for="cat in categoryOptions"
          :key="cat.id"
          class="category-option"
          :class="{ active: formData.category === cat.id }"
          role="button"
          tabindex="0"
          :aria-pressed="formData.category === cat.id"
          @click="formData.category = cat.id"
          @keydown.enter="formData.category = cat.id"
          @keydown.space.prevent="formData.category = cat.id"
        >
          <text>{{ cat.label }}</text>
        </view>
      </view>
    </view>

    <!-- End Date -->
    <view class="form-field">
      <text class="field-label">{{ t("endDate") }} *</text>
      <view class="date-input-container">
        <input v-model="formData.endDateStr" type="datetime-local" class="field-input" :aria-label="t('endDate')" />
      </view>
    </view>

    <!-- Oracle -->
    <view class="form-field">
      <text class="field-label">{{ t("oracle") }} *</text>
      <input v-model="formData.oracle" class="field-input" :placeholder="t('selectOracle')" />
      <text class="field-hint">{{ t("resolutionSource") }}</text>
    </view>

    <!-- Initial Liquidity -->
    <view class="form-field">
      <text class="field-label">{{ t("initialLiquidity") }} *</text>
      <input
        v-model.number="formData.initialLiquidity"
        type="number"
        class="field-input"
        placeholder="10"
        min="10"
        step="1"
      />
      <text class="field-hint">{{ t("liquidityInfo") }}</text>
    </view>
  </FormCard>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import { FormCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

interface Props {
  isCreating: boolean;
}

const props = defineProps<Props>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  submit: [
    data: {
      question: string;
      description: string;
      category: string;
      endDate: number;
      oracle: string;
      initialLiquidity: number;
    },
  ];
}>();

const formData = reactive({
  question: "",
  description: "",
  category: "crypto",
  endDateStr: "",
  oracle: "",
  initialLiquidity: 10,
});

const categoryOptions = computed(() => [
  { id: "crypto", label: t("categoryCrypto") },
  { id: "sports", label: t("categorySports") },
  { id: "politics", label: t("categoryPolitics") },
  { id: "economics", label: t("categoryEconomics") },
  { id: "entertainment", label: t("categoryEntertainment") },
  { id: "other", label: t("categoryOther") },
]);

const isFormValid = (): boolean => {
  return (
    formData.question.trim().length > 0 &&
    formData.category !== "" &&
    formData.endDateStr !== "" &&
    formData.oracle.trim().length > 0 &&
    formData.initialLiquidity >= 10
  );
};

const submitForm = () => {
  if (!isFormValid()) return;

  const endDate = new Date(formData.endDateStr).getTime();
  if (endDate <= Date.now()) {
    return; // Invalid date
  }

  emit("submit", {
    question: formData.question.trim(),
    description: formData.description.trim(),
    category: formData.category,
    endDate,
    oracle: formData.oracle.trim(),
    initialLiquidity: formData.initialLiquidity,
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;
@import "../prediction-market-theme.scss";

.create-market-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-header {
  text-align: center;
}

.form-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--predict-text-primary);
  display: block;
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 14px;
  color: var(--predict-text-secondary);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--predict-text-primary);
}

.field-input {
  background: var(--predict-input-bg);
  border: 1px solid var(--predict-input-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--predict-text-primary);
  font-size: 14px;

  &:focus {
    border-color: var(--predict-input-focus);
    outline: none;
  }
}

.field-textarea {
  min-height: 100px;
  resize: vertical;
}

.field-hint {
  font-size: 12px;
  color: var(--predict-text-muted);
}

.category-grid {
  @include grid-layout(2, 8px);
}

.category-option {
  padding: 12px;
  border: 1px solid var(--predict-input-border);
  border-radius: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--predict-text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    border-color: var(--predict-accent);
    background: rgba(59, 130, 246, 0.1);
    color: var(--predict-accent);
  }
}

.date-input-container {
  position: relative;
}

.form-actions {
  margin-top: 8px;
}

.submit-button {
  width: 100%;
  padding: 16px;
  background: var(--predict-btn-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
