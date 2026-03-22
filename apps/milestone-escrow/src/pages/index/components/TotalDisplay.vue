<template>
  <div class="total-row">
    <span class="total-label">{{ t("totalAmount") }}</span>
    <span class="total-value">{{ total }} {{ t("tokenGas") }}</span>
    <span class="total-hint">{{ t("totalHint") }}</span>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  total: string;
}>();

// asset prop removed — token label always uses i18n

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
.total-row {
  background: var(--escrow-total-bg);
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
