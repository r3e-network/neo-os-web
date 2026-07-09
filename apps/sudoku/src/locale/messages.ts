import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Sudoku Arena", zh: "数独竞技场" },
  appSubtitle: {
    en: "Solve the sealed board, protect your reward, and settle the win on Neo.",
    zh: "解开密封盘面，守住奖励，并在 Neo 上完成结算。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Open the sealed board", zh: "开启密封棋局" },
  playingTitle: { en: "{difficulty} board in play", zh: "{difficulty}盘面进行中" },
  statusWonTitle: { en: "Puzzle solved!", zh: "解题成功！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My arena record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Board route", zh: "棋局路线" },
  difficulty_easy: { en: "Warm-up Grid", zh: "热身棋盘" },
  difficulty_medium: { en: "Ranked Grid", zh: "排位棋盘" },
  difficulty_hard: { en: "Master Grid", zh: "大师棋盘" },
  routeEyebrow: { en: "sealed puzzle route", zh: "密封数独路线" },
  routeSummary: { en: "Selected board reward, entry, and clock", zh: "当前棋局的奖励、报名费和时间" },
  routeObjective_easy: {
    en: "A fast board with generous clues. Good for warming up, checking the enclave deal, and banking a clean win.",
    zh: "线索充足的快节奏棋局。适合热身、验证飞地发牌，并拿下一局干净的胜利。",
  },
  routeObjective_medium: {
    en: "A tighter ranked board with fewer anchors and a bigger payout. Read the grid, then commit.",
    zh: "线索更紧的排位棋局，奖励更高。先读清盘面，再落子推进。",
  },
  routeObjective_hard: {
    en: "A pressure board for expert solvers. Fewer clues, longer clock, and the full master reward.",
    zh: "面向高手的压力棋局。线索更少、时间更长，冲击完整大师奖励。",
  },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },

  startAction: { en: "Open board", zh: "开启棋盘" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pay the entry and the Morpheus enclave deals a sealed puzzle — only its hash commitment goes on-chain. Easy pays 0.1 GAS, Medium 0.5, Hard 1.",
    zh: "支付报名费后，Morpheus 飞地派发密封谜题——链上只记录哈希承诺。简单赢 0.1 GAS，中等 0.5，困难 1。",
  },
  submitAction: { en: "Submit solution", zh: "提交答案" },
  submitHint: { en: "Board complete — submit before the deadline", zh: "盘面已完成——在截止前提交" },
  submittingTitle: { en: "Submitting solution", zh: "正在提交答案" },
  fillHint: { en: "{left} cells to fill", zh: "还剩 {left} 格" },
  timeUpAction: { en: "Time is up", zh: "时间到" },

  undoAction: { en: "Undo ({left} left, -30%)", zh: "撤回（剩 {left} 次，-30%）" },
  undoConfirm: { en: "Confirm undo — reward drops to {pct}%", zh: "确认撤回——奖励降至 {pct}%" },
  undoHint: {
    en: "Recorded by the enclave session — no transaction needed. Each undo burns 30% of the base reward; three max, and the count is signed into the settlement.",
    zh: "由飞地会话记录——无需交易。每次撤回扣除基础奖励的 30%，最多三次，次数会签入最终结算。",
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

  boardLabel: { en: "Sudoku board", zh: "数独棋盘" },
  cellLabel: { en: "Row {row}, column {col}", zh: "第 {row} 行第 {col} 列" },
  cellNotesDesc: { en: "Notes: {notes}", zh: "候选数：{notes}" },
  notesToggle: { en: "Notes", zh: "笔记" },
  timerProgress: { en: "Time remaining", zh: "剩余时间" },
  padNoteLabel: { en: "Add note {digit}", zh: "添加候选数 {digit}" },
  padPlaceLabel: { en: "Place {digit}", zh: "填入 {digit}" },
  rewardNow: { en: "{amount} GAS ({pct}%)", zh: "{amount} GAS（{pct}%）" },
  minSolveHint: {
    en: "Anti-bot floor: submission unlocks in {clock}",
    zh: "防脚本时间下限：{clock} 后可提交",
  },
  timeUpHint: {
    en: "The deadline passed — release the game to start a new one.",
    zh: "已超过截止时间——请结算本局后再开新局。",
  },
  deadlineBufferHint: {
    en: "Too close to the deadline — a transaction can no longer land in time.",
    zh: "距截止时间太近——交易已无法在截止前上链。",
  },
  shufflingCopy: {
    en: "Sealing a fresh puzzle in Morpheus. The board opens when the commitment is ready.",
    zh: "Morpheus 正在密封新盘面。承诺就绪后棋盘会自动展开。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another board to climb the ranks.",
    zh: "已计入可提取余额——再开一局，冲击更高排名。",
  },
  expiredBanner: { en: "That board got away", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh puzzle, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  rewardMetric: { en: "Reward", zh: "奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  timeMetric: { en: "Time", zh: "时间" },
  scoreUndos: { en: "Undos left", zh: "剩余撤回" },
  undosMetric: { en: "Undos", zh: "撤回" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  drawerTitleShort: { en: "Rules", zh: "规则" },
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
  historyEmpty: { en: "Your solved boards will appear here.", zh: "你完成的盘面会显示在这里。" },
  historyUndos: { en: "{undos} undos", zh: "{undos} 次撤回" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Pick a difficulty and pay the entry (Easy 0.02, Medium 0.10, Hard 0.20 GAS). 2. The Morpheus enclave deals a puzzle with a verified unique solution and binds its hash commitment on-chain. 3. Solve it before the deadline (15/25/40 min). Placed digits are FINAL — pencil notes are free; undos are recorded by the enclave and each burns 30% of the base reward, three max. 4. The enclave verifies your board, signs the settlement, and the contract pays 0.1/0.5/1 GAS (minus undo penalties) after checking the signature and the commitment. A short anti-bot floor applies.",
    zh: "1. 选择难度并支付报名费（简单 0.02、中等 0.10、困难 0.20 GAS）。2. Morpheus 飞地派发经验证唯一解的数独，并将其哈希承诺绑定上链。3. 在截止时间内完成（15/25/40 分钟）。落子即锁定——铅笔笔记免费；撤回由飞地记录，每次扣除基础奖励的 30%，最多三次。4. 飞地验证盘面并签署结算，合约核验签名与承诺后按 0.1/0.5/1 GAS（扣除撤回罚金）入账。提交前有一段防脚本的最短用时。",
  },
  rulesShort: {
    en: "Fill the sealed board, use pencil notes freely, and submit before the deadline.",
    zh: "完成密封棋盘，可自由使用笔记，并在截止前提交。",
  },
  fairnessTitle: { en: "Provably fair deals", zh: "可验证公平发牌" },
  fairnessCopy: {
    en: "The puzzle is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the solution cannot be extracted or scripted outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, undos) and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The clue layout you see is all any client ever receives.",
    zh: "谜题由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此答案无法被提取、也无法在平台之外用脚本求解。结算时飞地对结果（问题哈希、答案哈希、用时、撤回次数）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。任何客户端能看到的只有题面线索。",
  },
  fairnessShort: {
    en: "The puzzle stays inside the Morpheus TEE until signed settlement.",
    zh: "谜题保留在 Morpheus TEE 内，直到签名结算。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a board route to open", zh: "选择一条棋局路线后开启" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the puzzle", zh: "对局已开始——正在密封谜题" },
  statusShuffling: { en: "Sealing your puzzle…", zh: "正在密封谜题…" },
  statusSealing: { en: "Sealing your puzzle in the enclave…", zh: "正在飞地中密封谜题…" },
  statusDealt: { en: "Puzzle sealed and bound — the clock is running", zh: "谜题已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Correct! {payout} GAS credited", zh: "答案正确！已入账 {payout} GAS" },
  statusUndoUsed: { en: "Undo recorded — reward now {pct}%", zh: "撤回已记录——奖励降至 {pct}%" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusBoardIncomplete: { en: "The board is not complete yet", zh: "盘面尚未完成" },
  statusPoolLow: {
    en: "Pool needs refill",
    zh: "奖池需要补充",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  // ── Guest (free / local) mode ─────────────────────────────────────────────
  // Guest is a plain local puzzle: no token, no pool, no reward at stake. These
  // strings replace the GAS-centric copy while GAMEFI copy stays unchanged.
  guestSubtitle: {
    en: "Solve the board at your own pace — a local puzzle with no stakes.",
    zh: "按自己的节奏解题——本地谜题，无需下注。",
  },
  guestLobbyTitle: { en: "Start a local puzzle", zh: "开始本地谜题" },
  guestRunLabel: { en: "Local run", zh: "本地对局" },
  guestRunValue: { en: "Practice", zh: "练习" },
  guestDiffTag: { en: "Free play", zh: "自由练习" },
  guestPoolLine: { en: "Local practice · unlimited", zh: "本地练习 · 不限次数" },
  guestVaultSub: { en: "Pick a grid to solve", zh: "选择一张棋盘开始解题" },
  guestGateChoose: { en: "Pick a grid, then start solving", zh: "选择棋盘后开始解题" },
  guestResultSolved: { en: "Puzzle solved", zh: "谜题已解开" },
  guestResultExpired: { en: "Run ended", zh: "本局结束" },
  guestModeLabel: { en: "Mode", zh: "模式" },
  guestModeValue: { en: "Local play", zh: "本地游玩" },
  guestBestLabel: { en: "Best score", zh: "最佳分数" },
  guestFairnessShort: {
    en: "A local puzzle — no chain, no stakes.",
    zh: "本地谜题——无链上操作，无需下注。",
  },
  guestRulesShort: {
    en: "Fill the grid, use pencil notes freely, and beat the clock. Scores save off-chain.",
    zh: "填满棋盘，可自由使用笔记，并在计时结束前完成。成绩离线保存。",
  },
  guestUndoUsed: { en: "Move taken back", zh: "已撤回一步" },
  guestNotSolved: { en: "Not the correct solution yet", zh: "尚未得到正确答案" },
  guestExpired: { en: "Time's up — start a fresh grid", zh: "时间到——开启新棋盘" },
  guestRunComplete: {
    en: "Local puzzle solved — score {score}!",
    zh: "本地谜题已解开——得分 {score}！",
  },

  // ── Canvas (Phaser scene) labels ──────────────────────────────────────────
  // The Phaser scene cannot localise on its own (BaseScene only reads bridge
  // state), so every string it draws is pre-translated here and pushed through
  // the React shell into bridgeState.labels.
  lobbyVaultTitle: { en: "Sudoku Vault", zh: "数独宝库" },
  lobbyVaultSub: { en: "Pick a sealed puzzle route", zh: "选择一条密封谜题路线" },
  diffName_0: { en: "Easy", zh: "简单" },
  diffName_1: { en: "Medium", zh: "中等" },
  diffName_2: { en: "Hard", zh: "困难" },

  playAgainAction: { en: "Play again", zh: "再玩一局" },
  tryAgainAction: { en: "Try again", zh: "重新挑战" },
  startingShort: { en: "Starting…", zh: "开局中…" },
  connectWalletAction: { en: "Connect wallet", zh: "连接钱包" },
  routeLockedAction: { en: "Route locked", zh: "路线未解锁" },
  poolLowShort: { en: "Pool low", zh: "奖池不足" },
  submittingShort: { en: "Submitting…", zh: "提交中…" },
  workingShort: { en: "Working…", zh: "处理中…" },
  tooLateAction: { en: "Too late to submit", zh: "已错过提交" },
  waitToSubmitAction: { en: "Wait to submit", zh: "稍候再提交" },
  solveToUnlockAction: { en: "Solve to unlock", zh: "解开后可提交" },

  undoLeftTemplate: { en: "Undo ({left} left)", zh: "撤回（剩 {left} 次）" },
  undoNoneLabel: { en: "No undos left", zh: "没有撤回次数" },

  poolLimitTemplate: {
    en: "Pool: {pool} GAS  ·  {min} min limit",
    zh: "奖池：{pool} GAS  ·  {min} 分钟限时",
  },
  gateConnect: {
    en: "Connect wallet to open a sealed board",
    zh: "连接钱包以开启密封棋盘",
  },
  gateChecking: { en: "Checking account route history", zh: "正在检查账户路线记录" },
  gateRouteLockedTemplate: {
    en: "Clear {difficulty} before replaying this route",
    zh: "先通关{difficulty}后再重玩此路线",
  },
  gatePoolLowTemplate: {
    en: "Pool low ({have} / {need} GAS reward needed)",
    zh: "奖池不足（{have} / {need} GAS 奖励需求）",
  },
  gateChoose: { en: "Choose a route, then open the board", zh: "选择路线后开启棋盘" },

  deadlinePassedMsg: {
    en: "Deadline passed. Release this board to start a new one.",
    zh: "已超过截止时间。请结算本局后再开新局。",
  },
  deadlineCloseMsg: {
    en: "Too close to the deadline for settlement.",
    zh: "距截止时间太近，无法完成结算。",
  },
  submitUnlockTemplate: {
    en: "Submission unlocks in {clock}",
    zh: "{clock} 后可提交",
  },
  resultCaptionSolved: { en: "Reward secured", zh: "奖励已入账" },
  resultCaptionExpired: { en: "Board released", zh: "棋局已释放" },
};

export const messages = mergeMessages(appMessages);
