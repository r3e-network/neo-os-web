<template>
  <div class="mobile-stats">
    <div class="stat-item">
      <span class="stat-value">{{ totalProofs }}</span>
      <span class="stat-label">{{ t("totalProofs") }}</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{{ yourProofs }}</span>
      <span class="stat-label">{{ t("yourProofs") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  totalProofs: number;
  yourProofs: number;
}>();
</script>

<style lang="scss" scoped>
.mobile-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.stat-item {
  text-align: center;
  padding: 8px 16px;
  background: rgba(159, 157, 243, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(159, 157, 243, 0.1);
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
}

.stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}
</style>
