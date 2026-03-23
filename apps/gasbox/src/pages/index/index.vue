<template>
  <MiniAppPage
    name="gasbox"
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
      <div class="hero-container">
        <!-- Gacha Machine Visual -->
        <div :class="['gacha-hero-machine', { shaking: isPlaying }]">
          <!-- Glass Dome -->
          <div class="hero-dome">
            <div class="dome-shine" />
            <div class="capsules-float">
              <span v-for="i in 7" :key="i" class="hero-capsule" :style="getCapsuleHeroStyle(i)">
                <AppIcon :name="['pill', 'crystal_ball', 'neo', 'generous', 'star', 'dice', 'sparkle'][i - 1]" :size="20" aria-hidden="true" />
              </span>
            </div>
          </div>
          <!-- Machine Body -->
          <div class="hero-machine-body">
            <div class="machine-slot-strip">
              <div class="slot-indicator" :class="{ active: !isPlaying }" />
            </div>
          </div>
          <!-- Machine Base -->
          <div class="hero-machine-base">
            <div class="dispense-slot">
              <div v-if="isPlaying" class="dispense-capsule"><AppIcon name="pill" :size="24" aria-hidden="true" /></div>
            </div>
          </div>
        </div>

        <!-- Machine Info -->
        <div class="hero-machine-info">
          <span class="hero-machine-name">
            {{ selectedMachine?.name || t("title") }}
          </span>
          <span v-if="selectedMachine" class="hero-machine-price">
            {{ selectedMachine.price }} {{ t("tokenGas") }} {{ t("playLabel") }}
          </span>
          <span class="hero-machine-count"> {{ machines.length }} {{ t("machines") }} </span>
        </div>
      </div>

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
import { MiniAppPage, AppIcon } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useGachaMachines } from "@/composables/useGachaMachines";
import type { Machine, MachineItem } from "@/types";
import { useGachaPlay } from "@/composables/useGachaPlay";
import { useGachaWallet } from "@/composables/useGachaWallet";
import { useGachaManagement } from "@/composables/useGachaManagement";
import { useGachaPublish } from "@/composables/useGachaPublish";
import MarketplaceTab from "@/components/MarketplaceTab.vue";
import DiscoverTab from "@/components/DiscoverTab.vue";
import ManageTab from "@/components/ManageTab.vue";
import CreatorStudio from "./components/CreatorStudio.vue";
import { WalletPrompt } from "@shared/components";

const activeTab = ref("market");

