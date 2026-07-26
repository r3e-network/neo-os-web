import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Goose Basket Shuffle", zh: "鹅篮翻翻乐" },
  appSubtitle: {
    en: "Tap items in the pen to pull them into your tray. Match three of a kind to clear them, empty the pen without jamming the tray, and snatch the runaway goose.",
    zh: "点鹅栏里的物品把它们捞进托盘，凑齐三个同款即可消除，别把托盘塞满，清空鹅栏抓住乱跑的大鹅。",
  },
  playTab: { en: "Play", zh: "游玩" },
  // MiniAppRoot resolves this shared label even when an app intentionally has
  // no network leaderboard. Keep the fallback local so production consoles
  // stay clean while the drawer exposes only honest personal records.
  ranksTab: { en: "Records", zh: "战绩" },
  lobbyTitle: { en: "Ready to catch?", zh: "准备抓鹅？" },
  playingTitle: { en: "Level {level}", zh: "第 {level} 关" },
  statusWonTitle: { en: "Goose caught!", zh: "抓到大鹅！" },
  guestRunLabel: { en: "Local play", zh: "本地游玩" },
  guestRunValue: { en: "Free", zh: "免费" },
  sidebarTitle: { en: "My record", zh: "我的战绩" },
  creditLabel: { en: "Levels cleared", zh: "已通关数" },

  // ── Launcher trust chips ──
  // These three chips are the hero's only free-standing claims, so each must
  // carry information the visitor does not already have. They used to be
  // ["guestRunValue", "scoreLevel", "creditLabel"], which printed "Free" a
  // third time (the eyebrow badge and the shared `entryGuestOnlyCopy` subtitle
  // tail already say it) and then two bare HUD nouns — "Level" and "Levels
  // cleared" — that are stat LABELS with no value attached, meaningless as
  // trust signals. Each chip below states a distinct, verifiable property of
  // this build: untimed default (G1, see timedModeHint), the three entries in
  // GAME_THEMES, and the guest-only local progress store.
  trustUntimedBadge: { en: "Untimed by default", zh: "默认不限时" },
  trustThemesBadge: { en: "Three complete themes", zh: "三套完整主题" },
  trustLocalProgressBadge: { en: "Progress stays on this device", zh: "进度只存本机" },

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

  // ── Player-selectable complete themes ──
  themePickerTitle: { en: "Choose a theme", zh: "选择主题" },
  themePickerHint: {
    en: "Every theme has its own basket, object set, atmosphere and soundscape.",
    zh: "每套主题都有独立篮子、物件、氛围与声音，可自由游玩。",
  },
  themeFreshName: { en: "Fresh Market", zh: "鲜集篮" },
  themeFreshDescription: { en: "Wicker, fruit and picnic light", zh: "柳编、果香与野餐日光" },
  themeFarmName: { en: "Farm Kitchen", zh: "农庄木箱" },
  themeFarmDescription: { en: "Warm wood and enamel cookware", zh: "暖木与搪瓷厨房" },
  themeNightName: { en: "Lantern Night", zh: "夜市灯笼" },
  themeNightDescription: { en: "Bamboo, lanterns and golden glow", zh: "竹篮、灯笼与暖金夜色" },

  // ── Real phone-motion interaction ──
  motionEnable: { en: "Shake phone to turn the basket", zh: "甩手机翻动篮子" },
  motionEnabled: { en: "Phone shake is ready", zh: "甩手机已启用" },
  motionEnableAction: { en: "Enable", zh: "开启" },
  motionDisableAction: { en: "Disable", zh: "关闭" },
  motionPrivacyHint: {
    en: "Motion stays on this device and is used only while a level is active.",
    zh: "运动数据只在本机用于当前关卡，不会上传。",
  },
  motionGrantedStatus: { en: "Ready — give the phone a firm shake during play.", zh: "已就绪——游戏中用力甩一下手机即可翻篮。" },
  motionDeniedStatus: { en: "Motion permission was not granted; the Shake button still works.", zh: "未获得运动权限，仍可使用“晃一晃”按钮。" },
  motionDisabledStatus: { en: "Phone shake disabled; the button remains available.", zh: "已关闭甩手机，按钮仍可使用。" },
  motionFallbackStatus: { en: "Motion is unavailable here; use the Shake button instead.", zh: "此设备无法读取运动数据，请使用“晃一晃”按钮。" },
  motionBlockedStatus: { en: "No motion events arrived; check browser sensor access or use the Shake button.", zh: "未收到运动事件，请检查浏览器传感器权限，或使用“晃一晃”按钮。" },

  scoreLabel: { en: "Score", zh: "分数" },
  scoreTime: { en: "Time", zh: "时间" },
  scoreLevel: { en: "Level", zh: "关卡" },
  scoreCombo: { en: "Combo", zh: "连击" },
  frenzyLabel: { en: "Frenzy", zh: "狂潮" },
  frenzyBurst: { en: "FRENZY!", zh: "狂潮来袭!" },
  comboBreak: { en: "Combo lost", zh: "连击中断" },
  milestoneHint: { en: "+1 Hint earned!", zh: "获得 +1 提示！" },
  milestoneRemove: { en: "+1 Remove earned!", zh: "获得 +1 移出！" },
  milestoneUndo: { en: "+1 Undo earned!", zh: "获得 +1 撤回！" },

  // ── R4 Daily challenge + sign-in streak ──
  dailyTitle: { en: "Daily reward", zh: "每日奖励" },
  dailyStreak: { en: "Streak {streak} day", zh: "连签 {streak} 天" },
  dailyStreakPlural: { en: "Streak {streak} days", zh: "连签 {streak} 天" },
  dailyBest: { en: "Best {best}", zh: "最佳 {best}" },
  dailyClaim: { en: "Claim day {streak}", zh: "领取第 {streak} 天" },
  dailyClaimed: { en: "Today's reward claimed", zh: "今日奖励已领取" },
  dailyChallenge: { en: "Daily challenge", zh: "今日挑战" },
  dailyMilestone: { en: "7-DAY STREAK!", zh: "连签 7 天!" },
  dailyClaimedStatus: { en: "Day {streak} reward claimed", zh: "第 {streak} 天奖励已领取" },
  dailyMilestoneStatus: { en: "7-day streak! Bonus reward granted", zh: "连签 7 天! 额外奖励已发放" },
  scoreWon: { en: "Levels cleared", zh: "已通关" },
  scoreTray: { en: "Tray", zh: "托盘" },
  levelProgressLabel: { en: "Level clear progress", zh: "本关清理进度" },
  levelProgressValue: { en: "Cleared {percent}%", zh: "已清理 {percent}%" },
  levelScopeValue: { en: "{kinds} kinds · {total} items", zh: "{kinds} 类 · {total} 件" },
  levelScopeValueSingular: { en: "{kinds} kinds · 1 item", zh: "{kinds} 类 · 1 件" },
  levelReserveValue: { en: "{count} below", zh: "底藏 {count} 件" },
  tutorialPick: {
    en: "Tap one top item and watch it fly into the tray",
    zh: "先点一件最上层物品，看它飞入托盘",
  },
  tutorialMatch: {
    en: "Keep tapping: three of a kind group and clear automatically",
    zh: "继续点选：凑齐 3 个同款会自动归组消除",
  },
  tutorialShake: {
    en: "Try Shake to uncover the pile; phone motion is available from the lobby",
    zh: "试试「晃一晃」翻开下层；大厅可开启甩手机",
  },

  controlsHint: { en: "Tap an item to pull it out", zh: "点物品即可捞出" },
  boardLabel: { en: "Goose pen", zh: "鹅栏" },
  retryAction: { en: "Restart", zh: "重开" },

  rulesTitle: { en: "How to play", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Dozens of items tumble into the pen under physics; deeper reserve waves emerge as you clear space. 2. Tap an item to pull it into your 7-slot tray. 3. Three of the same kind in the tray (or side shelf) clear away. 4. Drain every reserve wave to catch the goose — but if the tray jams full with no match, the goose escapes! Rescue tools: Remove parks 3 tray items on the shelf, Undo returns your last grab, Shake stirs the pile. Chain clears within the combo window for bonus points.",
    zh: "1. 数十件物品先在物理作用下堆进鹅栏，挖开空间后，底层储备会分批涌现。2. 点击物品把它捞进 7 格托盘。3. 托盘（含场边暂存位）凑齐三个同款即消除。4. 清空全部储备就能抓住大鹅——但托盘塞满又无法消除就会卡死，大鹅溜走！自救道具：移出可把 3 件托盘物品放到暂存位，撤回可收回上一次抓取，晃一晃能翻动堆底。连击时间内连续消除可得额外分数。",
  },

  statusReady: { en: "Tap Start to begin", zh: "点击开始进行游戏" },
  resumeRunTitle: { en: "Level {level} is still in progress", zh: "第 {level} 关还没结束" },
  resumeRunHint: { en: "Your tray, tools and deeper reserve were saved.", zh: "托盘、道具和底层储备都已保存。" },
  resumeRunAction: { en: "Continue", zh: "继续" },
  discardRunAction: { en: "Discard", zh: "放弃" },
  statusResumeAvailable: { en: "Level {level} can be continued", zh: "可以继续第 {level} 关" },
  statusRunResumed: { en: "Level {level} restored", zh: "已恢复第 {level} 关" },
  statusResumeUnavailable: { en: "That saved run is no longer available", zh: "该局存档已不可用" },
  statusRunDiscarded: { en: "Saved run discarded", zh: "已放弃局内存档" },
  progressSaveFailed: { en: "Progress could not be saved on this device", zh: "此设备无法保存游戏进度" },
  progressFutureVersion: { en: "Progress belongs to a newer game version and is read-only", zh: "进度来自更新版本，本版本仅可读取" },
  statusPlaying: { en: "Clear the pen!", zh: "清空鹅栏！" },
  statusMatched: { en: "+{gained} (combo x{combo})", zh: "+{gained}（连击 x{combo}）" },
  statusTray: { en: "{left} tray slots left", zh: "托盘剩 {left} 格" },
  statusStreamRefill: {
    en: "{count} deeper items surfaced · {remaining} still below",
    zh: "底层又涌出 {count} 件 · 还藏着 {remaining} 件",
  },
  statusCaught: { en: "Goose caught! +{bonus} time bonus", zh: "抓到大鹅！时间奖励 +{bonus}" },
  statusCaughtUntimed: { en: "Goose caught — pen cleared!", zh: "抓到大鹅——鹅栏清空！" },
  statusTrayRescue: {
    en: "Tray jammed! Use Remove or Undo to rescue the run",
    zh: "托盘卡住了！快用移出或撤回自救",
  },
  statusTrayJammedTitle: {
    en: "Tray full — stop picking items",
    zh: "托盘已满，别再点物品",
  },
  statusTrayJammedHint: {
    en: "Use Remove or Undo below to free space and keep playing",
    zh: "立即使用下方「移出」或「撤回」腾出空位",
  },
  // Failure is READABLE: timeout vs jammed tray get distinct copy (+ stamps).
  statusFailedTimeout: { en: "Time ran out — the goose got away", zh: "时间到了，大鹅溜走了" },
  statusFailedTrayFull: {
    en: "All 7 tray slots filled without a match. This run is over.",
    zh: "7 格托盘全部塞满且无法凑成三连，本局结束。",
  },
  statusFailedTrayFullTitle: { en: "Tray full — run over", zh: "托盘已满，本局结束" },
  statusFailedTitle: { en: "The goose got away", zh: "大鹅溜走了" },
  continueRunAction: { en: "Use recovery feather", zh: "使用救援羽毛" },
  continueTrayAction: { en: "Free 3 slots and continue", zh: "腾出 3 格继续" },
  continueAvailableHint: {
    en: "Your one recovery feather can reopen three tray slots or grant 30 extra seconds.",
    zh: "本局唯一一枚救援羽毛可腾回 3 格托盘，或在超时时追加 30 秒。",
  },
  statusContinued: { en: "Recovery feather used — the run continues", zh: "救援羽毛已生效，继续这一局" },
  shareResultAction: { en: "Share result", zh: "分享成绩" },
  shareResultText: {
    en: "I reached level {level} with {score} points in Goose Basket Shuffle.",
    zh: "我在《鹅篮翻翻乐》第 {level} 关拿到了 {score} 分。",
  },
  shareResultDone: { en: "Share sheet completed", zh: "已完成分享" },
  shareResultCopied: { en: "Result copied", zh: "成绩文案已复制" },
  shareResultUnavailable: { en: "Sharing is unavailable in this browser", zh: "当前浏览器无法分享或复制" },
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
  sceneVolcano: { en: "Ember Volcano", zh: "火山" },
  sceneCloud: { en: "Drifting Clouds", zh: "云端" },
  sceneAbyss: { en: "Sunless Abyss", zh: "深海" },

  // ── Limited-edition goose collection (G4) ──
  gooseGarden: { en: "Gardener Goose", zh: "菜园鹅" },
  gooseOrchard: { en: "Orchard Goose", zh: "果园鹅" },
  goosePond: { en: "Sailor Goose", zh: "池塘鹅" },
  gooseFarm: { en: "Farmhand Goose", zh: "农场鹅" },
  gooseSnowfield: { en: "Snowfield Goose", zh: "雪原鹅" },
  gooseNightMarket: { en: "Night Market Goose", zh: "夜市鹅" },
  gooseVolcano: { en: "Lava Goose", zh: "火山鹅" },
  gooseCloud: { en: "Cloud Goose", zh: "云端鹅" },
  gooseAbyss: { en: "Abyss Goose", zh: "深海鹅" },
  gooseUnlocked: { en: "Limited goose unlocked: {name}!", zh: "解锁限定大鹅：{name}！" },
  collectionTitle: { en: "Goose collection", zh: "大鹅收藏册" },
  collectionCount: { en: "{have}/{total} collected", zh: "已收集 {have}/{total}" },
  collectionLockedHint: { en: "Clear level {level} to unlock", zh: "通关第 {level} 关解锁" },
  collectionBack: { en: "Back to levels", zh: "返回关卡" },

  // ── Goose passive bonuses (R3) — shown in the collection book ──
  goosePerkGarden: { en: "Start each level with +1 hint", zh: "每局开局额外 +1 提示" },
  goosePerkOrchard: { en: "Start each level with +1 move-out", zh: "每局开局额外 +1 移出" },
  goosePerkPond: { en: "Shake cooldown −1s", zh: "晃一晃冷却 −1 秒" },
  goosePerkFarm: { en: "Combo window +200ms", zh: "连击窗口 +200 毫秒" },
  goosePerkSnowfield: { en: "Start each level with +1 undo", zh: "每局开局额外 +1 撤回" },
  goosePerkNightMarket: { en: "Milestone rewards arrive 10% earlier", zh: "里程碑返还提前 10%" },
  goosePerkVolcano: { en: "Start each level with +1 shuffle", zh: "每局开局额外 +1 洗牌" },
  goosePerkCloud: { en: "Score +5% (collection prestige)", zh: "得分 +5%（收藏荣誉加成）" },
  goosePerkAbyss: { en: "Frenzy triggers one combo earlier", zh: "狂潮触发门槛 −1 连击" },

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

  // ── Honest local record (no wallet, network request or fake ranking) ──
  personalRecordTitle: { en: "This level · personal record", zh: "本关个人记录" },
  personalBestLabel: { en: "Best", zh: "最佳" },
  personalAttemptsLabel: { en: "Attempts", zh: "尝试" },
  personalClearsLabel: { en: "Clears", zh: "通关" },

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
  untimedHud: { en: "Relaxed · No timer", zh: "休闲 · 不限时" },

  soundOn: { en: "Sound on", zh: "音效开" },
  soundOff: { en: "Sound off", zh: "音效关" },
  hapticsOn: { en: "Vibration on", zh: "振动开" },
  hapticsOff: { en: "Vibration off", zh: "振动关" },
  soundEnableAction: { en: "Enable sound", zh: "开启音效" },
  soundDisableAction: { en: "Mute sound", zh: "关闭音效" },
  hapticsEnableAction: { en: "Enable vibration", zh: "开启振动" },
  hapticsDisableAction: { en: "Disable vibration", zh: "关闭振动" },
  itemColorway: { en: "{name} · color {variant}", zh: "{name} · 配色{variant}" },

  // Fresh Market catalog: 18 authored silhouettes + 36 near-match treatments.
  freshApple: { en: "Green apple", zh: "青苹果" },
  freshOrange: { en: "Orange", zh: "橙子" },
  freshLemon: { en: "Lemon", zh: "柠檬" },
  freshMushroom: { en: "Mushroom", zh: "蘑菇" },
  freshBaguette: { en: "Baguette", zh: "法棍" },
  freshCup: { en: "Cream cup", zh: "奶油陶瓷杯" },
  freshTeaTin: { en: "Tea tin", zh: "茶叶铁盒" },
  freshBoat: { en: "Toy sailboat", zh: "小帆船" },
  freshCandy: { en: "Pink candy", zh: "粉色糖果" },
  freshPear: { en: "Green pear", zh: "青梨" },
  freshDonut: { en: "Donut", zh: "甜甜圈" },
  freshEgg: { en: "White egg", zh: "白鸡蛋" },
  freshStrawberry: { en: "Strawberry basket", zh: "草莓篮" },
  freshWatermelon: { en: "Watermelon slice", zh: "西瓜切片" },
  freshHoney: { en: "Honey jar", zh: "蜂蜜罐" },
  freshCheese: { en: "Picnic cheese", zh: "野餐奶酪" },
  freshFlowerPot: { en: "Daisy flowerpot", zh: "雏菊花盆" },
  freshJuice: { en: "Pear juice carton", zh: "青梨果汁盒" },

  // Farm Kitchen atlas: every silhouette has two separate near matches.
  farmKettle: { en: "Enamel kettle", zh: "搪瓷水壶" },
  farmMilk: { en: "Milk bottle", zh: "牛奶瓶" },
  farmBowl: { en: "Blue bowl", zh: "蓝陶碗" },
  farmRoll: { en: "Cinnamon roll", zh: "肉桂卷" },
  farmJam: { en: "Strawberry jam", zh: "草莓果酱" },
  farmSpoon: { en: "Wooden spoon", zh: "木勺" },
  farmPumpkin: { en: "Pumpkin", zh: "小南瓜" },
  farmMitt: { en: "Oven mitt", zh: "隔热手套" },
  farmWindmill: { en: "Toy windmill", zh: "小风车" },
  farmJug: { en: "Cream jug", zh: "奶油陶瓷壶" },
  farmCookie: { en: "Heart cookie", zh: "心形曲奇" },
  farmMug: { en: "Blue mug", zh: "蓝陶杯" },
  farmRollingPin: { en: "Rolling pin", zh: "木擀面杖" },
  farmPot: { en: "Enamel cooking pot", zh: "搪瓷煮锅" },
  farmBread: { en: "Country loaf", zh: "乡村面包" },
  farmButter: { en: "Butter crock", zh: "黄油罐" },
  farmRooster: { en: "Rooster figurine", zh: "公鸡摆件" },
  farmYarn: { en: "Wool yarn", zh: "羊毛线团" },

  // Lantern Night atlas: every silhouette has two separate near matches.
  nightLantern: { en: "Paper lantern", zh: "红纸灯笼" },
  nightBun: { en: "Steamed bun", zh: "蒸包" },
  nightSoda: { en: "Citrus soda", zh: "青橘汽水" },
  nightMooncake: { en: "Mooncake", zh: "月饼" },
  nightTanghulu: { en: "Candied hawthorn", zh: "糖葫芦" },
  nightDrum: { en: "Festival drum", zh: "红金小鼓" },
  nightBambooCup: { en: "Bamboo cup", zh: "竹杯" },
  nightZongzi: { en: "Rice dumpling", zh: "粽子" },
  nightFishCharm: { en: "Fish charm", zh: "鱼形挂件" },
  nightBowl: { en: "Rice bowl", zh: "米白小碗" },
  nightBell: { en: "Brass bell", zh: "黄铜铃" },
  nightSnackTin: { en: "Snack tin", zh: "点心铁盒" },
  nightTeapot: { en: "Jade teapot", zh: "青玉茶壶" },
  nightFan: { en: "Festival folding fan", zh: "节庆折扇" },
  nightLuckyCat: { en: "Lucky cat", zh: "招财猫" },
  nightNoodles: { en: "Noodle bowl", zh: "汤面碗" },
  nightLotusLamp: { en: "Lotus lamp", zh: "莲花灯" },
  nightMahjong: { en: "Mahjong tile", zh: "麻将牌" },

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
  canvasContextLost: {
    en: "Graphics were interrupted. Retry to restore this run.",
    zh: "图形环境被系统中断，请重试恢复本局。",
  },
  continueAction: { en: "Continue", zh: "继续" },
};

export const messages = mergeMessages(appMessages);
