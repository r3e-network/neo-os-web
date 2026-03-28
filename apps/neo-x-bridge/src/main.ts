/**
 * Neo X Bridge — Entry Point (New Pattern)
 */

import { ref, computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

type BridgeNetwork = {
  key: "mainnet" | "testnet";
  networkName: string;
  bridgeUrl: string;
  chainIdHex: string;
  chainIdDecimal: string;
  rpcUrl: string;
  explorer: string;
};

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

const docsUrl = "https://xdocs.ngd.network/bridge/quick-start-bridging-assets";

function openExternal(url: string) {
  if (!url) return;
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

defineMiniApp({
  appId: "miniapp-neo-x-bridge",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-neo-x-bridge", {
      t: ctx.t as (key: string) => string,
    });

    const { notify } = platformServices;

    const selectedKey = ref<"mainnet" | "testnet">("mainnet");
    const selectedBridge = computed(() => selectedKey.value === "testnet" ? testnetBridge : mainnetBridge);

    ctx.registerAction("selectNetwork", async (key: string) => {
      selectedKey.value = key as "mainnet" | "testnet";
    });

    ctx.registerAction("openBridge", async () => {
      openExternal(selectedBridge.value.bridgeUrl);
    });

    ctx.registerAction("addWallet", async () => {
      await notify.guard(async () => {
        const ethereum = (globalThis as { ethereum?: { request: (args: unknown) => Promise<unknown> } }).ethereum;
        if (!ethereum) throw new Error(ctx.t("addWalletMissing"));
        try {
          await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: selectedBridge.value.chainIdHex }] });
        } catch (_e) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: selectedBridge.value.chainIdHex, chainName: selectedBridge.value.networkName, nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 }, rpcUrls: [selectedBridge.value.rpcUrl], blockExplorerUrls: [selectedBridge.value.explorer] }],
          });
        }
      }, "addWalletSuccess");
    });

    ctx.registerAction("openExplorer", async () => {
      openExternal(selectedBridge.value.explorer);
    });

    ctx.registerAction("openDocs", async () => {
      openExternal(docsUrl);
    });

    return {
      state: {
        selectedKey,
        selectedNetwork: computed(() => selectedBridge.value.networkName),
        supportedRoute: computed(() => ctx.t("supportedRouteValue")),
        supportedAsset: computed(() => ctx.t("supportedAssetValue")),
        chainId: computed(() => selectedBridge.value.chainIdDecimal),
      },
      loadData: async () => {},
      cleanup: () => { platformServices.destroy(); },
    };
  },
});
