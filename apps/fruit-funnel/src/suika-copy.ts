export type SuikaSceneCopyKey =
  | "appTitle"
  | "scoreLabel"
  | "bestLabel"
  | "nextLabel"
  | "dangerLabel"
  | "pauseTitle"
  | "pauseCopy"
  | "gameOverTitle"
  | "gameOverCopy"
  | "newRecordCopy"
  | "resumeAction"
  | "newGameAction"
  | "dropHint"
  | "statusReady"
  | "statusDropped"
  | "statusMerged"
  | "statusGameOver"
  | "statusPaused"
  | "statusResumed"
  | "storageWarning";

export type SuikaSceneCopy = Record<SuikaSceneCopyKey, string>;

export type TranslateFn = (key: SuikaSceneCopyKey) => string;

export function createSuikaSceneCopy(t: TranslateFn): SuikaSceneCopy {
  return {
    appTitle: t("appTitle"),
    scoreLabel: t("scoreLabel"),
    bestLabel: t("bestLabel"),
    nextLabel: t("nextLabel"),
    dangerLabel: t("dangerLabel"),
    pauseTitle: t("pauseTitle"),
    pauseCopy: t("pauseCopy"),
    gameOverTitle: t("gameOverTitle"),
    gameOverCopy: t("gameOverCopy"),
    newRecordCopy: t("newRecordCopy"),
    resumeAction: t("resumeAction"),
    newGameAction: t("newGameAction"),
    dropHint: t("dropHint"),
    statusReady: t("statusReady"),
    statusDropped: t("statusDropped"),
    statusMerged: t("statusMerged"),
    statusGameOver: t("statusGameOver"),
    statusPaused: t("statusPaused"),
    statusResumed: t("statusResumed"),
    storageWarning: t("storageWarning"),
  };
}
