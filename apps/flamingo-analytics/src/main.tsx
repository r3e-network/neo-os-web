/**
 * Flamingo Analytics -- React Entry Point
 *
 * Thin launcher app that delegates all UI to a placeholder
 * FlamingoLauncherPage component with product key "analytics".
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";

defineMiniApp({
  appId: "miniapp-flamingo-analytics",
  playArea: PlayArea,
  manifest,
});
