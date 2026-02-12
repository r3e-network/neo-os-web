<template>
  <view class="claim-pool">
    <view class="section-header">
      <text class="section-title">{{ t("claimTitle") }}</text>
    </view>

    <!-- Pool ID Input -->
    <view class="pool-input-row">
      <NeoInput
        :modelValue="poolIdInput"
        @update:modelValue="poolIdInput = $event"
        :placeholder="t('enterPoolId')"
        type="number"
      />
      <NeoButton
        variant="primary"
        size="sm"
        :loading="claiming"
        :disabled="!poolIdInput.trim()"
        @click="handleClaim(poolIdInput.trim())"
      >
        {{ claiming ? t("claiming") : t("claimButton") }}
      </NeoButton>
    </view>

    <!-- Error -->
    <text v-if="error" class="error-msg">{{ error }}</text>

    <!-- Success -->
    <view v-if="claimResult" class="claim-success">
      <text class="success-icon">🎉</text>
      <text class="success-text">{{ t("claimSuccess") }}</text>
    </view>

    <!-- Available Pools -->
    <view class="pools-section">
      <text class="pools-label">{{ t("availablePools") }}</text>

      <view v-if="pools.length === 0" class="empty-state">
        <text class="empty-icon">🎯</text>
        <text class="empty-text">{{ t("noPools") }}</text>
      </view>

      <view v-else class="pool-grid">
        <view v-for="pool in pools" :key="pool.id" class="pool-card">
          <view class="pool-header">
            <text class="pool-icon">🧧</text>
            <text class="pool-id">Pool #{{ pool.id }}</text>
          </view>

          <text class="pool-amount">💎 {{ pool.totalAmount }} GAS</text>

          <view class="pool-progress">
            <text class="progress-text">
              🎫
              {{ t("claimedCount").replace("{0}", String(pool.openedCount)).replace("{1}", String(pool.packetCount)) }}
            </text>
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: progressPercent(pool) + '%' }" />
            </view>
          </view>

          <view v-if="pool.minNeoRequired > 0" class="pool-gate">
            <text class="gate-text">
              🔒 {{ pool.minNeoRequired }} NEO, {{ Math.round(pool.minHoldSeconds / 86400) }}d hold
            </text>
          </view>

          <text v-if="pool.expiryTime" class="pool-expiry"> ⏰ {{ formatTimeLeft(pool.expiryTime) }} </text>

          <text v-if="pool.message" class="pool-message">"{{ pool.message }}"</text>

          <NeoButton
            variant="primary"
            size="sm"
            block
            :loading="claiming"
            :disabled="pool.depleted || pool.expired"
            @click="handleClaim(pool.id)"
          >
            {{ t("claimButton") }}
          </NeoButton>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoInput, NeoButton } from "@shared/components";
import type { EnvelopeItem, ClaimItem } from "@/composables/useRedEnvelopeOpen";

const props = defineProps<{
  pools: EnvelopeItem[];
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  claim: [poolId: string];
}>();

const poolIdInput = ref("");
const claiming = ref(false);
const claimResult = ref<ClaimItem | null>(null);
const error = ref("");

const progressPercent = (pool: EnvelopeItem) => {
  if (pool.packetCount === 0) return 0;
  return Math.round((pool.openedCount / pool.packetCount) * 100);
};

const formatTimeLeft = (expiryTime: number) => {
  const now = Date.now() / 1000;
  const diff = expiryTime - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
};

const handleClaim = (poolId: string) => {
  if (!poolId || claiming.value) return;
  error.value = "";
  claimResult.value = null;
  emit("claim", poolId);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.claim-pool {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.section-header {
  margin-bottom: 4px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--envelope-gold);
}

.pool-input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.error-msg {
  color: var(--red-envelope-error);
  font-size: 13px;
}

.claim-success {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--red-envelope-gold-glow);
  border-radius: 10px;
  border: 1px solid var(--red-envelope-gold-border);
}

.success-icon {
  font-size: 20px;
}

.success-text {
  color: var(--envelope-gold);
  font-weight: 600;
  font-size: 14px;
}

.pools-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pools-label {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
}

.empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 8px;
}

.empty-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.pool-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pool-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  border: 1px solid var(--red-envelope-gold-glow);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pool-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pool-icon {
  font-size: 20px;
}

.pool-id {
  font-weight: 700;
  color: var(--envelope-gold);
  font-size: 15px;
}

.pool-amount {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.progress-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--envelope-gold), var(--envelope-gold-dark));
  border-radius: 3px;
  transition: width 0.3s;
}

.pool-gate {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.gate-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.pool-expiry {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.pool-message {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}
</style>
