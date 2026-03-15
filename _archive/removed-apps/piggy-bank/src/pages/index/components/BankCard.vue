<template>
  <div
    class="card"
    role="button"
    tabindex="0"
    :aria-label="`${bank.name} - ${bank.purpose}`"
    @click="$emit('select', bank.id)"
    @keydown.enter="$emit('select', bank.id)"
    :style="{ borderColor: bank.themeColor, boxShadow: `0 0 10px ${bank.themeColor}40` }"
  >
    <div class="card-header">
      <span class="bank-name">{{ bank.name }}</span>
      <div class="status-badge" :class="{ locked: locked }">
        {{ locked ? "🔒" : "🔓" }}
      </div>
    </div>

    <span class="purpose">{{ bank.purpose }}</span>

    <div class="progress-section">
      <span class="label"> {{ t("create.target_label") }}: {{ bank.targetAmount }} {{ bank.targetToken.symbol }} </span>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill unknown"></div>
      </div>
    </div>

    <span class="date-info">
      {{ new Date(bank.unlockTime * 1000).toLocaleDateString() }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { PiggyBank } from "@/stores/piggy";

defineProps<{
  bank: PiggyBank;
  locked: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  select: [id: string];
}>();
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.card {
  background: var(--piggy-card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--piggy-card-border);
  border-radius: 16px;
  padding: 16px;

  &:active {
    transform: scale(0.98);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.bank-name {
  font-size: 18px;
  font-weight: bold;
}

.status-badge {
  font-size: 16px;
}

.purpose {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 12px;
  display: block;
}

.progress-section {
  margin-bottom: 8px;
}

.label {
  font-size: 11px;
  opacity: 0.6;
}

.progress-bar-bg {
  height: 6px;
  background: var(--piggy-progress-bg);
  border-radius: 3px;
  margin-top: 4px;
  overflow: hidden;
}

.progress-bar-fill.unknown {
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    var(--piggy-progress-fill),
    var(--piggy-progress-fill) 10px,
    var(--piggy-progress-fill-strong) 10px,
    var(--piggy-progress-fill-strong) 20px
  );
}

.date-info {
  font-size: 11px;
  opacity: 0.5;
  text-align: right;
  display: block;
}
</style>
