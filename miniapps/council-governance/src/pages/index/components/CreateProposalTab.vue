<template>
  <view class="tab-content">
    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'erobo-neo'" class="status-card">
      <text class="status-text">{{ status.msg }}</text>
    </NeoCard>

    <NeoCard variant="erobo-neo">
      <view class="form-group mb-6">
        <text class="form-label">{{ t("proposalType") }}</text>
        <view class="flex gap-2">
          <NeoButton
            :variant="newProposal.type === 0 ? 'primary' : 'secondary'"
            @click="newProposal.type = 0"
            class="flex-1"
            size="sm"
          >
            {{ t("textType") }}
          </NeoButton>
          <NeoButton
            :variant="newProposal.type === 1 ? 'primary' : 'secondary'"
            @click="newProposal.type = 1"
            class="flex-1"
            size="sm"
          >
            {{ t("policyType") }}
          </NeoButton>
        </view>
      </view>

      <view class="form-group mb-6">
        <NeoInput v-model="newProposal.title" :label="t('proposalTitle')" :placeholder="t('titlePlaceholder')" />
      </view>

      <view class="form-group mb-6">
        <NeoInput
          v-model="newProposal.description"
          :label="t('description')"
          type="text"
          :placeholder="t('descPlaceholder')"
        />
      </view>

      <view v-if="newProposal.type === 1" class="policy-fields">
        <text class="form-label">{{ t("policyMethod") }}</text>
        <view class="method-grid">
          <NeoButton
            v-for="method in policyMethods"
            :key="method.value"
            :variant="newProposal.policyMethod === method.value ? 'primary' : 'secondary'"
            size="sm"
            class="method-btn"
            @click="newProposal.policyMethod = method.value"
          >
            {{ method.label }}
          </NeoButton>
        </view>
        <NeoInput
          v-model="newProposal.policyValue"
          :label="t('policyValue')"
          type="number"
          :placeholder="t('policyValuePlaceholder')"
        />
      </view>

      <view class="form-group mb-8">
        <text class="form-label">{{ t("duration") }}</text>
        <view class="flex gap-2">
          <NeoButton
            v-for="d in durations"
            :key="d.value"
            :variant="newProposal.duration === d.value ? 'primary' : 'secondary'"
            size="sm"
            class="flex-1"
            @click="newProposal.duration = d.value"
          >
            {{ d.label }}
          </NeoButton>
        </view>
      </view>

      <NeoButton variant="primary" size="lg" block @click="handleSubmit">
        {{ t("submit") }}
      </NeoButton>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
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

const durations = [
  { label: "3 Days", value: 259200 },
  { label: "7 Days", value: 604800 },
  { label: "14 Days", value: 1209600 },
];

const policyMethods = [
  { value: "setFeePerByte", label: "Set Fee Per Byte" },
  { value: "setExecFeeFactor", label: "Set Exec Fee Factor" },
  { value: "setStoragePrice", label: "Set Storage Price" },
  { value: "setMaxBlockSize", label: "Set Max Block Size" },
  { value: "setMaxTransactionsPerBlock", label: "Set Max Tx/Block" },
  { value: "setMaxSystemFee", label: "Set Max System Fee" },
];

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
