<template>
  <NeoCard variant="erobo">
    <div v-if="bids.length === 0" class="empty-neo">
      {{ t("noBids") }}
    </div>
    <div v-for="bid in bids" :key="bid.address" class="bid-row">
      <div class="bid-address">{{ bid.address }}</div>
      <div class="bid-amount">{{ formatNum(bid.amount, 2) }} {{ t("tokenGas") }}</div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { formatNum } from "@shared/utils/format";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  bids: Array<{ address: string; amount: number }>;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/gov-merc-theme.scss" as *;

.empty-neo {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--merc-empty-text);
  text-align: center;
  text-shadow: var(--merc-empty-shadow);
  padding: 32px;
}

.bid-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dotted var(--merc-bid-divider);
  transition: background 0.2s ease;

  &:hover {
    background: rgba(120, 40, 200, 0.05);
  }
}

.bid-address {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-size: 10px;
  color: var(--merc-bid-address);
}

.bid-amount {
  font-family: var(--font-family-mono, "Courier New", monospace);
  font-weight: 700;
  color: var(--merc-bid-amount);
  text-shadow: 0 0 6px rgba(0, 229, 153, 0.3);
}
</style>
