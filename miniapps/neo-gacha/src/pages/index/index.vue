<template>
  <view class="theme-neo-gacha">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      :fireworks-active="showFireworks"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
          <MarketplaceTab
            :machines="machines"
            :is-loading="isLoadingMachines"
            :selected-machine="selectedMachine"
            :wallet-hash="walletHash"
            :is-playing="isPlaying"
            :show-result="showResult"
            :result-item="resultItem"
            :play-error="playError"
            @select-machine="selectMachine"
            @browse-all="activeTab = 'discover'"
            @back="selectedMachine = null"
            @play="handlePlay"
            @close-result="resetResult"
            @buy="handleBuy"
          />
        </ErrorBoundary>
      </template>

      <template #operation>
        <CreatorStudio :publishing="isPublishing" @publish="handlePublish" />
      </template>

      <template #tab-discover>
        <DiscoverTab :machines="machines" :is-loading="isLoadingMachines" @select-machine="handleSelectFromDiscover" />
      </template>

      <template #tab-create>
        <CreatorStudio :publishing="isPublishing" @publish="handlePublish" />
      </template>

      <template #tab-manage>
        <ManageTab
          :machines="machines"
          :address="address"
          :is-loading="isLoadingMachines"
          :action-loading="actionLoading"
          @connect-wallet="handleWalletConnect"
          @update-price="handleUpdatePrice"
          @toggle-active="handleToggleActive"
          @toggle-listed="handleToggleListed"
          @list-for-sale="handleListForSale"
          @cancel-sale="handleCancelSale"
          @withdraw-revenue="handleWithdrawRevenue"
          @deposit-item="handleDepositItem"
          @withdraw-item="handleWithdrawItem"
        />
      </template>
    </MiniAppTemplate>

    <WalletPrompt
      :visible="showWalletPrompt"
      :message="walletMessage"
      @close="showWalletPrompt = false"
      @connect="handleWalletConnect"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { MiniAppTemplate, SidebarPanel, WalletPrompt, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createUseI18n } from "@shared/composables/useI18n";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import { messages } from "@/locale/messages";
import { useGachaMachines } from "@/composables/useGachaMachines";
import type { Machine } from "@/types";
import { useGachaPlay } from "@/composables/useGachaPlay";
import { useGachaWallet } from "@/composables/useGachaWallet";
import { useGachaManagement } from "@/composables/useGachaManagement";
import { useGachaPublish } from "@/composables/useGachaPublish";
import CreatorStudio from "./components/CreatorStudio.vue";
import MarketplaceTab from "@/components/MarketplaceTab.vue";
import DiscoverTab from "@/components/DiscoverTab.vue";
import ManageTab from "@/components/ManageTab.vue";

const { t } = createUseI18n(messages)();

const templateConfig = createTemplateConfig({
  tabs: [
    { key: "market", labelKey: "market", icon: "🎰", default: true },
    { key: "discover", labelKey: "discover", icon: "🧭" },
    { key: "create", labelKey: "create", icon: "✏️" },
    { key: "manage", labelKey: "manage", icon: "⚙️" },
  ],
  fireworks: true,
  docFeatureCount: 3,
});

const activeTab = ref("market");
const appState = computed(() => ({
  machines: machines.value.length,
  isPlaying: isPlaying.value,
  showFireworks: showFireworks.value,
}));

const sidebarItems = computed(() => [
  { label: t("machines"), value: machines.value.length },
  { label: t("playing"), value: isPlaying.value ? t("yes") : t("no") },
  { label: t("selected"), value: selectedMachine.value?.name || t("none") },
]);

const { status, setStatus } = useStatusMessage();

const {
  machines,
  selectedMachine,
  isLoadingMachines,
  fetchMachines,
  selectMachine,
  setActionLoading,
  actionLoading,
  ensureContractAddress,
  walletHash,
} = useGachaMachines();
const { isPlaying, showResult, resultItem, playError, showFireworks, resetResult, playMachine, buyMachine } =
  useGachaPlay();
