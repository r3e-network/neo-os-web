import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // ─── MiniAppHomeShell ────────────────────────────────────────────────
  homeBadge: { en: "On-Chain Challenge", zh: "链上公平挑战" },
  homeTitle: {
    en: "Fly Through Pipes, Win GAS",
    zh: "飞越管道，赢取GAS奖励",
  },
  homeTitleAccent: {
    en: "Win GAS",
    zh: "赢取GAS奖励",
  },
  homeDesc: {
    en: "Dodge TEE-generated pipes, beat the clock, and earn real GAS rewards. Every flap is sealed and verified on-chain.",
    zh: "穿梭于 TEE 生成的管道之间，与时间赛跑赢取真实 GAS 奖励。每次振翅都在链上记录和验证。",
  },
  homeHowToPlay: { en: "How to play", zh: "玩法说明" },
  homePoolStat: { en: "Prize Pool", zh: "奖池金额" },
  homeWonStat: { en: "Total Won", zh: "累计赢取" },
  homeSolvesStat: { en: "Clears", zh: "通关次数" },
  homeRankStat: { en: "Rank", zh: "全网排名" },
  homeRankUnset: { en: "--", zh: "--" },
  homeFeatureTee: { en: "TEE-Secured Pipes", zh: "TEE 安全管道" },
  homeFeatureTeeDesc: {
    en: "Every pipe layout is generated inside a Morpheus enclave. Only the hash commitment goes on-chain — the seed never leaves the TEE, making the game provably fair.",
    zh: "每个管道布局都在 Morpheus 飞地内生成。只有哈希承诺上链 — 种子永不离开 TEE，确保可验证公平。",
  },
  homeFeatureDifficulty: { en: "Three Flight Routes", zh: "三条飞行路线" },
  homeFeatureDifficultyDesc: {
    en: "Meadow Hop (5 pipes, 0.02 GAS), Sky Sprint (10 pipes, 0.10 GAS), and Pipe Gauntlet (20 pipes, 0.20 GAS).",
    zh: "草地起飞（5 根管道，0.02 GAS）、云端冲刺（10 根，0.10 GAS）和管道试炼（20 根，0.20 GAS）。",
  },
  homeFeatureRank: { en: "Global Leaderboard", zh: "全球排行榜" },
  homeFeatureRankDesc: {
    en: "Compete with players worldwide. Rankings are rebuilt from on-chain events — every score is verifiable.",
    zh: "与全球玩家竞技。榜单由链上事件重建——每个成绩都可验证。",
  },
  homeLbEyebrow: { en: "Leaderboard", zh: "排行榜" },
  homeLbTitle: { en: "Top Players", zh: "顶尖玩家" },
  homeLbScoreLabel: { en: "GAS won", zh: "赢取 GAS" },
  homeCtaTitle: { en: "Ready to fly?", zh: "准备起飞？" },
  homeCtaDesc: {
    en: "Connect your wallet, pick a flight route, and start flapping. The pipes are waiting.",
    zh: "连接钱包，选择飞行路线，开始振翅。管道正在等待你的挑战。",
  },
  homeCtaLabel: { en: "Pick route & take off", zh: "选择路线并起飞" },
  homeTrustBadge1: { en: "Neo N3 Verified", zh: "Neo N3 链上验证" },
  homeTrustBadge2: { en: "Morpheus TEE", zh: "Morpheus TEE 加密" },
  homeTrustBadge3: { en: "Provably Fair", zh: "可验证公平" },

  appEyebrow: { en: "Flappy Dash", zh: "飞鸟冲冲冲" },
  appSubtitle: {
    en: "Tap, dodge the pipes, clear the route, and win GAS.",
    zh: "点击振翅，穿越管道，完成路线赢取 GAS。",
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
    en: "Your pipe layout is generated inside the Morpheus enclave — only its hash commitment goes on-chain, and the pipe seed never leaves the TEE.",
    zh: "管道布局由 Morpheus 飞地生成——链上只记录其哈希承诺，管道种子永不离开 TEE。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

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
    en: "1. Choose a flight route and pay the entry (Meadow 0.02, Sky 0.10, Gauntlet 0.20 GAS). 2. The Morpheus enclave generates a deterministic pipe layout and binds its hash commitment on-chain. 3. Tap to make the bird fly through the pipe gaps. Pass the target number of pipes (5/10/20) before the deadline (2/3/5 min) to win. Hitting a pipe or the ground ends the run. 4. The enclave verifies your run and signs the settlement — the contract pays 0.1/0.5/1 GAS if you met the target, or 0 otherwise.",
    zh: "1. 选择飞行路线并支付报名费（草地 0.02、云端 0.10、试炼 0.20 GAS）。2. Morpheus 飞地生成确定性的管道布局，并将其哈希承诺绑定上链。3. 点击屏幕让小鸟穿越管道间隙。在截止时间内（2/3/5 分钟）通过目标数量的管道（5/10/20 根）即可获胜。碰到管道或地面则挑战结束。4. 飞地验证你的表现并签署结算——达到目标则合约支付 0.1/0.5/1 GAS，否则为零。",
  },
  fairnessTitle: { en: "Provably fair pipes", zh: "可验证公平管道" },
  fairnessCopy: {
    en: "The pipe layout is generated inside the Morpheus TEE from a per-game seed: only its SHA-256 commitment is bound on-chain at the start, so the gap positions cannot be seen ahead of time or scripted. At settlement the enclave signs the result (problem hash, state hash, time, pipes passed) and the contract verifies both the signature and that the problem hash equals the original commitment before paying.",
    zh: "管道布局由 Morpheus TEE 用每局独立的种子在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此管道间隙位置无法提前获知或通过脚本预判。结算时飞地对结果（问题哈希、状态哈希、用时、通过管道数）签名，合约核验签名与承诺一致后才发奖。",
  },
  fairnessShort: {
    en: "Pipe routes are sealed in the TEE before the run starts.",
    zh: "管道路线上链前已在 TEE 中密封。",
  },
  rulesShort: {
    en: "Tap to flap, clear the route target, then submit the verified run.",
    zh: "点击振翅，通过路线目标后提交可验证成绩。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Pick a route and take off", zh: "选好路线即可起飞" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — generating pipes", zh: "对局已开始——正在生成管道" },
  statusShuffling: { en: "Generating your pipes…", zh: "正在生成管道…" },
  statusSealing: { en: "Sealing your pipes in the enclave…", zh: "正在飞地中密封管道…" },
  statusDealt: { en: "Pipes sealed and bound — the clock is running! Tap to fly!", zh: "管道已密封上链——计时开始！点击飞行！" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
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
  guestExpired: { en: "Local run ended — time's up", zh: "本地对局结束——时间到" },
  guestLastPayout: { en: "{pipes} pipes", zh: "{pipes} 根管道" },
  guestLeaderboardIntro: {
    en: "Local practice scores, saved off-chain. Connect a wallet to save yours.",
    zh: "本地练习成绩，离线保存。连接钱包即可保存你的成绩。",
  },
  guestPlayModeLabel: { en: "Play mode", zh: "游玩模式" },
  guestPlayModeValue: { en: "Local · free", zh: "本地 · 免费" },
  guestModeHudLabel: { en: "Mode", zh: "模式" },
  guestModeHudValue: { en: "Local run", zh: "本地对局" },
  guestSubtitle: {
    en: "Tap, dodge the pipes, and beat your best — free local practice.",
    zh: "点击振翅，穿越管道，刷新纪录——免费本地练习。",
  },

  // ─── In-canvas (Phaser scene) labels ─────────────────────────────────────
  // Pre-resolved and handed to the flight scene through bridgeState.sceneLabels
  // so the canvas honours the active locale. {placeholders} are substituted by
  // the scene at draw time.
  canvasEyebrow: { en: "Verified flight challenge", zh: "链上飞行挑战" },
  canvasHeroTagline: {
    en: "Pass the gates, prove the run, claim GAS.",
    zh: "穿越管道，验证飞行，赢取 GAS。",
  },
  canvasLaunch: { en: "Launch Run", zh: "开始飞行" },
  canvasLaunching: { en: "Launching…", zh: "起飞中…" },
  canvasFlyAgain: { en: "Fly Again", zh: "再飞一次" },
  canvasRetryRun: { en: "Retry Run", zh: "重试挑战" },
  canvasAwaitingPool: { en: "Awaiting pool", zh: "等待奖池" },
  canvasPoolChip: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  canvasTapTitle: { en: "Tap to Fly!", zh: "点击起飞！" },
  canvasTapHint: { en: "Space / ↑ on desktop", zh: "桌面端按 空格 / ↑" },
  canvasSealingTitle: { en: "Sealing Pipes…", zh: "正在密封管道…" },
  canvasSealingHint: {
    en: "Waiting for on-chain randomness",
    zh: "等待链上随机数",
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
  canvasSubmitting: { en: "Submitting…", zh: "提交中…" },
  canvasPlayAgain: { en: "Play Again", zh: "再玩一次" },
  canvasBackToLobby: { en: "Back to Lobby", zh: "返回大厅" },
  canvasTryAgain: { en: "Try Again", zh: "再试一次" },
  canvasRouteTitle: { en: "{name} route", zh: "{name}路线" },
  canvasRouteMeta: {
    en: "{gates} gate run · {minutes} min timer",
    zh: "{gates} 管道挑战 · {minutes} 分钟计时",
  },
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
    en: "{score} pipes cleared\nNew local run!",
    zh: "已通过 {score} 根管道\n本地新纪录！",
  },
};

export const messages = mergeMessages(appMessages);
