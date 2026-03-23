<template>
  <div class="my-envelopes">
    <div class="section-header">
      <span class="section-title"><AppIcon name="envelope_red" :size="20" aria-hidden="true" /> {{ t("sectionPools") }}</span>
    </div>

    <div v-if="createdEnvelopes.length === 0" class="empty-state">
      <AppIcon name="envelope_red" :size="40" class="empty-icon" aria-hidden="true" />
      <span class="empty-text">{{ t("noEnvelopesHeld") }}</span>
    </div>

    <div v-else class="envelope-grid">
      <div v-for="envelope in createdEnvelopes" :key="envelope.id" class="envelope-card">
        <div class="card-header">
          <AppIcon name="envelope_red" :size="20" class="envelope-icon" aria-hidden="true" />
          <div class="status-badge" :class="statusClass(envelope)">
            <span class="status-text">{{ statusLabel(envelope) }}</span>
          </div>
        </div>
        <span class="envelope-amount">{{ envelope.totalAmount.toFixed(2) }} {{ t("tokenGas") }}</span>
        <span class="envelope-from">{{ envelope.from }}</span>
        <span class="envelope-packets">
          {{ t("claimedCount", { claimed: String(envelope.openedCount), total: String(envelope.packetCount) }) }}
        </span>
        <span class="envelope-packets">
          {{ t("remaining", { remaining: String(envelope.remainingPackets), total: String(envelope.packetCount) }) }}
        </span>
      </div>
    </div>

    <div class="section-header">
      <span class="section-title"><AppIcon name="generous" :size="20" aria-hidden="true" /> {{ t("sectionClaims") }}</span>
    </div>

    <div v-if="claims.length === 0" class="empty-state">
      <AppIcon name="generous" :size="40" class="empty-icon" aria-hidden="true" />
      <span class="empty-text">{{ t("noClaims") }}</span>
    </div>

    <div v-else class="envelope-grid">
      <div v-for="claim in claims" :key="claim.id" class="envelope-card claim-card">
        <div class="card-header">
          <AppIcon name="success" :size="20" class="envelope-icon" aria-hidden="true" />
          <span class="claim-origin">{{ t("fromPool", { poolId: claim.poolId }) }}</span>
        </div>
        <span class="envelope-amount">{{ t("claimedGas", { amount: claim.amount.toFixed(4), tokenGas: t("tokenGas") }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables";
import AppIcon from "@shared/components/AppIcon.vue";
import { messages } from "@/locale/messages";
import type { EnvelopeItem, ClaimItem } from "@/composables/useRedEnvelopeOpen";

const props = defineProps<{
  envelopes: EnvelopeItem[];
  claims: ClaimItem[];
  currentAddress: string;
}>();

const { t } = createUseI18n(messages)();

const createdEnvelopes = computed(() => props.envelopes.filter((item) => item.creator === props.currentAddress));

const statusClass = (env: EnvelopeItem) => ({
  "status-active": env.ready && !env.depleted && !env.expired,
  "status-expired": env.expired,
  "status-depleted": env.depleted,
});

const statusLabel = (env: EnvelopeItem) => {
  if (env.depleted) return t("envelopeDepleted");
  if (env.expired) return t("expired");
  if (!env.ready) return t("notReady");
  return t("ready");
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
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
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
}

@media (max-width: 480px) {
  .envelope-grid {
    gap: 10px;
  }

  .envelope-card {
    padding: 12px;
    border-radius: 10px;
  }

  .section-title {
    font-size: 16px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.envelope-icon {
  font-size: 20px;
}

.envelope-amount {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.envelope-from,
.envelope-packets,
.claim-origin {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.status-badge {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  border-radius: 999px;

  &.status-active {
    background: rgba(46, 204, 113, 0.2);
    color: var(--red-envelope-success);
    border: 1px solid rgba(46, 204, 113, 0.3);
  }

  &.status-expired,
  &.status-depleted {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.58);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }
}
</style>
