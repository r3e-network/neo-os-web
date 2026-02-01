<template>
  <ResponsiveLayout :desktop-breakpoint="1024" class="theme-neo-gacha" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event">
    <template #desktop-sidebar>
      <view class="desktop-sidebar">
        <text class="sidebar-title">{{ t('overview') }}</text>
      </view>
    </template>

    <view class="app-container">
      <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />
      <NeoCard v-if="status" :variant="status.variant" class="mb-4">
        <text class="status-text">{{ status.msg }}</text>
      </NeoCard>

      <MarketplaceTab
        v-if="activeTab === 'market'"
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

      <DiscoverTab
        v-if="activeTab === 'discover'"
        :machines="machines"
        :is-loading="isLoadingMachines"
        @select-machine="handleSelectFromDiscover"
      />

      <CreatorStudio
        v-if="activeTab === 'create'"
        :publishing="isPublishing"
        @publish="handlePublish"
      />

      <ManageTab
        v-if="activeTab === 'manage'"
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

      <view v-if="activeTab === 'docs'" class="tab-content scrollable">
        <NeoDoc
          :title="t('title')"
          :subtitle="t('docSubtitle')"
          :description="t('docDescription')"
          :steps="docSteps"
          :features="docFeatures"
        />
      </view>
    </view>

    <Fireworks :active="showFireworks" :duration="3000" />
    <WalletPrompt
      :visible="showWalletPrompt"
      :message="walletMessage"
      @close="showWalletPrompt = false"
      @connect="handleWalletConnect"
    />
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { ResponsiveLayout, NeoCard, NeoDoc, WalletPrompt, ChainWarning } from "@shared/components";
import Fireworks from "@shared/components/Fireworks.vue";
import { useI18n } from "@/composables/useI18n";
import { useGachaMachines, type Machine } from "@/composables/useGachaMachines";
import { useGachaPlay } from "@/composables/useGachaPlay";
import { useGachaWallet } from "@/composables/useGachaWallet";
import { useGachaManagement } from "@/composables/useGachaManagement";
import { useGachaPublish } from "@/composables/useGachaPublish";
import CreatorStudio from "./components/CreatorStudio.vue";
import MarketplaceTab from "@/components/MarketplaceTab.vue";
import DiscoverTab from "@/components/DiscoverTab.vue";
import ManageTab from "@/components/ManageTab.vue";

const { t } = useI18n();

const navTabs = computed(() => [
  { id: "market", icon: "bag", label: t("market") },
  { id: "discover", icon: "compass", label: t("discover") },
  { id: "create", icon: "edit", label: t("create") },
  { id: "manage", icon: "settings", label: t("manage") },
  { id: "docs", icon: "book", label: t("docs") },
]);

const activeTab = ref("market");

interface Status {
  msg: string;
  variant: "danger" | "success" | "warning";
}

const status = ref<Status | null>(null);
const setStatus = (msg: string, variant: Status["variant"]) => {
  status.value = { msg, variant };
};

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);

const { machines, selectedMachine, isLoadingMachines, fetchMachines, selectMachine, setActionLoading, actionLoading, ensureContractAddress, walletHash } = useGachaMachines();
const { isPlaying, showResult, resultItem, playError, showFireworks, resetResult, playMachine, buyMachine } = useGachaPlay();
const { address, showWalletPrompt, walletMessage, requestWallet, handleWalletConnect } = useGachaWallet();
const { updateMachinePrice, toggleMachineActive, toggleMachineListed, listMachineForSale, cancelMachineSale, withdrawMachineRevenue, depositItem, withdrawItem } = useGachaManagement();
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

const handlePublish = async (machineData: any) => {
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

const handleDepositItem = async ({ machine, item, index, amount, tokenId }: { machine: Machine; item: any; index: number; amount: string; tokenId: string }) => {
  await depositItem(machine, item, index, amount || "", tokenId || "", fetchMachines);
};

const handleWithdrawItem = async ({ machine, item, index, amount, tokenId }: { machine: Machine; item: any; index: number; amount: string; tokenId: string }) => {
  await withdrawItem(machine, item, index, amount || "", tokenId || "", fetchMachines);
};

watch(showFireworks, (val) => {
  if (val) {
    setTimeout(() => (showFireworks.value = false), 3000);
  }
});

watch(address, () => {
  fetchMachines();
});

onMounted(() => {
  fetchMachines();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";
@import "./neo-gacha-theme.scss";

.app-container {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
  background-color: var(--gacha-bg);
  background-image:
    radial-gradient(var(--gacha-pattern-pink) 15%, transparent 16%),
    radial-gradient(var(--gacha-pattern-blue) 15%, transparent 16%);
  background-size: 40px 40px;
  background-position:
    0 0,
    20px 20px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.status-text {
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
}

.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
