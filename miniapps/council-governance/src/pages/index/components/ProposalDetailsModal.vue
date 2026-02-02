<template>
  <view class="modal-overlay" @click.self="$emit('close')">
    <view class="modal-content">
      <NeoCard variant="erobo-neo">
        <template #header-extra>
          <view class="close-btn" @click="$emit('close')">×</view>
        </template>

        <view class="proposal-detail-content">
          <view class="detail-header">
            <text :class="['proposal-id', proposal.type === 1 && 'text-accent']">
              {{ proposal.type === 0 ? t("textType") : t("policyType") }} #{{ proposal.id }}
            </text>
          </view>

          <text class="detail-title">{{ proposal.title }}</text>
          <text class="detail-description">{{ proposal.description }}</text>

          <view v-if="proposal.type === 1" class="policy-details">
            <text class="section-label">{{ t("policyDetails") }}</text>
            <view class="policy-detail-row">
              <text class="label-mute">{{ t("policyMethod") }}</text>
              <text class="value-highlight">{{ getPolicyMethodLabel(proposal.policyMethod) }}</text>
            </view>
            <view class="policy-detail-row">
              <text class="label-mute">{{ t("policyValue") }}</text>
              <text class="value-mono">{{ proposal.policyValue || "-" }}</text>
            </view>
          </view>

          <!-- Timeline -->
          <view class="timeline-section">
            <text class="section-label">{{ t("timeline") }}</text>
            <view class="timeline">
              <view class="timeline-item">
                <view class="timeline-dot active"></view>
                <text class="timeline-text">{{ t("proposalCreated") }}</text>
              </view>
              <view class="timeline-item">
                <view :class="['timeline-dot', proposal.status >= 2 ? 'active' : 'inactive']"></view>
                <text class="timeline-text">{{ t("votingEnds") }}</text>
              </view>
              <view class="timeline-item">
                <view :class="['timeline-dot', proposal.status === 6 ? 'active' : 'inactive']"></view>
                <text class="timeline-text">{{ t("execution") }}</text>
              </view>
            </view>
          </view>

          <!-- Voting Section -->
          <view v-if="proposal.status === 1" class="voting-section">
            <text class="section-label text-center mb-4">{{ t("castYourVote") }}</text>
            <view class="vote-buttons">
              <NeoButton
                variant="primary"
                block
                :disabled="!canVote"
                :loading="isVoting"
                @click="$emit('vote', proposal.id, 'for')"
              >
                {{ t("for") }} ({{ proposal.yesVotes }})
              </NeoButton>
              <NeoButton
                variant="danger"
                block
                :disabled="!canVote"
                :loading="isVoting"
                @click="$emit('vote', proposal.id, 'against')"
              >
                {{ t("against") }} ({{ proposal.noVotes }})
              </NeoButton>
            </view>
            <view v-if="!canVote" class="vote-hint">
              <text v-if="!address">{{ t("connectWallet") }}</text>
              <text v-else-if="!isCandidate">{{ t("notCandidate") }}</text>
              <text v-else>{{ t("alreadyVoted") }}</text>
            </view>
          </view>

          <!-- Execution Section -->
          <view v-if="canExecute" class="execution-section pt-4 mt-4 border-t border-white/10">
             <NeoButton
                variant="success"
                block
                :loading="isVoting"
                @click="$emit('execute', proposal.id)"
              >
                {{ t("execute") }}
              </NeoButton>
          </view>
        </view>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton } from "@shared/components";

const props = defineProps<{
  proposal: any;
  address: string | null;
  isCandidate: boolean;
  hasVoted: boolean;
  isVoting: boolean;
  t: (key: string) => string;
}>();

const canVote = computed(() => {
  if (!props.address) return false;
  if (!props.isCandidate) return false;
  if (props.isVoting) return false;
  return !props.hasVoted;
});

const canExecute = computed(() => {
  const isExpired = props.proposal.expiryTime < Date.now();
  // Status 1 is Active. If expired and active, maybe valuable to execute.
  // Or if status is already 'Passed' (assuming status 2).
  // We'll show it if expired AND candidate AND status is not executed (6) or rejected.
  // Assuming status: 1=Active, 6=Executed.
  return props.isCandidate && isExpired && props.proposal.status !== 6;
});

const policyMethods = [
  { value: "setFeePerByte", label: "Set Fee Per Byte" },
  { value: "setExecFeeFactor", label: "Set Exec Fee Factor" },
  { value: "setStoragePrice", label: "Set Storage Price" },
  { value: "setMaxBlockSize", label: "Set Max Block Size" },
  { value: "setMaxTransactionsPerBlock", label: "Set Max Transactions/Block" },
  { value: "setMaxSystemFee", label: "Set Max System Fee" },
];

const getPolicyMethodLabel = (method?: string) =>
  policyMethods.find((item) => item.value === method)?.label || method || "-";
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.3s ease-out;
}
.modal-content {
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}
.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--text-primary);
  opacity: 0.6;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    opacity: 1;
    transform: rotate(90deg);
  }
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.proposal-id {
  font-family: $font-mono;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 12px;
  line-height: 1.2;
  display: block;
  text-shadow: 0 0 20px rgba(0, 229, 153, 0.2);
}

.detail-description {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-primary, rgba(255, 255, 255, 0.8));
  line-height: 1.6;
  margin-bottom: 24px;
  display: block;
}

.policy-details {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #00e599;
  letter-spacing: 0.1em;
  display: block;
  margin-bottom: 12px;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.policy-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.label-mute {
  opacity: 0.6;
}
.value-highlight {
  font-weight: 700;
  text-transform: uppercase;
}
.value-mono {
  font-family: $font-mono;
  font-weight: 700;
}

.timeline-section {
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  margin-bottom: 24px;
}

.timeline {
  display: flex;
  gap: 16px;
}

.timeline-item {
  flex: 1;
  text-align: center;
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: 0 auto 8px;
  transition: all 0.3s;

  &.active {
    background: #00e599;
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.5);
  }
  &.inactive {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
}

.timeline-text {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  display: block;
  opacity: 0.6;
}

.voting-section {
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.vote-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.vote-hint {
  background: rgba(253, 224, 71, 0.1);
  border: 1px solid rgba(253, 224, 71, 0.2);
  color: #fde047;
  padding: 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.05em;
}

.text-accent {
  color: #00e599;
}
.text-center {
  text-align: center;
}
.mb-4 {
  margin-bottom: 16px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
