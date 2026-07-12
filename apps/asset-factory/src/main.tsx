import { defineMiniApp } from "@shared/react/defineMiniApp";
import AssetFactoryPlayArea from "./AssetFactoryPlayArea";
import { createAssetFactorySetup } from "./setup";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-asset-factory";

defineMiniApp({
  appId,
  playArea: AssetFactoryPlayArea,
  manifest,
  messages,
  setup: createAssetFactorySetup(appId),
});
