import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Sheep Solitaire", zh: "小羊接龙" },
  appSubtitle: {
    en: "Pick cards from the pile into your slot bar — three matching cards auto-eliminate. Clear the board before the slots fill up to win!",
    zh: "从牌堆选取卡片放入卡槽——三张相同卡片自动消除。在卡槽满溢前清空所有卡片即可获胜！",
  },
  rollTab: { en: "Board", zh: "牌局" },
  rollDescription: {
    en: "Pick exposed cards into the slot bar, match three to clear them, and empty the board before time runs out.",
    zh: "选择可见卡片放入卡槽，三张相同即消除，并在倒计时前清空牌面。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Clear the meadow board", zh: "清空草地牌局" },
  playingTitle: { en: "Sheep Solitaire", zh: "小羊接龙" },
  statusWonTitle: { en: "All cards cleared!", zh: "全部消除！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Free-board rank", zh: "自由榜排名" },
  sidebarTitle: { en: "My local record", zh: "我的本地战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Board route", zh: "牌局路线" },
  easyLabel: { en: "Meadow Board", zh: "草地牌局" },
  mediumLabel: { en: "Festival Board", zh: "庆典牌局" },
  hardLabel: { en: "Mountain Board", zh: "山岭牌局" },
  routeEyebrow: { en: "match-3 route", zh: "三消路线" },
  routeSummary: { en: "Current board mode, timer, tray, and tools", zh: "当前牌局的模式、计时、卡槽与道具" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  poolMetric: { en: "Pool", zh: "奖池" },
  trayMetric: { en: "Tray", zh: "卡槽" },
  toolsMetric: { en: "Tools", zh: "道具" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },

  easyDesc: { en: "A friendly meadow with 8 symbol families and a quick 5-minute clock.", zh: "友好的草地牌局，8 组图案，5 分钟快节奏清盘。" },
  mediumDesc: { en: "A fuller festival spread with 12 symbol families and tighter slot pressure.", zh: "更丰富的庆典牌局，12 组图案，卡槽压力更高。" },
  hardDesc: { en: "A dense mountain layout with 15 symbol families for a serious clear.", zh: "密集的山岭牌局，15 组图案，面向认真挑战。" },

  startAction: { en: "Open board", zh: "开启牌局" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Choose a route and start immediately. Free play runs locally, needs no wallet, and never asks you to fill in a transaction form.",
    zh: "选择路线即可立即开局。自由练习在本地运行，无需钱包，也不会要求填写交易表单。",
  },
  submitAction: { en: "Submit win", zh: "提交获胜" },
  submitSolution: { en: "Submit win", zh: "提交获胜" },
  submitHint: { en: "All cards cleared — submit before the deadline", zh: "已清空所有卡片——在截止前提交" },
  timeUpAction: { en: "Time is up", zh: "时间到" },

  undoAction: { en: "Undo ({left} left, -30%)", zh: "撤回（剩 {left} 次，-30%）" },
  undoConfirm: { en: "Confirm undo — reward drops to {pct}%", zh: "确认撤回——奖励降至 {pct}%" },
  undoHint: {
    en: "Recorded by the enclave session — no transaction needed. Each undo burns 30% of the base reward; three max.",
    zh: "由飞地会话记录——无需交易。每次撤回扣除基础奖励的 30%，最多三次。",
  },

  shuffleAction: { en: "Shuffle ({left})", zh: "洗牌（{left}）" },
  shuffleHint: {
    en: "Reshuffle all cards in the slot bar back into the pile. One use per game.",
    zh: "将卡槽中所有卡片洗回牌堆。每局一次。",
  },
  remove3Action: { en: "Remove 3 ({left})", zh: "移出三张（{left}）" },
  remove3Hint: {
    en: "Return the first 3 tray tiles to the pile. One use per game.",
    zh: "将卡槽前 3 张卡片退回牌堆。每局一次。",
  },

  releaseAction: { en: "Release game", zh: "结算过期对局" },
  expireGame: { en: "Release game", zh: "结算过期对局" },
  releaseHint: {
    en: "Frees the reward reservation of an expired game (refunds an undealt entry).",
    zh: "释放过期对局占用的奖励额度（未发牌的对局将退回报名费）。",
  },
  withdrawAction: { en: "Withdraw {amount} GAS", zh: "提取 {amount} GAS" },
  withdrawTitle: { en: "Withdraw winnings", zh: "提取奖金" },
  withdrawHint: {
    en: "Pulls your winnings and unused entry credit back to your wallet.",
    zh: "将奖金与未使用的报名余额提回钱包。",
  },

  pileLabel: { en: "Card pile", zh: "牌堆" },
  slotBarLabel: { en: "Slot bar ({used}/{cap})", zh: "卡槽（{used}/{cap}）" },
  slotsFull: { en: "Slots full — game over!", zh: "卡槽已满——游戏结束！" },
  rewardNow: { en: "{amount} GAS ({pct}%)", zh: "{amount} GAS（{pct}%）" },
  cardsLeft: { en: "{count} cards left", zh: "剩余 {count} 张" },
  minSolveHint: {
    en: "Anti-bot floor: submission unlocks in {clock}",
    zh: "防脚本时间下限：{clock} 后可提交",
  },
  deadlineBufferHint: {
    en: "Too close to the deadline — a transaction can no longer land in time.",
    zh: "距截止时间太近——交易已无法在截止前上链。",
  },
  timeUpHint: {
    en: "The deadline passed — release the game to start a new one.",
    zh: "已超过截止时间——请结算本局后再开新局。",
  },
  shufflingCopy: {
    en: "Your card layout is sealed inside the Morpheus enclave — only its hash commitment goes on-chain, and cards are revealed as you pick them.",
    zh: "牌面在 Morpheus 飞地内密封——链上只记录哈希承诺，卡片在你选取时才揭示。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another game to climb the ranks.",
    zh: "已计入可提取余额——再来一局，冲击更高排名。",
  },
  gameOverBanner: { en: "Slots full — better luck next time", zh: "卡槽已满——下次加油" },
  gameOverBannerHint: {
    en: "The entry stays in the reward pool. Fresh layout, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },
  expiredBanner: { en: "That game got away", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh layout, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scoreUndos: { en: "Undos left", zh: "剩余撤回" },
  scoreCards: { en: "Cards left", zh: "剩余卡片" },
  scoreWon: { en: "Best tiles cleared", zh: "最佳消除数" },
  scoreRuns: { en: "Boards cleared", zh: "通关次数" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  leaderboardIntro: {
    en: "Free-play scores use a separate guest board when it is available; they never mix with paid or on-chain records.",
    zh: "自由练习成绩会在游客榜可用时单独记录，不会与付费或链上记录混在一起。",
  },
  leaderboardTitle: { en: "Free-play leaderboard", zh: "自由练习榜" },
  leaderboardEmpty: {
    en: "No guest scores yet — the first name on this board could be yours.",
    zh: "暂无游客成绩——榜单第一个名字可能就是你。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} wins", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My games", zh: "我的通关" },
  historyEmpty: { en: "Your completed local boards will appear here.", zh: "你完成的本地牌局会显示在这里。" },
  historyUndos: { en: "{undos} undos", zh: "{undos} 次撤回" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Choose Meadow, Festival, or Mountain and start instantly. 2. Tap an exposed tile to move it into the seven-slot tray. 3. Three matching tiles clear automatically; empty the board before the timer or tray fills. 4. Undo returns the last tile, Shuffle returns the tray and mixes the remaining board, and Remove 3 returns three tray tiles. 5. Use My Runs to reset safely at any time. Free play never opens a wallet or writes to chain.",
    zh: "1. 选择草地、庆典或山岭路线后立即开局。2. 点击可见卡片，将它移入七格卡槽。3. 三张相同卡片会自动消除；请在倒计时结束或卡槽填满前清空牌面。4. 撤回会退回上一张卡片，洗牌会清空卡槽并重排剩余牌面，移出三张会退回卡槽中的三张牌。5. 可随时从“我的通关”安全重置。自由练习不会唤起钱包，也不会写入链上。",
  },
  fairnessTitle: { en: "Walletless practice", zh: "无需钱包的练习" },
  fairnessNote: {
    en: "The layout is sealed inside the Morpheus enclave, revealed only as you pick exposed cards, and verified before payout.",
    zh: "牌面在 Morpheus 飞地内密封，只在你选择可见卡片时揭示，并在派奖前验证。",
  },
  fairnessShort: {
    en: "TEE-sealed cards, exposed picks, and contract-verified payout.",
    zh: "TEE 密封牌面、逐张揭示、合约核验派奖。",
  },
  activeGameLine: {
    en: "Game #{gameId} is live. Clear the board before settlement.",
    zh: "对局 #{gameId} 进行中，请在结算前清空牌面。",
  },
  fairnessCopy: {
    en: "The released mode is a local practice game: it makes no payment, oracle, TEE, or wallet request. Each route is generated as complete match-three groups across the layered board so a valid clear path always exists.",
    zh: "当前发布的是本地练习模式：不会发起支付、预言机、TEE 或钱包请求。每条路线都按完整三消组合生成并分布在多层牌面中，始终存在有效的通关路径。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Ready for today's challenge", zh: "准备好开始今日挑战" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the card layout", zh: "对局已开始——正在密封牌面" },
  statusShuffling: { en: "Sealing your game…", zh: "正在密封对局…" },
  statusSealing: { en: "Sealing your game in the enclave…", zh: "正在飞地中密封对局…" },
  statusDealt: { en: "Confidential session ready — the clock is running", zh: "机密会话已就绪——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Verified! {payout} GAS credited", zh: "验证通过！已入账 {payout} GAS" },
  statusUndoUsed: { en: "Undo recorded — reward now {pct}%", zh: "撤回已记录——奖励降至 {pct}%" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool needs refill",
    zh: "奖池需要补充",
  },
  walletRequiredStatus: {
    en: "Connect your wallet to start a game.",
    zh: "请先连接钱包再开始游戏。",
  },
  contractUnavailableStatus: {
    en: "This game is not configured for the selected network yet.",
    zh: "该游戏尚未配置到当前网络。",
  },
  startGameUnavailableStatus: {
    en: "The chain accepted the request, but no active game was returned. Please retry shortly.",
    zh: "链上请求已提交，但未返回有效对局。请稍后重试。",
  },
  paidRunsUnavailable: {
    en: "New paid boards are temporarily unavailable while live settlement is re-verified. Free play and recovery of an existing board remain available.",
    zh: "新的付费牌局暂时关闭，等待重新完成线上结算验证。自由练习与已有牌局恢复仍可使用。",
  },
  paidRunsUnavailableShort: { en: "Paid boards paused", zh: "付费牌局暂停" },
  statusInputSyncFailed: {
    en: "The enclave did not confirm that move. No local result was assumed; retry after recovery.",
    zh: "飞地未确认该操作。本地不会自行假定结果，请恢复牌局后重试。",
  },
  statusSessionMismatch: {
    en: "The recovered game does not match this wallet, network, or sealed commitment.",
    zh: "恢复的牌局与当前钱包、网络或密封承诺不匹配。",
  },
  statusSettlementPending: {
    en: "Transaction status is still unknown. Keep this game open and recover its exact on-chain state before retrying.",
    zh: "交易状态仍未知。请保留当前牌局，并先恢复其准确链上状态再重试。",
  },
  statusRecoveryUnavailable: {
    en: "The sealed session could not be restored yet. Your on-chain game id and move log were kept.",
    zh: "密封会话暂时无法恢复。链上牌局编号与操作记录已保留。",
  },
  statusRecovered: { en: "Game state recovered", zh: "牌局状态已恢复" },
  recoverAction: { en: "Recover game", zh: "恢复牌局" },
  recoveryTitle: { en: "Confirming your game", zh: "正在确认牌局" },
  recoveryHint: {
    en: "The previous request may already be on-chain. Recovery reads the exact game before enabling another action.",
    zh: "上一次请求可能已经上链。恢复会先读取准确牌局状态，再允许下一步操作。",
  },
  releaseNotReady: {
    en: "This game is still inside its protected settlement window and cannot be released yet.",
    zh: "该牌局仍处于受保护的结算窗口，暂时不能释放。",
  },
  releaseReady: { en: "This game can now be safely released.", zh: "该牌局现在可以安全释放。" },
  releaseIn: { en: "Release in {clock}", zh: "{clock} 后可释放" },
  withdrawPending: {
    en: "Withdrawal is not confirmed yet. The balance was refreshed without assuming success.",
    zh: "提取尚未确认。余额已刷新，但不会自行假定成功。",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  // ── Guest (free / local) mode copy ─────────────────────────────────────────
  freePlayLabel: { en: "Free play", zh: "自由练习" },
  modeMetric: { en: "Mode", zh: "模式" },
  clearGoalLabel: { en: "Clear {count} tiles", zh: "清除 {count} 张牌" },
  guestBadge: { en: "Free play", zh: "自由练习" },
  guestDealtStage: {
    en: "Pick exposed tiles — match three to clear the board",
    zh: "选择可见卡片——三张相同即消除",
  },
  guestDealing: { en: "Shuffling the board…", zh: "正在洗牌…" },
  guestClearedTitle: { en: "Board cleared!", zh: "牌面清空！" },
  guestRunSub: {
    en: "Nice clear — your local record is saved, and the guest board updates when available.",
    zh: "漂亮！本地战绩已保存，游客榜可用时会同步更新。",
  },
  guestPlayAgainAction: { en: "Play again", zh: "再来一局" },
  guestResetAction: { en: "Reset run", zh: "重置对局" },
  guestRunComplete: {
    en: "Local run — {count} tiles cleared!",
    zh: "本地对局——清除 {count} 张牌！",
  },
  guestUndoUsed: { en: "Last tile returned to the pile", zh: "上一张卡片已撤回牌堆" },
  guestShuffled: { en: "Board reshuffled", zh: "牌面已重洗" },
  guestRemoved3: { en: "3 tiles returned to the pile", zh: "3 张牌已移回牌堆" },
  guestProgressRestored: {
    en: "Your local board was restored — continue where you left off.",
    zh: "已恢复本地牌局——可以从离开的位置继续。",
  },
  secureRandomUnavailable: {
    en: "This browser cannot create a secure board yet. Reload and try again.",
    zh: "当前浏览器暂时无法安全生成牌局，请刷新后重试。",
  },
  guestShuffleUnavailable: {
    en: "This recovered board cannot be reshuffled safely, so the tool was not used.",
    zh: "该恢复牌局无法安全重排，因此未消耗洗牌道具。",
  },
  guestFairnessNote: {
    en: "Local practice board — no wallet needed. Device records persist; the guest leaderboard is best-effort.",
    zh: "本地练习牌局——无需钱包。本机战绩会持续保存，游客榜为尽力同步。",
  },
  guestActiveLine: {
    en: "Local run in progress — clear the board!",
    zh: "本地对局进行中——清空牌面！",
  },
  guestModeLine: {
    en: "Guest mode — local play, device recovery, optional guest ranking.",
    zh: "游客模式——本地游玩、设备恢复，可选游客排行。",
  },
  guestTimeUpHint: {
    en: "The meadow clock ended. Your local board stays saved until you reset it.",
    zh: "草地倒计时已结束。本地牌局会保留，直到你主动重置。",
  },
  guestTimeUpSub: {
    en: "The clock ended. Reset when you are ready for a fresh meadow board.",
    zh: "倒计时已结束。准备好后重置，即可开启新的草地牌局。",
  },

  // ── P1 — daily two-level challenge (羊了个羊 soul) ─────────────────────────
  dailyChallengeTitle: { en: "Today's Challenge", zh: "今日挑战" },
  dailyChallengeSub: { en: "Level 1 easy · Level 2 devil · refreshes daily", zh: "第1关超易 · 第2关魔鬼 · 每日刷新" },
  level1ClearedTitle: { en: "Level 1 cleared!", zh: "第1关通过！" },
  level1ClearedSub: { en: "On to the devil level — ready?", zh: "进入魔鬼第2关，准备好了吗？" },
  enterLevel2: { en: "Enter Level 2", zh: "进入第2关" },
  dailyFullyClearedTitle: { en: "Daily clear!", zh: "今日全清！" },
  dailyFullyClearedAny: { en: "Fully cleared today — share your win!", zh: "今日全清——晒出你的战绩！" },
  reviveSub: { en: "Tray full — use your revive to keep going?", zh: "卡槽已满——用一次复活继续挑战？" },
  reviveAction: { en: "Revive ({left} left)", zh: "复活（剩 {left} 次）" },
  retryLevel2Sub: { en: "Out of revives — retry the devil level?", zh: "复活已用完——再战魔鬼第2关？" },
  retryLevel2: { en: "Retry Level 2", zh: "重战第2关" },
  guestRevived: { en: "Revived — same board, go!", zh: "已复活——同一牌面，继续！" },

  // ── P2 — full-screen home view + in-game HUD (§9.4 IA flip) ────────────────
  homeStartDaily: { en: "Start Game", zh: "开始游戏" },
  homePractice: { en: "Free Practice", zh: "自由练习" },
  practiceTitle: { en: "Choose a practice board", zh: "选择练习牌局" },
  practiceBack: { en: "Back", zh: "返回" },
  hudRemaining: { en: "{count} left", zh: "剩余 {count}" },
  hudLevelPractice: { en: "Practice", zh: "练习" },
  hudLevelN: { en: "Level {n}", zh: "第{n}关" },

  // ── In-canvas (Phaser scene) strings ──────────────────────────────────────
  boardTagline: {
    en: "Match 3 tiles to clear the board",
    zh: "凑齐三张相同图案即可消除清盘",
  },
  tileTypesLabel: { en: "{count} tile types", zh: "{count} 种图案" },
  undoLabel: { en: "Undo", zh: "撤回" },
  shuffleLabel: { en: "Shuffle", zh: "洗牌" },
  remove3Label: { en: "Remove 3", zh: "移出三张" },
  trayLabel: { en: "Tray", zh: "卡槽" },
  loadingBoard: { en: "Preparing your board…", zh: "正在准备牌面…" },
  securingPuzzle: { en: "Securing puzzle on-chain", zh: "正在链上锁定牌面" },
  progressStat: {
    en: "Time {clock}  ·  Pile {pile}  ·  Tray {tray}/{cap}",
    zh: "时间 {clock}  ·  牌堆 {pile}  ·  卡槽 {tray}/{cap}",
  },
  matchedStat: { en: "Matched {matched}/{total}", zh: "已消除 {matched}/{total}" },
  matchCleared: { en: "Cleared!", zh: "消除！" },
  matchCombo: { en: "Combo x{n}!", zh: "连消 x{n}！" },
  wonTitle: { en: "You Won", zh: "你赢了" },
  creditedTitle: { en: "Reward Credited", zh: "奖励已入账" },
  gameOverTitle: { en: "Game Over", zh: "游戏结束" },
  boardClearedSub: { en: "Board cleared!", zh: "牌面已清空！" },
  boardVerifiedSub: { en: "Board verified on-chain", zh: "牌面已链上验证" },
  payoutSub: { en: "Payout: {payout}", zh: "奖励：{payout}" },
  creditReadySub: {
    en: "{amount} GAS is ready to withdraw",
    zh: "{amount} GAS 可提取",
  },
  trayFullSub: { en: "Tray is full — no more moves!", zh: "卡槽已满——无法继续！" },
  timeUpTitle: { en: "Time is up", zh: "时间到" },
  timeUpSub: {
    en: "The board is locked. A paid game stays recoverable until its settlement window closes.",
    zh: "牌局已锁定。付费牌局会保留，直到结算窗口结束后可安全释放。",
  },
  gameAriaLabel: { en: "Sheep Solitaire tile game", zh: "小羊接龙三消牌局" },
  gameLoadingLabel: { en: "Opening sheep board", zh: "正在打开小羊接龙牌局" },
  gameLoadError: { en: "The sheep board could not load", zh: "小羊接龙牌局加载失败" },
  retryLoadAction: { en: "Retry loading", zh: "重试加载" },
  keyboardControls: { en: "Keyboard game controls", zh: "键盘游戏控制" },
  pickTileAction: {
    en: "Pick exposed tile {index}, pattern {symbol}",
    zh: "选择第 {index} 张可见卡片，图案 {symbol}",
  },
  openRouteAction: { en: "Open {route}", zh: "开启{route}" },
  playAgainAction: { en: "Play Again", zh: "再玩一次" },
  claimRewardAction: { en: "Claim Reward", zh: "领取奖励" },
  withdrawShortAction: { en: "Withdraw", zh: "提取" },
  backToRoutesAction: { en: "Back to Routes", zh: "返回牌局" },
  tryAgainAction: { en: "Try Again", zh: "再试一次" },
};

export const messages = mergeMessages(appMessages);
