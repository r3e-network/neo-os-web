<template>
  <view class="my-envelopes">
    <!-- Section 1: Spreading Envelopes -->
    <view class="section-header">
      <text class="section-title">🔄 {{ t("sectionSpreading") }}</text>
    </view>

    <view v-if="spreadingEnvelopes.length === 0" class="empty-state">
      <text class="empty-icon">🧧</text>
      <text class="empty-text">{{ t("noEnvelopesHeld") }}</text>
    </view>

    <view v-else class="envelope-grid">
      <view
        v-for="envelope in spreadingEnvelopes"
        :key="envelope.id"
        class="envelope-card"
        :class="{
          active: envelope.canOpen,
          expired: envelope.expired,
          depleted: envelope.depleted,
        }"
      >
        <view class="card-header">
          <text class="envelope-icon">🧧</text>
          <view class="status-badge" :class="statusClass(envelope)">
            <text class="status-text">{{ statusLabel(envelope) }}</text>
          </view>
        </view>
        <text class="envelope-amount">{{ envelope.totalAmount }} GAS</text>
        <text class="envelope-from">{{ envelope.from }}</text>
        <text class="envelope-packets">
          {{ t("packets").replace("{0}", String(envelope.openedCount)).replace("{1}", String(envelope.packetCount)) }}
        </text>
        <view v-if="envelope.minNeoRequired > 0" class="neo-gate-badge">
          <text class="gate-text">
            {{
              t("neoGate")
                .replace("{0}", String(envelope.minNeoRequired))
                .replace("{1}", String(Math.round(envelope.minHoldSeconds / 86400)))
            }}
          </text>
        </view>
        <view class="card-actions">
          <NeoButton v-if="envelope.canOpen" variant="primary" size="sm" @click="$emit('open', envelope)">
            {{ t("openEnvelope") }}
          </NeoButton>
          <NeoButton
            v-if="envelope.active && !envelope.depleted"
            variant="secondary"
            size="sm"
            @click="$emit('transfer', envelope)"
          >
            {{ t("transferEnvelope") }}
          </NeoButton>
          <NeoButton
            v-if="envelope.expired && isCreator(envelope)"
            variant="secondary"
            size="sm"
            @click="$emit('reclaim', envelope)"
          >
            {{ t("reclaimEnvelope") }}
          </NeoButton>
        </view>
      </view>
    </view>

    <!-- Section 2: Pools I Created (Lucky Money) -->
    <view class="section-header">
      <text class="section-title">🎯 {{ t("sectionPools") }}</text>
    </view>

    <view v-if="myPools.length === 0" class="empty-state">
      <text class="empty-icon">🎯</text>
      <text class="empty-text">{{ t("noPools") }}</text>
    </view>

    <view v-else class="envelope-grid">
      <view v-for="pool in myPools" :key="'pool-' + pool.id" class="envelope-card pool-card">
        <view class="card-header">
          <text class="envelope-icon">🧧</text>
          <text class="pool-id-label">Pool #{{ pool.id }}</text>
          <view class="status-badge" :class="statusClass(pool)">
            <text class="status-text">{{ statusLabel(pool) }}</text>
          </view>
        </view>
        <text class="envelope-amount">💎 {{ pool.totalAmount }} GAS</text>
        <view class="pool-progress">
          <text class="progress-text">
            🎫 {{ t("claimedCount").replace("{0}", String(pool.openedCount)).replace("{1}", String(pool.packetCount)) }}
          </text>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: poolProgress(pool) + '%' }" />
          </view>
        </view>
        <view class="card-actions">
          <NeoButton
            v-if="pool.expired && pool.remainingAmount > 0"
            variant="secondary"
            size="sm"
            @click="$emit('reclaim-pool', pool)"
          >
            {{ t("reclaimPool") }}
          </NeoButton>
        </view>
      </view>
    </view>

    <!-- Section 3: NFTs I Claimed -->
    <view class="section-header">
      <text class="section-title">🎫 {{ t("sectionClaims") }}</text>
    </view>

    <view v-if="claims.length === 0" class="empty-state">
      <text class="empty-icon">🎫</text>
      <text class="empty-text">{{ t("noClaims") }}</text>
    </view>

    <view v-else class="envelope-grid">
      <view v-for="claim in claims" :key="'claim-' + claim.id" class="envelope-card claim-card">
        <view class="card-header">
          <text class="envelope-icon">{{ claim.opened ? "✅" : "🧧" }}</text>
          <text class="claim-origin">{{ t("fromPool").replace("{0}", claim.poolId) }}</text>
        </view>
        <text class="envelope-amount">
          {{ claim.opened ? t("claimedGas").replace("{0}", String(claim.amount)) : t("unopened") }}
        </text>
        <view class="card-actions">
          <NeoButton v-if="!claim.opened" variant="primary" size="sm" @click="$emit('open-claim', claim)">
            {{ t("openClaim") }}
          </NeoButton>
          <NeoButton v-if="!claim.opened" variant="secondary" size="sm" @click="$emit('transfer-claim', claim)">
            {{ t("transferClaim") }}
          </NeoButton>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { EnvelopeItem, ClaimItem } from "@/composables/useRedEnvelopeOpen";

const props = defineProps<{
  envelopes: EnvelopeItem[];
  claims: ClaimItem[];
  currentAddress: string;
}>();

defineEmits<{
  open: [envelope: EnvelopeItem];
  transfer: [envelope: EnvelopeItem];
  reclaim: [envelope: EnvelopeItem];
  "open-claim": [claim: ClaimItem];
  "transfer-claim": [claim: ClaimItem];
  "reclaim-pool": [pool: EnvelopeItem];
}>();

const { t } = createUseI18n(messages)();

const spreadingEnvelopes = computed(() =>
  props.envelopes.filter((e) => e.type === "spreading" && e.currentHolder === props.currentAddress)
);

const myPools = computed(() => props.envelopes.filter((e) => e.type === "lucky" && e.creator === props.currentAddress));

const isCreator = (env: EnvelopeItem) => env.creator === props.currentAddress;

const statusClass = (env: EnvelopeItem) => ({
  "status-active": env.canOpen,
  "status-expired": env.expired,
  "status-depleted": env.depleted,
});

const statusLabel = (env: EnvelopeItem) => {
  if (env.depleted) return t("envelopeDepleted");
  if (env.expired) return t("expired");
  return t("ready");
};

const poolProgress = (pool: EnvelopeItem) => {
  if (pool.packetCount === 0) return 0;
  return Math.round((pool.openedCount / pool.packetCount) * 100);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.my-envelopes {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.section-header {
  margin-top: 8px;
  margin-bottom: 4px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--envelope-gold);
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

.envelope-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.envelope-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  border: 1px solid var(--red-envelope-gold-glow);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s;

  &.active {
    border-color: var(--red-envelope-gold-border);
  }

  &.expired {
    opacity: 0.6;
  }

  &.depleted {
    opacity: 0.5;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.envelope-icon {
  font-size: 20px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 6px;
  margin-left: auto;
}

.status-active {
  background: var(--red-envelope-gold-glow);
}

.status-expired {
  background: rgba(255, 255, 255, 0.1);
}

.status-depleted {
  background: rgba(255, 255, 255, 0.08);
}

.status-text {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.envelope-amount {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.envelope-from {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.envelope-packets {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.neo-gate-badge {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
}

.gate-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* Pool card extras */
.pool-id-label {
  font-weight: 700;
  color: var(--envelope-gold);
  font-size: 14px;
}

.pool-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
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

/* Claim card extras */
.claim-origin {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}
</style>
