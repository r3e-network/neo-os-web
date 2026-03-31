<template>
  <div class="danger-ring-hero">
    <!-- Danger Ring -->
    <div :class="['danger-ring', dangerLevel, { pulse: shouldPulse }]">
      <div class="ring-inner">
        <div class="ring-glow" />
        <!-- Countdown Timer -->
        <div class="hero-countdown" aria-live="polite" role="timer">
          <span class="countdown-digits">{{ countdown }}</span>
          <span class="countdown-label">{{ t("timeUntilEvent") }}</span>
        </div>
      </div>
    </div>

    <!-- Prize Pool (MASSIVE) -->
    <div class="hero-prize-pool">
      <span class="prize-label">{{ t("totalPot") }}</span>
      <div class="prize-amount-row">
        <span class="prize-gas-icon" aria-hidden="true">&#x26FD;</span>
        <span class="prize-amount">{{ formattedPot }}</span>
        <span class="prize-token">{{ t("tokenGas") }}</span>
      </div>
      <div class="pot-glow-bar" />
    </div>

    <!-- Claim Banner -->
    <div v-if="canClaim" class="hero-claim-banner" role="alert">
      <div class="claim-trophy" aria-hidden="true">&#x1F3C6;</div>
      <span class="claim-text">{{ t("youWon") }}</span>
      <NeoButton variant="primary" size="lg" block type="button" :loading="isClaiming" @click="$emit('claim')" :aria-label="t('claimPrize')">
        {{ t("claimPrize") }}
      </NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  countdown: string;
  dangerLevel: string;
  shouldPulse: boolean;
  formattedPot: string;
  canClaim: boolean;
  isClaiming: boolean;
}>();

defineEmits<{
  claim: [];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "../pages/index/last-survivor-theme.scss" as *;

.danger-ring-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 24px;
  width: 100%;
}

/* ── Danger Ring ── */
.danger-ring {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(from 0deg, rgba(16, 185, 129, 0.15), rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.15), rgba(16, 185, 129, 0.15));
  border: 3px solid rgba(255, 255, 255, 0.1);
  transition: all 0.5s ease;

  &::before {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid transparent;
    animation: ring-rotate 8s linear infinite;
  }

  &.low {
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow: 0 0 30px rgba(16, 185, 129, 0.15), inset 0 0 30px rgba(16, 185, 129, 0.05);
    &::before { border-top-color: rgba(16, 185, 129, 0.6); }
  }
  &.medium {
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 0 30px rgba(245, 158, 11, 0.15), inset 0 0 30px rgba(245, 158, 11, 0.05);
    &::before { border-top-color: rgba(245, 158, 11, 0.6); }
  }
  &.high {
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow: 0 0 40px rgba(239, 68, 68, 0.2), inset 0 0 30px rgba(239, 68, 68, 0.05);
    &::before { border-top-color: rgba(239, 68, 68, 0.6); }
  }
  &.critical {
    border-color: rgba(239, 68, 68, 0.6);
    box-shadow: 0 0 50px rgba(239, 68, 68, 0.35), inset 0 0 40px rgba(239, 68, 68, 0.1);
    &::before { border-top-color: rgba(239, 68, 68, 0.8); }
  }
  &.pulse {
    animation: danger-pulse 1s ease-in-out infinite alternate;
  }
}

.ring-inner {
  width: 190px;
  height: 190px;
  border-radius: 50%;
  background: var(--bg-elevated, rgba(0, 0, 0, 0.5));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.ring-glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at center, var(--ring-glow-color, rgba(165, 180, 252, 0.08)) 0%, transparent 70%);
}

.hero-countdown {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.countdown-digits {
  font-size: 32px;
  font-weight: 900;
  font-family: $font-mono;
  letter-spacing: 0.04em;
  line-height: 1;
  background: linear-gradient(180deg, var(--doom-white, #fff) 0%, var(--doom-indigo-light, #a5b4fc) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 10px rgba(165, 180, 252, 0.5));

  .critical & {
    background: linear-gradient(180deg, var(--doom-white, #fff) 0%, var(--doom-danger-light, #f87171) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 0 12px rgba(248, 113, 113, 0.6));
  }
}

.countdown-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-secondary, rgba(255, 255, 255, 0.4));
}

/* ── Prize Pool ── */
.hero-prize-pool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 28px;
  background: rgba(251, 191, 36, 0.04);
  border: 1px solid rgba(251, 191, 36, 0.12);
  border-radius: 16px;
  position: relative;
}

.prize-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-secondary, rgba(255, 255, 255, 0.4));
}

.prize-amount-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prize-gas-icon {
  font-size: 28px;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.5));
  animation: icon-pulse 2s ease-in-out infinite alternate;
}

.prize-amount {
  font-size: 38px;
  font-weight: 900;
  font-family: $font-mono;
  background: linear-gradient(135deg, var(--doom-warn-light, #fbbf24), var(--doom-amber, #f59e0b), var(--doom-warn, #d97706));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.5));
  letter-spacing: 0.02em;
}

.prize-token {
  font-size: 14px;
  font-weight: 800;
  color: rgba(251, 191, 36, 0.6);
  letter-spacing: 0.1em;
  align-self: flex-end;
  margin-bottom: 6px;
}

.pot-glow-bar {
  width: 80%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), transparent);
  border-radius: 1px;
  animation: glow-bar-pulse 2s ease-in-out infinite;
}

@keyframes icon-pulse {
  0% { transform: scale(1); }
  100% { transform: scale(1.1); }
}

@keyframes glow-bar-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* ── Claim Banner ── */
.hero-claim-banner {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.08));
  border: 1px solid rgba(16, 185, 129, 0.3);
  text-align: center;
  animation: claim-glow 2s ease-in-out infinite alternate;
}

.claim-trophy {
  font-size: 42px;
  margin-bottom: 8px;
  animation: trophy-bounce 1s ease-in-out infinite;
}

.claim-text {
  display: block;
  font-size: 20px;
  font-weight: 900;
  color: var(--doom-success, var(--accent-success, #34d399));
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-shadow: 0 0 20px rgba(52, 211, 153, 0.4);
}

@keyframes trophy-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6px) scale(1.05); }
}

@keyframes ring-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes danger-pulse { 0% { transform: scale(1); } 100% { transform: scale(1.03); } }
@keyframes claim-glow { 0% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.1); } 100% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.25); } }

@media (max-width: 480px) {
  .danger-ring { width: 180px; height: 180px; }
  .ring-inner { width: 155px; height: 155px; }
  .countdown-digits { font-size: 26px; }
  .prize-amount { font-size: 22px; }
}
</style>
