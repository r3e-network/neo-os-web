import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Aim Master", zh: "瞄准大师" },
  appSubtitle: {
    en: "Stop the moving reticle on the bullseye to win GAS — each round is verified inside the Morpheus TEE.",
    zh: "在瞄准刻度上停住移动的靶心即可赢取 GAS——每一轮都在 Morpheus TEE 中验证。",
  },
  playTab: { en: "Play", zh: "游戏" },
  ranksTab: { en: "Ranks", zh: "排行" },
  sidebarTitle: { en: "My aim record", zh: "我的战绩" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },
  lobbyTitle: { en: "Open the target range", zh: "进入瞄准靶场" },
  playingTitle: { en: "{difficulty} run in play", zh: "{difficulty}进行中" },
  statusWonTitle: { en: "Bullseye!", zh: "正中靶心！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },

  difficultyTitle: { en: "Target lane", zh: "瞄准靶道" },
  difficulty_easy: { en: "Warm-up Lane", zh: "热身靶道" },
  difficulty_medium: { en: "Arcade Range", zh: "街机靶场" },
  difficulty_hard: { en: "Pro Circuit", zh: "职业赛场" },
  rangeEyebrow: { en: "target range", zh: "瞄准靶场" },
  rangeBrief: {
    en: "Choose a target, enter the range, and stop the sweeping reticle on the bullseye.",
    zh: "选择靶牌进入靶场，在准星扫过靶心时出手命中。",
  },
  lobbyPreviewLabel: {
    en: "{lane} preview, {count} accuracy hits needed",
    zh: "{lane}预览，需精准命中 {count} 次",
  },
  laneGoal: { en: "Land {count} clean hits", zh: "完成 {count} 次精准命中" },
  laneObjective_easy: {
    en: "A warm range with a slower sweep and a short hit target.",
    zh: "轻松热身靶道，准星扫动更稳，命中目标更短。",
  },
  laneObjective_medium: {
    en: "A tighter arcade range with faster rhythm and a stronger bounty.",
    zh: "更紧凑的街机靶场，节奏更快，赏金更高。",
  },
  laneObjective_hard: {
    en: "A pro circuit lane for confident aim. Time the sweep and chain seven clean hits.",
    zh: "面向熟练玩家的职业靶道。卡准节奏，连续打出七次精准命中。",
  },
  routeSummary: { en: "Selected lane reward, entry, target, and timer", zh: "当前靶道的奖励、报名费、命中目标和时间" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  accuracyCount: { en: "{count} hits needed", zh: "需命中 {count} 次" },
  timeAmount: { en: "{seconds}s", zh: "{seconds} 秒" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },

  startAction: { en: "Enter range", zh: "进入靶场" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pick a target lane, pay the entry, and the Morpheus enclave seeds a hidden reticle pattern. Land the required clean hits before time runs out to win the fixed GAS bounty.",
    zh: "选择瞄准靶道并支付报名费，Morpheus 飞地会生成隐藏准星轨迹。在倒计时结束前完成精准命中，即可赢取固定 GAS 赏金。",
  },
  aimReady: { en: "Tap to aim", zh: "点击瞄准" },
  tapToStop: { en: "Tap to stop the target", zh: "点击停住靶心" },
  submitRound: { en: "Submit round", zh: "提交本轮" },
  submitHint: { en: "Submit your accuracy score to the enclave", zh: "将命中成绩提交给飞地验证" },
  roundProgress: { en: "Round progress", zh: "回合进度" },
  roundProgressStatus: { en: "Aim progress", zh: "瞄准进度" },
  hitCount: { en: "{accuracies}/{total} accuracy hits", zh: "{accuracies}/{total} 次精准命中" },
  totalScore: { en: "Total score: {points}", zh: "总分：{points}" },

  releaseAction: { en: "Release game", zh: "结算过期对局" },
  releaseHint: {
    en: "Frees the reward reservation of an expired game.",
    zh: "释放过期对局占用的奖励额度。",
  },
  withdrawAction: { en: "Withdraw {amount} GAS", zh: "提取 {amount} GAS" },
  withdrawTitle: { en: "Withdraw winnings", zh: "提取奖金" },
  withdrawHint: {
    en: "Pulls your winnings and unused entry credit back to your wallet.",
    zh: "将奖金与未使用的报名余额提回钱包。",
  },
  timeUpAction: { en: "Time is up", zh: "时间已到" },

  shufflingCopy: {
    en: "Your target pattern is seeded inside the Morpheus enclave — only its hash commitment goes on-chain, and the reticle path never leaves the TEE.",
    zh: "靶心模式由 Morpheus 飞地生成——链上只记录哈希承诺，靶心轨迹永不离开 TEE。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance.",
    zh: "已计入可提取余额。",
  },
  expiredBanner: { en: "That game expired", zh: "这一局已过期" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool.",
    zh: "报名费留在奖池中。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  rewardMetric: { en: "Reward", zh: "奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  timeMetric: { en: "Time", zh: "时间" },
  scoreRings: { en: "Accuracy hits", zh: "精准命中" },
  hitsMetric: { en: "Hits", zh: "命中" },
  scoreWon: { en: "Total won", zh: "累计赢取" },
  rewardNow: { en: "{amount} GAS", zh: "{amount} GAS" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  drawerTitleShort: { en: "Rules", zh: "规则" },
  leaderboardIntro: {
    en: "The global ranking is rebuilt from on-chain Solved events.",
    zh: "全网排行由链上 Solved 事件重建。",
  },
  leaderboardTitle: { en: "Global leaderboard", zh: "全网积分榜" },
  leaderboardEmpty: { en: "No solves recorded yet.", zh: "暂无通关记录。" },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} solves", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My solves", zh: "我的通关" },
  historyEmpty: { en: "Your solved games will appear here.", zh: "你的通关记录会显示在这里。" },
  historyRings: { en: "{rings} hits", zh: "{rings} 次命中" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Choose a target lane and pay the entry (Warm-up 0.02, Arcade 0.10, Pro 0.20 GAS). 2. The Morpheus enclave seeds a target pattern and binds its hash commitment on-chain. 3. Tap to stop the moving reticle. Land enough accuracy hits (3/5/7) before the deadline (60/90/120 s) to win 0.1/0.5/1 GAS. 4. The enclave replays your taps, gates on human-plausible timing, and signs the result — the contract verifies the signature and commitment before paying.",
    zh: "1. 选择瞄准靶道并支付报名费（热身 0.02、街机 0.10、职业 0.20 GAS）。2. Morpheus 飞地生成靶心模式并将其哈希承诺绑定上链。3. 点击停住移动的靶心。在截止时间内（60/90/120 秒）达到足够的精准命中数（3/5/7）即可赢取 0.1/0.5/1 GAS。4. 飞地回放你的点击，校验人类可信的操作节奏并对结果签名——合约核验签名与承诺一致后才发奖。",
  },
  rulesShort: {
    en: "Tap the range when the moving reticle crosses the bullseye.",
    zh: "当移动准星扫过靶心时点击靶场。",
  },
  fairnessTitle: { en: "Provably fair target", zh: "可验证公平靶心" },
  fairnessCopy: {
    en: "The target pattern is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the reticle path cannot be seen ahead of time or scripted. This cannot perfectly tell humans from bots, but replaying your input makes the score unforgeable, and timing gates plus entry fees and a bounded pool make farming unprofitable.",
    zh: "靶心模式由 Morpheus TEE 用每局独立的秘密在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此靶心轨迹无法提前获知或脚本化。这无法完美区分人类与机器人，但回放你的输入让分数不可伪造，加上操作节奏校验、报名费与有上限的奖池，使刷分无利可图。",
  },
  fairnessShort: {
    en: "The target path stays sealed in the Morpheus TEE until settlement.",
    zh: "靶心轨迹在结算前始终密封在 Morpheus TEE 内。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a target lane to enter", zh: "选择瞄准靶道即可进入" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the target", zh: "对局已开始——正在密封靶心" },
  statusShuffling: { en: "Sealing your target pattern…", zh: "正在密封靶心模式…" },
  statusSealing: { en: "Seeding your target in the enclave…", zh: "正在飞地中生成靶心…" },
  statusDealt: { en: "Target sealed and bound — the clock is running", zh: "靶心已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Correct! {payout} GAS credited", zh: "命中！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool needs refill",
    zh: "奖池需要补充",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  statusBullseye: { en: "Bullseye!", zh: "正中靶心！" },
  statusHit: { en: "Hit! +{pts} pts", zh: "命中！+{pts} 分" },
  statusMiss: { en: "Miss", zh: "未命中" },
  minSolveHint: { en: "Anti-bot floor: submission unlocks in {clock}", zh: "反机器人底线：{clock} 后可提交" },
  timeUpHint: { en: "The deadline passed.", zh: "已超过截止时间。" },
  deadlineBufferHint: { en: "Too close to the deadline — a transaction can no longer land in time.", zh: "距离截止太近——交易已无法及时上链。" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
};

export const messages = mergeMessages(appMessages);
