<template>
  <OfficialLauncherMiniApp
    page-name="neo-x-bridge"
    :template-config="templateConfig"
    :app-state="appState"
    :t="t"
    :status="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :handle-boundary-error="handleBoundaryError"
    :reset-status="resetStatus"
    hero-mode="bridge"
    :bridge-left-label="t('bridgeLeftLabel')"
    :bridge-right-label="t('bridgeRightLabel')"
    :hero-kicker="t('officialOnly')"
    :hero-title="t('title')"
    :hero-blurb="t('heroBlurb')"
    :overview-stats="overviewStats"
    :main-cards="mainCards"
    :detail-cards="detailCards"
    :operation-title="t('selectedNetwork')"
    :operation-toggle="operationToggle"
    :operation-actions="operationActions"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { OfficialLauncherMiniApp } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { formatErrorMessage } from "@shared/utils/errorHandling";
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

const mainCards = computed(() => [
  {
    title: selectedBridge.value.networkName,
    variant: "erobo" as const,
    stats: selectedNetworkStats.value,
  },
  {
    title: t("bridgeNotes"),
    variant: "erobo-neo" as const,
    className: "notes-card",
    paragraphs: [t("bridgeNotesText"), t("walletNoticeText")],
  },
]);

const detailCards = computed(() => [
  {
    title: mainnetBridge.networkName,
    variant: "erobo" as const,
    className: "network-card",
    stats: networkStats(mainnetBridge),
  },
  {
    title: testnetBridge.networkName,
    variant: "erobo" as const,
    className: "network-card",
    stats: networkStats(testnetBridge),
  },
]);

const operationToggle = computed(() => ({
  selectedKey: selectedKey.value,
  options: [
    { key: "mainnet", label: t("mainnet"), onSelect: () => { selectedKey.value = "mainnet"; } },
    { key: "testnet", label: t("testnet"), onSelect: () => { selectedKey.value = "testnet"; } },
  ],
}));

const operationActions = computed(() => [
  { label: t("officialBridge"), variant: "primary" as const, onClick: () => openExternal(selectedBridge.value.bridgeUrl) },
  { label: t("addWallet"), variant: "secondary" as const, onClick: () => { void addNetwork(selectedBridge.value); } },
  { label: t("openExplorer"), variant: "secondary" as const, onClick: () => openExternal(selectedBridge.value.explorer) },
  { label: t("openDocs"), variant: "secondary" as const, onClick: () => openExternal(docsUrl) },
]);

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
    } catch (_e: unknown) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [params],
      });
    }

    setStatus(t("addWalletSuccess"), "success");
  } catch (error: unknown) {
    setStatus(formatErrorMessage(error, t("addWalletFailed")), "error");
  }
}

function resetStatus() {
  clearStatus();
}
</script>
