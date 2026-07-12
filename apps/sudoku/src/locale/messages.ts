import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Sudoku Arena", zh: "数独竞技场" },
  appSubtitle: {
    en: "Solve a warm, resource-rich Sudoku locally with candidates, hints, pause, and recovery.",
    zh: "在温暖明亮的资源化棋盘中本地解题，支持候选数、提示、暂停和恢复。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Open the sealed board", zh: "开启密封棋局" },
  playingTitle: { en: "{difficulty} board in play", zh: "{difficulty}进行中" },
  statusWonTitle: { en: "Puzzle solved!", zh: "解题成功！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Practice rank", zh: "练习排名" },
  sidebarTitle: { en: "My practice record", zh: "我的练习战绩" },
  creditLabel: { en: "Historical credit", zh: "历史可提取余额" },

  difficultyTitle: { en: "Board route", zh: "棋局路线" },
  difficulty_easy: { en: "Warm-up Grid", zh: "热身棋盘" },
  difficulty_medium: { en: "Ranked Grid", zh: "排位棋盘" },
  difficulty_hard: { en: "Master Grid", zh: "大师棋盘" },
  routeEyebrow: { en: "sealed puzzle route", zh: "密封数独路线" },
  routeSummary: { en: "Current board difficulty, clock, and tools", zh: "当前棋局的难度、时间和工具" },
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
    en: "Choose a local route and open a fresh, uniquely solvable board.",
    zh: "选择本地路线，开启一张全新的唯一解棋盘。",
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

  scoreReward: { en: "Latest score", zh: "最近得分" },
  rewardMetric: { en: "Reward", zh: "奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  timeMetric: { en: "Time", zh: "时间" },
  scoreUndos: { en: "Undos left", zh: "剩余撤回" },
  undosMetric: { en: "Undos", zh: "撤回" },
  hintsMetric: { en: "Hints", zh: "提示" },
  scoreWon: { en: "Best score", zh: "最佳分数" },
  solvesLabel: { en: "Solved boards", zh: "完成棋局" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  drawerTitleShort: { en: "Rules", zh: "规则" },
  leaderboardIntro: {
    en: "Practice scores are stored off-chain so local players can compare clean, fast solves without putting funds at risk.",
    zh: "练习成绩离线保存，让本地玩家在无需承担资金风险的前提下比较解题速度与完整度。",
  },
  leaderboardTitle: { en: "Practice leaderboard", zh: "练习积分榜" },
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
    en: "Choose Easy, Medium, or Hard and solve the uniquely generated local board before its clock ends. Select a cell, place or correct 1–9, erase freely, or switch on pencil candidates. Conflicts are highlighted immediately; hints, pause, undo, and automatic refresh recovery keep the run friendly. Scores are stored off-chain.",
    zh: "选择简单、中等或困难路线，在计时结束前完成唯一生成的本地棋盘。选择格子后可填入或改正 1–9、自由擦除，也可开启候选笔记；冲突会立即高亮，并提供提示、暂停、撤回和刷新自动恢复。成绩离线保存。",
  },
  rulesShort: {
    en: "Fill the sealed board, use pencil notes freely, and submit before the deadline.",
    zh: "完成密封棋盘，可自由使用笔记，并在截止前提交。",
  },
  fairnessTitle: { en: "Fresh unique puzzles", zh: "全新唯一解谜题" },
  fairnessCopy: {
    en: "Local play uses Web Crypto to derive a fresh puzzle from a verified unique-solution mask family. No wallet, chain write, oracle, or reward call occurs. Paid entry stays unavailable until its complete live settlement path is certified.",
    zh: "本地玩法使用 Web Crypto，从经过唯一解验证的模板族生成新棋盘，不会连接钱包，也不会发起链上写入、预言机或奖励调用。付费报名将在完整线上结算链路验收后开放。",
  },
  fairnessShort: {
    en: "Fresh local puzzle, unique solution, and no chain write.",
    zh: "本地生成新谜题、保证唯一解且无链上写入。",
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
  statusSessionMismatch: {
    en: "The sealed session does not match this on-chain game. Refresh to recover safely.",
    zh: "密封会话与链上对局不匹配。请刷新并安全恢复。",
  },
  statusStartPending: {
    en: "The start transaction is pending confirmation. Check the game before trying again.",
    zh: "开局交易仍待确认。请先检查对局，再尝试开局。",
  },
  statusRecovered: { en: "Game recovered from chain state", zh: "已从链上状态恢复对局" },
  statusSettlementPending: {
    en: "Settlement is pending. Check the chain state before starting another board.",
    zh: "结算仍在处理中。开始新棋局前请先检查链上状态。",
  },
  settlementPendingTitle: { en: "Settlement pending", zh: "结算处理中" },
  recoverAction: { en: "Check settlement", zh: "检查结算" },
  releaseNotReady: {
    en: "This game is still inside the contract recovery window.",
    zh: "本局仍处于合约恢复窗口内。",
  },
  walletConnected: { en: "Wallet connected", zh: "钱包已连接" },
  connectWalletFirst: { en: "Connect your wallet first.", zh: "请先连接钱包。" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
  withdrawPending: {
    en: "Withdrawal is still pending. Check your credit before trying again.",
    zh: "提取仍在确认中。再次操作前请先检查可提余额。",
  },

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
    en: "Correct or erase freely, use pencil notes, and beat the clock. The live board recovers after refresh.",
    zh: "可自由改正或擦除数字、使用候选笔记，并在计时结束前完成；刷新后会恢复当前棋局。",
  },
  guestUndoUsed: { en: "Move taken back", zh: "已撤回一步" },
  guestHintUsed: { en: "Correct digit revealed · {left} hints left", zh: "已揭示正确数字 · 剩 {left} 次提示" },
  guestHintSelectCell: { en: "Select an empty cell for a hint", zh: "请选择空格后使用提示" },
  guestHintNoneLeft: { en: "No hints left on this board", zh: "本局提示次数已用完" },
  guestPaused: { en: "Puzzle paused", zh: "棋局已暂停" },
  guestResumed: { en: "Puzzle resumed", zh: "棋局已继续" },
  guestRestored: { en: "Your local puzzle was restored", zh: "已恢复你的本地棋局" },
  guestRandomUnavailable: {
    en: "Secure puzzle generation is unavailable in this browser. Try again after refreshing.",
    zh: "当前浏览器无法安全生成谜题。请刷新后重试。",
  },
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
  undoShort: { en: "Undo", zh: "撤回" },
  notesShort: { en: "Notes", zh: "笔记" },
  notesOnShort: { en: "Notes on", zh: "笔记开" },
  eraseNotesShort: { en: "Clear", zh: "清除" },
  hintShort: { en: "Hint", zh: "提示" },
  hintLeftTemplate: { en: "Hint {left}", zh: "提示 {left}" },
  pauseShort: { en: "Pause", zh: "暂停" },
  resumeShort: { en: "Resume", zh: "继续" },
  restartShort: { en: "New board", zh: "新棋局" },
  pausedTitle: { en: "Puzzle paused", zh: "棋局已暂停" },
  pausedCopy: {
    en: "Your local clock is frozen. Resume when you are ready.",
    zh: "本地计时已冻结。准备好后继续。",
  },
  conflictMessage: {
    en: "Conflict highlighted — correct or erase one of the matching digits.",
    zh: "冲突已标出——请改正或擦除其中一个重复数字。",
  },
  selectCellMessage: { en: "Select an empty cell first", zh: "请先选择一个空格" },
  givenLockedMessage: { en: "This clue is fixed", zh: "该线索不可修改" },
  placedLockedMessage: { en: "Placed digits are final; use undo", zh: "落子已锁定；请使用撤回" },
  eraseFirstMessage: {
    en: "Erase this digit before adding candidates",
    zh: "请先擦除该数字，再添加候选数",
  },
  keyboardHelp: {
    en: "Keyboard: arrows move, 1–9 enter, N notes, Backspace erases, U undo, P pause.",
    zh: "键盘：方向键移动，1–9 填数，N 笔记，退格擦除，U 撤回，P 暂停。",
  },
  canvasAriaLabel: { en: "Sudoku Arena interactive puzzle", zh: "数独竞技场互动棋盘" },
  canvasLoadingLabel: { en: "Opening sealed Sudoku board", zh: "正在开启密封数独棋盘" },
  boardReadyMessage: {
    en: "Board complete — submit to verify",
    zh: "棋盘已完成——提交验证即可通关",
  },
  statusInputSyncFailed: {
    en: "The latest paid move was restored safely. Check the sealed session before continuing.",
    zh: "最近一次付费落子未同步，已安全还原。继续前请检查密封会话。",
  },
  statusInvalidBoard: {
    en: "The sealed puzzle is invalid. No moves were accepted; recover the session safely.",
    zh: "密封谜题无效，未接受任何落子；请安全恢复会话。",
  },
  gameFiMaintenanceShort: { en: "GAS mode paused", zh: "GAS 模式维护中" },
  gameFiMaintenanceBody: {
    en: "Paid mode is not published until the complete live settlement path is certified.",
    zh: "付费模式将在完整线上结算链路验收后开放。",
  },
  closeDrawer: { en: "Close leaderboard and rules", zh: "关闭排行榜与规则" },
  a11yControlsLabel: { en: "Accessible Sudoku controls", zh: "数独无障碍操作" },
  a11yBoardLabel: { en: "Nine by nine Sudoku board", zh: "九乘九数独棋盘" },
  a11yDigitPadLabel: { en: "Sudoku digit pad", zh: "数独数字键盘" },
  a11yCellGiven: {
    en: "Row {row}, column {col}, fixed clue {digit}",
    zh: "第 {row} 行第 {col} 列，固定线索 {digit}",
  },
  a11yCellPlaced: {
    en: "Row {row}, column {col}, placed digit {digit}",
    zh: "第 {row} 行第 {col} 列，已填数字 {digit}",
  },
  a11yCellEmpty: {
    en: "Row {row}, column {col}, empty",
    zh: "第 {row} 行第 {col} 列，空格",
  },
  a11yCellNotes: { en: "Candidates {notes}", zh: "候选数 {notes}" },
  a11yCellConflict: { en: "Conflict", zh: "存在冲突" },
  a11ySelectedCell: {
    en: "Selected row {row}, column {col}",
    zh: "已选择第 {row} 行第 {col} 列",
  },
  a11yStartGuest: {
    en: "Start {difficulty} local puzzle",
    zh: "开始{difficulty}本地谜题",
  },

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
  graceWaitTemplate: {
    en: "Recovery window: {clock} before this game can be released.",
    zh: "恢复窗口：{clock} 后才可释放本局。",
  },
  resultCaptionSolved: { en: "Reward secured", zh: "奖励已入账" },
  resultCaptionExpired: { en: "Board released", zh: "棋局已释放" },
};

export const messages = mergeMessages(appMessages);
