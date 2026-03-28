<template>
  <div class="multisig-play-area">
    <MultisigHero
      :t="t"
      :pending-count="pendingCount"
      :completed-count="completedCount"
      :total-count="history.length"
    />

    <!-- Activity Section -->
    <ActivitySection
      :items="history"
      :count="history.length"
      :title="t('recentTitle')"
      :empty-title="t('sidebarNoActivity')"
      :empty-description="t('recentEmpty')"
      :get-status-icon="getStatusIcon"
      :status-label="statusLabel"
      :shorten="shorten"
      :format-date="formatDate"
      @select="openHistory"
    />

    <StatsDisplay :items="multisigStats" layout="grid" :columns="3" />

    <!-- Operation Panel Inline: Create / Load -->
    <MainCard
      v-model="idInput"
      :create-title="t('createCta')"
      :create-desc="t('createDesc')"
      :divider-text="t('dividerOr')"
      :load-label="t('loadTitle')"
      :load-placeholder="t('loadPlaceholder')"
      :load-button-text="t('loadButton')"
      @create="navigateToCreate"
      @load="loadTransaction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { StatsDisplay } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import { useMultisigUI } from "./composables/useMultisigUI";
import MultisigHero from "./components/MultisigHero.vue";
import ActivitySection from "./components/ActivitySection.vue";
import MainCard from "./components/MainCard.vue";
import type { HistoryItem } from "./composables/useMultisigHistory";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());
const { getStatusIcon, statusLabel, shorten, formatDate } = useMultisigUI();

const history = computed(() => (props.state.history?.value ?? []) as HistoryItem[]);
const pendingCount = computed(() => Number(props.state.pendingCount?.value ?? 0));
const completedCount = computed(() => Number(props.state.completedCount?.value ?? 0));

const idInput = ref("");

const multisigStats = computed(() => [
  { label: t("sidebarTotalTxs"), value: history.value.length },
  { label: t("statPending"), value: pendingCount.value },
  { label: t("statCompleted"), value: completedCount.value },
]);

const openHistory = (id: string) => {
  uni.navigateTo({ url: `/pages/sign/index?id=${id}` });
};

const navigateToCreate = async () => {
  const handler = actions.get("navigateToCreate");
  if (handler) await handler();
};

const loadTransaction = async () => {
  const handler = actions.get("loadTransaction");
  if (handler && idInput.value) {
    await handler(idInput.value);
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./pages/index/neo-multisig-theme.scss" as *;

:global(body) {
  background: var(--multi-bg-start);
}

.multisig-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
