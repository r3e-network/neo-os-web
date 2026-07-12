import { defineMiniApp } from "@shared/react/defineMiniApp";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { NftFactoryPlayArea } from "./NftFactoryPlayArea";
import {
  createNftFactorySetup,
  NFT_FACTORY_APP_ID,
} from "./NftFactorySetup";

defineMiniApp({
  appId: NFT_FACTORY_APP_ID,
  playArea: NftFactoryPlayArea,
  manifest,
  messages,
  setup: createNftFactorySetup,
});
