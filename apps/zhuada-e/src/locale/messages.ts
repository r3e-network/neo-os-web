import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Catch the Goose", zh: "抓大鹅" },
  appSubtitle: {
    en: "Tap items in the pen to pull them into your tray. Match three of a kind to clear them, empty the pen without jamming the tray, and snatch the runaway goose.",
    zh: "点鹅栏里的物品把它们捞进托盘，凑齐三个同款即可消除，别把托盘塞满，清空鹅栏抓住乱跑的大鹅。",
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

  // ── Timed-challenge mode (G1: untimed is the default) ──
  timedModeLabel: { en: "Timed challenge", zh: "限时挑战" },
  timedModeHint: {
    en: "Off: take your time — only a jammed tray loses. On: beat the clock for a time bonus.",
    zh: "关闭：慢慢想，只有托盘卡死才会输。开启：与时间赛跑，剩余时间换奖励分。",
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
    en: "1. Items tumble into the pen under physics. 2. Tap an item to pull it into your 7-slot tray. 3. Three of the same kind in the tray (or side shelf) clear away. 4. Empty the pen to catch the goose — but if the tray jams full with no match, the goose escapes! Rescue tools: Remove parks 3 tray items on the shelf, Undo returns your last grab, Shake stirs the pile. Chain clears within the combo window for bonus points.",
    zh: "1. 物品在物理作用下堆进鹅栏。2. 点击物品把它捞进 7 格托盘。3. 托盘（含场边暂存位）凑齐三个同款即消除。4. 清空鹅栏就能抓住大鹅——但托盘塞满又无法消除就会卡死，大鹅溜走！自救道具：移出可把 3 件托盘物品放到暂存位，撤回可收回上一次抓取，晃一晃能翻动堆底。连击时间内连续消除可得额外分数。",
  },

  statusReady: { en: "Tap Start to begin", zh: "点击开始进行游戏" },
  statusPlaying: { en: "Clear the pen!", zh: "清空鹅栏！" },
  statusMatched: { en: "+{gained} (combo x{combo})", zh: "+{gained}（连击 x{combo}）" },
  statusTray: { en: "{left} tray slots left", zh: "托盘剩 {left} 格" },
  statusCaught: { en: "Goose caught! +{bonus} time bonus", zh: "抓到大鹅！时间奖励 +{bonus}" },
  statusCaughtUntimed: { en: "Goose caught — pen cleared!", zh: "抓到大鹅——鹅栏清空！" },
  statusTrayRescue: {
    en: "Tray jammed! Use Remove or Undo to rescue the run",
    zh: "托盘卡住了！快用移出或撤回自救",
  },
  // Failure is READABLE: timeout vs jammed tray get distinct copy (+ stamps).
  statusFailedTimeout: { en: "Time ran out — the goose got away", zh: "时间到了，大鹅溜走了" },
  statusFailedTrayFull: { en: "Tray jammed — the goose got away", zh: "托盘塞满卡死，大鹅溜走了" },
  statusFailedTitle: { en: "The goose got away", zh: "大鹅溜走了" },
  statusNext: { en: "Next level", zh: "下一关" },
  statusRetry: { en: "Retry", zh: "重来" },
  statusAllClear: { en: "All levels cleared — total goose victory!", zh: "全部通关，大获全鹅！" },

  // ── Scenes (G4 themed pens) ──
  sceneGarden: { en: "Veggie Garden", zh: "菜园" },
  sceneOrchard: { en: "Sunny Orchard", zh: "果园" },
  scenePond: { en: "Reed Pond", zh: "池塘" },
  sceneFarm: { en: "Old Farm", zh: "农场" },
  sceneSnowfield: { en: "Snowfield", zh: "雪原" },
  sceneNightMarket: { en: "Night Market", zh: "夜市" },

  // ── Limited-edition goose collection (G4) ──
  gooseGarden: { en: "Gardener Goose", zh: "菜园鹅" },
  gooseOrchard: { en: "Orchard Goose", zh: "果园鹅" },
  goosePond: { en: "Sailor Goose", zh: "池塘鹅" },
  gooseFarm: { en: "Farmhand Goose", zh: "农场鹅" },
  gooseSnowfield: { en: "Snowfield Goose", zh: "雪原鹅" },
  gooseNightMarket: { en: "Night Market Goose", zh: "夜市鹅" },
  gooseUnlocked: { en: "Limited goose unlocked: {name}!", zh: "解锁限定大鹅：{name}！" },
  collectionTitle: { en: "Goose collection", zh: "大鹅收藏册" },
  collectionCount: { en: "{have}/{total} collected", zh: "已收集 {have}/{total}" },
  collectionLockedHint: { en: "Clear level {level} to unlock", zh: "通关第 {level} 关解锁" },
  collectionBack: { en: "Back to levels", zh: "返回关卡" },

  // ── Level select map (G4) ──
  levelSelectTitle: { en: "Pick a pen", zh: "选择鹅栏" },
  levelBest: { en: "Best {score}", zh: "最佳 {score}" },
  levelLockedLabel: { en: "Level {level} locked", zh: "第 {level} 关未解锁" },

  // ── All-clear ending (finishing the last level) ──
  allClearTitle: { en: "Total goose victory!", zh: "大获全鹅！" },
  allClearBody: {
    en: "The final pen is empty! Here is your goose journey so far.",
    zh: "最后一个鹅栏也清空啦！这是你的抓鹅战绩。",
  },
  allClearBack: { en: "Back to the pens", zh: "返回鹅栏地图" },

  // ── Stats (sidebar / stat cards, persisted locally) ──
  statWins: { en: "Total wins", zh: "累计胜场" },
  statBest: { en: "Best score", zh: "最佳分数" },
  statGeese: { en: "Geese collected", zh: "收藏大鹅" },

  // ── Guest leaderboard (G6, off-chain best-effort) ──
  leaderboardTitle: { en: "Guest leaderboard", zh: "游客排行榜" },
  leaderboardEmpty: { en: "No scores yet — catch a goose!", zh: "还没有成绩——快去抓鹅！" },

  puTitle: { en: "Power-ups", zh: "道具" },
  puShuffle: { en: "Shuffle", zh: "洗牌" },
  puHint: { en: "Hint", zh: "提示" },
  puAddTime: { en: "+15s", zh: "加时" },
  puRemove: { en: "Remove", zh: "移出" },
  puUndo: { en: "Undo", zh: "撤回" },
  puShake: { en: "Shake", zh: "晃一晃" },
  puShakeCd: { en: "Shake ({sec}s)", zh: "晃一晃（{sec}秒）" },
  puUsedShuffle: { en: "Shuffled the pen!", zh: "已洗牌重落！" },
  puUsedHint: { en: "A helpful item is glowing", zh: "高亮了一个可消物品" },
  puUsedAddTime: { en: "+{sec}s added", zh: "时间 +{sec}秒" },
  puUsedRemove: { en: "3 items parked on the shelf", zh: "3 件物品已移到暂存位" },
  puUsedUndo: { en: "Last grab returned to the pen", zh: "上一次抓取已放回鹅栏" },
  puUsedShake: { en: "The pile got a good shake!", zh: "鹅栏晃了晃，翻出了下层！" },

  // ── Side shelf (G2 移出 target) ──
  shelfTitle: { en: "Shelf", zh: "暂存" },
  shelfEmptySlot: { en: "Empty shelf slot", zh: "暂存空位" },
  untimedBadge: { en: "Relaxed", zh: "无倒计时" },

  soundOn: { en: "Sound on", zh: "音效开" },
  soundOff: { en: "Sound off", zh: "音效关" },
  hapticsOn: { en: "Vibration on", zh: "振动开" },
  hapticsOff: { en: "Vibration off", zh: "振动关" },

  // Item kind names (tray tooltips + accessible labels), keyed by ModelKind.
  kindTomato: { en: "Tomato", zh: "番茄" },
  kindCarrot: { en: "Carrot", zh: "胡萝卜" },
  kindCorn: { en: "Corn", zh: "玉米" },
  kindEggplant: { en: "Eggplant", zh: "茄子" },
  kindApple: { en: "Apple", zh: "苹果" },
  kindBroccoli: { en: "Broccoli", zh: "西兰花" },
  kindMushroom: { en: "Mushroom", zh: "蘑菇" },
  kindOnion: { en: "Onion", zh: "洋葱" },
  kindPepper: { en: "Pepper", zh: "辣椒" },
  kindMelon: { en: "Melon", zh: "西瓜" },
  kindEgg: { en: "Egg", zh: "鸡蛋" },
  kindFish: { en: "Fish", zh: "小鱼干" },
  trayEmptySlot: { en: "Empty slot", zh: "空格" },

  // 3D canvas host (ThreeGameComponent) — loading / boot-failure UI.
  canvasLoading: { en: "Loading the pen…", zh: "鹅栏加载中…" },
  canvasError: {
    en: "The 3D pen could not start on this device",
    zh: "3D 鹅栏无法在此设备上启动",
  },
  continueAction: { en: "Continue", zh: "继续" },
};

export const messages = mergeMessages(appMessages);
