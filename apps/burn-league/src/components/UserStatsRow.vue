<template>
  <div class="user-stats-row">
    <div class="user-stat">
      <span class="user-stat-value">{{ formatNum(userBurned) }}</span>
      <span class="user-stat-label">{{ t("youBurned") }} ({{ t("tokenGas") }})</span>
    </div>
    <div class="user-stat">
      <span class="user-stat-value">{{ formattedRank }}</span>
      <span class="user-stat-label">{{ t("rank") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatNum } from "../composables/useBurnLeague";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  userBurned: number;
  formattedRank: string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.user-stats-row {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 400px;
}

.user-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.user-stat-value {
  font-size: 20px;
  font-weight: 800;
  font-family: $font-mono;
  color: var(--text-primary);
}

.user-stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
}

@media (max-width: 480px) {
  .user-stats-row { gap: 8px; }
  .user-stat { padding: 12px 8px; }
  .user-stat-value { font-size: 16px; }
}
</style>
