<template>
  <FormCard
    :submit-label="isLoading ? t('contributing') : t('contribute')"
    :submit-loading="isLoading"
    :submit-disabled="isLoading"
    @submit="emitContribute"
  >
    <NeoInput v-model="localForm.roundId" :label="t('contributionRoundId')" disabled />
    <NeoInput v-model="localForm.projectId" :label="t('contributionProjectId')" :placeholder="t('selectProjectHint')" />
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
  </FormCard>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { NeoInput, FormCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const props = defineProps<{
  roundId: string;
  assetSymbol: string;
}>();

const emit = defineEmits<{
  (e: "contribute", data: { roundId: string; projectId: string; amount: string; memo: string }): void;
}>();

const { t } = createUseI18n(messages)();
const isLoading = ref(false);

const localForm = reactive({
  roundId: "",
  projectId: "",
  amount: "",
  memo: "",
});

watch(
  () => props.roundId,
  (newId) => {
    localForm.roundId = newId;
  },
  { immediate: true }
);

const emitContribute = () => {
  emit("contribute", { ...localForm });
};

defineExpose({
  setLoading: (loading: boolean) => {
    isLoading.value = loading;
  },
  reset: () => {
    localForm.amount = "";
    localForm.memo = "";
  },
});
</script>

<style lang="scss" scoped></style>
