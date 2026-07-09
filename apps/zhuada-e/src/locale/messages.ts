import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Catch the Goose", zh: "抓大鹅" },
  appSubtitle: {
    en: "Tap items in the pen to pull them into your tray. Match three of a kind to clear them, empty the pen, and snatch the runaway goose before time runs out.",
    zh: "点鹅栏里的物品把它们捞进托盘，凑齐三个同款即可消除，清空鹅栏，在倒计时归零前抓住乱跑的大鹅。",
  },
  playTab: { en: "Play", zh: "游玩" },
  lobbyTitle: { en: "Ready to catch?", zh: "准备抓鹅？" },
  playingTitle: { en: "Level {level}", zh: "第 {level} 关" },
  statusWonTitle: { en: "Goose caught!", zh: "抓到大鹅！" },
  guestRunLabel: { en: "Local play", zh: "本地游玩" },
  guestRunValue: { en: "Free", zh: "免费" },
  sidebarTitle: { en: "My record", zh: "我的战绩" },
  creditLabel: { en: "Levels cleared", zh: "已通关数" },

  startAction: { en: "Start level", zh: "开始关卡" },
  moreActions: { en: "More", zh: "更多" },

  // In-canvas labels (bridged into the Three.js scene).
  startOpenRun: { en: "Start", zh: "开始" },
  startOpening: { en: "Starting…", zh: "开局中…" },
  startHint: { en: "Pull 3 of a kind into the tray to clear", zh: "把 3 个同款捞进托盘即可消除" },
  startDescription: {
    en: "Tap items to pull them into the 7-slot tray. Three of the same kind clears. Empty the whole pen to catch the goose. No entry fee, all local.",
    zh: "点击物品把它们捞进 7 格托盘，凑齐三个同款即消除。清空整个鹅栏就能抓住大鹅。无需报名费，纯本地游玩。",
  },

  scoreLabel: { en: "Score", zh: "分数" },
  scoreTime: { en: "Time", zh: "时间" },
  scoreLevel: { en: "Level", zh: "关卡" },
  scoreCombo: { en: "Combo", zh: "连击" },
  scoreWon: { en: "Levels cleared", zh: "已通关" },
  scoreTray: { en: "Tray", zh: "托盘" },

  controlsHint: { en: "Tap an item to pull it out", zh: "点物品即可捞出" },
  boardLabel: { en: "Goose pen", zh: "鹅栏" },
  retryAction: { en: "Restart", zh: "重开" },

  rulesTitle: { en: "How to play", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Items tumble into the pen under physics. 2. Tap an item to pull it into your 7-slot tray. 3. Three of the same kind in the tray clear away. 4. Empty the pen before the timer hits zero to catch the goose! Chain clears within the combo window for bonus points.",
    zh: "1. 物品在物理作用下堆进鹅栏。2. 点击物品把它捞进 7 格托盘。3. 托盘里凑齐三个同款即消除。4. 在倒计时归零前清空鹅栏即可抓住大鹅！连击时间内连续消除可得额外分数。",
  },

  statusReady: { en: "Tap Start to begin", zh: "点击开始进行游戏" },
  statusPlaying: { en: "Clear the pen!", zh: "清空鹅栏！" },
  statusMatched: { en: "+{gained} (combo x{combo})", zh: "+{gained}（连击 x{combo}）" },
  statusTray: { en: "{left} tray slots left", zh: "托盘剩 {left} 格" },
  statusCaught: { en: "Goose caught! +{bonus} time bonus", zh: "抓到大鹅！时间奖励 +{bonus}" },
  statusFailed: { en: "Tray jammed — the goose got away", zh: "托盘塞满，大鹅溜走了" },
  statusFailedTitle: { en: "The goose got away", zh: "大鹅溜走了" },
  statusNext: { en: "Next level", zh: "下一关" },
  statusRetry: { en: "Retry", zh: "重来" },
  statusAllClear: { en: "All levels cleared! 🪿", zh: "全部通关！🪿" },

  puTitle: { en: "Power-ups", zh: "道具" },
  puShuffle: { en: "Shuffle", zh: "洗牌" },
  puHint: { en: "Hint", zh: "提示" },
  puAddTime: { en: "+15s", zh: "加时" },
  puUsedShuffle: { en: "Shuffled the pen!", zh: "已洗牌重落！" },
  puUsedHint: { en: "A helpful item is glowing", zh: "高亮了一个可消物品" },
  puUsedAddTime: { en: "+{sec}s added", zh: "时间 +{sec}秒" },

  soundOn: { en: "Sound on", zh: "音效开" },
  soundOff: { en: "Sound off", zh: "音效关" },
};

export const messages = mergeMessages(appMessages);
