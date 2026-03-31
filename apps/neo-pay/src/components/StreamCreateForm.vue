<template>
  <div class="app-container">
    <NeoCard variant="erobo-neo">
      <div class="form-group">
        <NeoInput v-model="localForm.name" :label="t('vaultName')" :placeholder="t('vaultNamePlaceholder')" />
        <NeoInput
          v-model="localForm.beneficiary"
          :label="t('beneficiary')"
          :placeholder="t('beneficiaryPlaceholder')"
        />

        <div class="input-group">
          <span class="input-label">{{ t("assetType") }}</span>
          <div class="asset-toggle">
            <NeoButton
              size="sm"
              :variant="localForm.asset === 'GAS' ? 'primary' : 'secondary'"
              @click="setAsset('GAS')"
            >
              {{ t("assetGas") }}
            </NeoButton>
            <NeoButton
              size="sm"
              :variant="localForm.asset === 'NEO' ? 'primary' : 'secondary'"
              @click="setAsset('NEO')"
            >
              {{ t("assetNeo") }}
            </NeoButton>
          </div>
        </div>

        <NeoInput
          v-model="localForm.total"
          type="number"
          :label="t('totalAmount')"
          :placeholder="t('totalAmountPlaceholder')"
          :suffix="localForm.asset"
          :hint="t('totalAmountHint')"
        />

        <NeoInput
          v-model="localForm.rate"
          type="number"
          :label="t('rateAmount')"
          :placeholder="t('rateAmountPlaceholder')"
          :suffix="localForm.asset"
        />

        <NeoInput
          v-model="localForm.intervalDays"
          type="number"
          :label="t('intervalDays')"
          :placeholder="t('intervalDaysPlaceholder')"
          :hint="t('intervalHint')"
        />

        <NeoInput v-model="localForm.notes" type="textarea" :label="t('notes')" :placeholder="t('notesPlaceholder')" />

        <NeoButton variant="primary" size="lg" block :loading="loading" :disabled="loading" @click="handleCreate">
          {{ loading ? t("creating") : t("createVault") }}
        </NeoButton>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, onUnmounted, watch } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const emit = defineEmits<{
  (
    e: "create",
    payload: {
      name: string;
      beneficiary: string;
      asset: string;
      total: string;
      rate: string;
      intervalDays: string;
      notes: string;
    }
  ): void;
}>();

const props = defineProps<{
  loading?: boolean;
}>();

const { t } = createUseI18n(messages)();

const localForm = reactive({
  name: "",
  beneficiary: "",
  asset: "GAS",
  total: "20",
  rate: "1",
  intervalDays: "30",
  notes: "",
});

const stopLoadingWatch = watch(
  () => props.loading,
  (newVal) => {
    if (!newVal) {
      localForm.name = "";
      localForm.beneficiary = "";
      localForm.total = localForm.asset === "NEO" ? "10" : "20";
      localForm.rate = "1";
      localForm.intervalDays = "30";
      localForm.notes = "";
    }
  }
);

onUnmounted(() => {
  stopLoadingWatch();
});

const handleCreate = () => {
  emit("create", { ...localForm });
};

const setAsset = (asset: "GAS" | "NEO") => {
  localForm.asset = asset;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.app-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 0;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  @include stat-label;
  font-size: 12px;
  color: var(--stream-muted);
  letter-spacing: 0.05em;
}

.asset-toggle {
  display: flex;
  gap: 10px;

  :deep(.neo-btn) {
    flex: 1;
    border-radius: 12px;
    font-weight: 700;
    transition: all 0.25s ease;

    &:hover {
      transform: translateY(-1px);
    }
  }
}

/* Bank-transfer-style form polish */
:deep(.neo-input) {
  border-radius: 12px;
  transition: all 0.25s ease;

  &:focus-within {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2), 0 4px 16px rgba(59, 130, 246, 0.08);
  }
}

:deep(.neo-input label) {
  font-family: var(--stream-font, 'DM Sans', sans-serif);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--stream-muted, rgba(232, 237, 245, 0.55));
}

:deep(.neo-btn--primary) {
  height: 52px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 14px;
  margin-top: 4px;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    animation: form-btn-shimmer 4s ease-in-out infinite;
  }
}

@keyframes form-btn-shimmer {
  0% { left: -100%; }
  50%, 100% { left: 200%; }
}
</style>
