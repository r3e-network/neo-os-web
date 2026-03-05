<template>
  <FormCard
    :submit-label="isLoading ? t('creatingRound') : t('createRound')"
    :submit-loading="isLoading"
    :submit-disabled="isLoading"
    @submit="emitCreate"
  >
    <NeoInput v-model="localForm.title" :label="t('roundTitle')" :placeholder="t('roundTitlePlaceholder')" />
    <NeoInput
      v-model="localForm.description"
      type="textarea"
      :label="t('roundDescription')"
      :placeholder="t('roundDescriptionPlaceholder')"
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
      v-model="localForm.matchingPool"
      type="number"
      :label="t('matchingPool')"
      placeholder="50"
      :suffix="localForm.asset"
      :hint="t('matchingPoolHint')"
    />

    <NeoInput v-model="localForm.startTime" :label="t('roundStart')" :placeholder="t('roundStartPlaceholder')" />
    <NeoInput v-model="localForm.endTime" :label="t('roundEnd')" :placeholder="t('roundEndPlaceholder')" />
  </FormCard>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { NeoInput, NeoButton, FormCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const emit = defineEmits<{
  (
    e: "create",
    data: {
      title: string;
      description: string;
      asset: string;
      matchingPool: string;
      startTime: string;
      endTime: string;
    }
  ): void;
}>();

const { t } = createUseI18n(messages)();
const isLoading = ref(false);

const localForm = reactive({
  title: "",
  description: "",
  asset: "GAS",
  matchingPool: "",
  startTime: "",
  endTime: "",
});

const emitCreate = () => {
  emit("create", { ...localForm });
};

defineExpose({
  setLoading: (loading: boolean) => {
    isLoading.value = loading;
  },
  reset: () => {
    localForm.title = "";
    localForm.description = "";
    localForm.matchingPool = "";
    localForm.startTime = "";
    localForm.endTime = "";
  },
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  @include stat-label;
  letter-spacing: 0.05em;
  color: var(--qf-muted);
}

.asset-toggle {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
