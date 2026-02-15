<template>
  <FormCard
    :title="t('createCampaign')"
    :submit-label="isCreating ? t('loading') : t('createCampaign')"
    :submit-loading="isCreating"
    :submit-disabled="isCreating || !isFormValid()"
    @submit="submitForm"
  >
    <!-- Campaign Name -->
    <view class="form-field">
      <text class="field-label">{{ t("campaignName") }} *</text>
      <input v-model="formData.title" class="field-input" :placeholder="t('campaignNamePlaceholder')" maxlength="100" />
    </view>

    <!-- Description -->
    <view class="form-field">
      <text class="field-label">{{ t("description") }}</text>
      <textarea
        v-model="formData.description"
        class="field-textarea"
        :placeholder="t('storyPlaceholder')"
        maxlength="500"
      />
    </view>

    <!-- Category -->
    <view class="form-field">
      <text class="field-label">{{ t("selectCategory") }} *</text>
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

    <!-- Target Goal -->
    <view class="form-field">
      <text class="field-label">{{ t("targetGoal") }} *</text>
      <input
        v-model.number="formData.targetAmount"
        type="number"
        class="field-input"
        :placeholder="t('targetPlaceholder')"
        min="10"
        step="1"
      />
    </view>

    <!-- Duration -->
    <view class="form-field">
      <text class="field-label">{{ t("duration") }} *</text>
      <view class="duration-input">
        <input
          v-model.number="formData.duration"
          type="number"
          class="field-input"
          min="1"
          max="365"
          :aria-label="t('duration')"
        />
        <text class="duration-suffix">{{ t("durationDays") }}</text>
      </view>
    </view>

    <!-- Beneficiary Address -->
    <view class="form-field">
      <text class="field-label">{{ t("beneficiaryAddress") }} *</text>
      <input v-model="formData.beneficiary" class="field-input" :placeholder="t('beneficiaryPlaceholder')" />
    </view>

    <!-- Multi-sig Addresses -->
    <view class="form-field">
      <text class="field-label">{{ t("multisigAddresses") }}</text>
      <text class="field-hint">{{ t("multisigInfo") }}</text>
      <view v-for="(addr, index) in formData.multisigAddresses" :key="index" class="multisig-row">
        <input
          v-model="formData.multisigAddresses[index]"
          class="field-input"
          :placeholder="t('neoAddressPlaceholder')"
        />
        <view
          class="remove-button"
          role="button"
          tabindex="0"
          :aria-label="`Remove address ${index + 1}`"
          @click="removeMultisigAddress(index)"
          @keydown.enter="removeMultisigAddress(index)"
          @keydown.space.prevent="removeMultisigAddress(index)"
        >
          <text aria-hidden="true">×</text>
        </view>
      </view>
      <view
        class="add-button"
        role="button"
        tabindex="0"
        :aria-label="t('addAddress')"
        @click="addMultisigAddress"
        @keydown.enter="addMultisigAddress"
        @keydown.space.prevent="addMultisigAddress"
      >
        <text>+ {{ t("addAddress") }}</text>
      </view>
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
      title: string;
      description: string;
      story: string;
      category: string;
      targetAmount: number;
      duration: number;
      beneficiary: string;
      multisigAddresses: string[];
    },
  ];
}>();

const formData = reactive({
  title: "",
  description: "",
  story: "",
  category: "disaster",
  targetAmount: 100,
  duration: 30,
  beneficiary: "",
  multisigAddresses: [] as string[],
});

const categoryOptions = computed(() => [
  { id: "disaster", label: t("categoryDisaster") },
  { id: "education", label: t("categoryEducation") },
  { id: "health", label: t("categoryHealth") },
  { id: "environment", label: t("categoryEnvironment") },
  { id: "poverty", label: t("categoryPoverty") },
  { id: "animals", label: t("categoryAnimals") },
  { id: "other", label: t("categoryOther") },
]);

const addMultisigAddress = () => {
  formData.multisigAddresses.push("");
};

const removeMultisigAddress = (index: number) => {
  formData.multisigAddresses.splice(index, 1);
};

const isFormValid = (): boolean => {
  return (
    formData.title.trim().length > 0 &&
    formData.category !== "" &&
    formData.targetAmount >= 10 &&
    formData.duration >= 1 &&
    formData.duration <= 365 &&
    formData.beneficiary.trim().length > 0
  );
};

const submitForm = () => {
  if (!isFormValid()) return;

  emit("submit", {
    title: formData.title.trim(),
    description: formData.description.trim(),
    story: formData.description.trim(),
    category: formData.category,
    targetAmount: formData.targetAmount,
    duration: formData.duration,
    beneficiary: formData.beneficiary.trim(),
    multisigAddresses: formData.multisigAddresses.filter((a) => a.trim().length > 0),
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../charity-vault-theme.scss";

.create-campaign-form {
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
  color: var(--charity-text-primary);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--charity-text-primary);
}

.field-input,
.field-textarea {
  background: var(--charity-input-bg);
  border: 1px solid var(--charity-input-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--charity-text-primary);
  font-size: 14px;
}

.field-textarea {
  min-height: 100px;
  resize: vertical;
}

.field-hint {
  font-size: 12px;
  color: var(--charity-text-muted);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.category-option {
  padding: 12px;
  border: 1px solid var(--charity-input-border);
  border-radius: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--charity-text-secondary);
  cursor: pointer;

  &.active {
    border-color: var(--charity-accent);
    background: rgba(245, 158, 11, 0.1);
    color: var(--charity-accent);
  }
}

.duration-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-input .field-input {
  flex: 1;
}

.duration-suffix {
  font-size: 14px;
  color: var(--charity-text-muted);
}

.multisig-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.multisig-row .field-input {
  flex: 1;
}

.remove-button {
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--charity-danger-bg);
  color: var(--charity-danger);
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
}

.add-button {
  padding: 10px;
  background: var(--charity-bg-secondary);
  border: 1px dashed var(--charity-input-border);
  border-radius: 8px;
  text-align: center;
  color: var(--charity-accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.form-actions {
  margin-top: 8px;
}

.submit-button {
  width: 100%;
  padding: 16px;
  background: var(--charity-btn-primary);
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
