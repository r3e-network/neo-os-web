<template>
  <div class="milestone-escrow-play-area">
    <!-- ── Hero Section with Progress Track ── -->
    <div class="hero-container">
      <span class="hero-label">{{ t("appName") }}</span>
      <div class="hero-progress-track">
        <div class="hero-progress-fill" :style="{ width: progressPercent + '%' }" />
        <div
          v-for="cp in milestoneCheckpoints"
          :key="cp.label"
          class="hero-checkpoint"
          :class="{ 'hero-checkpoint--done': cp.done }"
          :style="{ left: cp.position + '%' }"
        >
          <div class="checkpoint-dot" />
          <span class="checkpoint-label">{{ cp.label }}</span>
        </div>
      </div>
      <div class="hero-stats-row">
        <div class="hero-stat">
          <span class="hero-stat-label">{{ t("statusActive") }}</span>
          <span class="hero-stat-value">{{ activeCount }}</span>
        </div>
        <div class="hero-stat-divider" />
        <div class="hero-stat">
          <span class="hero-stat-label">{{ t("statusCompleted") }}</span>
          <span class="hero-stat-value">{{ completedCount }}</span>
        </div>
      </div>
    </div>

    <!-- ── Contract Availability Check ── -->
    <ContractAvailabilityCard
      v-if="!contractReady"
      :title="t('deploymentPendingTitle')"
      :description="t('deploymentPendingDesc')"
      :t="t"
    />
    <template v-else>
      <div class="escrows-header">
        <span class="section-title">{{ t("escrowsTab") }}</span>
        <NeoButton size="sm" variant="secondary" type="button" :loading="isRefreshing" :aria-label="t('refresh')" @click="handleRefresh">
          {{ t("refresh") }}
        </NeoButton>
      </div>

      <div v-if="!hasAddress" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
          <NeoButton size="sm" variant="primary" type="button" :aria-label="t('connectWallet')" @click="handleConnectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </div>

      <EscrowList
        v-else
        :creator-escrows="creatorEscrows"
        :beneficiary-escrows="beneficiaryEscrows"
        :approving-id="approvingId"
        :cancelling-id="cancellingId"
        :claiming-id="claimingId"
        :status-label-func="statusLabelFunc"
        :format-amount-func="formatAmountFunc"
        :format-address-func="formatAddressFunc"
        @approve="handleApproveMilestone"
        @cancel="handleCancelEscrow"
        @claim="handleClaimMilestone"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The custom play area for Milestone Escrow
 *
 * Renders the milestone progress hero, escrow lists, and action buttons.
 * Everything else (sidebar, stats, operation panel, docs, shell chrome)
 * is rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoButton, ContractAvailabilityCard } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import EscrowList from "./pages/index/components/EscrowList.vue";

// ── Props ─────────────────────────────────────────────────────────────
const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

// ── Translation shorthand ─────────────────────────────────────────────
const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const hasAddress = computed(() => Boolean(props.state.address?.value));
const contractReady = computed(() => Boolean(props.state.contractReady?.value ?? false));
const isRefreshing = computed(() => Boolean(props.state.isRefreshing?.value ?? false));
const approvingId = computed(() => String(props.state.approvingId?.value ?? ""));
const cancellingId = computed(() => String(props.state.cancellingId?.value ?? ""));
const claimingId = computed(() => String(props.state.claimingId?.value ?? ""));

const creatorEscrows = computed(() => {
  const raw = props.state.creatorEscrows?.value;
  return Array.isArray(raw) ? raw : [];
});
const beneficiaryEscrows = computed(() => {
  const raw = props.state.beneficiaryEscrows?.value;
  return Array.isArray(raw) ? raw : [];
});

const activeCount = computed(() => creatorEscrows.value.filter((e: { status: string }) => e.status === "active").length);
const completedCount = computed(() => creatorEscrows.value.filter((e: { status: string }) => e.status === "completed").length);
const totalEscrows = computed(() => creatorEscrows.value.length);

const progressPercent = computed(() => {
  if (totalEscrows.value === 0) return 0;
  return Math.round((completedCount.value / totalEscrows.value) * 100);
});

const milestoneCheckpoints = computed(() => {
  const total = totalEscrows.value || 4;
  const steps = Math.min(total, 5);
  return Array.from({ length: steps }, (_, i) => ({
    position: ((i + 1) / steps) * 100,
    done: i < completedCount.value,
    label: `M${i + 1}`,
  }));
});

