import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Jump Rush", zh: "跳一跳" },
  appSubtitle: {
    en: "Hold, jump, land clean, and clear the route for GAS.",
    zh: "按住蓄力，精准跳跃，完成路线赢取 GAS。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Choose your route", zh: "选择跳跃路线" },
  playingTitle: { en: "{difficulty} jump in progress", zh: "{difficulty}跳跃进行中" },
  statusWonTitle: { en: "Target reached!", zh: "目标达成！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My jumping record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Jump route", zh: "跳跃路线" },
  difficulty_easy: { en: "Meadow Hop", zh: "草地小跳" },
  difficulty_medium: { en: "Cloud Dash", zh: "云端冲刺" },
  difficulty_hard: { en: "Summit Leap", zh: "山巅飞跃" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },
  lobbyReady: { en: "Ready to jump", zh: "可以起跳" },

  startAction: { en: "Start run", zh: "开始冲刺" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Choose a jump route, pay the entry, and the Morpheus enclave generates a deterministic platform layout. Clear the target jumps before the deadline to win. Meadow pays 0.1 GAS, Cloud 0.5, Summit 1.",
    zh: "选择跳跃路线并支付报名费，Morpheus 飞地会生成确定性平台布局。在截止前完成目标跳跃次数即可获胜。草地赢 0.1 GAS，云端 0.5，山巅 1。",
  },
  submitAction: { en: "Submit run", zh: "提交成绩" },
  submitHint: { en: "Target reached — submit before the deadline", zh: "已达到目标——在截止前提交" },
  timeUpAction: { en: "Time is up", zh: "时间到" },

  jumpAction: { en: "Jump!", zh: "跳跃！" },
  perfectLabel: { en: "Perfect!", zh: "完美着陆" },
  comboLabel: { en: "{x}x combo", zh: "{x}倍连击" },
  scoreLabel: { en: "Score", zh: "得分" },
  platformsLabel: { en: "Platforms", zh: "平台" },
  targetLabel: { en: "Target: {count}", zh: "目标: {count}次" },

  undoAction: { en: "Undo jump", zh: "撤回跳跃" },
  undoConfirm: { en: "Confirm undo — reward drops to {pct}%", zh: "确认撤回——奖励降至 {pct}%" },
  undoHint: {
    en: "Recorded by the enclave session — no transaction needed. Each undo reverts your last jump and burns 30% of the base reward.",
    zh: "由飞地会话记录——无需交易。每次撤回退回上一次跳跃并扣除基础奖励的 30%。",
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

  boardLabel: { en: "Jump arena", zh: "跳跃竞技场" },
  statusBarLabel: { en: "Game status", zh: "游戏状态" },
  rewardNow: { en: "{amount} GAS ({pct}%)", zh: "{amount} GAS（{pct}%）" },
  minSolveHint: {
    en: "Anti-bot floor: submission unlocks in {clock}",
    zh: "防脚本时间下限：{clock} 后可提交",
  },
  timeUpHint: {
    en: "The deadline passed — release the game to start a new one.",
    zh: "已超过截止时间——请结算本局后再开新局。",
  },
  shufflingCopy: {
    en: "Your platform layout is generated inside the Morpheus enclave — only its hash commitment goes on-chain, and the jump sequence never leaves the TEE.",
    zh: "平台布局在 Morpheus 飞地内生成——链上只记录其哈希承诺，跳跃序列永不离开 TEE。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another run to climb the ranks.",
    zh: "已计入可提取余额——再开一局，冲击更高排名。",
  },
  expiredBanner: { en: "That run got away", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh platforms, fresh chances.",
    zh: "报名费留在奖池中。新平台，新机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
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
    en: "No runs recorded yet — the first name on this board could be yours.",
    zh: "暂无通关记录——榜单第一个名字可能就是你。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} runs", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My runs", zh: "我的通关" },
  historyEmpty: { en: "Your completed runs will appear here.", zh: "你完成的跳跃会显示在这里。" },
  historyUndos: { en: "{undos} undos", zh: "{undos} 次撤回" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Pick a jump route and pay the entry (Meadow 0.02, Cloud 0.10, Summit 0.20 GAS). 2. The Morpheus enclave generates a deterministic platform layout and binds its hash commitment on-chain. 3. Hold to charge power, release to jump. Land on the center 30% of each platform for a Perfect! bonus. Missing a platform ends the run. 4. Reach the target number of jumps before the deadline to win. Undos revert your last jump and burn 30% of the base reward (three max). 5. The enclave verifies your run sequence, signs the settlement, and the contract pays out after checking the signature.",
    zh: "1. 选择跳跃路线并支付报名费（草地 0.02、云端 0.10、山巅 0.20 GAS）。2. Morpheus 飞地生成确定性平台布局，并将其哈希承诺绑定上链。3. 按住蓄力，松开跳跃。落在平台中间 30% 区域可获得「完美着陆」加分。未踩中平台则游戏结束。4. 在截止时间前达到目标跳跃次数即可获胜。撤回会退回上一次跳跃并扣除基础奖励的 30%（最多三次）。5. 飞地验证你的跳跃序列并签署结算，合约核验签名后发奖。",
  },
  fairnessTitle: { en: "Provably fair platforms", zh: "可验证公平布局" },
  fairnessCopy: {
    en: "The platform layout is generated inside the Morpheus TEE from a per-game seed: only its SHA-256 commitment is bound on-chain at the start, so the gap distances cannot be predicted or scripted outside the app. At settlement the enclave signs the result (problem hash, jump count, perfects, time, undos) and the contract verifies both the signature and that the problem hash equals the original commitment before paying.",
    zh: "平台布局由 Morpheus TEE 用每局独立的种子在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此平台间距无法预测、也无法在平台之外用脚本预知。结算时飞地对结果（问题哈希、跳跃次数、完美着陆数、用时、撤回次数）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a jump route to start", zh: "选择跳跃路线即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing platforms", zh: "对局已开始——正在密封平台" },
  statusShuffling: { en: "Sealing your platform layout…", zh: "正在密封平台布局…" },
  statusSealing: { en: "Sealing platforms in the enclave…", zh: "正在飞地中密封平台…" },
  statusDealt: { en: "Platforms sealed — the clock is running", zh: "平台已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Run verified! {payout} GAS credited", zh: "成绩验证通过！已入账 {payout} GAS" },
  statusUndoUsed: { en: "Undo recorded — reward now {pct}%", zh: "撤回已记录——奖励降至 {pct}%" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusBoardIncomplete: { en: "Target jumps not reached yet", zh: "尚未达到目标跳跃次数" },
  statusPoolLow: {
    en: "Pool refilling for this route",
    zh: "该路线奖池补充中",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  statusMissed: { en: "You missed the platform!", zh: "没踩中平台！" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  perfectLanding: { en: "Perfect!", zh: "完美着陆" },
  comboMultiplier: { en: "{x}x combo", zh: "{x}倍连击" },
  chargeHint: { en: "Hold to charge, release to jump", zh: "按住蓄力，松开跳跃" },
  jumpsCount: { en: "{count} platforms", zh: "{count}个平台" },
  targetJumps: { en: "Target: {count}", zh: "目标: {count}次" },
};

export const messages = mergeMessages(appMessages);
