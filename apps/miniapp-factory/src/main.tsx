import { defineMiniApp } from "@shared/react/defineMiniApp";
import MiniAppFactoryPlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { createMiniAppFactorySetup } from "./setup";
import { factoryContractFor } from "@shared/factory/factoryPlan";

const appId = "miniapp-miniapp-factory";

defineMiniApp({
  appId,
  playArea: MiniAppFactoryPlayArea,
  manifest,
  messages,
  platformFactory: {
    hashes: {
      "neo-n3-mainnet": factoryContractFor("miniapp", "neo-n3-mainnet"),
      "neo-n3-testnet": factoryContractFor("miniapp", "neo-n3-testnet"),
    },
  },
  setup: createMiniAppFactorySetup(appId),
});
