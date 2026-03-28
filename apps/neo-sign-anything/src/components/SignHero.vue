<template>
  <div class="hero-container">
    <div class="sign-scene" aria-hidden="true">
      <div class="pen-graphic" aria-hidden="true">✒️</div>
      <div class="checkmark-graphic" aria-hidden="true">✓</div>
    </div>
  </div>

  <div class="header">
    <span class="title">{{ t("signTitle") }}</span>
    <span class="subtitle">{{ t("signDesc") }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.hero-container {
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(30, 64, 175, 0.12), rgba(59, 130, 246, 0.06), rgba(99, 102, 241, 0.08));
  background-size: 200% 200%;
  animation: sign-ink-flow 6s ease-in-out infinite;
  border: 1px solid rgba(30, 64, 175, 0.12);
  border-radius: 16px;
  padding: 24px 20px;
  width: 100%;
  max-width: 400px;
}

.sign-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  height: 70px;
}

.pen-graphic {
  font-size: 32px;
  animation: pen-writing 4s ease-in-out infinite;
  border-radius: 50%;
  padding: 8px;
}

.checkmark-graphic {
  font-size: 28px;
  color: rgba(0, 229, 153, 0.6);
  font-weight: 900;
  animation: seal-stamp-press 3.5s ease-in-out infinite 0.3s;
}

.header {
  text-align: center;
  margin-bottom: 8px;
}

.title {
  font-size: 28px;
  font-weight: 900;
  color: var(--text-primary);
  display: block;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.4;
}

@keyframes sign-ink-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes pen-writing {
  0%, 100% { transform: rotate(-30deg) translateX(0); }
  25% { transform: rotate(-25deg) translateX(4px) translateY(-2px); }
  50% { transform: rotate(-35deg) translateX(8px); }
  75% { transform: rotate(-28deg) translateX(4px) translateY(2px); }
}

@keyframes seal-stamp-press {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.15); }
  30% { transform: scale(0.95); }
  50% { transform: scale(1.02); }
}

@media (max-width: 767px) {
  .title { font-size: 22px; }
  .subtitle { font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-container { animation: none; }
  .pen-graphic { animation: none; }
  .checkmark-graphic { animation: none; }
}
</style>
