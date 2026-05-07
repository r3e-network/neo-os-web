import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createFactoryPlayArea, createFactorySetup } from "@shared/factory/runtime";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";

const appId = "miniapp-miniapp-factory";
const kind = "miniapp";

defineMiniApp({
  appId,
  playArea: createFactoryPlayArea(kind, appId),
  manifest,
  messages,
  setup: createFactorySetup(kind, appId),
});
