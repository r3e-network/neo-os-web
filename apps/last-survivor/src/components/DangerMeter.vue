<template>
  <div class="danger-meter">
    <div class="meter-header">
      <span class="meter-label-left">{{ t("safe") }}</span>
      <div :class="['danger-badge', level]">
        <span>{{ levelText }}</span>
      </div>
      <span class="meter-label-right">{{ t("critical") }}</span>
    </div>
    <div class="meter-track">
      <div :class="['meter-fill', level]" :style="{ width: progress + '%' }" />
      <div class="meter-glow-point" :style="{ left: progress + '%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  level: string;
  levelText: string;
  progress: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.danger-meter {
  width: 100%;
  max-width: 320px;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.meter-label-left,
.meter-label-right {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.3));
}

.danger-badge {
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
  backdrop-filter: blur(4px);

  &.low { background: rgba(16, 185, 129, 0.2); color: var(--doom-safe, var(--accent-success, #34d399)); }
  &.medium { background: rgba(245, 158, 11, 0.2); color: var(--doom-warn-light, var(--accent-warning, #fbbf24)); }
  &.high { background: rgba(239, 68, 68, 0.2); color: var(--doom-danger-light, var(--accent-error, #f87171)); }
  &.critical {
    background: rgba(239, 68, 68, 0.3);
    color: var(--doom-danger-light, var(--accent-error, #f87171));
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
  }
}

.meter-track {
  height: 6px;
  background: var(--bg-elevated, rgba(0, 0, 0, 0.4));
  border-radius: 3px;
  position: relative;
  overflow: visible;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
}

.meter-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
  &.low { background: linear-gradient(90deg, var(--doom-green, #10b981), var(--doom-success, #34d399)); }
  &.medium { background: linear-gradient(90deg, var(--doom-amber, #f59e0b), var(--doom-warn-light, #fbbf24)); }
  &.high { background: linear-gradient(90deg, var(--doom-red, #ef4444), var(--doom-danger-light, #f87171)); }
  &.critical {
    background: linear-gradient(90deg, var(--doom-red-deep, #dc2626), var(--doom-red, #ef4444));
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
  }
}

.meter-glow-point {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--doom-white, var(--text-primary, #fff));
  transform: translate(-50%, -50%);
  box-shadow: 0 0 8px var(--doom-white, rgba(255, 255, 255, 0.8));
  transition: left 0.5s ease;
}
</style>
