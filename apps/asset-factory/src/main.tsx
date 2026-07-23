import { defineMiniApp } from "@shared/react/defineMiniApp";
import AssetFactoryPlayArea from "./AssetFactoryPlayArea";
import { createAssetFactorySetup } from "./setup";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { factoryContractFor } from "@shared/factory/factoryPlan";

const appId = "miniapp-asset-factory";

defineMiniApp({
  appId,
  playArea: AssetFactoryPlayArea,
  manifest,
  messages,
  platformFactory: {
    hashes: {
      "neo-n3-mainnet": factoryContractFor("nep17", "neo-n3-mainnet"),
      "neo-n3-testnet": factoryContractFor("nep17", "neo-n3-testnet"),
    },
  },
  setup: createAssetFactorySetup(appId),
});
