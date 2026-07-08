import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "2048 Rush", zh: "2048 冲刺" },
  appSubtitle: {
    en: "Merge tiles, chase the target, and submit a verified run before time runs out.",
    zh: "合成方块，冲刺目标，在倒计时前提交可验证对局。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Build the target tile", zh: "合成目标方块" },
  playingTitle: { en: "Racing to {tile}", zh: "冲刺 {tile}" },
  statusWonTitle: { en: "Target reached!", zh: "达成目标！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My rush record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Target lane", zh: "目标赛道" },
  targetKicker: { en: "Target tile", zh: "目标方块" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },
  lobbyReady: { en: "Ready to race", zh: "可以开局" },

  startAction: { en: "Start run", zh: "开始冲刺" },
  moreActions: { en: "More actions", zh: "更多操作" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pay the entry and the Morpheus enclave seals your spawn stream — only its hash commitment goes on-chain. 512 pays 0.1 GAS, 1024 pays 0.5, 2048 pays 1.",
    zh: "支付报名费后，Morpheus 飞地密封你的方块随机流——链上只记录哈希承诺。合成 512 赢 0.1 GAS，1024 赢 0.5，2048 赢 1。",
  },
  submitAction: { en: "Submit run", zh: "提交对局" },
  submitHint: { en: "Target reached — submit before the deadline", zh: "已达成目标——在截止前提交" },
  chaseHint: { en: "Reach the {tile} tile to unlock submission", zh: "合成 {tile} 方块后即可提交" },
  timeUpAction: { en: "Time is up", zh: "时间到" },

  undoAction: { en: "Undo ({left} left, -30%)", zh: "撤回（剩 {left} 次，-30%）" },
  useUndo: { en: "Use undo", zh: "使用撤回" },
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

  boardLabel: { en: "2048 board", zh: "2048 棋盘" },
  padLabel: { en: "Move controls", zh: "方向控制" },
  controlsHint: { en: "Swipe · arrow keys · WASD", zh: "滑动 · 方向键 · WASD" },
  moveUp: { en: "Slide up", zh: "上滑" },
  moveDown: { en: "Slide down", zh: "下滑" },
  moveLeft: { en: "Slide left", zh: "左滑" },
  moveRight: { en: "Slide right", zh: "右滑" },
  rewardNow: { en: "{amount} GAS ({pct}%)", zh: "{amount} GAS（{pct}%）" },
  bestTile: { en: "Best tile {tile}", zh: "最大方块 {tile}" },
  targetTile: { en: "target {tile}", zh: "目标 {tile}" },
  moveCount: { en: "{used}/{cap} moves", zh: "{used}/{cap} 步" },
  minSolveHint: {
    en: "Anti-bot floor: submission unlocks in {clock}",
    zh: "防脚本时间下限：{clock} 后可提交",
  },
  deadBoardHint: {
    en: "No moves left — this run is over. Release the game once the deadline passes.",
    zh: "已无可行操作——本局结束。截止时间过后可结算本局。",
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
    en: "Your spawn stream is sealed inside the Morpheus enclave — only its hash commitment goes on-chain, and each spawn is revealed only after you commit a move.",
    zh: "方块随机流在 Morpheus 飞地内密封——链上只记录哈希承诺，每个新方块只在你落子后才揭示。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another run to climb the ranks.",
    zh: "已计入可提取余额——再来一局，冲击更高排名。",
  },
  expiredBanner: { en: "That run got away", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh board, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreBest: { en: "Best tile", zh: "最大方块" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scoreUndos: { en: "Undos left", zh: "剩余撤回" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  leaderboardIntro: {
    en: "The global ranking is rebuilt from on-chain Solved events — every payout is independently verifiable.",
    zh: "全网排行由链上 Solved 事件重建——每笔奖励都可独立验证。",
  },
  leaderboardTitle: { en: "Global leaderboard", zh: "全网积分榜" },
  leaderboardEmpty: {
    en: "No verified runs yet — the first name on this board could be yours.",
    zh: "暂无通关记录——榜单第一个名字可能就是你。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} runs", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My runs", zh: "我的通关" },
  historyEmpty: { en: "Your verified runs will appear here.", zh: "你完成的对局会显示在这里。" },
  historyUndos: { en: "{undos} undos", zh: "{undos} 次撤回" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Choose a target and pay the entry (512: 0.02, 1024: 0.10, 2048: 0.20 GAS). 2. The Morpheus enclave seals your spawn stream and binds its hash commitment on-chain — each new tile is revealed only after you commit a move. 3. Reach the target tile before the deadline (4/8/15 min, 2000-move cap). Moves are FINAL — undos are recorded by the enclave and each burns 30% of the base reward, three max. 4. The enclave verifies your run, signs the settlement, and the contract pays 0.1/0.5/1 GAS (minus undo penalties) after checking the signature and the commitment. A short anti-bot floor applies.",
    zh: "1. 选择目标并支付报名费（512：0.02、1024：0.10、2048：0.20 GAS）。2. Morpheus 飞地密封你的方块随机流并将其哈希承诺绑定上链——每个新方块只在你落子后才揭示。3. 在截止时间内合成目标方块（4/8/15 分钟，上限 2000 步）。操作即锁定——撤回由飞地记录，每次扣除基础奖励的 30%，最多三次。4. 飞地验证对局并签署结算，合约核验签名与承诺后按 0.1/0.5/1 GAS（扣除撤回罚金）入账。提交前有一段防脚本的最短用时。",
  },
  fairnessTitle: { en: "Provably fair spawns", zh: "可验证公平出块" },
  fairnessCopy: {
    en: "The spawn stream is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, and each spawn is revealed one move at a time — so future tiles cannot be extracted or searched outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, undos) and the contract verifies both the signature and that the problem hash equals the original commitment before paying.",
    zh: "方块随机流由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，且每个新方块只随落子逐个揭示——未来的方块无法被提取，也无法在平台之外搜索。结算时飞地对结果（问题哈希、答案哈希、用时、撤回次数）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Pick a lane, then merge to the glowing tile", zh: "选择赛道，然后合成发光目标方块" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Run started — sealing the spawn stream", zh: "对局已开始——正在密封随机流" },
  statusShuffling: { en: "Sealing your run…", zh: "正在密封对局…" },
  statusSealing: { en: "Sealing your run in the enclave…", zh: "正在飞地中密封对局…" },
  statusDealt: { en: "Run sealed and bound — the clock is running", zh: "对局已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Verified! {payout} GAS credited", zh: "验证通过！已入账 {payout} GAS" },
  statusUndoUsed: { en: "Undo recorded — reward now {pct}%", zh: "撤回已记录——奖励降至 {pct}%" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool refilling for this target",
    zh: "该目标奖池补充中",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
};

export const messages = mergeMessages(appMessages);