const { address, showWalletPrompt, walletMessage, requestWallet, handleWalletConnect } = useGachaWallet();
const {
  updateMachinePrice,
  toggleMachineActive,
  toggleMachineListed,
  listMachineForSale,
  cancelMachineSale,
  withdrawMachineRevenue,
  depositItem,
  withdrawItem,
} = useGachaManagement();
const { isPublishing, publishMachine } = useGachaPublish();

const requireAddress = async () => {
  if (!address.value) {
    requestWallet(t("connectWallet"));
    return false;
  }
  return true;
};

const handleSelectFromDiscover = (machine: Machine) => {
  selectMachine(machine);
  activeTab.value = "market";
};

const handlePlay = async () => {
  if (!selectedMachine.value) return;
  await playMachine(selectedMachine.value, {
    requireAddress,
    ensureContract: ensureContractAddress,
    onSuccess: fetchMachines,
  });
};

const handleBuy = async () => {
  if (!selectedMachine.value) return;
  await buyMachine(selectedMachine.value, {
    requireAddress,
    ensureContract: ensureContractAddress,
    setLoading: setActionLoading,
    onSuccess: fetchMachines,
  });
};

const handlePublish = async (machineData: Record<string, unknown>) => {
  await publishMachine(machineData, {
    requireAddress,
    setStatus,
    onSuccess: async () => {
      await fetchMachines();
      activeTab.value = "manage";
      selectedMachine.value = null;
    },
  });
};

const handleUpdatePrice = async (machine: Machine) => {
  await updateMachinePrice(machine, fetchMachines);
};

const handleToggleActive = async (machine: Machine) => {
  await toggleMachineActive(machine, fetchMachines);
};

const handleToggleListed = async (machine: Machine) => {
  await toggleMachineListed(machine, fetchMachines);
};

const handleListForSale = async (machine: Machine) => {
  const salePrice = machine.salePriceRaw > 0 ? String(machine.salePriceRaw / 1e8) : "";
  if (!salePrice) return;
  await listMachineForSale(machine, salePrice, fetchMachines);
};

const handleCancelSale = async (machine: Machine) => {
  await cancelMachineSale(machine, fetchMachines);
};

const handleWithdrawRevenue = async (machine: Machine) => {
  await withdrawMachineRevenue(machine, fetchMachines);
  setStatus(t("revenueClaimed"), "success");
};

const handleDepositItem = async ({
  machine,
  item,
  index,
  amount,
  tokenId,
}: {
  machine: Machine;
  item: Record<string, unknown>;
  index: number;
  amount: string;
  tokenId: string;
}) => {
  await depositItem(machine, item, index, amount || "", tokenId || "", fetchMachines);
};

const handleWithdrawItem = async ({
  machine,
  item,
  index,
  amount,
  tokenId,
}: {
  machine: Machine;
  item: Record<string, unknown>;
  index: number;
  amount: string;
  tokenId: string;
}) => {
  await withdrawItem(machine, item, index, amount || "", tokenId || "", fetchMachines);
};

let fireworksTimer: ReturnType<typeof setTimeout> | null = null;

watch(showFireworks, (val) => {
  if (val) {
    fireworksTimer = setTimeout(() => {
      fireworksTimer = null;
      showFireworks.value = false;
    }, 3000);
  }
});

onUnmounted(() => {
  if (fireworksTimer) {
    clearTimeout(fireworksTimer);
    fireworksTimer = null;
  }
});

watch(
  address,
  () => {
    fetchMachines();
  },
  { immediate: true }
);

const { handleBoundaryError } = useHandleBoundaryError("neo-gacha");
const resetAndReload = async () => {
  await fetchMachines();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./neo-gacha-theme.scss";

@include page-background(var(--gacha-bg));

.status-text {
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
}
</style>
