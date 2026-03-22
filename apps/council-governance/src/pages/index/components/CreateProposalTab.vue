<template>
  <div class="tab-content">
    <NeoCard
      v-if="status"
      :variant="status.type === 'error' ? 'danger' : 'erobo-neo'"
      class="status-card"
      :role="status.type === 'error' ? 'alert' : undefined"
    >
      <span class="status-text">{{ status.msg }}</span>
    </NeoCard>

    <NeoCard variant="erobo-neo">
      <div class="form-group mb-6">
        <span class="form-label">{{ t("proposalType") }}</span>
        <div class="flex gap-2">
          <NeoButton
            :variant="newProposal.type === 0 ? 'primary' : 'secondary'"
            @click="newProposal.type = 0"
            class="flex-1"
            size="sm"
            type="button"
          >
            {{ t("textType") }}
          </NeoButton>
          <NeoButton
            :variant="newProposal.type === 1 ? 'primary' : 'secondary'"
            @click="newProposal.type = 1"
            class="flex-1"
            size="sm"
            type="button"
          >
            {{ t("policyType") }}
          </NeoButton>
        </div>
      </div>

      <div class="form-group mb-6">
        <NeoInput v-model="newProposal.title" :label="t('proposalTitle')" :placeholder="t('titlePlaceholder')" />
      </div>

      <div class="form-group mb-6">
        <NeoInput
          v-model="newProposal.description"
          :label="t('description')"
          type="text"
          :placeholder="t('descPlaceholder')"
        />
      </div>

      <div v-if="newProposal.type === 1" class="policy-fields">
        <span class="form-label">{{ t("policyMethod") }}</span>
        <div class="method-grid">
          <NeoButton
            v-for="method in policyMethods"
            :key="method.value"
            :variant="newProposal.policyMethod === method.value ? 'primary' : 'secondary'"
            size="sm"
            class="method-btn"
            type="button"
            @click="newProposal.policyMethod = method.value"
          >
            {{ method.label }}
          </NeoButton>
        </div>
        <NeoInput
          v-model="newProposal.policyValue"
          :label="t('policyValue')"
          type="number"
          :placeholder="t('policyValuePlaceholder')"
        />
      </div>

      <div class="form-group mb-8">
        <span class="form-label">{{ t("duration") }}</span>
        <div class="flex gap-2">
          <NeoButton
            v-for="d in durations"
            :key="d.value"
            :variant="newProposal.duration === d.value ? 'primary' : 'secondary'"
            size="sm"
            class="flex-1"
            type="button"
            @click="newProposal.duration = d.value"
          >
            {{ d.label }}
          </NeoButton>
        </div>
      </div>

      <NeoButton variant="primary" size="lg" block type="button" @click="handleSubmit">
        {{ t("submit") }}
      </NeoButton>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";

const props = defineProps<{
  t: (key: string, ...args: unknown[]) => string;
  status: { msg: string; type: string } | null;
}>();

const emit = defineEmits<{
  (
    e: "submit",
    proposal: {
      type: number;
      title: string;
      description: string;
      policyMethod: string;
      policyValue: string;
      duration: number;
    }
  ): void;
}>();

const newProposal = ref({
  type: 0,
  title: "",
  description: "",
  policyMethod: "",
  policyValue: "",
  duration: 604800,
});

const durations = computed(() => [
  { label: props.t("duration3Days"), value: 259200 },
  { label: props.t("duration7Days"), value: 604800 },
  { label: props.t("duration14Days"), value: 1209600 },
]);

const policyMethods = computed(() => [
  { value: "setFeePerByte", label: props.t("methodFeePerByte") },
  { value: "setExecFeeFactor", label: props.t("methodExecFeeFactor") },
  { value: "setStoragePrice", label: props.t("methodStoragePrice") },
  { value: "setMaxBlockSize", label: props.t("methodMaxBlockSize") },
  { value: "setMaxTransactionsPerBlock", label: props.t("methodMaxTransactions") },
  { value: "setMaxSystemFee", label: props.t("methodMaxSystemFee") },
]);

function handleSubmit() {
  emit("submit", { ...newProposal.value });
}

defineExpose({
  reset: () => {
    newProposal.value = {
      type: 0,
      title: "",
      description: "",
      policyMethod: "",
      policyValue: "",
      duration: 604800,
    };
  },
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-content {
  padding: 20px;
}

.status-card {
  margin-bottom: 24px;
  text-align: center;
}
.status-text {
  font-weight: 700;
  text-transform: uppercase;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  letter-spacing: 0.1em;
  display: block;
  margin-bottom: 8px;
}

.policy-fields {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.method-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.method-btn {
  :deep(button) {
    font-size: 10px !important;
    padding: 8px 4px !important;
    height: auto !important;
    white-space: normal !important;
    line-height: 1.2 !important;
  }
}

.mb-6 {
  margin-bottom: 24px;
}
.mb-8 {
  margin-bottom: 32px;
}
</style>
