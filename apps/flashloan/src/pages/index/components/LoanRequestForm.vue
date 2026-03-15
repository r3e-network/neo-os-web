<template>
  <NeoCard variant="erobo" class="loan-card">
    <div class="tabs" role="tablist">
      <div
        :class="['tab', { active: activeTab === 'lookup' }]"
        role="tab"
        tabindex="0"
        :aria-selected="activeTab === 'lookup'"
        :aria-label="t('tabLookup')"
        @click="activeTab = 'lookup'"
      >
        <span>{{ t("tabLookup") }}</span>
      </div>
      <div
        :class="['tab', { active: activeTab === 'create' }]"
        role="tab"
        tabindex="0"
        :aria-selected="activeTab === 'create'"
        :aria-label="t('tabCreate')"
        @click="activeTab = 'create'"
      >
        <span>{{ t("tabCreate") }}</span>
      </div>
    </div>

    <!-- Lookup Tab -->
    <div v-if="activeTab === 'lookup'" class="tab-content">
      <div class="input-section">
        <NeoInput
          :modelValue="loanId"
          @update:modelValue="$emit('update:loanId', $event)"
          type="number"
          :placeholder="t('loanIdPlaceholder')"
          :label="t('loanId')"
        />
      </div>

      <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('lookup')" class="execute-btn">
        <span v-if="!isLoading">{{ t("checkStatus") }}</span>
        <span v-else>{{ t("checking") }}</span>
      </NeoButton>

      <div v-if="loanDetails" class="status-grid">
        <div class="status-row">
          <span class="status-label">{{ t("statusLabel") }}</span>
          <span :class="['status-value', loanDetails.status]">{{ statusText(loanDetails.status) }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("loanId") }}</span>
          <span class="status-value">#{{ loanDetails.id }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("amount") }}</span>
          <span class="status-value">{{ loanDetails.amount }} GAS</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("feeShort") }}</span>
          <span class="status-value">{{ loanDetails.fee }} GAS</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("borrower") }}</span>
          <span class="status-value mono">{{ loanDetails.borrower }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("callbackContract") }}</span>
          <span class="status-value mono">{{ loanDetails.callbackContract }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("callbackMethod") }}</span>
          <span class="status-value mono">{{ loanDetails.callbackMethod }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">{{ t("timestamp") }}</span>
          <span class="status-value">{{ loanDetails.timestamp }}</span>
        </div>
      </div>

      <div v-else class="empty-state">
        <span class="empty-text">{{ t("statusHint") }}</span>
      </div>
    </div>

    <!-- Create Loan Tab -->
    <div v-if="activeTab === 'create'" class="tab-content">
      <div class="form-section">
        <span class="section-title">{{ t("requestLoanTitle") }}</span>

        <div class="input-section">
          <NeoInput
            v-model="loanAmount"
            type="number"
            :placeholder="t('amountPlaceholder')"
            :label="t('loanAmount')"
            suffix="GAS"
          />
        </div>

        <div class="input-section">
          <NeoInput
            v-model="callbackContractAddress"
            :placeholder="t('callbackContractPlaceholder')"
            :label="t('callbackContract')"
          />
        </div>

        <div class="input-section">
          <NeoInput
            v-model="callbackMethodName"
            :placeholder="t('callbackMethodPlaceholder')"
            :label="t('callbackMethod')"
          />
        </div>

        <div class="info-box">
          <span class="info-text">{{ t("flashloanInfo") }}</span>
        </div>

        <NeoButton
          variant="primary"
          size="lg"
          block
          :loading="isCreating"
          @click="handleRequestLoan"
          class="execute-btn"
          :disabled="!canRequest"
        >
          <span v-if="!isCreating">{{ t("requestLoan") }}</span>
          <span v-else>{{ t("requesting") }}</span>
        </NeoButton>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard, NeoInput, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

export interface LoanDetails {
  id: string;
  borrower: string;
  amount: string;
  fee: string;
  callbackContract: string;
  callbackMethod: string;
  timestamp: string;
  status: "pending" | "success" | "failed";
}

const props = defineProps<{
  loanId: string;
  loanDetails: LoanDetails | null;
  isLoading: boolean;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits(["update:loanId", "lookup", "request-loan"]);

const activeTab = ref("lookup");
const loanAmount = ref("");
const callbackContractAddress = ref("");
const callbackMethodName = ref("");
const isCreating = ref(false);

const canRequest = computed(() => {
  const amount = Number(loanAmount.value);
  const hasCallbackContract = callbackContractAddress.value.trim().length > 0;
  const hasCallbackMethod = callbackMethodName.value.trim().length > 0;
  return amount > 0 && hasCallbackContract && hasCallbackMethod;
});

const statusText = (status: LoanDetails["status"]) => {
  const map = {
    pending: t("statusPending"),
    success: t("statusSuccess"),
    failed: t("statusFailed"),
  };
  return map[status] || status;
};

const handleRequestLoan = async () => {
  if (!canRequest.value || isCreating.value) return;
  isCreating.value = true;
  try {
    emit("request-loan", {
      amount: loanAmount.value,
      callbackContract: callbackContractAddress.value.trim(),
      callbackMethod: callbackMethodName.value.trim(),
    });
  } finally {
    isCreating.value = false;
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.tabs {
  display: flex;
  gap: $spacing-2;
  margin-bottom: $spacing-4;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab {
  padding: $spacing-3 $spacing-4;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;

  &.active {
    color: var(--text-primary);
    border-bottom-color: var(--flash-success);
  }
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.input-section {
  margin-bottom: $spacing-3;
}

.execute-btn {
  margin-top: $spacing-2;
}

.status-grid {
  margin-top: $spacing-4;
  display: grid;
  gap: 10px;
  padding: $spacing-4;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-3;
}

.status-label {
  @include stat-label;
  font-size: 10px;
}

.status-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;

  &.pending {
    color: var(--flash-pending);
  }
  &.success {
    color: var(--flash-success);
  }
  &.failed {
    color: var(--flash-danger);
  }
}

.mono {
  font-family: $font-mono;
  font-size: 10px;
}

.empty-state {
  margin-top: $spacing-4;
  padding: $spacing-4;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-text {
  @include stat-label;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: $spacing-2;
}

.info-box {
  padding: $spacing-3;
  background: rgba(0, 229, 153, 0.1);
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 8px;
}

.info-text {
  font-size: 11px;
  color: var(--flash-success);
  line-height: 1.5;
}
</style>
