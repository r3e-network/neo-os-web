import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Gomoku Arena", zh: "五子棋竞技场" },
  appSubtitle: {
    en: "Play Gomoku (Five-in-a-Row) against a local AI with three difficulty levels, undo, pause, and scoring.",
    zh: "与本地 AI 对弈五子棋，支持三档难度、悔棋、暂停和计分。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Start a game", zh: "开始对局" },
  lobbySub: { en: "Five in a row wins", zh: "五子连珠即胜" },
  playingTitle: { en: "{difficulty} game in play", zh: "{difficulty}对局进行中" },
  statusWonTitle: { en: "You win!", zh: "你赢了！" },
  statusLostTitle: { en: "AI wins", zh: "AI 获胜" },
  networkBadge: { en: "Local", zh: "本地" },
  sidebarTitle: { en: "My record", zh: "我的战绩" },

  difficultyTitle: { en: "AI difficulty", zh: "AI 难度" },
  difficulty_easy: { en: "Casual AI", zh: "休闲 AI" },
  difficulty_medium: { en: "Tactical AI", zh: "战术 AI" },
  difficulty_hard: { en: "Master AI", zh: "大师 AI" },
  routeSummary: { en: "Current game status and tools", zh: "当前对局状态与工具" },

  startAction: { en: "Start game", zh: "开始对局" },
  startDescription: {
    en: "Choose a difficulty and play against the AI. Place five stones in a row to win.",
    zh: "选择难度后与 AI 对弈。五子连珠即可获胜。",
  },
  playAgainAction: { en: "Play again", zh: "再玩一局" },
  tryAgainAction: { en: "Try again", zh: "重新挑战" },
  startingShort: { en: "Starting…", zh: "开局中…" },

  yourTurn: { en: "Your turn — place a black stone", zh: "轮到你——放置黑子" },
  aiThinking: { en: "AI is thinking…", zh: "AI 思考中…" },

  undoShort: { en: "Undo", zh: "悔棋" },
  pauseShort: { en: "Pause", zh: "暂停" },
  resumeShort: { en: "Resume", zh: "继续" },
  restartShort: { en: "New game", zh: "新对局" },
  pausedTitle: { en: "Game paused", zh: "对局已暂停" },
  pausedCopy: {
    en: "Take your time. Resume when you are ready.",
    zh: "慢慢来。准备好后继续。",
  },

  resultWin: { en: "You win!", zh: "你赢了！" },
  resultLose: { en: "AI wins", zh: "AI 获胜" },
  resultDraw: { en: "Draw", zh: "平局" },

  scoreReward: { en: "Latest score", zh: "最近得分" },
  timeMetric: { en: "Time", zh: "时间" },
  scoreWon: { en: "Best score", zh: "最佳分数" },
  winsLabel: { en: "Wins", zh: "胜场" },

  drawerTitle: { en: "Game info & rules", zh: "对局信息与规则" },
  drawerTitleShort: { en: "Rules", zh: "规则" },
  closeDrawer: { en: "Close", zh: "关闭" },
  leaderboardIntro: {
    en: "Practice scores are stored off-chain so local players can compare results.",
    zh: "练习成绩离线保存，让本地玩家可以比较对局结果。",
  },
  leaderboardTitle: { en: "Practice leaderboard", zh: "练习积分榜" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "Choose Easy, Medium, or Hard AI and take turns placing stones on the 15×15 board. You play black (first), the AI plays white. Align five consecutive stones horizontally, vertically, or diagonally to win. Undo removes your last move and the AI's response. The timer counts down; if it expires, the game ends.",
    zh: "选择简单、中等或困难 AI，在 15×15 棋盘上轮流落子。你执黑先行，AI 执白。横、竖或斜方向连成五子即胜。悔棋会同时撤回你和 AI 的最近一步。计时器倒计时，超时则对局结束。",
  },
  fairnessTitle: { en: "Local AI opponent", zh: "本地 AI 对手" },
  fairnessCopy: {
    en: "The AI runs entirely in your browser using minimax search with alpha-beta pruning. No network calls, no wallet, no chain interaction. Three difficulty levels control the AI's search depth and tactical awareness.",
    zh: "AI 完全在浏览器中运行，使用带 Alpha-Beta 剪枝的极小化极大搜索。无网络调用、无钱包、无链上交互。三档难度控制 AI 的搜索深度和战术意识。",
  },
  guestModeLabel: { en: "Mode", zh: "模式" },
  guestModeValue: { en: "Local play", zh: "本地游玩" },
  guestBestLabel: { en: "Best score", zh: "最佳分数" },
  guestRunLabel: { en: "Local run", zh: "本地对局" },
  guestRunValue: { en: "Practice", zh: "练习" },
  guestFairnessShort: {
    en: "A local game — no chain, no stakes.",
    zh: "本地对局——无链上操作，无需下注。",
  },
  guestRulesShort: {
    en: "Place five stones in a row to win. Undo, pause, and restart are always available.",
    zh: "五子连珠即胜。悔棋、暂停和重开随时可用。",
  },
  guestUndoUsed: { en: "Move taken back", zh: "已悔棋一步" },
  undoLimitReached: { en: "No undos left for this game", zh: "本局悔棋次数已用完" },
  guestPaused: { en: "Game paused", zh: "对局已暂停" },
  guestResumed: { en: "Game resumed", zh: "对局已继续" },
  guestRestored: { en: "Your game was restored", zh: "已恢复你的对局" },
  guestWin: { en: "You win — score {score}!", zh: "你赢了——得分 {score}！" },
  guestLose: { en: "AI wins this round", zh: "AI 赢得本局" },
  guestDraw: { en: "The board is full — draw", zh: "棋盘已满——平局" },
  guestExpired: { en: "Time's up — start a new game", zh: "时间到——开始新对局" },

  canvasAriaLabel: { en: "Gomoku Arena interactive board", zh: "五子棋竞技场互动棋盘" },
  canvasLoadingLabel: { en: "Loading Gomoku board", zh: "正在加载五子棋棋盘" },

  diffName_0: { en: "Easy", zh: "简单" },
  diffName_1: { en: "Medium", zh: "中等" },
  diffName_2: { en: "Hard", zh: "困难" },

  a11yControlsLabel: { en: "Keyboard controls", zh: "键盘操作" },
  a11yDifficultyLabel: { en: "Choose AI difficulty", zh: "选择 AI 难度" },
  a11yBoardLabel: {
    en: "Gomoku board, 15 rows by 15 columns",
    zh: "五子棋棋盘，15 行 15 列",
  },
  a11yBoardPending: { en: "Board is syncing", zh: "棋盘同步中" },
  a11yCellEmpty: {
    en: "Row {row}, column {col}, empty",
    zh: "第 {row} 行第 {col} 列，空",
  },
  a11yCellBlack: {
    en: "Row {row}, column {col}, your stone",
    zh: "第 {row} 行第 {col} 列，你的棋子",
  },
  a11yCellWhite: {
    en: "Row {row}, column {col}, AI stone",
    zh: "第 {row} 行第 {col} 列，AI 的棋子",
  },
  a11yUndoLabel: {
    en: "Undo last move, {left} remaining",
    zh: "撤回上一步，剩余 {left} 次",
  },
  a11yMovesPlayed: { en: "{moves} moves played", zh: "已走 {moves} 步" },
};

export const messages = mergeMessages(appMessages);
