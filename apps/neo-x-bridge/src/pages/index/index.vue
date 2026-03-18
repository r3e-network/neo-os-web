<template>
  <MiniAppPage
    name="neo-x-bridge"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetStatus"
  >
    <template #content>
      <div class="hero-shell">
        <HeroSection variant="accent" compact>
          <template #background>
            <div class="bridge-scene" aria-hidden="true">
              <div class="bridge-orb bridge-orb--left">N3</div>
              <div class="bridge-link" />
              <div class="bridge-orb bridge-orb--right">X</div>
            </div>
          </template>
        </HeroSection>
        <div class="hero-copy">
          <span class="hero-kicker">{{ t("officialOnly") }}</span>
          <h1 class="hero-title">{{ t("title") }}</h1>
          <p class="hero-subtitle">{{ t("heroBlurb") }}</p>
        </div>
      </div>

      <StatsDisplay :items="overviewStats" layout="grid" :columns="3" class="mb-6" />

      <NeoCard variant="erobo" :title="selectedBridge.networkName">
        <StatsDisplay :items="selectedNetworkStats" layout="rows" />
      </NeoCard>

      <NeoCard variant="erobo-neo" :title="t('bridgeNotes')" class="notes-card">
        <p class="note-text">{{ t("bridgeNotesText") }}</p>
        <p class="note-text">{{ t("walletNoticeText") }}</p>
      </NeoCard>
    </template>

    <template #tab-networks>
      <NeoCard variant="erobo" :title="mainnetBridge.networkName" class="network-card">
        <StatsDisplay :items="networkStats(mainnetBridge)" layout="rows" />
      </NeoCard>
      <NeoCard variant="erobo" :title="testnetBridge.networkName" class="network-card">
        <StatsDisplay :items="networkStats(testnetBridge)" layout="rows" />
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('selectedNetwork')">
        <div class="toggle-row">
          <NeoButton
            size="sm"
            :variant="selectedKey === 'mainnet' ? 'primary' : 'secondary'"
            @click="selectedKey = 'mainnet'"
          >
            {{ t("mainnet") }}
          </NeoButton>
          <NeoButton
            size="sm"
            :variant="selectedKey === 'testnet' ? 'primary' : 'secondary'"
            @click="selectedKey = 'testnet'"
          >
            {{ t("testnet") }}
          </NeoButton>
        </div>

        <div class="action-stack">
          <NeoButton variant="primary" @click="openExternal(selectedBridge.bridgeUrl)">
            {{ t("officialBridge") }}
          </NeoButton>
          <NeoButton variant="secondary" @click="addNetwork(selectedBridge)">
            {{ t("addWallet") }}
          </NeoButton>
          <NeoButton variant="secondary" @click="openExternal(selectedBridge.explorer)">
            {{ t("openExplorer") }}
          </NeoButton>
          <NeoButton variant="secondary" @click="openExternal(docsUrl)">
            {{ t("openDocs") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { HeroSection, MiniAppPage, NeoButton, NeoCard, StatsDisplay } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { messages } from "@/locale/messages";

type BridgeNetwork = {
  key: "mainnet" | "testnet";
  networkName: string;
  bridgeUrl: string;
  chainIdHex: string;
  chainIdDecimal: string;
  rpcUrl: string;
  explorer: string;
};

const docsUrl = "https://xdocs.ngd.network/bridge/quick-start-bridging-assets";

const mainnetBridge: BridgeNetwork = {
  key: "mainnet",
  networkName: "Neo X MainNet",
  bridgeUrl: "https://xbridge.neo.org/",
  chainIdHex: "0xba93",
  chainIdDecimal: "47763",
  rpcUrl: "https://mainnet-1.rpc.banelabs.org",
  explorer: "https://xexplorer.neo.org",
};

const testnetBridge: BridgeNetwork = {
  key: "testnet",
  networkName: "Neo X TestNet",
  bridgeUrl: "https://testnet.bridge.banelabs.org/",
  chainIdHex: "0xba9304",
  chainIdDecimal: "12227332",
  rpcUrl: "https://neoxt4seed1.ngd.network",
  explorer: "https://xt4scan.ngd.network",
};

const selectedKey = ref<"mainnet" | "testnet">("mainnet");

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, setStatus, clearStatus, handleBoundaryError } =
  createMiniApp({
    name: "neo-x-bridge",
    messages,
    template: {
      tabs: [
        { key: "bridge", labelKey: "tabBridge", icon: "🌉", default: true },
        { key: "networks", labelKey: "tabNetworks", icon: "🛰️" },
      ],
      docSubtitleKey: "docsSubtitle",
      docFeatureCount: 3,
    },
    sidebarItems: [
      { labelKey: "supportedRoute", value: () => t("supportedRouteValue") },
      { labelKey: "supportedAsset", value: () => t("supportedAssetValue") },
      { labelKey: "selectedNetwork", value: () => selectedBridge.value.networkName },
      { labelKey: "chainId", value: () => selectedBridge.value.chainIdDecimal },
    ],
  });

const selectedBridge = computed(() => (selectedKey.value === "testnet" ? testnetBridge : mainnetBridge));

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: t("supportedRoute"), value: t("supportedRouteValue"), variant: "accent" },
  { label: t("supportedAsset"), value: t("supportedAssetValue"), variant: "success" },
  { label: t("bridgeMode"), value: t("bridgeModeValue"), variant: "erobo" },
]);

