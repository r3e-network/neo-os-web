<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { NeoCard } from "@shared/components";
import type { RoutingSlotInfo } from "../data/routingSlots";

defineProps<{
  slots: RoutingSlotInfo[];
}>();

const { t } = createUseI18n(messages)();
</script>

<template>
  <div class="routing-header mb-4 px-1">
    <span class="routing-title">{{ t("routingTabTitle") }}</span>
    <span class="routing-subtitle">{{ t("routingTabSubtitle") }}</span>
  </div>

  <div class="slots-grid">
    <NeoCard
      v-for="slot in slots"
      :key="slot.slot"
      variant="erobo"
      class="slot-card"
      :class="{ 'slot-card--ingress': slot.isDefaultIngress }"
    >
      <div class="slot-top">
        <span class="slot-eyebrow">{{ t("slotLabel") }} {{ slot.slot }}</span>
        <span class="slot-badge">{{ slot.isDefaultIngress ? t("defaultIngressShort") : t("rebalanceShort") }}</span>
      </div>

      <div class="slot-main">
        <span class="slot-name">{{ slot.label }}</span>
        <span class="slot-summary">{{ slot.summary }}</span>
      </div>

      <div class="slot-rows">
        <div class="slot-row">
          <span class="slot-row-label">{{ t("slotRole") }}</span>
          <span class="slot-row-value">{{ slot.role }}</span>
        </div>
        <div class="slot-row">
          <span class="slot-row-label">{{ t("slotTarget") }}</span>
          <span class="slot-row-value">{{ slot.candidateTarget }}</span>
        </div>
        <div class="slot-row">
          <span class="slot-row-label">{{ t("slotFundingPath") }}</span>
          <span class="slot-row-value">{{ slot.fundingPath }}</span>
        </div>
        <div class="slot-row">
          <span class="slot-row-label">{{ t("slotAccount") }}</span>
          <span class="slot-row-value">{{ slot.accountAddress }}</span>
        </div>
        <div class="slot-row">
          <span class="slot-row-label">{{ t("slotVerificationScript") }}</span>
          <span class="slot-row-value">{{ slot.verificationScript }}</span>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<style lang="scss" scoped>
.routing-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.routing-title {
  font-size: 18px;
  font-weight: 800;
}

.routing-subtitle {
  font-size: 13px;
  opacity: 0.72;
  line-height: 1.5;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
  padding: 0 4px;
}

.slot-card {
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 42%),
    rgba(255, 255, 255, 0.02);
}

.slot-card--ingress {
  border-color: rgba(16, 185, 129, 0.28);
  box-shadow: 0 12px 30px rgba(16, 185, 129, 0.08);
}

.slot-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.slot-eyebrow,
.slot-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.slot-eyebrow {
  opacity: 0.66;
}

.slot-badge {
  color: #10b981;
}

.slot-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.slot-name {
  font-size: 18px;
  font-weight: 800;
}

.slot-summary {
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.78;
}

.slot-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.slot-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slot-row-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  opacity: 0.56;
  font-weight: 700;
}

.slot-row-value {
  font-size: 13px;
  line-height: 1.5;
}

@media (min-width: 900px) {
  .slots-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .slots-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