// ── Passthrough functions from state ──────────────────────────────────
const statusLabelFunc = computed(() => {
  const fn = props.state.statusLabelFunc?.value;
  return typeof fn === "function" ? fn : (s: string) => s;
});
const formatAmountFunc = computed(() => {
  const fn = props.state.formatAmountFunc?.value;
  return typeof fn === "function" ? fn : (a: unknown) => String(a);
});
const formatAddressFunc = computed(() => {
  const fn = props.state.formatAddressFunc?.value;
  return typeof fn === "function" ? fn : (a: string) => a;
});

// ── Action dispatch ───────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleRefresh = async () => {
  const handler = actions.get("refreshEscrows");
  if (handler) await handler();
};

const handleConnectWallet = async () => {
  const handler = actions.get("connectWallet");
  if (handler) await handler();
};

const handleApproveMilestone = async (escrow: unknown) => {
  const handler = actions.get("approveMilestone");
  if (handler) await handler(escrow);
};

const handleCancelEscrow = async (escrow: unknown) => {
  const handler = actions.get("cancelEscrow");
  if (handler) await handler(escrow);
};

const handleClaimMilestone = async (escrow: unknown) => {
  const handler = actions.get("claimMilestone");
  if (handler) await handler(escrow);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;

.milestone-escrow-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

.escrows-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.empty-state {
  margin-top: 10px;
}

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  gap: 16px;
  padding: 32px 20px;
  border-radius: 20px;
  margin-bottom: 20px;
}

.hero-label {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-progress-track {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 6px;
  background: var(--escrow-border-light, rgba(255, 255, 255, 0.1));
  border-radius: 3px;
  margin: 24px 0 32px;
}

.hero-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--escrow-indigo, #6366f1), var(--escrow-purple, #8b5cf6));
  border-radius: 3px;
  transition: width 0.6s ease;
}

.hero-checkpoint {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.checkpoint-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--escrow-border-light-mid, rgba(255, 255, 255, 0.15));
  border: 2px solid var(--escrow-border-light, rgba(255, 255, 255, 0.1));
  transition: all 0.3s ease;
}

.hero-checkpoint--done .checkpoint-dot {
  background: var(--escrow-purple, #8b5cf6);
  border-color: var(--escrow-indigo, #6366f1);
  box-shadow: 0 0 8px rgb(from var(--escrow-purple, #8b5cf6) r g b / 0.4);
}

.checkpoint-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin-top: 10px;
}

.hero-checkpoint--done .checkpoint-label {
  opacity: 0.9;
}

.hero-stats-row {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--escrow-overlay-light, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--escrow-overlay-light-hover, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 16px 24px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.hero-stat-value {
  font-size: 20px;
  font-weight: 700;
}

.hero-stat-divider {
  width: 1px;
  height: 36px;
  background: var(--escrow-border-light, rgba(255, 255, 255, 0.1));
}

/* ── Milestone Escrow Hero Enhancements: Progress Tracking ── */
@keyframes checkpoint-pulse {
  0%,
  100% {
    box-shadow: 0 0 6px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.3);
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    box-shadow:
      0 0 18px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.6),
      0 0 36px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.15);
    transform: translate(-50%, -50%) scale(1.15);
  }
}
@keyframes progress-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-progress-fill,
  .hero-checkpoint--done .checkpoint-dot {
    animation: none;
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 30%, rgb(from var(--escrow-indigo, #6366f1) r g b / 0.1) 0%, transparent 55%);
}
.hero-progress-fill {
  background: linear-gradient(90deg, var(--escrow-indigo, #6366f1), var(--escrow-purple, #8b5cf6), var(--escrow-indigo, #6366f1), var(--escrow-purple, #8b5cf6));
  background-size: 200% 100%;
  animation: progress-shimmer 3s linear infinite;
}
.hero-checkpoint--done .checkpoint-dot {
  animation: checkpoint-pulse 2.5s ease-in-out infinite;
}
.hero-stats-row {
  box-shadow: 0 4px 20px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.12);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgb(from var(--escrow-indigo, #6366f1) r g b / 0.25);
    transform: translateY(-2px);
  }
}
.hero-stat-value {
  box-shadow: none;
  background: var(--escrow-hero-stat-gradient);
}
.hero-label {
  box-shadow: 0 0 16px var(--escrow-hero-label-glow);
}
</style>
