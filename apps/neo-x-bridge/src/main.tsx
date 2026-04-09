/**
 * Neo X Bridge — Entry Point (React)
 */

import { defineMiniApp, createObservable } from "@shared/react/defineMiniApp";
import type { Observable } from "@shared/react/context";
import PlayArea from "./PlayArea";
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
    const platformServices = ctx.services;
    const { notify } = platformServices;

    const selectedKey = createObservable<"mainnet" | "testnet">("mainnet");

    const getBridge = () => selectedKey.get() === "testnet" ? testnetBridge : mainnetBridge;

    const selectedNetwork: Observable<string> = {
      get: () => getBridge().networkName,
      set: () => {},
      subscribe: (listener) => selectedKey.subscribe(listener),
    };
    const supportedRoute: Observable<string> = {
      get: () => ctx.t("supportedRouteValue"),
      set: () => {},
      subscribe: () => () => {},
    };
    const supportedAsset: Observable<string> = {
      get: () => ctx.t("supportedAssetValue"),
      set: () => {},
      subscribe: () => () => {},
    };
    const chainId: Observable<string> = {
      get: () => getBridge().chainIdDecimal,
      set: () => {},
      subscribe: (listener) => selectedKey.subscribe(listener),
    };

    ctx.registerAction("selectNetwork", async (key: string) => {
      selectedKey.set(key as "mainnet" | "testnet");
    });

    ctx.registerAction("openBridge", async () => {
      openExternal(getBridge().bridgeUrl);
    });

    ctx.registerAction("addWallet", async () => {
      await notify.guard(async () => {
        const ethereum = (
          globalThis as {
            ethereum?: { request: (args: unknown) => Promise<unknown> };
          }
        ).ethereum;
        if (!ethereum) throw new Error(ctx.t("addWalletMissing"));
        const bridge = getBridge();
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: bridge.chainIdHex }],
          });
        } catch (_e) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: bridge.chainIdHex,
                chainName: bridge.networkName,
                nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
                rpcUrls: [bridge.rpcUrl],
                blockExplorerUrls: [bridge.explorer],
              },
            ],
          });
        }
      }, "addWalletSuccess");
    });

    ctx.registerAction("openExplorer", async () => {
      openExternal(getBridge().explorer);
    });

    ctx.registerAction("openDocs", async () => {
      openExternal(docsUrl);
    });

    return {
      state: {
        selectedKey,
        selectedNetwork,
        supportedRoute,
        supportedAsset,
        chainId,
      },
      loadData: async () => {},
    };
  },
});
