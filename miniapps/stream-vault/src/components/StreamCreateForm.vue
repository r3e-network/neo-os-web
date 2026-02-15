<template>
  <view class="app-container">
    <NeoCard variant="erobo-neo">
      <view class="form-group">
        <NeoInput v-model="localForm.name" :label="t('vaultName')" :placeholder="t('vaultNamePlaceholder')" />
        <NeoInput
          v-model="localForm.beneficiary"
          :label="t('beneficiary')"
          :placeholder="t('beneficiaryPlaceholder')"
        />

        <view class="input-group">
          <text class="input-label">{{ t("assetType") }}</text>
          <view class="asset-toggle">
            <NeoButton size="sm" variant="primary" disabled>
              {{ t("assetGas") }}
            </NeoButton>
          </view>
        </view>

        <NeoInput
          v-model="localForm.total"
          type="number"
          :label="t('totalAmount')"
          placeholder="20"
          :suffix="localForm.asset"
          :hint="t('totalAmountHint')"
        />

        <NeoInput
          v-model="localForm.rate"
          type="number"
          :label="t('rateAmount')"
          placeholder="1.5"
          :suffix="localForm.asset"
        />

        <NeoInput
          v-model="localForm.intervalDays"
          type="number"
          :label="t('intervalDays')"
          placeholder="30"
          :hint="t('intervalHint')"
        />

        <NeoInput v-model="localForm.notes" type="textarea" :label="t('notes')" :placeholder="t('notesPlaceholder')" />

        <NeoButton variant="primary" size="lg" block :loading="loading" :disabled="loading" @click="handleCreate">
          {{ loading ? t("creating") : t("createVault") }}
        </NeoButton>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
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

watch(
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

const handleCreate = () => {
  emit("create", { ...localForm });
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
  gap: 16px;
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
}
</style>
