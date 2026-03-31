<template>
  <div class="loan-play-area">
    <!-- ── Wallet Prompt ── -->
    <div v-if="!isConnected" class="wallet-prompt">
      <NeoCard variant="warning" class="connect-card">
        <span class="connect-label">{{ t("connectWalletToUse") }}</span>
        <NeoButton type="button" variant="primary" size="sm" @click="handleAction('connectWallet')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <!-- ── Hero Container ── -->
    <div class="hero-container">
      <!-- Vault security badge -->
      <div class="vault-security-badge">
        <span class="security-icon" aria-hidden="true">&#x1F512;</span>
        <span class="security-text">{{ t("locked") || "VAULT SECURED" }}</span>
        <span class="security-dot" />
      </div>

      <CollateralDashboard
        :t="t"
        :collateralDisplay="collateralDisplay"
        :borrowedDisplay="borrowedDisplay"
        :healthFactorDisplay="healthFactorDisplay"
        :healthColor="healthColor"
        :healthArc="healthArc"
      />
      <LtvBar
        :t="t"
        :currentLTVDisplay="currentLTVDisplay"
        :currentLTV="currentLTV"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — Composition root for Self-Loan
 *
 * Composes CollateralDashboard (locked/borrowed/gauge) and LtvBar.
 * All computation lives in composables/useSelfLoan.ts.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import CollateralDashboard from "./components/CollateralDashboard.vue";
import LtvBar from "./components/LtvBar.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const isConnected = computed(() => Boolean(props.state.isConnected?.value ?? false));
const collateralDisplay = computed(() => String(props.state.collateralDisplay?.value ?? "0"));
const borrowedDisplay = computed(() => String(props.state.borrowedDisplay?.value ?? "0"));
const healthFactorDisplay = computed(() => String(props.state.healthFactorDisplay?.value ?? t("notAvailable")));
const currentLTVDisplay = computed(() => String(props.state.currentLTVDisplay?.value ?? t("notAvailable")));
const currentLTV = computed(() => Number(props.state.currentLTV?.value ?? 0));
const healthColor = computed(() => String(props.state.healthColor?.value ?? "rgba(255,255,255,0.2)"));
const healthArc = computed(() => Number(props.state.healthArc?.value ?? 0));

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleAction = async (name: string) => {
  const handler = actions.get(name);
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/self-loan-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,500;0,700;0,800;1,400&display=swap');

.loan-play-area {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: var(--vault-font, 'Plus Jakarta Sans', sans-serif);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent 10%, var(--vault-gold, #D4A853) 50%, transparent 90%);
    opacity: 0.6;
    z-index: 2;
  }
}

.wallet-prompt {
  .connect-card {
    background: var(--vault-surface-elevated, rgba(30, 41, 59, 0.8));
    border: 1px solid var(--checkbook-card-border, rgba(212, 168, 83, 0.18));
    border-radius: 18px;
    padding: 32px 24px;
    backdrop-filter: blur(16px);
    text-align: center;
    box-shadow: var(--checkbook-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.3));
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 80px;
      height: 80px;
      background: radial-gradient(circle, rgba(212, 168, 83, 0.12) 0%, transparent 70%);
      border-radius: 50%;
      top: -20px;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--vault-gold, #D4A853), transparent);
      opacity: 0.3;
    }
  }

  .connect-label {
    display: block;
    font-family: var(--vault-font, 'Plus Jakarta Sans', sans-serif);
    font-size: 14px;
    font-weight: 600;
    color: var(--checkbook-text-muted, rgba(228, 232, 239, 0.6));
    margin-bottom: 16px;
    letter-spacing: 0.02em;
  }

  :deep(.neo-btn) {
    font-family: var(--vault-font, 'Plus Jakarta Sans', sans-serif);
    background: linear-gradient(135deg, var(--vault-gold, #D4A853) 0%, var(--vault-trust-green, #059669) 100%);
    color: #fff;
    font-weight: 700;
    border-radius: 12px;
    border: none;
    transition: all 0.25s ease;
    box-shadow: 0 6px 20px var(--vault-gold-glow, rgba(212, 168, 83, 0.35));
    letter-spacing: 0.02em;

    &:hover {
      box-shadow: 0 10px 32px var(--vault-gold-glow, rgba(212, 168, 83, 0.35));
      transform: translateY(-2px);
    }
  }
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 28px 16px;
  gap: 24px;
  background: var(--vault-seal-gradient, linear-gradient(135deg, rgba(212, 168, 83, 0.2) 0%, rgba(5, 150, 105, 0.12) 100%));
  border: 1px solid var(--checkbook-card-border, rgba(212, 168, 83, 0.18));
  border-radius: 20px;
  box-shadow: var(--checkbook-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.3));
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    bottom: 12px;
    border: 1px solid rgba(212, 168, 83, 0.1);
    border-radius: 14px;
    pointer-events: none;
  }

  .vault-security-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(5, 150, 105, 0.06);
    border: 1px solid rgba(5, 150, 105, 0.15);
    margin-bottom: 8px;
  }

  .security-icon {
    font-size: 14px;
  }

  .security-text {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: rgba(5, 150, 105, 0.7);
  }

  .security-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #059669;
    box-shadow: 0 0 6px rgba(5, 150, 105, 0.6);
    animation: security-blink 2s ease-in-out infinite;
  }

  @keyframes security-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  &::after {
    content: '';
    position: absolute;
    top: -60px;
    right: -60px;
    width: 160px;
    height: 160px;
    background: radial-gradient(circle, rgba(212, 168, 83, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }
}

:deep(.neo-card) {
  font-family: var(--vault-font, 'Plus Jakarta Sans', sans-serif);
  background: var(--checkbook-card-bg, rgba(18, 24, 38, 0.85));
  border: 1px solid var(--checkbook-card-border, rgba(212, 168, 83, 0.18));
  border-radius: 16px;
  box-shadow: var(--checkbook-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(12px);
}

:deep(.neo-btn--primary) {
  font-family: var(--vault-font, 'Plus Jakarta Sans', sans-serif);
  background: linear-gradient(135deg, var(--vault-gold, #D4A853) 0%, #B8922E 100%);
  color: #fff;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  box-shadow: 0 6px 20px var(--vault-gold-glow, rgba(212, 168, 83, 0.35));
  letter-spacing: 0.02em;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 8px 28px var(--vault-gold-glow, rgba(212, 168, 83, 0.35));
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet-prompt :deep(.neo-btn):hover,
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
