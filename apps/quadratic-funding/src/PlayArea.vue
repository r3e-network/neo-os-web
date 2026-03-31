<template>
  <div class="qf-play-area">
    <!-- Hero -->
    <FundingHero
      :t="t"
      :progress-pct="roundProgressPct"
      :matching-pool-display="matchingPoolDisplay"
      :project-count="projects.length"
    />

    <!-- Round Form -->
    <RoundForm ref="roundFormRef" @create="handleCreateRound" />

    <!-- Round List -->
    <RoundList
      :rounds="rounds"
      :selected-round-id="selectedRoundId"
      :is-refreshing="isRefreshingRounds"
      :round-status-label="roundStatusLabel"
      :format-amount="formatAmount"
      :format-schedule="formatSchedule"
      :format-address="formatAddress"
      @refresh="refreshRounds"
      @select="selectRound"
    />

    <!-- Round Admin Panel -->
    <RoundAdminPanel
      v-if="selectedRound"
      :round="selectedRound"
      :can-manage="canManageSelectedRound"
      :can-finalize="canFinalizeSelectedRound"
      :can-claim-unused="canClaimUnused"
      :is-adding-matching="isAddingMatching"
      :is-finalizing="isFinalizing"
      :is-claiming-unused="isClaimingUnused"
      @add-matching="handleAddMatching"
      @finalize="handleFinalize"
      @claim-unused="handleClaimUnused"
    />

    <!-- Quick Contribute (Operation Panel) -->
    <NeoCard variant="erobo" :title="t('quickContribute')">
      <NeoButton size="sm" variant="primary" class="op-btn" type="button" @click="goToContributeTab">
        {{ t("tabContribute") }}
      </NeoButton>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import { formatAddress } from "@shared/utils/format";
import FundingHero from "./components/FundingHero.vue";
import RoundForm from "./pages/index/components/RoundForm.vue";
import RoundList from "./pages/index/components/RoundList.vue";
import RoundAdminPanel from "./pages/index/components/RoundAdminPanel.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const rounds = computed(() => (props.state.rounds?.value ?? []) as Array<Record<string, unknown>>);
const selectedRoundId = computed(() => props.state.selectedRoundId?.value as number | null);
const selectedRound = computed(() => props.state.selectedRound?.value as Record<string, unknown> | null);
const isRefreshingRounds = computed(() => Boolean(props.state.isRefreshingRounds?.value ?? false));
const isAddingMatching = computed(() => Boolean(props.state.isAddingMatching?.value ?? false));
const isFinalizing = computed(() => Boolean(props.state.isFinalizing?.value ?? false));
const isClaimingUnused = computed(() => Boolean(props.state.isClaimingUnused?.value ?? false));
const canManageSelectedRound = computed(() => Boolean(props.state.canManageSelectedRound?.value ?? false));
const canFinalizeSelectedRound = computed(() => Boolean(props.state.canFinalizeSelectedRound?.value ?? false));
const canClaimUnused = computed(() => Boolean(props.state.canClaimUnused?.value ?? false));
const projects = computed(() => (props.state.projects?.value ?? []) as Array<Record<string, unknown>>);
const matchingPoolDisplay = computed(() => String(props.state.matchingPoolDisplay?.value ?? t("notAvailable")));

const activeRounds = computed(() => rounds.value.filter((r: Record<string, unknown>) => r.status === "active").length);
const roundProgressPct = computed(() => {
  const total = rounds.value.length;
  if (total === 0) return 0;
  return Math.round((activeRounds.value / total) * 100);
});

const roundFormRef = ref<{ reset?: () => void } | null>(null);

const roundStatusLabel = (round: Record<string, unknown>) => String(round.statusLabel ?? round.status ?? "");
const formatAmount = (val: unknown) => String(val ?? "0");
const formatSchedule = (val: unknown) => String(val ?? "");

const refreshRounds = async () => {};

const selectRound = (round: Record<string, unknown>) => {
  if (props.state.selectedRoundId) {
    (props.state.selectedRoundId as Ref<number | null>).value = round.id as number;
  }
};

const handleCreateRound = async (...args: unknown[]) => {
  const handler = actions.get("createRound");
  if (handler) await handler(...args);
};

const handleAddMatching = async (...args: unknown[]) => {
  const handler = actions.get("addMatching");
  if (handler) await handler(...args);
};

const handleFinalize = async (...args: unknown[]) => {
  const handler = actions.get("finalize");
  if (handler) await handler(...args);
};

const handleClaimUnused = async (...args: unknown[]) => {
  const handler = actions.get("claimUnused");
  if (handler) await handler(...args);
};

const goToContributeTab = () => {
  if (props.state.activeTab) {
    (props.state.activeTab as Ref<string>).value = "contribute";
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/quadratic-funding-theme.scss" as *;
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

:global(body) {
  background: linear-gradient(135deg, var(--qf-bg-start) 0%, var(--qf-bg-end) 100%);
  color: var(--qf-text);
}

.qf-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: var(--qf-font, 'Outfit', sans-serif);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 280px;
    background:
      radial-gradient(ellipse at 25% 0%, rgba(194, 65, 12, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 75% 10%, rgba(124, 58, 237, 0.06) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

.op-btn {
  width: 100%;

  :deep(.neo-btn) {
    font-family: var(--qf-font, 'Outfit', sans-serif);
    background: var(--qf-pool-gradient, linear-gradient(135deg, #C2410C, #7C3AED));
    color: #fff;
    font-weight: 700;
    border: none;
    border-radius: 14px;
    box-shadow: 0 6px 24px rgba(194, 65, 12, 0.25);
    letter-spacing: 0.02em;
    transition: all 0.25s ease;

    &:hover {
      box-shadow: 0 10px 32px rgba(194, 65, 12, 0.35);
      transform: translateY(-2px);
    }
  }
}

:deep(.neo-card) {
  font-family: var(--qf-font, 'Outfit', sans-serif);
  background: var(--qf-card-bg, rgba(22, 14, 32, 0.85));
  border: 1px solid var(--qf-card-border, rgba(124, 58, 237, 0.2));
  border-radius: 18px;
  box-shadow: var(--qf-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.25));
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: rgba(124, 58, 237, 0.35);
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(124, 58, 237, 0.08);
    transform: translateY(-1px);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--qf-pool-gradient, linear-gradient(135deg, #C2410C, #7C3AED));
    opacity: 0.5;
  }
}

:deep(.neo-btn--primary) {
  font-family: var(--qf-font, 'Outfit', sans-serif);
  background: var(--qf-pool-gradient, linear-gradient(135deg, #C2410C, #7C3AED));
  color: #fff;
  font-weight: 700;
  border: none;
  border-radius: 14px;
  box-shadow: 0 6px 24px rgba(124, 58, 237, 0.3);
  letter-spacing: 0.02em;
  transition: all 0.25s ease;

  &:hover {
    box-shadow: 0 8px 32px rgba(124, 58, 237, 0.4);
    transform: translateY(-1px);
  }
}

:deep(.neo-btn--secondary) {
  font-family: var(--qf-font, 'Outfit', sans-serif);
  background: var(--qf-multiplier-bg, rgba(124, 58, 237, 0.12));
  border: 1px solid var(--qf-multiplier-border, rgba(124, 58, 237, 0.25));
  color: var(--qf-accent, #7C3AED);
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(124, 58, 237, 0.2);
    border-color: rgba(124, 58, 237, 0.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .op-btn :deep(.neo-btn):hover,
  :deep(.neo-card):hover,
  :deep(.neo-btn--primary):hover {
    transform: none;
  }
}
</style>
