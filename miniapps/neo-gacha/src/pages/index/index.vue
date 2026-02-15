<template>
  <MiniAppPage
    name="neo-gacha"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="showFireworks"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadMachines"
  >
    <template #content>
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
  </MiniAppPage>

  <WalletPrompt
    :visible="showWalletPrompt"
    :message="walletMessage"
    @close="showWalletPrompt = false"
    @connect="handleWalletConnect"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { MiniAppPage } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useGachaMachines } from "@/composables/useGachaMachines";
import type { Machine } from "@/types";
import { useGachaPlay } from "@/composables/useGachaPlay";
import { useGachaWallet } from "@/composables/useGachaWallet";
import { useGachaManagement } from "@/composables/useGachaManagement";
import { useGachaPublish } from "@/composables/useGachaPublish";
import MarketplaceTab from "@/components/MarketplaceTab.vue";

const activeTab = ref("market");

const {
  machines,
  selectedMachine,
  isLoadingMachines,
  loadMachines,
  selectMachine,
  setActionLoading,
  actionLoading,
  ensureContractAddress,
  walletHash,
} = useGachaMachines();
const { isPlaying, showResult, resultItem, playError, showFireworks, resetResult, playMachine, buyMachine } =
  useGachaPlay();
const { address, showWalletPrompt, walletMessage, requestWallet, handleWalletConnect } = useGachaWallet();

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, handleBoundaryError } =
  createMiniApp({
    name: "neo-gacha",
    messages,
    template: {
      tabs: [
        { key: "market", labelKey: "market", icon: "🎰", default: true },
        { key: "discover", labelKey: "discover", icon: "🧭" },
        { key: "create", labelKey: "create", icon: "✏️" },
        { key: "manage", labelKey: "manage", icon: "⚙️" },
      ],
      fireworks: true,
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "machines", value: () => machines.value.length },
      { labelKey: "playing", value: () => (isPlaying.value ? t("yes") : t("no")) },
      { labelKey: "selected", value: () => selectedMachine.value?.name || t("none") },
    ],
  });
const appState = computed(() => ({
  machines: machines.value.length,
  isPlaying: isPlaying.value,
  showFireworks: showFireworks.value,
}));

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
    onSuccess: loadMachines,
  });
};

const handleBuy = async () => {
  if (!selectedMachine.value) return;
  await buyMachine(selectedMachine.value, {
    requireAddress,
    ensureContract: ensureContractAddress,
    setLoading: setActionLoading,
    onSuccess: loadMachines,
  });
};

const handlePublish = async (machineData: Record<string, unknown>) => {
  await publishMachine(machineData, {
    requireAddress,
    setStatus,
    onSuccess: async () => {
      await loadMachines();
      activeTab.value = "manage";
      selectedMachine.value = null;
    },
  });
};

const handleUpdatePrice = async (machine: Machine) => {
  await updateMachinePrice(machine, loadMachines);
};

const handleToggleActive = async (machine: Machine) => {
  await toggleMachineActive(machine, loadMachines);
};

const handleToggleListed = async (machine: Machine) => {
  await toggleMachineListed(machine, loadMachines);
};

const handleListForSale = async (machine: Machine) => {
  const salePrice = machine.salePriceRaw > 0 ? String(machine.salePriceRaw / 1e8) : "";
  if (!salePrice) return;
  await listMachineForSale(machine, salePrice, loadMachines);
};

const handleCancelSale = async (machine: Machine) => {
  await cancelMachineSale(machine, loadMachines);
};

const handleWithdrawRevenue = async (machine: Machine) => {
  await withdrawMachineRevenue(machine, loadMachines);
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
  await depositItem(machine, item, index, amount || "", tokenId || "", loadMachines);
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
  await withdrawItem(machine, item, index, amount || "", tokenId || "", loadMachines);
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
    loadMachines();
  },
  { immediate: true }
);
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
