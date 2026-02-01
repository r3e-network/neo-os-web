<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <NeoInput v-model="localForm.roundId" :label="t('contributionRoundId')" disabled />
      <NeoInput
        v-model="localForm.projectId"
        :label="t('contributionProjectId')"
        :placeholder="t('selectProjectHint')"
      />
      <NeoInput
        v-model="localForm.amount"
        type="number"
        :label="t('contributionAmount')"
        :placeholder="t('contributionAmountPlaceholder')"
        :suffix="assetSymbol"
      />
      <NeoInput
        v-model="localForm.memo"
        type="textarea"
        :label="t('contributionMemo')"
        :placeholder="t('contributionMemoPlaceholder')"
      />

      <NeoButton
        variant="primary"
        size="lg"
        block
        :loading="isLoading"
        :disabled="isLoading"
        @click="emitContribute"
      >
        {{ isLoading ? t("contributing") : t("contribute") }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { NeoInput, NeoButton, NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  roundId: string;
  assetSymbol: string;
}>();

const emit = defineEmits<{
  (e: "contribute", data: { roundId: string; projectId: string; amount: string; memo: string }): void;
}>();

const { t } = useI18n();
const isLoading = ref(false);

const localForm = reactive({
  roundId: "",
  projectId: "",
  amount: "",
  memo: "",
});

watch(() => props.roundId, (newId) => {
  localForm.roundId = newId;
}, { immediate: true });

const emitContribute = () => {
  emit("contribute", { ...localForm });
};

defineExpose({
  setLoading: (loading: boolean) => { isLoading.value = loading; },
  reset: () => {
    localForm.amount = "";
    localForm.memo = "";
  },
});
</script>

<style lang="scss" scoped>
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
