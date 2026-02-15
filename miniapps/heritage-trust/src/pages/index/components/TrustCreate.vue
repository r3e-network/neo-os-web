<template>
  <view class="trust-create">
    <CreateTrustForm
      v-model:name="newTrust.name"
      v-model:beneficiary="newTrust.beneficiary"
      v-model:neo-value="newTrust.neoValue"
      v-model:gas-value="newTrust.gasValue"
      v-model:monthly-neo="newTrust.monthlyNeo"
      v-model:monthly-gas="newTrust.monthlyGas"
      v-model:release-mode="newTrust.releaseMode"
      v-model:interval-days="newTrust.intervalDays"
      v-model:notes="newTrust.notes"
      :is-loading="isLoading"
      @create="$emit('create')"
    />
  </view>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import CreateTrustForm from "./CreateTrustForm.vue";

const props = defineProps<{
  isLoading: boolean;
}>();

const emit = defineEmits<{
  create: [];
  update: [trust: typeof newTrust];
}>();

const newTrust = reactive({
  name: "",
  beneficiary: "",
  neoValue: "10",
  gasValue: "0",
  monthlyNeo: "1",
  monthlyGas: "0",
  releaseMode: "neoRewards",
  intervalDays: "30",
  notes: "",
});

watch([() => newTrust.releaseMode, () => newTrust.neoValue, () => newTrust.gasValue], ([mode, neoValue, gasValue]) => {
  const neoAmount = Number.parseFloat(neoValue);
  const gasAmount = Number.parseFloat(gasValue);

  if (mode !== "fixed") {
    newTrust.gasValue = "0";
    newTrust.monthlyGas = "0";
  } else if (!Number.isFinite(gasAmount) || gasAmount <= 0) {
    newTrust.monthlyGas = "0";
  }

  if (mode === "rewardsOnly") {
    newTrust.monthlyNeo = "0";
  } else if (!Number.isFinite(neoAmount) || neoAmount <= 0) {
    newTrust.monthlyNeo = "0";
  } else if (newTrust.monthlyNeo === "0") {
    newTrust.monthlyNeo = "1";
  }
});

watch(
  newTrust,
  (val) => {
    emit("update", val);
  },
  { deep: true }
);
</script>