const getCapsuleHeroStyle = (i: number) => ({
  left: `${15 + ((i * 11) % 70)}%`,
  top: `${10 + ((i * 17) % 65)}%`,
  animationDelay: `${i * 0.4}s`,
  fontSize: `${18 + (i % 3) * 4}px`,
});

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
    name: "gasbox",
    messages,
    template: {
      tabs: [
        { key: "market", labelKey: "market", icon: "slot", default: true },
        { key: "discover", labelKey: "discover", icon: "compass" },
        { key: "create", labelKey: "create", icon: "edit" },
        { key: "manage", labelKey: "manage", icon: "settings" },
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
const handleSelectFromDiscover = (machine: Machine) => {
  selectMachine(machine);
  activeTab.value = "market";
};

const handleUpdatePrice = async (machine: Machine) => {
  if (!(await requireAddress())) return;
  await updateMachinePrice(machine, loadMachines);
};

const handleToggleActive = async (machine: Machine) => {
  if (!(await requireAddress())) return;
  await toggleMachineActive(machine, loadMachines);
};

const handleToggleListed = async (machine: Machine) => {
  if (!(await requireAddress())) return;
  await toggleMachineListed(machine, loadMachines);
};

const handleListForSale = async (machine: Machine) => {
  if (!(await requireAddress())) return;
  await listMachineForSale(machine, "", loadMachines);
};

const handleCancelSale = async (machine: Machine) => {
  if (!(await requireAddress())) return;
  await cancelMachineSale(machine, loadMachines);
};

const handleDepositItem = async (op: {
  machine: Machine;
  item: MachineItem;
  index: number;
  amount: string;
  tokenId: string;
}) => {
  if (!(await requireAddress())) return;
  await depositItem(op.machine, op.item, op.index, op.amount, op.tokenId, loadMachines);
};

const handleWithdrawItem = async (op: {
  machine: Machine;
  item: MachineItem;
  index: number;
  amount: string;
  tokenId: string;
}) => {
  if (!(await requireAddress())) return;
  await withdrawItem(op.machine, op.item, op.index, op.amount, op.tokenId, loadMachines);
};

const handlePublish = async (machineData: {
  name: string;
  description: string;
  category: string;
  tags: string;
  price: string;
  items: {
    name: string;
    probability: number;
    icon: string;
    rarity: string;
    assetType: string;
    assetHash: string;
    amount: string;
    tokenId: string;
  }[];
}) => {
  if (!(await requireAddress())) return;
  await publishMachine(machineData, {
    requireAddress,
    setStatus,
    onSuccess: loadMachines,
  });
};

let fireworksTimer: ReturnType<typeof setTimeout> | null = null;

const stopFireworksWatch = watch(showFireworks, (val) => {
  if (fireworksTimer) {
    clearTimeout(fireworksTimer);
    fireworksTimer = null;
  }
  if (val) {
    fireworksTimer = setTimeout(() => {
      fireworksTimer = null;
      showFireworks.value = false;
    }, 3000);
  }
});

onUnmounted(() => {
  stopFireworksWatch();
  stopAddressWatch();
  if (fireworksTimer) {
    clearTimeout(fireworksTimer);
    fireworksTimer = null;
  }
});

const stopAddressWatch = watch(
  address,
  () => {
    loadMachines();
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./gasbox-theme.scss" as *;

@include page-background(var(--gacha-bg));

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 16px 16px;
  gap: 20px;
}

/* ── Gacha Machine ── */
.gacha-hero-machine {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.2s;

  &.shaking {
    animation: machine-shake 0.15s ease-in-out infinite;
  }
}

.hero-dome {
  width: 160px;
  height: 140px;
  border-radius: 50% 50% 8% 8%;
  background: radial-gradient(
    ellipse at 30% 25%,
    rgba(255, 255, 255, 0.12),
    rgba(139, 92, 246, 0.08) 40%,
    rgba(99, 102, 241, 0.05) 70%,
    rgba(0, 0, 0, 0.3)
  );
  border: 2px solid rgba(139, 92, 246, 0.3);
  box-shadow:
    0 0 30px rgba(139, 92, 246, 0.15),
    inset 0 -20px 40px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  z-index: 2;
}

.dome-shine {
  position: absolute;
  top: 8px;
  left: 20px;
  width: 50px;
  height: 30px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: rotate(-30deg);
}

.capsules-float {
  position: absolute;
  inset: 0;
}

.hero-capsule {
  position: absolute;
  animation: capsule-bob 3s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.hero-machine-body {
  width: 140px;
  height: 40px;
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.3));
  border: 2px solid rgba(139, 92, 246, 0.25);
  border-top: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.machine-slot-strip {
  width: 80%;
  height: 20px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.slot-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.3s;

  &.active {
    background: var(--gacha-accent-green);
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
    animation: slot-blink 2s ease-in-out infinite;
  }
}

.hero-machine-base {
  width: 120px;
  height: 30px;
  background: linear-gradient(180deg, rgba(79, 70, 229, 0.3), rgba(67, 56, 202, 0.4));
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-top: none;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dispense-slot {
  width: 40px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px 4px 0 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.dispense-capsule {
  position: absolute;
  font-size: 16px;
  left: 50%;
  transform: translateX(-50%);
  animation: capsule-drop 0.6s ease-out forwards;
}

/* ── Machine Info ── */
.hero-machine-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hero-machine-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--gacha-hero-gradient-start, #a78bfa), var(--gacha-hero-gradient-end, #818cf8));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-machine-price {
  font-size: 14px;
  font-weight: 700;
  color: var(--gacha-accent-yellow);
  font-family: $font-mono;
}

.hero-machine-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

.status-text {
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
}

@keyframes machine-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px) rotate(-1deg);
  }
  75% {
    transform: translateX(3px) rotate(1deg);
  }
}

@keyframes capsule-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-6px) rotate(10deg);
  }
}

@keyframes capsule-drop {
  0% {
    top: -20px;
    opacity: 0;
  }
  60% {
    top: 4px;
    opacity: 1;
  }
  80% {
    top: 0;
  }
  100% {
    top: 4px;
  }
}

@keyframes slot-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@media (max-width: 480px) {
  .hero-dome {
    width: 130px;
    height: 115px;
  }
  .hero-machine-body {
    width: 115px;
  }
  .hero-machine-base {
    width: 100px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gacha-hero-machine.shaking,
  .hero-capsule,
  .slot-indicator.active,
  .dispense-capsule {
    animation: none;
  }
}
</style>
