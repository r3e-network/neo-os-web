import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Merge Kingdom", zh: "合并王国" },
  appTitle: { en: "Merge Kingdom", zh: "合并王国" },
  appSubtitle: {
    en: "Merge buildings into the crown before the clock runs out.",
    zh: "在倒计时结束前，把建筑合并成王冠。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Build the kingdom", zh: "建造你的王国" },
  gameTitle: { en: "Kingdom board", zh: "王国棋盘" },
  playingTitle: { en: "{difficulty} merge in play", zh: "{difficulty}合并进行中" },
  statusWonTitle: { en: "Kingdom merged!", zh: "王国合并！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My merge record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Kingdom route", zh: "王国路线" },
  difficulty_easy: { en: "Easy", zh: "简单" },
  difficulty_medium: { en: "Medium", zh: "中等" },
  difficulty_hard: { en: "Hard", zh: "困难" },
  lobbyPreviewLabel: { en: "{difficulty} board preview", zh: "{difficulty}棋盘预览" },
  lobbyQuest: { en: "Merge to {tile}; win {reward} GAS.", zh: "合并到 {tile}，赢 {reward} GAS。" },
  routeGoal: { en: "Reach {tile}", zh: "冲到 {tile}" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  entryLabel: { en: "Entry", zh: "报名" },
  timeLimitLabel: { en: "Time", zh: "时限" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Reward pool: {pool} GAS available", zh: "奖池可用：{pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },
  walletRequiredStatus: {
    en: "Connect wallet to start",
    zh: "连接钱包后开始",
  },

  startAction: { en: "Start game", zh: "开始对局" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pay the entry and the Morpheus enclave generates a secret board with initial tiles — only its hash commitment goes on-chain. Easy pays 0.1 GAS, Medium 0.5, Hard 1.",
    zh: "支付报名费后，Morpheus 飞地生成秘密初始棋盘——链上只记录哈希承诺。简单赢 0.1 GAS，中等 0.5，困难 1。",
  },

  tileScore: { en: "Highest tile", zh: "最高方块" },
  tileTarget: { en: "Target: {tile}", zh: "目标：{tile}" },
  tileAchieved: { en: "Achieved: {tile}", zh: "已达：{tile}" },
  srTargetBarLabel: { en: "Progress toward tile {tile}", zh: "冲向 {tile} 的进度" },
  srTargetReached: { en: "Target tile {tile} reached", zh: "已达成目标方块 {tile}" },
  srTimeLow: { en: "Less than 30 seconds left", zh: "剩余时间不足 30 秒" },
  srTimerBarLabel: { en: "Time remaining", zh: "剩余时间" },
  tileEmpty: { en: "Empty cell, row {row}, column {col}", zh: "空格，第 {row} 行第 {col} 列" },
  tileOccupied: {
    en: "{name}, row {row}, column {col}",
    zh: "{name}，第 {row} 行第 {col} 列",
  },
  movesCount: { en: "Moves: {n}", zh: "步数：{n}" },
  mergeBonus: { en: "Merge!", zh: "合并！" },
  selectTile: { en: "Select a tile to move", zh: "选择一个要移动的方块" },
  selectedTile: { en: "Tap destination to move or merge", zh: "点击目标位置进行移动或合并" },

  submitAction: { en: "Claim reward", zh: "领取奖励" },
  submitHint: { en: "Target tile reached — claim before the deadline", zh: "已达目标方块——在截止前领取奖励" },
  timeUpAction: { en: "Time is up", zh: "时间到" },

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

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scoreTile: { en: "Highest tile", zh: "最高方块" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  drawerSummaryLabel: { en: "Merge Kingdom player summary", zh: "合并王国玩家摘要" },
  moreActions: { en: "More actions", zh: "更多操作" },
  poolLabel: { en: "Reward pool", zh: "奖励池" },
  activeRouteLine: {
    en: "{route} route · {moves} moves · target {target} · {time}",
    zh: "{route}路线 · {moves} 步 · 目标 {target} · {time}",
  },
  lastResultLine: {
    en: "Last settlement: {payout} · {time}",
    zh: "上次结算：{payout} · {time}",
  },
  leaderboardIntro: {
    en: "The global ranking is rebuilt from on-chain Solved events — every payout is independently verifiable.",
    zh: "全网排行由链上 Solved 事件重建——每笔奖励都可独立验证。",
  },
  leaderboardTitle: { en: "Global leaderboard", zh: "全网积分榜" },
  leaderboardEmpty: {
    en: "No solves recorded yet — the first name on this board could be yours.",
    zh: "暂无通关记录——榜单第一个名字可能就是你。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} solves", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My solves", zh: "我的通关" },
  historyEmpty: { en: "Your completed merges will appear here.", zh: "你完成的合并记录会显示在这里。" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Pick a difficulty and pay the entry (Easy 0.02, Medium 0.10, Hard 0.20 GAS). 2. The Morpheus enclave generates a 4×4 board with initial numbered tiles and binds its hash commitment on-chain. 3. Tap a tile to select it, then tap an adjacent empty space or a tile with the same number to move or merge. Merging two same-number tiles creates a tile with their sum (2+2=4, 4+4=8, …). 4. Reach the target tile (Easy 64, Medium 256, Hard 1024) before the deadline to win (0.1/0.5/1 GAS). 5. Each undo costs 30% of your reward — plan your moves wisely!",
    zh: "1. 选择难度并支付报名费（简单 0.02、中等 0.10、困难 0.20 GAS）。2. Morpheus 飞地生成 4×4 初始数字棋盘，并将其哈希承诺绑定上链。3. 点击一个方块选中它，再点击相邻空格或相同数字的方块进行移动或合并。合并两个相同数字得到它们的和（2+2=4、4+4=8…）。4. 在截止时间前达到目标方块（简单 64、中等 256、困难 1024）即可获胜（0.1/0.5/1 GAS）。5. 每次撤销扣除 30% 奖励——谨慎规划你的每一步！",
  },
  fairnessTitle: { en: "Provably fair boards", zh: "可验证公平棋盘" },
  fairnessCopy: {
    en: "The initial board is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the board cannot be extracted or scripted outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, highest tile achieved) and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The TEE validates every move and ensures no tile tampering is possible.",
    zh: "初始棋盘由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此棋盘无法被提取、也无法在平台之外用脚本破解。结算时飞地对结果（问题哈希、答案哈希、用时、已达成最高方块）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。TEE 验证每个移动，确保方块不可篡改。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a kingdom route to start", zh: "选择一条王国路线即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the board", zh: "对局已开始——正在密封棋盘" },
  statusShuffling: { en: "Creating your board in the enclave…", zh: "正在飞地中创建棋盘…" },
  checkDealAgain: { en: "Retry", zh: "重试" },
  statusSealing: { en: "Sealing your board in the enclave…", zh: "正在飞地中密封棋盘…" },
  statusDealt: { en: "Board sealed and bound — the clock is running", zh: "棋盘已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Kingdom merged! {payout} GAS credited", zh: "王国合并！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "The reward pool cannot cover this difficulty right now",
    zh: "奖池暂时无法覆盖该难度的奖励",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  // ── Guest (free / local) mode ─────────────────────────────────────────────
  // GUEST is a purely local merge puzzle: no wallet, no fees, no chain/oracle/
  // reward. These strings replace the GAS-at-stake / pool / reward framing so
  // guest carries only local practice framing.
  guestModeLine: {
    en: "Guest mode — local play, best tiles saved off-chain.",
    zh: "游客模式——本地游玩，最高方块离线保存。",
  },
  guestRunLabel: { en: "Local run", zh: "本地对局" },
  guestRunValue: { en: "Free play", zh: "自由练习" },
  guestBestLabel: { en: "Best tile", zh: "最大方块" },
  guestStartHint: {
    en: "Free local run — no wallet or entry needed",
    zh: "免费本地对局——无需钱包或报名费",
  },
  guestSubmitAction: { en: "Finish run", zh: "结束对局" },
  guestSubmitHint: {
    en: "Target tile reached — save your local run",
    zh: "已达目标方块——保存本地对局",
  },
  guestRunComplete: {
    en: "Local run complete — raised tile {tile}!",
    zh: "本地对局完成——达成方块 {tile}！",
  },
  guestGameOver: {
    en: "Run over — best tile {tile}.",
    zh: "对局结束——最高方块 {tile}。",
  },
  guestRulesTitle: { en: "How guest mode works", zh: "游客模式说明" },
  guestRulesCopy: {
    en: "Guest mode is a free local merge puzzle — slide and merge adjacent tiles up to the target with no wallet, no fees, and nothing on-chain. Your best tile is saved to an off-chain practice board (connect a wallet to record it). Switch to Earn GAS for the provably fair on-chain reward game.",
    zh: "游客模式是一款免费的本地合并益智游戏——移动并合并相邻方块冲向目标，无需钱包、没有费用、也不涉及任何链上操作。你的最高方块会保存到离线练习榜（连接钱包即可记录）。切换到「赢取 GAS」即可体验可验证公平的链上奖励游戏。",
  },
};

export const messages = mergeMessages(appMessages);
