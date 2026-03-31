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

:global(body) {
  background: linear-gradient(135deg, var(--qf-bg-start) 0%, var(--qf-bg-end) 100%);
  color: var(--qf-text);
}

.qf-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

.op-btn {
  width: 100%;
}
</style>
