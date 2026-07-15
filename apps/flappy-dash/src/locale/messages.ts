import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // ─── MiniAppHomeShell ────────────────────────────────────────────────
  homeBadge: { en: "Arcade Flight Challenge", zh: "街机飞行挑战" },
  homeTitle: {
    en: "Tap, Dodge, Chase a New Best",
    zh: "点击振翅，穿越管道，刷新纪录",
  },
  homeTitleAccent: {
    en: "New Best",
    zh: "刷新纪录",
  },
  /**
   * Launcher hero subtitle (manifest heroDescKey). The trailing "Verified
   * reward flights stay gated until settlement validation is complete" was
   * dead weight the 138-char clamp happened to cut — but it is store-facing
   * copy, so it stayed one wording change away from shipping an outage notice
   * as the first line of the app. MiniAppRoot appends the shared free-play
   * line for guest-only builds; this states the game.
   */
  homeDesc: {
    en: "A polished Flappy-style arcade run with three real difficulty curves, responsive controls, sound, and instant free practice.",
    zh: "精心打磨的飞鸟街机玩法，拥有三档真实难度曲线、灵敏操作、音效与即时免费练习。",
  },
  homeHowToPlay: { en: "How to play", zh: "玩法说明" },
  homePoolStat: { en: "Prize Pool", zh: "奖池金额" },
  homeWonStat: { en: "Best Pipes", zh: "最佳管道数" },
  homeSolvesStat: { en: "Clears", zh: "通关次数" },
  homeRankStat: { en: "Rank", zh: "全网排名" },
  homeRankUnset: { en: "--", zh: "--" },
  homeFeatureFlightFeel: { en: "Responsive Arcade Flight", zh: "灵敏街机飞行" },
  homeFeatureFlightFeelDesc: {
    en: "Real bird and pipe sprites, animated wing states, parallax scenery, crisp audio cues, and instant restarts keep every run tactile and readable.",
    zh: "真实小鸟与管道资源、翅膀状态动画、视差场景、清晰音效与即时重开，让每次飞行都灵敏且易读。",
  },
  homeFeatureTee: { en: "Replay-Ready Routes", zh: "可重放验证路线" },
  homeFeatureTeeDesc: {
    en: "Free practice runs entirely on-device. The gated GameFi path uses a Morpheus session and sealed operation log so its result can be replayed before contract settlement.",
    zh: "免费练习完全在本地运行。暂未开放的 GameFi 路径使用 Morpheus 会话与密封操作日志，在合约结算前重放验证结果。",
  },
  homeFeatureDifficulty: { en: "Three Flight Routes", zh: "三条飞行路线" },
  homeFeatureDifficultyDesc: {
    en: "Meadow Hop, Sky Sprint, and Pipe Gauntlet change the pipe target, gap size, gravity, scroll speed, and spawn rhythm — not just the label.",
    zh: "草地起飞、云端冲刺与管道试炼会真实改变管道目标、间隙、重力、滚动速度和生成节奏，而不仅是改个名称。",
  },
  homeFeatureRank: { en: "Global Leaderboard", zh: "全球排行榜" },
  homeFeatureRankDesc: {
    en: "Free-practice scores stay off-chain. When verified rewards reopen, paid clears will populate a separate ranking rebuilt from on-chain settlement events.",
    zh: "免费练习成绩保留在链下。验证奖励重新开放后，付费通关将进入由链上结算事件重建的独立榜单。",
  },
  homeLbEyebrow: { en: "Leaderboard", zh: "排行榜" },
  homeLbTitle: { en: "Top Players", zh: "顶尖玩家" },
  homeLbScoreLabel: { en: "Best pipes", zh: "最佳管道数" },
  homeCtaTitle: { en: "Ready to fly?", zh: "准备起飞？" },
  homeCtaDesc: {
    en: "Pick a route and start flapping. No wallet, entry, or chain write is needed for free practice.",
    zh: "选择路线立即振翅。免费练习无需钱包、报名费或链上写入。",
  },
  homeCtaLabel: { en: "Play free", zh: "免费开玩" },
  homeTrustBadge1: { en: "Free Play", zh: "免费游玩" },
  homeTrustBadge2: { en: "Deterministic Physics", zh: "确定性物理" },
  homeTrustBadge3: { en: "Reduced Motion", zh: "支持减少动态效果" },

  appEyebrow: { en: "Flappy Dash", zh: "飞鸟冲冲冲" },
  appSubtitle: {
    en: "Tap, dodge the pipes, and clear the route. Verified rewards remain gated during settlement validation.",
    zh: "点击振翅，穿越管道并完成路线。验证奖励在结算验证期间保持关闭。",
  },
  playTab: { en: "Play", zh: "游戏" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Flight deck", zh: "起飞控制台" },
  playingTitle: { en: "{difficulty} run in play", zh: "{difficulty}难度进行中" },
  statusWonTitle: { en: "Pipes cleared!", zh: "闯关成功！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My flappy record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Flight route", zh: "飞行路线" },
  difficulty_easy: { en: "Meadow Hop", zh: "草地起飞" },
  difficulty_medium: { en: "Sky Sprint", zh: "云端冲刺" },
  difficulty_hard: { en: "Pipe Gauntlet", zh: "管道试炼" },
  routeEyebrow: { en: "flight route", zh: "飞行路线" },
  routeSummary: { en: "Selected route reward, entry, target, and clock", zh: "当前路线的奖励、报名费、目标和时间" },
  routeObjective_easy: {
    en: "A bright warm-up lane with a short pipe target and forgiving rhythm.",
    zh: "明亮的热身路线，管道目标较短，节奏更友好。",
  },
  routeObjective_medium: {
    en: "A faster sky sprint with tighter gaps and a stronger bounty.",
    zh: "更快的云端冲刺，管道间隙更紧，赏金更高。",
  },
  routeObjective_hard: {
    en: "A long pipe gauntlet for confident flyers. Stay steady through twenty gates.",
    zh: "面向熟练玩家的长线管道试炼。保持节奏，连续穿过二十道关口。",
  },
  lobbyPreviewLabel: {
    en: "{difficulty} flight route preview, clear {count} pipes",
    zh: "{difficulty}飞行路线预览，通过 {count} 根管道",
  },
  lobbyFlightGoal: {
    en: "Clear {count} pipes",
    zh: "通过 {count} 根管道",
  },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  targetPipesLabel: { en: "Target: {count} pipes", zh: "目标：{count} 根管道" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },
  lobbyReady: { en: "Ready to fly", zh: "可以起飞" },

  startAction: { en: "Take off", zh: "起飞" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pick a flight route, pay the entry, and the Morpheus enclave generates a hidden pipe layout. Clear the route target before time runs out to win the fixed GAS bounty.",
    zh: "选择飞行路线并支付报名费，Morpheus 飞地会生成隐藏管道布局。在倒计时结束前通过目标管道数，即可赢取固定 GAS 赏金。",
  },
  tapToFly: { en: "Tap to fly!", zh: "点击飞行！" },
  tapHint: { en: "Tap the screen to make the bird flap and stay aloft", zh: "点击屏幕让小鸟振翅飞行" },
  scoreLabel: { en: "Pipes: {count}", zh: "管道：{count}" },
  bestScoreLabel: { en: "Best: {count}", zh: "最佳：{count}" },

  releaseAction: { en: "Release game", zh: "结算过期对局" },
  timeUpAction: { en: "Time is up", zh: "时间已到" },
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

  gameOverTitle: { en: "Game Over", zh: "游戏结束" },
  gameOverPipes: { en: "You passed {count} pipes", zh: "你通过了 {count} 根管道" },
  gameOverWin: { en: "You won {payout} GAS!", zh: "你赢得了 {payout} GAS！" },
  gameOverLoss: { en: "Better luck next time!", zh: "下次加油！" },
  gameOverTarget: { en: "Target was {count} pipes", zh: "目标为 {count} 根管道" },
  retryAction: { en: "Play again", zh: "再玩一次" },
  submitAction: { en: "Submit run", zh: "提交战绩" },

  shufflingCopy: {
    en: "The entry transaction is confirmed. Morpheus is preparing the deterministic route and replay session; no second payment is requested here.",
    zh: "报名交易已确认。Morpheus 正在准备确定性路线与重放会话；此处不会再次请求付款。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },
  checkSettlementAction: { en: "Check settlement", zh: "查询结算结果" },
  checkingSettlement: { en: "Checking settlement…", zh: "正在查询结算…" },
  checkSettlementHint: {
    en: "Re-read this exact game from Neo N3. This never starts or charges for another run.",
    zh: "从 Neo N3 重新读取当前这局，不会另开一局，也不会再次扣费。",
  },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another run to climb the ranks.",
    zh: "已计入可提取余额——再开一局，冲击更高排名。",
  },
  expiredBanner: { en: "That run got away", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh pipes, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scorePipes: { en: "Pipes passed", zh: "已过管道" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  drawerTitleShort: { en: "Rules", zh: "规则" },
  closeDrawer: { en: "Close leaderboard and rules", zh: "关闭排行榜与规则" },
  leaderboardIntro: {
    en: "The global ranking is rebuilt from on-chain Solved events — every payout is independently verifiable.",
    zh: "全网排行由链上 Solved 事件重建——每笔奖励都可独立验证。",
  },
  leaderboardTitle: { en: "Global leaderboard", zh: "全网积分榜" },
  leaderboardEmpty: {
    en: "No clears recorded yet — the first name on this board could be yours.",
    zh: "暂无通关记录——榜单第一个名字可能就是你。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} clears", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en:"My clears", zh: "我的通关" },
  historyEmpty: { en: "Your completed runs will appear here.", zh: "你完成的挑战会显示在这里。" },
  historyPipes: { en: "{pipes} pipes", zh: "{pipes} 根管道" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "Free practice: choose a route, tap anywhere on the playfield (or Space / ↑ / W), clear 5/10/20 gates, and save your score. Each route changes gap size, scroll speed, gravity, and gate rhythm. Hitting a pipe or the ground ends that run; practice can restart instantly. The wallet-backed reward route is intentionally unavailable until its Morpheus replay and deployed timing rules pass production validation.",
    zh: "免费练习：选择路线，在游戏区任意点击（或按空格 / ↑ / W），通过 5/10/20 道管道并保存成绩。每条路线都会改变间隙大小、滚动速度、重力和出管节奏。碰到管道或地面即结束本局；练习模式可立即重开。钱包奖励路线将在 Morpheus 重放与已部署计时规则通过生产验证后开放。",
  },
  fairnessTitle: { en: "Run verification", zh: "对局验证机制" },
  fairnessCopy: {
    en: "Free practice is deterministic and local, not a reward claim. The gated GameFi design opens a per-game Morpheus session after entry, records real flap operations, seals the operation log, and asks the oracle kernel to replay it before the contract accepts a callback. The current deployed route remains hidden because the client replay cadence and contract minimum times still need live validation.",
    zh: "免费练习采用本地确定性逻辑，不构成奖励凭证。暂未开放的 GameFi 设计会在报名后开启每局独立的 Morpheus 会话，记录真实振翅操作，密封操作日志，并由预言机内核重放后再让合约接受回调。由于客户端重放节奏与合约最短用时仍需在线验证，当前已部署奖励入口继续隐藏。",
  },
  fairnessShort: {
    en: "Free runs stay local; reward settlement remains gated pending validation.",
    zh: "免费对局保持本地运行；奖励结算在验证完成前保持关闭。",
  },
  rulesShort: {
    en: "Tap to flap, clear the route target, then submit the verified run.",
    zh: "点击振翅，通过路线目标后提交可验证成绩。",
  },
  commitmentLine: {
    en: "Game #{gameId} · session commitment {commitment}",
    zh: "对局 #{gameId} · 会话承诺 {commitment}",
  },

  statusReady: { en: "Pick a route and take off", zh: "选好路线即可起飞" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — generating pipes", zh: "对局已开始——正在生成管道" },
  statusShuffling: { en: "Generating your pipes…", zh: "正在生成管道…" },
  statusSealing: { en: "Sealing your pipes in the enclave…", zh: "正在飞地中密封管道…" },
  statusDealt: { en: "Flight session ready — the clock is running. Tap to fly!", zh: "飞行会话已就绪——计时开始，点击飞行！" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSettlementPending: {
    en: "Settlement broadcast — waiting for the verified oracle callback",
    zh: "结算已广播——正在等待预言机验证回调",
  },
  statusSolved: { en: "Result! {payout} GAS credited", zh: "结果已出！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool needs refill",
    zh: "奖池需要补充",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  // ─── Guest (free / local) mode ───────────────────────────────────────────
  // Local play: no token, no entry, no reward pool. Scores are saved to the
  // off-chain guest leaderboard only.
  guestStatusReady: { en: "Local practice — pick a route and tap to fly", zh: "本地练习——选择路线并点击飞行" },
  guestStatusDealt: { en: "Local run ready — tap to fly!", zh: "本地对局就绪——点击飞行！" },
  guestRunComplete: { en: "Local run complete — {count} pipes cleared!", zh: "本地对局完成——通过 {count} 根管道！" },
  guestScoreSaved: { en: "Score saved — {count} pipes", zh: "成绩已保存——{count} 根管道" },
  guestExpired: { en: "Local run ended — time's up", zh: "本地对局结束——时间到" },
  guestLastPayout: { en: "{pipes} pipes", zh: "{pipes} 根管道" },
  guestLeaderboardIntro: {
    en: "Best-effort off-chain practice scores. Free runs never spend GAS or write to the chain.",
    zh: "尽力保存的链下练习成绩。免费对局不会消耗 GAS，也不会写入链上。",
  },
  guestPlayModeLabel: { en: "Play mode", zh: "游玩模式" },
  guestPlayModeValue: { en: "Local · free", zh: "本地 · 免费" },
  guestModeHudLabel: { en: "Mode", zh: "模式" },
  guestModeHudValue: { en: "Local run", zh: "本地对局" },
  guestBestLabel: { en: "Best pipes", zh: "最佳管道数" },
  guestSubtitle: {
    en: "Tap, dodge the pipes, and beat your best — free local practice.",
    zh: "点击振翅，穿越管道，刷新纪录——免费本地练习。",
  },

  // ─── In-canvas (Phaser scene) labels ─────────────────────────────────────
  // Pre-resolved and handed to the flight scene through bridgeState.sceneLabels
  // so the canvas honours the active locale. {placeholders} are substituted by
  // the scene at draw time.
  canvasEyebrow: { en: "Arcade flight deck", zh: "街机飞行甲板" },
  canvasHeroTagline: {
    en: "Pass the gates, prove the run, claim GAS.",
    zh: "穿越管道，验证飞行，赢取 GAS。",
  },
  canvasLaunch: { en: "Launch Run", zh: "开始飞行" },
  canvasGuestLaunch: { en: "Start Practice", zh: "开始练习" },
  canvasPayAndLaunch: { en: "Pay {amount} GAS & Fly", zh: "支付 {amount} GAS 并起飞" },
  canvasConnectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  canvasConnectingWallet: { en: "Connecting…", zh: "连接中…" },
  canvasGuestLobbyHint: {
    en: "Free local flight · no wallet or transaction",
    zh: "免费本地飞行 · 无需钱包或交易",
  },
  canvasGameFiLobbyHint: {
    en: "Connect first; the next press confirms the quoted entry once.",
    zh: "先连接钱包；下一次点击仅确认一次标示的报名费。",
  },
  canvasLaunching: { en: "Launching…", zh: "起飞中…" },
  canvasFlyAgain: { en: "Fly Again", zh: "再飞一次" },
  canvasRetryRun: { en: "Retry Run", zh: "重试挑战" },
  canvasAwaitingPool: { en: "Awaiting pool", zh: "等待奖池" },
  canvasPoolChip: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  canvasTapTitle: { en: "Tap to Fly!", zh: "点击起飞！" },
  canvasTapHint: { en: "Space / ↑ on desktop", zh: "桌面端按 空格 / ↑" },
  canvasSealingTitle: { en: "Preparing Route…", zh: "正在准备路线…" },
  canvasSealingHint: {
    en: "Opening the Morpheus replay session",
    zh: "正在开启 Morpheus 重放会话",
  },
  canvasSettlementTitle: { en: "Settlement Pending…", zh: "正在等待结算…" },
  canvasSettlementHint: {
    en: "Your run is saved and recoverable while the verified callback arrives",
    zh: "正在等待验证回调；本局记录已保留，可随时恢复查询",
  },
  canvasWinTitle: { en: "You Win!", zh: "你赢了！" },
  canvasCrashTitle: { en: "Crashed!", zh: "坠机了！" },
  canvasTimeUpTitle: { en: "Time Up!", zh: "时间到！" },
  canvasWinBody: {
    en: "{score} pipes passed\nWin {reward} GAS",
    zh: "已通过 {score} 根管道\n奖励 {reward} GAS",
  },
  canvasCrashBody: {
    en: "{score} pipes passed\nTarget {target}",
    zh: "已通过 {score} 根管道\n目标 {target} 根",
  },
  canvasTimeUpBody: {
    en: "{score} pipes passed\nDeadline reached",
    zh: "已通过 {score} 根管道\n已到截止时间",
  },
  canvasSubmitScore: { en: "Submit Score", zh: "提交成绩" },
  canvasSaveScore: { en: "Save Score", zh: "保存成绩" },
  canvasSettleRun: { en: "Settle Run", zh: "结算本局" },
  canvasSubmitting: { en: "Submitting…", zh: "提交中…" },
  canvasPlayAgain: { en: "Play Again", zh: "再玩一次" },
  canvasBackToLobby: { en: "Back to Lobby", zh: "返回大厅" },
  canvasTryAgain: { en: "Try Again", zh: "再试一次" },
  canvasRouteTitle: { en: "{name} route", zh: "{name}路线" },
  canvasRouteMeta: {
    en: "{gates} gates · {pace}",
    zh: "{gates} 根管道 · {pace}",
  },
  routePace_easy: { en: "roomy gaps", zh: "宽松间隙" },
  routePace_medium: { en: "faster rhythm", zh: "更快节奏" },
  routePace_hard: { en: "tight gauntlet", zh: "紧凑试炼" },
  canvasCardGates: { en: "{gates} gates", zh: "{gates} 根管道" },
  canvasEntry: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },

  // ─── In-canvas guest (local) overrides — no GAS / entry / pool framing ────
  canvasGuestHeroTagline: {
    en: "Pass the gates, beat your best — free local practice.",
    zh: "穿越管道，刷新纪录——免费本地练习。",
  },
  canvasGuestPoolChip: { en: "Free practice — no entry", zh: "自由练习——无需报名" },
  canvasGuestEntry: { en: "No entry — free", zh: "免费——无需报名" },
  canvasGuestRouteReward: { en: "{gates} pipes", zh: "{gates} 根管道" },
  canvasGuestWinBody: {
    en: "{score} pipes cleared\nRoute complete!",
    zh: "已通过 {score} 根管道\n路线完成！",
  },

  gameAriaLabel: { en: "Flappy Dash arcade game", zh: "飞鸟冲冲冲街机游戏" },
  gameLoadingLabel: { en: "Opening flight deck", zh: "正在开启飞行甲板" },
  continue: { en: "Continue", zh: "继续" },
  gameActionFailed: { en: "Flight control could not continue", zh: "飞行操作暂时无法继续" },
  enableGameSound: { en: "Enable game sound", zh: "开启游戏声音" },
  muteGameSound: { en: "Mute game sound", zh: "关闭游戏声音" },
  a11yDifficultyGroup: { en: "Choose a flight route", zh: "选择飞行路线" },
  a11yStartRoute: { en: "Start selected route", zh: "开始所选路线" },
  a11yFlyContinue: { en: "Flap or continue the run", zh: "振翅或继续本局" },
  walletUnavailable: { en: "Wallet connection is unavailable", zh: "当前无法连接钱包" },
  walletConnectedReady: {
    en: "Wallet connected — review the quoted entry, then take off",
    zh: "钱包已连接——确认标示的报名费后即可起飞",
  },
  statusInputSyncFailed: {
    en: "Flight input could not be synchronized. The paid run is paused to protect settlement.",
    zh: "飞行输入无法同步。为保护结算安全，付费对局已暂停。",
  },

  // ── Platform credits (Credits v2 — GameFi only, never guest) ──────────────
  creditsChipLabel: { en: "Credits", zh: "积分" },
  creditsChipRefresh: { en: "Refresh credit balance", zh: "刷新积分余额" },
  creditsStaleHint: {
    en: "Showing the last settled on-chain balance — the credits ledger is unreachable.",
    zh: "积分服务暂不可达，当前显示的是最近一次链上结算余额。",
  },
  creditsStaleTag: { en: "last settled", zh: "已结算快照" },
  creditsOfferTitle: { en: "Instant relaunch", zh: "立即再飞" },
  creditsOfferBody: {
    en: "Spend {cost} credits to relaunch the same route right away — instant and feeless.",
    zh: "花费 {cost} 积分立刻在同一路线重新起飞——即时到账，无手续费。",
  },
  creditsOfferAction: { en: "Fly again · {cost} credits", zh: "再飞一次 · {cost} 积分" },
  creditsBalanceLine: { en: "Balance: {balance} credits", zh: "余额：{balance} 积分" },
  creditsInsufficientBody: {
    en: "You need {cost} credits for an instant relaunch. Top up at the fixed rate: 1 GAS = {rate} credits.",
    zh: "立即再飞需要 {cost} 积分。按固定汇率充值：1 GAS = {rate} 积分。",
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
    en: "Relaunch unlocked for {cost} credits — {balance} left",
    zh: "已花费 {cost} 积分解锁再飞——剩余 {balance} 积分",
  },
  creditsInsufficientStatus: {
    en: "Not enough credits — an instant relaunch costs {cost}.",
    zh: "积分不足——立即再飞需要 {cost} 积分。",
  },
  creditsLaneFailed: { en: "Credit action failed", zh: "积分操作失败" },
};

export const messages = mergeMessages(appMessages);
