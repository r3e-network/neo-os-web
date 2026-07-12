import { messages } from "./locale/messages";
import { FRUIT_ENGINE_MESSAGE_KEYS } from "./logic/fruit-engine";

type FruitMessageKey = keyof typeof messages;

export const FRUIT_SCENE_COPY_KEYS = [
  "appTitle",
  "appEyebrow",
  "timeLabel",
  "pairsLabel",
  "scoreLabel",
  "chuteLabel",
  "movesLabel",
  "seedLabel",
  "undoAction",
  "hintAction",
  "pauseAction",
  "resumeAction",
  "newOrchardAction",
  "pauseTitle",
  "pauseCopy",
  "winTitle",
  "winCopy",
  "lostTitle",
  "lostCopy",
  "timeoutTitle",
  "timeoutCopy",
  "keyboardHelp",
  "storageWarning",
  "statusHintReady",
  "statusHintUndo",
  "statusHintRestart",
  ...FRUIT_ENGINE_MESSAGE_KEYS,
] as const satisfies readonly FruitMessageKey[];

export type FruitSceneCopyKey = (typeof FRUIT_SCENE_COPY_KEYS)[number];
export type FruitSceneCopy = Record<FruitSceneCopyKey, string>;

export function createFruitSceneCopy(t: (key: FruitMessageKey) => string): FruitSceneCopy {
  return Object.fromEntries(
    FRUIT_SCENE_COPY_KEYS.map((key) => [key, t(key)]),
  ) as FruitSceneCopy;
}
