<template>
  <MiniAppPage
    name="time-capsule"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
    @tab-change="activeTab = $event"
  >
    <template #content>
      <CapsuleList :capsules="capsules" :current-time="currentTime" :t="t" @open="handleOpen" />
    </template>

    <template #operation>
      <NeoCard variant="erobo-neo">
        <text class="helper-text">{{ t("fishDescription") }}</text>
        <NeoButton
          variant="secondary"
          size="md"
          block
          :loading="isBusy"
          :disabled="isBusy"
          class="mt-3"
          @click="handleFish"
        >
          {{ t("fishButton") }}
        </NeoButton>
      </NeoCard>
    </template>

    <template #tab-create>
      <CreateCapsuleForm
        v-model:title="newCapsule.title"
        v-model:content="newCapsule.content"
        v-model:days="newCapsule.days"
        v-model:is-public="newCapsule.isPublic"
        v-model:category="newCapsule.category"
        :is-loading="isBusy"
        :can-create="canCreate"
        :t="t"
        @create="handleCreate"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useTicker } from "@shared/composables/useTicker";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useCapsuleCreation } from "@/composables/useCapsuleCreation";
import { useCapsuleUnlock } from "@/composables/useCapsuleUnlock";
import CapsuleList, { type Capsule } from "./components/CapsuleList.vue";

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status: actionStatus,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "time-capsule",
  messages,
  template: {
    tabs: [
      { key: "capsules", labelKey: "tabCapsules", icon: "🔒", default: true },
      { key: "create", labelKey: "tabCreate", icon: "➕" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "sidebarTotalCapsules", value: () => capsules.value.length },
    { labelKey: "sidebarLocked", value: () => capsules.value.filter((c) => c.locked).length },
    { labelKey: "sidebarRevealed", value: () => capsules.value.filter((c) => c.revealed).length },
  ],
  statusTimeoutMs: 4000,
});
const { address } = useWallet() as WalletSDK;

const activeTab = ref("capsules");

const capsules = ref<Capsule[]>([]);
const currentTime = ref(Date.now());
const isLoadingData = ref(false);

const appState = computed(() => ({}));

const { newCapsule, status: createStatus, isBusy: createBusy, canCreate, create } = useCapsuleCreation();
const status = computed(() => actionStatus.value ?? createStatus.value);
const { isBusy: unlockBusy, open, fish, loadCapsules } = useCapsuleUnlock();

const isBusy = computed(() => createBusy.value || unlockBusy.value || isLoadingData.value);

const countdownTicker = useTicker(() => {
  currentTime.value = Date.now();
}, 1000);

onMounted(() => {
  countdownTicker.start();
});

watch(
  address,
  () => {
    loadData();
  },
  { immediate: true }
);

const loadData = async () => {
  if (!address.value) return;
  isLoadingData.value = true;
  try {
    capsules.value = await loadCapsules();
  } catch {
    /* non-critical: capsule data fetch */
  } finally {
    isLoadingData.value = false;
  }
};
const handleOpen = async (cap: Capsule) => {
  await open(cap, (msg, type) => {
    setStatus(msg, type);
    if (type !== "error") {
      loadData();
    }
  });
};
const resetAndReload = async () => {
  if (address.value) loadData();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./time-capsule-theme.scss";

@include page-background(var(--bg-primary));

.helper-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--capsule-cyan, var(--text-secondary));
  opacity: 0.8;
  letter-spacing: 0.05em;
}
</style>
