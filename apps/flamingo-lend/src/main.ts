/**
 * Flamingo Lend — Entry Point (defineMiniApp pattern)
 *
 * Thin launcher app that delegates all UI to the shared
 * FlamingoLauncherPage component with product key "lend".
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";

defineMiniApp({
  appId: "miniapp-flamingo-lend",
  playArea: PlayArea,
  manifest,
});
