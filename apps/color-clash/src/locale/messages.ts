import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Color Clash", zh: "色彩对决" },
  appSubtitle: {
    en: "Watch the TEE-sealed color sequence, then repeat it from memory before the clock runs out. Each correct press lights up the button — one mistake means game over.",
    zh: "观察 TEE 密封的颜色序列，在倒计时结束前凭记忆复现。每按对一次按钮亮起——按错即出局。",
  },
  guestEyebrow: { en: "Color Clash · Guest", zh: "色彩对决 · 游客" },
  guestSubtitle: {
    en: "Play the same Simon board locally: no GAS, no wallet transaction, no oracle request. Connect a wallet only if you want your local score saved off-chain.",
    zh: "用同一套 Simon 街机进行本地游玩：不涉及 GAS、钱包交易或预言机请求。只有想把本地成绩保存到离线榜单时才需要连接钱包。",
  },
  guestLobbyTitle: { en: "Local memory board", zh: "本地记忆街机" },
  guestPlayingTitle: { en: "Local sequence in play", zh: "本地序列进行中" },
  guestSolvedTitle: { en: "Local sequence mastered", zh: "本地序列完成" },
  guestFailedTitle: { en: "Pattern broken — try again", zh: "节奏中断——再试一次" },
  guestExpiredTitle: { en: "Local run ended", zh: "本地对局结束" },
  guestModeBadge: { en: "Guest mode", zh: "游客模式" },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Enter the arcade", zh: "进入记忆街机" },
  playingTitle: { en: "{difficulty} sequence in play", zh: "{difficulty}序列进行中" },
  statusWonTitle: { en: "Sequence mastered!", zh: "序列掌握！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My memory record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },
  lobbyConsoleLabel: { en: "Color sequence console", zh: "颜色序列控制台" },

  difficultyTitle: { en: "Arcade mode", zh: "街机模式" },
  difficulty_easy: { en: "Pulse Arcade", zh: "脉冲街机" },
  difficulty_medium: { en: "Neon Rush", zh: "霓虹连击" },
  difficulty_hard: { en: "Master Circuit", zh: "冠军序列" },
  targetSeqLabel: { en: "{count} cues", zh: "{count} 个灯号" },
  sequenceCueCount: { en: "{count} cues", zh: "{count} 个灯号" },
  modeSummary: { en: "Selected arcade mode entry and clock", zh: "当前街机模式的报名费与时间" },
  modeObjective_easy: {
    en: "Warm up on a short glowing pattern with enough time to learn the rhythm.",
    zh: "从短灯光序列热身，留出足够时间熟悉节奏。",
  },
  modeObjective_medium: {
    en: "A faster neon lane with a longer pattern and a sharper payout.",
    zh: "更快的霓虹路线，序列更长，奖励也更高。",
  },
  modeObjective_hard: {
    en: "A championship memory run where every cue has to land cleanly.",
    zh: "冠军级记忆挑战，每一个灯号都要准确复现。",
  },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{seconds}s", zh: "{seconds}秒" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },

  startAction: { en: "Play sequence", zh: "开始记忆" },
  continue: { en: "Continue", zh: "继续" },
  practiceAction: { en: "Free practice", zh: "自由练习" },
  rewardMode: { en: "Reward run", zh: "奖励局" },
  practiceMode: { en: "Practice mode", zh: "练习模式" },
  practiceBadge: { en: "Practice", zh: "练习" },
  practiceModeLine: {
    en: "Practice uses a local sequence and does not submit a transaction.",
    zh: "练习局使用本地序列，不会提交交易。",
  },
  practiceHint: {
    en: "Practice mode · pool refilling",
    zh: "练习模式 · 奖池补给中",
  },
  practiceWon: { en: "Clean run — sequence mastered", zh: "完美完成——序列掌握" },
  practiceLost: { en: "Missed color — try the rhythm again", zh: "颜色按错——再试一次节奏" },
  practiceExpired: { en: "Practice timer ended", zh: "练习计时结束" },
  practiceResultHint: {
    en: "No GAS moved in practice mode. Funded reward runs use the same buttons.",
    zh: "练习模式不会移动 GAS。正式奖励局使用同一套按钮。",
  },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Choose an arcade mode, pay the entry, then let the Morpheus enclave seal a secret color pattern. Pulse pays 0.1 GAS, Neon 0.5, Master 1.",
    zh: "选择街机模式并支付报名费，Morpheus 飞地会密封一组秘密颜色序列。脉冲赢 0.1 GAS，霓虹 0.5，冠军 1。",
  },
  watchPhase: { en: "Watch the sequence...", zh: "观察序列..." },
  repeatPhase: { en: "Repeat the sequence!", zh: "复现序列！" },
  repeatKeyboardHint: {
    en: "Repeat it — tap the pads or use 1–4 / R B G Y",
    zh: "按顺序复现——轻触按钮，或使用 1–4 / R B G Y",
  },
  sceneReady: { en: "READY", zh: "准备" },
  sceneWatch: { en: "WATCH", zh: "观察" },
  sceneRepeat: { en: "YOUR TURN", zh: "轮到你" },
  sceneWrong: { en: "WRONG", zh: "按错" },
  sceneCorrect: { en: "CLEAR", zh: "通过" },
  sceneWin: { en: "WIN!", zh: "完成" },
  sceneEnd: { en: "END", zh: "结束" },
  roundLabel: { en: "ROUND", zh: "回合" },
  pressButton: { en: "Press {color}", zh: "按下{color}" },
  wrongPress: { en: "Wrong! Game over", zh: "错了！游戏结束" },
  allCorrect: { en: "All correct! +{n}", zh: "全部正确！+{n}" },

  submitAction: { en: "Claim reward", zh: "领取奖励" },
  submitHint: { en: "Sequence completed — claim before the deadline", zh: "序列已复现——在截止前领取奖励" },
  guestSubmitAction: { en: "Save score", zh: "保存成绩" },
  guestSubmitHint: {
    en: "Sequence completed locally — save the cue count to the guest board.",
    zh: "本地序列已完成——把灯号成绩保存到游客榜单。",
  },
  guestStatusSaving: { en: "Saving local score…", zh: "正在保存本地成绩…" },
  timeUpAction: { en: "Time is up", zh: "时间到" },
  releaseWaitAction: { en: "Recovery countdown", zh: "恢复倒计时" },
  releaseWaitStatus: {
    en: "This finished run can be released after the on-chain recovery window.",
    zh: "该结束对局需等待链上恢复窗口后才能释放。",
  },
  releaseReadyStatus: {
    en: "Recovery window complete — release this run to play again.",
    zh: "恢复窗口已结束——释放本局后即可再次游玩。",
  },
  releaseWaitTitle: { en: "Run sealed — recovery pending", zh: "本局已封存——等待恢复" },
  scoreReleaseIn: { en: "Release in", zh: "可释放倒计时" },
  checkSettlementAction: { en: "Check settlement", zh: "检查结算" },
  settlementCheckingTitle: { en: "Checking settlement…", zh: "正在检查结算…" },
  settlementStillPending: {
    en: "Settlement is still pending. Check again shortly; release remains available after recovery.",
    zh: "结算仍在处理中。请稍后再次检查；恢复窗口结束后仍可释放对局。",
  },
  sessionRecoveryReady: {
    en: "The on-chain run is still active. Reopen the sealed session to continue or settle it.",
    zh: "链上对局仍处于活动状态。请重新打开密封会话以继续或完成结算。",
  },
  invalidSessionPayload: {
    en: "The sealed session returned an invalid color cue. Nothing was accepted — retry the session.",
    zh: "密封会话返回了无效颜色灯号，本次未接受该数据。请重试会话。",
  },
  secureRandomUnavailable: {
    en: "Secure local randomness is unavailable on this device. No sequence was created — retry in a supported browser.",
    zh: "当前设备无法提供安全的本地随机数，本次未生成序列。请在受支持的浏览器中重试。",
  },
  gameFiMaintenanceShort: {
    en: "Reward mode is paused. Local arcade play remains fully available.",
    zh: "奖励模式暂未开放，本地街机仍可完整游玩。",
  },
  connectWalletFirst: {
    en: "Connect your wallet before using reward mode.",
    zh: "使用奖励模式前，请先连接钱包。",
  },
  statusContractMismatch: {
    en: "Reward mode is unavailable because the contract, oracle, or game rules do not match this build.",
    zh: "合约、预言机或游戏规则与当前版本不一致，奖励模式不可用。",
  },
  statusStorageUnavailable: {
    en: "This browser cannot preserve the sealed move log, so a paid run was not started.",
    zh: "当前浏览器无法可靠保存密封操作记录，因此未开启付费对局。",
  },
  statusStartPending: {
    en: "The wallet request may have reached the chain. The run is frozen for exact recovery instead of charging again.",
    zh: "钱包请求可能已到达链上，本局已冻结等待精确恢复，不会再次扣费。",
  },
  statusSessionMismatch: {
    en: "The recovered game or sealed session does not match this wallet and difficulty. Input stays locked.",
    zh: "恢复的对局或密封会话与当前钱包及难度不匹配，操作已锁定。",
  },
  statusWalletChanged: {
    en: "The wallet changed during an active run. Reconnect the original wallet to recover it.",
    zh: "活动对局期间钱包已切换，请重新连接原钱包以恢复本局。",
  },
  settlementMismatch: {
    en: "The settlement event and on-chain game record do not match. The run remains recoverable and no win is shown.",
    zh: "结算事件与链上对局记录不一致，本局将保持可恢复状态且不会显示胜利。",
  },
  withdrawPending: {
    en: "The wallet responded, but the exact credit withdrawal is not confirmed yet. Refresh before trying again.",
    zh: "钱包已响应，但精确余额提取尚未确认，请刷新后再操作。",
  },
  statusRecoveryUnavailable: {
    en: "The active run could not be read reliably. It remains locked until chain recovery succeeds.",
    zh: "暂时无法可靠读取活动对局，链上恢复成功前本局将保持锁定。",
  },
  guestRestartAction: { en: "Restart run", zh: "重开本地局" },
  guestRestartHint: {
    en: "Clear this local sequence and return to the lobby.",
    zh: "清空这局本地序列并返回大厅。",
  },

  releaseAction: { en: "Release game", zh: "结算过期对局" },
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

  solvedBanner: { en: "Correct! {payout} GAS credited", zh: "答案正确！已入账 {payout} GAS" },
  solvedBannerHint: { en: "Credited to your balance.", zh: "已计入你的余额。" },
  expiredBanner: { en: "Game released", zh: "对局已结算" },
  expiredBannerHint: { en: "The sequence expired.", zh: "该序列已过期。" },
  checkDealAgain: { en: "Retry", zh: "重试" },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scoreSeqLen: { en: "Sequence length", zh: "序列长度" },
  scoreWon: { en: "Total won", zh: "累计赢取" },
  guestProgressLabel: { en: "Local progress", zh: "本地进度" },
  guestBestLabel: { en: "Best local score", zh: "最佳本地成绩" },
  guestModeLabel: { en: "Mode", zh: "模式" },
  // This fills a tile labelled "Mode", so it must name the mode. "No token"
  // answered a question nobody asked there (and the guest board already says
  // no GAS is involved), reading as a stray fragment on the stat rail.
  guestModeValue: { en: "Local play", zh: "本地游玩" },
  // Honest zero-states, replacing bare "--" voids on the first-run stat rail.
  guestNoScore: { en: "No runs yet", zh: "暂无成绩" },
  rankUnranked: { en: "Unranked", zh: "未上榜" },
  guestScoreValue: { en: "{count} cues", zh: "{count} 个灯号" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  guestDrawerTitle: { en: "Guest board & rules", zh: "游客榜单与规则" },
  leaderboardIntro: {
    en: "The global ranking is rebuilt from on-chain Solved events — every payout is independently verifiable.",
    zh: "全网排行由链上 Solved 事件重建——每笔奖励都可独立验证。",
  },
  guestLeaderboardIntro: {
    en: "Guest scores stay local/off-chain: the board records cue counts, not GAS payouts.",
    zh: "游客成绩只保存在本地/离线榜单：记录的是灯号数量，不是 GAS 奖励。",
  },
  leaderboardTitle: { en: "Global leaderboard", zh: "全网积分榜" },
  guestBoardTitle: { en: "Guest leaderboard", zh: "游客排行榜" },
  leaderboardEmpty: {
    en: "No solves recorded yet — the first name on this board could be yours.",
    zh: "暂无通关记录——榜单第一个名字可能就是你。",
  },
  guestLeaderboardEmpty: {
    en: "No local scores yet — finish a guest run to seed the board.",
    zh: "暂无本地成绩——完成一局游客模式即可上榜。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  guestRefreshBoard: { en: "Refresh board", zh: "刷新榜单" },
  solvesCount: { en: "{count} solves", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My solves", zh: "我的通关" },
  guestHistoryTitle: { en: "Local runs", zh: "本地对局" },
  historyEmpty: { en: "Your completed sequences will appear here.", zh: "你完成的序列会显示在这里。" },
  guestHistoryEmpty: {
    en: "Saved guest runs will appear after you finish a local sequence.",
    zh: "完成并保存游客序列后，本地对局会显示在这里。",
  },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Pick an arcade mode and pay the entry (Pulse 0.02, Neon 0.10, Master 0.20 GAS). 2. The Morpheus enclave generates a secret color sequence (8/12/16 cues) and binds its hash commitment on-chain. 3. Watch the arcade buttons light up one by one. 4. Repeat the pattern from memory in the same order. One wrong press ends the run. 5. Complete the full sequence before the deadline to win (0.1/0.5/1 GAS). The shorter your time, the stronger your score.",
    zh: "1. 选择街机模式并支付报名费（脉冲 0.02、霓虹 0.10、冠军 0.20 GAS）。2. Morpheus 飞地生成秘密颜色序列（8/12/16 个灯号），并将其哈希承诺绑定上链。3. 观察街机按钮依次亮起。4. 凭记忆按相同顺序复现图案。按错一次即出局。5. 在截止时间前完成全部序列即可获胜（0.1/0.5/1 GAS）。用时越短，成绩越强。",
  },
  guestRulesCopy: {
    en: "Pick a difficulty, watch the local color sequence, then repeat it from memory. One wrong press ends the run. Completing the full pattern saves cue count to the guest board only; no token or chain action is involved.",
    zh: "选择难度，观察本地颜色序列，再凭记忆复现。按错一次即结束。完成整段序列后只会把灯号数量保存到游客榜单，不涉及代币或链上操作。",
  },
  fairnessTitle: { en: "Provably fair sequences", zh: "可验证公平序列" },
  guestFairnessTitle: { en: "Local random sequence", zh: "本地随机序列" },
  fairnessCopy: {
    en: "The color sequence is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the sequence cannot be extracted or scripted outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, sequence length achieved) and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The light sequence you see is all any client ever receives.",
    zh: "颜色序列由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此序列无法被提取、也无法在平台之外用脚本破解。结算时飞地对结果（问题哈希、答案哈希、用时、已复现序列长度）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。任何客户端能看到的只有灯光序列。",
  },
  guestFairnessCopy: {
    en: "Guest mode uses local Web-Crypto randomness to create a fresh sequence for practice. GameFi mode is the verified oracle/contract path.",
    zh: "游客模式使用本地 Web-Crypto 随机数生成练习序列。GameFi 模式才使用可验证的预言机与合约路径。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose an arcade mode to play", zh: "选择街机模式即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the sequence", zh: "对局已开始——正在密封序列" },
  statusShuffling: { en: "Sealing your sequence…", zh: "正在密封序列…" },
  statusSealing: { en: "Sealing your sequence in the enclave…", zh: "正在飞地中密封序列…" },
  statusDealt: { en: "Sequence sealed and bound — the clock is running", zh: "序列已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Correct! {payout} GAS credited", zh: "答案正确！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool refilling for this arcade mode",
    zh: "该街机模式奖池补给中",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
  guestRunComplete: { en: "Local run complete — {count} in a row!", zh: "本地对局完成——连对 {count} 个！" },
  guestModeLine: { en: "Guest mode — local play, scores saved off-chain.", zh: "游客模式——本地游玩，成绩离线保存。" },

  color_red: { en: "Red", zh: "红" },
  color_blue: { en: "Blue", zh: "蓝" },
  color_green: { en: "Green", zh: "绿" },
  color_yellow: { en: "Yellow", zh: "黄" },
  colorClashStageAlt: {
    en: "Color Clash Simon memory console with four playable color pads.",
    zh: "色彩对决 Simon 记忆控制台，包含四个可操作颜色按钮。",
  },
  openingColorBoard: { en: "Opening the memory console", zh: "正在打开记忆控制台" },
  colorClashActionFailed: {
    en: "The memory run could not continue",
    zh: "记忆对局暂时无法继续",
  },
  enableGameSound: { en: "Enable game sound", zh: "开启游戏声音" },
  muteGameSound: { en: "Mute game sound", zh: "关闭游戏声音" },

  // ── Platform credits (Credits v2 — GameFi only, never guest) ──────────────
  creditsChipLabel: { en: "Credits", zh: "积分" },
  creditsChipRefresh: { en: "Refresh credit balance", zh: "刷新积分余额" },
  creditsStaleHint: {
    en: "Showing the last settled on-chain balance — the credits ledger is unreachable.",
    zh: "积分服务暂不可达，当前显示的是最近一次链上结算余额。",
  },
  creditsStaleTag: { en: "last settled", zh: "已结算快照" },
  creditsOfferTitle: { en: "Instant retry", zh: "立即重开" },
  creditsOfferBody: {
    en: "Spend {cost} credits to relight the console at the same difficulty — instant and feeless.",
    zh: "花费 {cost} 积分立刻在同一难度重开记忆街机——即时到账，无手续费。",
  },
  creditsOfferAction: { en: "Retry · {cost} credits", zh: "重开 · {cost} 积分" },
  creditsBalanceLine: { en: "Balance: {balance} credits", zh: "余额：{balance} 积分" },
  creditsInsufficientBody: {
    en: "You need {cost} credits for an instant retry. Top up at the fixed rate: 1 GAS = {rate} credits.",
    zh: "立即重开需要 {cost} 积分。按固定汇率充值：1 GAS = {rate} 积分。",
  },
  creditsBuyAction: {
    en: "Buy {credits} credits for {gas} GAS",
    zh: "用 {gas} GAS 购买 {credits} 积分",
  },
  creditsBuyNeedsPermission: {
    en: "Buying credits needs the app's payments permission — not granted yet.",
    zh: "购买积分需要应用的 payments 权限——当前尚未授予。",
  },
  creditsBuyCredited: {
    en: "{credits} credits added to your balance",
    zh: "{credits} 积分已入账",
  },
  creditsBuyBroadcast: {
    en: "GAS sent — {credits} credits will appear once the purchase is indexed.",
    zh: "GAS 已发送——购买确认后 {credits} 积分将自动入账。",
  },
  creditsReviveUnlocked: {
    en: "Retry unlocked for {cost} credits — {balance} left",
    zh: "已花费 {cost} 积分解锁重开——剩余 {balance} 积分",
  },
  creditsInsufficientStatus: {
    en: "Not enough credits — an instant retry costs {cost}.",
    zh: "积分不足——立即重开需要 {cost} 积分。",
  },
  creditsLaneFailed: { en: "Credit action failed", zh: "积分操作失败" },
};

export const messages = mergeMessages(appMessages);