function networkStats(network: BridgeNetwork): StatsDisplayItem[] {
  return [
    { label: t("networkName"), value: network.networkName, variant: "accent" },
    { label: t("chainId"), value: `${network.chainIdDecimal} (${network.chainIdHex})`, variant: "default" },
    { label: t("rpcUrl"), value: network.rpcUrl, variant: "default" },
    { label: t("explorer"), value: network.explorer, variant: "default" },
    { label: t("bridgeUrl"), value: network.bridgeUrl, variant: "default" },
  ];
}

const selectedNetworkStats = computed<StatsDisplayItem[]>(() => networkStats(selectedBridge.value));

const appState = computed(() => ({
  selectedNetwork: selectedBridge.value.networkName,
  bridgeUrl: selectedBridge.value.bridgeUrl,
  chainId: selectedBridge.value.chainIdDecimal,
}));

function openExternal(url: string) {
  if (!url) return;
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
}

async function addNetwork(network: BridgeNetwork) {
  try {
    const ethereum = (globalThis as { ethereum?: { request: (args: unknown) => Promise<unknown> } }).ethereum;
    if (!ethereum) {
      throw new Error(t("addWalletMissing"));
    }

    const params = {
      chainId: network.chainIdHex,
      chainName: network.networkName,
      nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
      rpcUrls: [network.rpcUrl],
      blockExplorerUrls: [network.explorer],
    };

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: network.chainIdHex }],
      });
    } catch {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [params],
      });
    }

    setStatus(t("addWalletSuccess"), "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : t("error");
    setStatus(message, "error");
  }
}

function resetStatus() {
  clearStatus();
}
</script>

<style lang="scss" scoped>
.hero-shell {
  display: grid;
  gap: 18px;
  margin-bottom: 24px;
}

.bridge-scene {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 96px;
}

.bridge-orb {
  width: 66px;
  height: 66px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.08em;
  border: 1px solid var(--bridge-border);
  background: linear-gradient(180deg, rgba(79, 209, 255, 0.18), rgba(79, 209, 255, 0.05));
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.24);
}

.bridge-link {
  width: 90px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(79, 209, 255, 0.22), rgba(79, 209, 255, 0.9), rgba(79, 209, 255, 0.22));
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--bridge-accent);
}

.hero-title {
  font-size: 30px;
  line-height: 1.05;
}

.hero-subtitle {
  font-size: 14px;
  line-height: 1.65;
  color: var(--bridge-text-muted);
}

.toggle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notes-card,
.network-card {
  margin-top: 18px;
}

.note-text {
  font-size: 13px;
  line-height: 1.7;
  color: var(--bridge-text-muted);
}

.note-text + .note-text {
  margin-top: 10px;
}
</style>
