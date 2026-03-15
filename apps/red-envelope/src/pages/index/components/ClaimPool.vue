<template>
  <div class="claim-pool">
    <div class="section-header">
      <span class="section-title">{{ t("claimTitle") }}</span>
    </div>

    <!-- Pool ID Input -->
    <div class="pool-input-row">
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
    </div>

    <!-- Error -->
    <span v-if="error" class="error-msg">{{ error }}</span>

    <!-- Success -->
    <div v-if="claimResult" class="claim-success">
      <span class="success-icon">🎉</span>
      <span class="success-text">{{ t("claimSuccess") }}</span>
    </div>

    <!-- Available Pools -->
    <div class="pools-section">
      <span class="pools-label">{{ t("availablePools") }}</span>

      <div v-if="pools.length === 0" class="empty-state">
        <span class="empty-icon">🎯</span>
        <span class="empty-text">{{ t("noPools") }}</span>
      </div>

      <div v-else class="pool-grid">
        <div v-for="pool in pools" :key="pool.id" class="pool-card">
          <div class="pool-header">
            <span class="pool-icon">🧧</span>
            <span class="pool-id">Pool #{{ pool.id }}</span>
          </div>

          <span class="pool-amount">💎 {{ pool.totalAmount }} GAS</span>

          <div class="pool-progress">
            <span class="progress-text">
              🎫
              {{ t("claimedCount").replace("{0}", String(pool.openedCount)).replace("{1}", String(pool.packetCount)) }}
            </span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent(pool) + '%' }" />
            </div>
          </div>

          <div v-if="pool.minNeoRequired > 0" class="pool-gate">
            <span class="gate-text">
              🔒 {{ pool.minNeoRequired }} NEO, {{ Math.round(pool.minHoldSeconds / 86400) }}d hold
            </span>
          </div>

          <span v-if="pool.expiryTime" class="pool-expiry"> ⏰ {{ formatTimeLeft(pool.expiryTime) }} </span>

          <span v-if="pool.message" class="pool-message">"{{ pool.message }}"</span>

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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoInput, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { EnvelopeItem, ClaimItem } from "@/composables/useRedEnvelopeOpen";

const props = defineProps<{
  pools: EnvelopeItem[];
}>();

const { t } = createUseI18n(messages)();

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
