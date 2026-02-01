<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
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

      <NeoButton
        variant="primary"
        size="lg"
        block
        :loading="isLoading"
        :disabled="isLoading"
        @click="emitCreate"
      >
        {{ isLoading ? t("creatingRound") : t("createRound") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { NeoInput, NeoButton, NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const emit = defineEmits<{
  (e: "create", data: { title: string; description: string; asset: string; matchingPool: string; startTime: string; endTime: string }): void;
}>();

const { t } = useI18n();
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
  setLoading: (loading: boolean) => { isLoading.value = loading; },
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
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--qf-muted);
}

.asset-toggle {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
