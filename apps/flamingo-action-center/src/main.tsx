/**
 * Flamingo Action Center -- React Entry Point
 *
 * Thin launcher app that delegates all UI to a placeholder
 * FlamingoLauncherPage component with product key "actionCenter".
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";

defineMiniApp({
  appId: "miniapp-flamingo-action-center",
  playArea: PlayArea,
  manifest,
});
