import { defineMiniApp } from "@shared/react/defineMiniApp";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { NftFactoryPlayArea } from "./NftFactoryPlayArea";
import {
  createNftFactorySetup,
  NFT_FACTORY_APP_ID,
} from "./NftFactorySetup";
import { factoryContractFor } from "@shared/factory/factoryPlan";

defineMiniApp({
  appId: NFT_FACTORY_APP_ID,
  playArea: NftFactoryPlayArea,
  manifest,
  messages,
  platformFactory: {
    hashes: {
      "neo-n3-mainnet": factoryContractFor("nep11", "neo-n3-mainnet"),
      "neo-n3-testnet": factoryContractFor("nep11", "neo-n3-testnet"),
    },
  },
  setup: createNftFactorySetup,
});
