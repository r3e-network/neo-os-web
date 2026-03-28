/**
 * Flamingo Swap — Entry Point (defineMiniApp pattern)
 *
 * Thin launcher app that delegates all UI to the shared
 * FlamingoLauncherPage component with product key "swap".
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";

defineMiniApp({
  appId: "miniapp-flamingo-swap",
  playArea: PlayArea,
  manifest,
});
