<template>
  <NeoCard :variant="getContractVariant(contract.status)" class="contract-card" :class="contract.status">
    <template #header-extra>
      <view class="contract-status-badge" :class="contract.status">
        <view class="status-indicator">
          <view class="pulse-dot"></view>
          <view class="pulse-ring"></view>
        </view>
        <text class="status-text">{{ t(contract.status) }}</text>
      </view>
    </template>

    <view class="crack-overlay" v-if="contract.status === 'broken'"></view>
    
    <view class="contract-content">
      <view class="relationship-connector">
        <view class="avatar me">
          {{ (address || "").slice(0, 2) }}
        </view>
        <view class="connection-line" :class="contract.status">
          <view class="heart-node">
            <text class="heart-icon">{{ contract.status === 'broken' ? '💔' : '❤️' }}</text>
          </view>
        </view>
        <view class="avatar partner">
          {{ contract.partner.slice(0, 2) }}
        </view>
      </view>

      <text class="contract-title" v-if="contract.title">{{ contract.title }}</text>

      <view class="info-grid-glass">
        <view class="info-item">
          <text class="info-label">{{ t("stake") }}</text>
          <text class="info-value stake">{{ contract.stake }} GAS</text>
        </view>
        <view class="info-item">
          <text class="info-label">{{ t("duration") }}</text>
          <text class="info-value">{{ contract.daysLeft }} {{ t("daysLeft") }}</text>
        </view>
      </view>

      <view class="progress-section-glass">
        <view class="progress-header">
          <text class="progress-label">{{ t("progress") }}</text>
          <text class="progress-val">{{ contract.progress }}%</text>
        </view>
        <view class="progress-track-glass">
          <view class="progress-fill-glass" :style="{ width: contract.progress + '%' }">
            <view class="shimmer"></view>
          </view>
        </view>
      </view>

      <view class="action-area mt-4">
        <NeoButton
          v-if="contract.status === 'pending' && canSign"
          variant="primary"
          size="sm"
          block
          class="glow-btn"
          @click="$emit('sign', contract)"
        >
          {{ t("signContract") }}
        </NeoButton>
        <NeoButton
          v-else-if="contract.status === 'active'"
          variant="danger"
          size="sm"
          block
          class="break-btn"
          @click="$emit('break', contract)"
        >
          {{ t("breakContract") }}
        </NeoButton>
        <view v-else class="status-panel-glass">
          <text class="status-display-text">{{ t(contract.status) }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton } from "@shared/components";

const getContractVariant = (status: string) => {
  switch (status) {
    case 'active': return 'erobo-neo';
    case 'broken': return 'danger';
    case 'pending': return 'warning';
    default: return 'erobo';
  }
};

interface RelationshipContractView {
  id: number;
  party1: string;
  party2: string;
  partner: string;
  title: string;
  terms: string;
  stake: number;
  stakeRaw: string;
  progress: number;
  daysLeft: number;
  status: "pending" | "active" | "broken" | "ended";
}

const props = defineProps<{
  contract: RelationshipContractView;
  address: string | null;
  t: (key: string) => string;
}>();

defineEmits(["sign", "break"]);

const canSign = computed(() =>
  Boolean(props.address && props.contract.status === "pending" && props.contract.party2 === props.address),
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.contract-card {
  position: relative;
  transition: all 0.3s;
  
  &.broken {
    border-color: #ef4444;
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
  }
  
  &.active {
    box-shadow: 0 0 20px rgba(255, 105, 180, 0.2);
  }
}

.crack-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L20 40 L10 60 L40 50 L60 80 L80 40 L100 0' fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='1'/%3E%3C/svg%3E");
  background-size: cover;
  opacity: 0.3;
  pointer-events: none;
  z-index: 1;
}

.contract-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);

  &.active { border-color: #ff6b6b; color: #ff6b6b; }
  &.broken { border-color: #ef4444; color: #ef4444; }
  &.pending { border-color: #fde047; color: #fde047; }
}

.status-indicator {
  position: relative;
  width: 8px; height: 8px;
}

.pulse-dot {
  width: 8px; height: 8px;
  background: currentColor;
  border-radius: 50%;
}

.pulse-ring {
  position: absolute;
  top: -4px; left: -4px; right: -4px; bottom: -4px;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: 0;
  animation: ripple 2s infinite;
}

.status-text {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.relationship-connector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 16px;
}

.contract-title {
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 16px;
  color: var(--text-primary);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--text-primary);
  border: 2px solid rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  z-index: 2;
}

.connection-line {
  flex: 1;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 12px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &.active {
    background: linear-gradient(90deg, #ff6b6b, #ff9f43);
    box-shadow: 0 0 10px rgba(255, 107, 107, 0.4);
  }
  
  &.broken {
    background: transparent;
    border-top: 2px dashed #ef4444;
  }
}

.heart-node {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.heart-icon { font-size: 12px; }

.info-grid-glass {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.info-item {
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.info-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: $font-mono;
  
  &.stake {
    color: #00e599;
    text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
  }
}

.progress-section-glass {
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label { font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
.progress-val { font-size: 10px; font-weight: 700; color: #ff6b6b; font-family: $font-mono; }

.progress-track-glass {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill-glass {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #ff9f43);
  position: relative;
}

.shimmer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  transform: translateX(-100%);
  animation: glimmer 2s infinite;
}

.status-panel-glass {
  text-align: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-display-text {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.glow-btn {
  box-shadow: 0 0 15px rgba(253, 224, 71, 0.2);
}

.break-btn:hover {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
}

@keyframes ripple {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2.5); opacity: 0; }
}

@keyframes glimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
