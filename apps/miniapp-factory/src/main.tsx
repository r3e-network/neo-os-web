import { defineMiniApp } from "@shared/react/defineMiniApp";
import MiniAppFactoryPlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { createMiniAppFactorySetup } from "./setup";

const appId = "miniapp-miniapp-factory";

defineMiniApp({
  appId,
  playArea: MiniAppFactoryPlayArea,
  manifest,
  messages,
  setup: createMiniAppFactorySetup(appId),
});
