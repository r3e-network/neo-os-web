import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appTitle: { en: "Bead Workshop", zh: "拼拼豆工坊" },
  appEyebrow: { en: "SUNLIT PUZZLE STUDIO", zh: "阳光拼豆工作室" },
  appSubtitle: {
    en: "Lift connected bead patches, park them in the tray, and rebuild the pattern before the studio clock ends.",
    zh: "提起连成一片的拼豆、暂存在托盘，再在工坊倒计时结束前还原图案。",
  },
  playTab: { en: "Workshop", zh: "工坊" },
  ranksTab: { en: "Studio records", zh: "工坊记录" },
  rulesTitle: { en: "Pattern rules", zh: "拼图规则" },
  rulesCopy: {
    en: "Tap a mismatched connected patch, then tap a matching empty socket—or move the whole patch to the 14-slot tray. Completed beads lock in place. Use undo or restart if you need a clean recovery.",
    zh: "点击颜色与底板不符的连片拼豆，再点击同色空位；也可以把整片移入 14 格托盘。拼对的豆会锁定。需要恢复时可撤回或重新开始。",
  },
  fairnessTitle: { en: "Certified local patterns", zh: "可验证的本地图案" },
  fairnessCopy: {
    en: "Every board is deterministic from its seed and ships with a constructive solution certificate. Play is entirely local: no wallet, transaction, oracle request, or token is involved.",
    zh: "每张盘面都由种子确定生成，并附带构造式可解证明。游戏完全在本地运行，不连接钱包、不发交易、不请求预言机，也不涉及代币。",
  },
  featureBoardTitle: { en: "A real bead board", zh: "真正的拼豆盘" },
  featureBoardCopy: {
    en: "140 tactile beads, clear target sockets, glossy craft materials, and animated batch movement—not a form disguised as a game.",
    zh: "140 颗可操作拼豆、清楚的目标孔位、温润手工材质与整片移动动画——不是披着游戏外衣的表单。",
  },
  featureRecoveryTitle: { en: "Gentle recovery", zh: "轻松恢复" },
  featureRecoveryCopy: {
    en: "Pause, five-step undo, deadlock detection, safe reload recovery, and a fresh-pattern restart are always close by.",
    zh: "暂停、五步撤回、死局检测、安全刷新恢复和新图案重开都触手可及。",
  },
  featureInputTitle: { en: "Touch and keyboard", zh: "触控与键盘" },
  featureInputCopy: {
    en: "Large touch targets, color names and symbols, reduced-motion support, and complete keyboard play.",
    zh: "大触控热区、颜色名称与符号、减少动态支持，以及完整键盘操作。",
  },
  localOnly: { en: "Free local play", zh: "免费本地游玩" },
  startAction: { en: "Open the workshop", zh: "进入工坊" },
  boardLabel: { en: "Pattern board", zh: "图案板" },
  trayLabel: { en: "14-slot tray", zh: "14 格托盘" },
  trayEmpty: { en: "Tray is clear", zh: "托盘是空的" },
  moveToTray: { en: "Move {count} to tray", zh: "将 {count} 颗移入托盘" },
  selectPatch: { en: "Select a bead patch", zh: "选择一片拼豆" },
  selectedPatch: {
    en: "{count} {color} beads selected",
    zh: "已选 {count} 颗{color}拼豆",
  },
  selectedTray: {
    en: "{color} selected from tray",
    zh: "已从托盘选择{color}拼豆",
  },
  timerLabel: { en: "Time", zh: "时间" },
  stepsLabel: { en: "Moves", zh: "步数" },
  progressLabel: { en: "Matched", zh: "拼对" },
  undoAction: { en: "Undo", zh: "撤回" },
  pauseAction: { en: "Pause", zh: "暂停" },
  resumeAction: { en: "Resume", zh: "继续" },
  restartAction: { en: "Restart", zh: "重开" },
  newPatternAction: { en: "New pattern", zh: "新图案" },
  cancelAction: { en: "Keep playing", zh: "继续拼" },
  restartTitle: { en: "Start over?", zh: "重新开始吗？" },
  restartCopy: {
    en: "Your current pattern will be replaced with a fresh certified board.",
    zh: "当前进度会被一张全新的可解盘面替换。",
  },
  pauseTitle: { en: "Workshop paused", zh: "工坊已暂停" },
  pauseCopy: {
    en: "The clock is stopped. Your beads are safe.",
    zh: "计时已经停止，拼豆进度已安全保存。",
  },
  winTitle: { en: "Pattern complete!", zh: "图案完成！" },
  winCopy: {
    en: "Every bead has found its socket.",
    zh: "每颗拼豆都回到了正确的位置。",
  },
  timeoutTitle: { en: "Studio clock ended", zh: "工坊时间到" },
  timeoutCopy: {
    en: "Try the same idea again with a fresh pattern.",
    zh: "换一张新图案，再试一次吧。",
  },
  stuckTitle: { en: "No safe move remains", zh: "没有可行移动了" },
  stuckCopy: {
    en: "Undo a move or open a fresh certified pattern.",
    zh: "撤回一步，或开启一张新的可解图案。",
  },
  keyboardHelp: {
    en: "Arrow keys move focus. Enter selects or places. Tab switches board and tray. T sends a selected patch to the tray. U undoes, P pauses, and R restarts.",
    zh: "方向键移动焦点，回车选择或放置，Tab 在棋盘与托盘间切换，T 将所选拼豆移入托盘，U 撤回，P 暂停，R 重开。",
  },
  loadingGame: { en: "Opening the bead workshop", zh: "正在打开拼豆工坊" },
  gameAriaLabel: {
    en: "Interactive Bead Workshop puzzle",
    zh: "可交互的拼拼豆工坊游戏",
  },
  gameError: { en: "The workshop could not start", zh: "工坊启动失败" },
  retryAction: { en: "Retry", zh: "重试" },
  continueAction: { en: "Continue", zh: "继续" },
  enableSound: { en: "Enable workshop sound", zh: "开启工坊音效" },
  muteSound: { en: "Mute workshop sound", zh: "关闭工坊音效" },
  colorCoral: { en: "coral", zh: "珊瑚红" },
  colorSunflower: { en: "sunflower", zh: "向日葵黄" },
  colorMint: { en: "mint", zh: "薄荷绿" },
  colorSky: { en: "sky blue", zh: "晴空蓝" },
  colorPeach: { en: "tangerine", zh: "橘子橙" },
  colorCocoa: { en: "cocoa", zh: "可可棕" },
  colorRaspberry: { en: "raspberry", zh: "树莓粉" },
  statusReady: {
    en: "Pick a mismatched patch to begin",
    zh: "选择一片错位拼豆开始",
  },
  statusRecoveredPaused: {
    en: "Recovered safely — resume when ready",
    zh: "进度已安全恢复，准备好后继续",
  },
  statusPaused: { en: "Paused — the clock is stopped", zh: "已暂停——计时停止" },
  statusAutoPaused: {
    en: "Paused when the app left view",
    zh: "离开页面时已自动暂停",
  },
  statusResumed: { en: "Back to the board", zh: "继续拼图" },
  statusBoardSelected: {
    en: "Patch selected — place it or send it to the tray",
    zh: "拼豆片已选中——放入空位或移入托盘",
  },
  statusHoldingSelected: {
    en: "Tray color selected — tap a matching empty socket",
    zh: "已选择托盘颜色——点击同色空位",
  },
  statusSelectionCleared: { en: "Selection cleared", zh: "已取消选择" },
  statusMovedToHolding: {
    en: "Patch parked safely in the tray",
    zh: "拼豆片已安全放入托盘",
  },
  statusPlacedBatch: {
    en: "Great fit — the batch clicked into place",
    zh: "放得漂亮——整片拼豆已归位",
  },
  statusPlacedPartialBatch: {
    en: "Filled this socket group; matching tray beads remain",
    zh: "这一组孔位已填满，托盘里还有同色拼豆",
  },
  statusWon: { en: "Pattern complete!", zh: "图案完成！" },
  statusTimeUp: {
    en: "Time is up — open a fresh pattern",
    zh: "时间到——开启一张新图案吧",
  },
  statusStuck: {
    en: "No safe move remains — undo or restart",
    zh: "没有可行移动——请撤回或重开",
  },
  statusUndone: { en: "Last move restored", zh: "已恢复上一步" },
  statusNothingToUndo: {
    en: "No earlier move to restore",
    zh: "还没有可以撤回的步骤",
  },
  statusUndoUnavailable: {
    en: "This finished pattern can no longer be undone",
    zh: "本局已经结束，无法撤回",
  },
  statusOutsideBoard: {
    en: "Choose a bead or an empty target socket",
    zh: "请选择拼豆或空的目标孔位",
  },
  statusEmptySocket: {
    en: "Select a bead patch first",
    zh: "请先选择一片拼豆",
  },
  statusMatchedLocked: {
    en: "That bead is already matched and locked",
    zh: "这颗拼豆已经拼对并锁定",
  },
  statusNoMovableBatch: {
    en: "That patch cannot move",
    zh: "这片拼豆无法移动",
  },
  statusSelectBatch: {
    en: "Select a board patch or tray color first",
    zh: "请先选择棋盘拼豆片或托盘颜色",
  },
  statusSelectBoardFirst: {
    en: "Select a board patch before using the tray",
    zh: "使用托盘前请先选择棋盘拼豆片",
  },
  statusHoldingNeedsSpace: {
    en: "The whole patch will not fit in the tray",
    zh: "托盘空间不足，无法完整放入这片拼豆",
  },
  statusWrongTarget: {
    en: "That socket needs a different color",
    zh: "这个孔位需要另一种颜色",
  },
  statusTargetTooSmall: {
    en: "That empty region is too small for the whole patch",
    zh: "这片空位放不下整片拼豆",
  },
  statusHoldingColorMissing: {
    en: "That tray color is no longer available",
    zh: "托盘里已经没有该颜色",
  },
  statusCannotResume: {
    en: "Open a new pattern to keep playing",
    zh: "请开启新图案继续游玩",
  },
  storageWarning: {
    en: "Progress cannot be saved on this device",
    zh: "此设备当前无法保存进度",
  },
} as const;

export const messages = mergeMessages(appMessages);
