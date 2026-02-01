<template>
  <view class="total-row">
    <text class="total-label">{{ t("totalAmount") }}</text>
    <text class="total-value">{{ total }} {{ asset }}</text>
    <text class="total-hint">{{ t("totalHint") }}</text>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";

defineProps<{
  total: string;
  asset: string;
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.total-row {
  background: rgba(251, 191, 36, 0.12);
  border-radius: 16px;
  padding: 12px 16px;
}

.total-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--escrow-muted);
}

.total-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--escrow-accent-strong);
}

.total-hint {
  display: block;
  font-size: 11px;
  margin-top: 4px;
  color: var(--escrow-muted);
}
</style>
