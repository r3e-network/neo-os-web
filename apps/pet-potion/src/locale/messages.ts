import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Pet Potion", zh: "宠物药水" },
  appSubtitle: {
    en: "Care for your pet, raise happiness, and claim GAS when it evolves.",
    zh: "照护宠物、提升快乐值，进化达标后领取 GAS。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Open the nursery", zh: "进入宠物育成室" },
  playingTitle: { en: "{difficulty} pet in care", zh: "{difficulty}宠物照护中" },
  statusWonTitle: { en: "Pet happy!", zh: "宠物快乐！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My pet record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },
  moreActions: { en: "More actions", zh: "更多操作" },
  poolLabel: { en: "Reward pool", zh: "奖励池" },
  drawerSummaryLabel: { en: "Pet Potion player summary", zh: "宠物药水玩家摘要" },
  activeRunTitle: { en: "Active care run", zh: "当前照护局" },
  activeRouteLine: {
    en: "{actions}/{max} actions · {time}",
    zh: "{actions}/{max} 次动作 · {time}",
  },
  lastResultLine: {
    en: "Last settlement: {payout} · {time}",
    zh: "上次结算：{payout} · {time}",
  },
  actionTrailTitle: { en: "Care actions", zh: "照护动作" },

  difficultyTitle: { en: "Nursery path", zh: "育成路线" },
  difficulty_easy: { en: "Sprout Hatch", zh: "嫩芽孵化" },
  difficulty_medium: { en: "Glow Garden", zh: "荧光花园" },
  difficulty_hard: { en: "Royal Bloom", zh: "皇家绽放" },
  pathSummary: { en: "Selected nursery path entry, reward, and clock", zh: "当前育成路线的报名费、奖励和时间" },
  pathObjective_easy: {
    en: "A gentle first hatch with a forgiving happiness target.",
    zh: "轻松的首次孵化路线，快乐目标更友好。",
  },
  pathObjective_medium: {
    en: "A brighter garden route that asks for steadier care rhythm.",
    zh: "更明亮的花园路线，需要更稳定的照护节奏。",
  },
  pathObjective_hard: {
    en: "A premium bloom run for players who can balance every care action.",
    zh: "高阶绽放挑战，适合能平衡每个照护动作的玩家。",
  },
  lobbyPreviewLabel: {
    en: "{difficulty} care plan preview, target happiness {happiness}",
    zh: "{difficulty}照护计划预览，目标快乐值 {happiness}",
  },
  lobbyCareGoal: {
    en: "Raise happiness to {happiness}",
    zh: "快乐值提升到 {happiness}",
  },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{seconds}s", zh: "{seconds}秒" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "Credit {credit} GAS", zh: "余额 {credit} GAS" },
  lobbyReady: { en: "Nursery ready", zh: "育成室已就绪" },

  startAction: { en: "Begin care", zh: "开始照护" },
  startHint: { en: "Spend {amount} GAS to hatch this run", zh: "消耗 {amount} GAS 开始本局" },
  startDescription: {
    en: "Choose a nursery path, pay the entry, and the Morpheus enclave hatches a virtual pet with secret initial stats. Sprout pays 0.1 GAS, Glow 0.5, Royal 1.",
    zh: "选择育成路线并支付报名费，Morpheus 飞地会孵化一只拥有秘密初始状态的虚拟宠物。嫩芽赢 0.1 GAS，荧光 0.5，皇家 1。",
  },

  petStats: { en: "Pet stats", zh: "宠物状态" },
  statHappiness: { en: "Happiness", zh: "快乐" },
  statHunger: { en: "Hunger", zh: "饱食" },
  statEnergy: { en: "Energy", zh: "精力" },
  petStage: { en: "Stage: {stage}", zh: "阶段：{stage}" },
  stage_baby: { en: "Baby", zh: "婴儿" },
  stage_child: { en: "Child", zh: "儿童" },
  stage_adult: { en: "Adult", zh: "成年" },

  actionFeed: { en: "Feed", zh: "喂食" },
  actionPlay: { en: "Play", zh: "玩耍" },
  actionPet: { en: "Pet", zh: "抚摸" },
  actionRest: { en: "Rest", zh: "休息" },
  actionHint: { en: "Choose an action to nurture your pet", zh: "选择一个动作来培育宠物" },
  actionsCounter: { en: "{used} / {max} actions used", zh: "已用 {used} / {max} 次动作" },

  happinessTarget: { en: "Target: {happiness}", zh: "目标：{happiness}" },
  happinessCurrent: { en: "Current: {happiness}", zh: "当前：{happiness}" },

  submitAction: { en: "Claim reward", zh: "领取奖励" },
  submitHint: { en: "Pet happiness reached target — claim before the deadline", zh: "宠物快乐值达标——在截止前领取奖励" },
  targetReachedHint: { en: "Target reached — claim your reward below", zh: "目标达成——请在下方领取奖励" },
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
  scoreHappiness: { en: "Happiness", zh: "快乐值" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
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
  historyEmpty: { en: "Your completed pet care sessions will appear here.", zh: "你完成的宠物照护记录会显示在这里。" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Pick a nursery path and pay the entry (Sprout 0.02, Glow 0.10, Royal 0.20 GAS). 2. The Morpheus enclave creates a virtual pet with secret initial happiness, hunger, and energy stats and binds its hash commitment on-chain. 3. Nurture your pet using four actions: Feed (+hunger/small +happiness), Play (+happiness -energy), Pet (+happiness -small hunger), Rest (+energy -small hunger). 4. Reach the target happiness (Sprout 50, Glow 70, Royal 100) before the deadline to win. 5. Watch your pet evolve from Baby to Child to Adult as happiness grows.",
    zh: "1. 选择育成路线并支付报名费（嫩芽 0.02、荧光 0.10、皇家 0.20 GAS）。2. Morpheus 飞地创建一只虚拟宠物，具有秘密的初始快乐、饱食和精力值，并将其哈希承诺绑定上链。3. 使用四个动作培育宠物：喂食（+饱食/少量+快乐）、玩耍（+快乐 -精力）、抚摸（+快乐 -少量饱食）、休息（+精力 -少量饱食）。4. 在截止时间前达到目标快乐值（嫩芽 50、荧光 70、皇家 100）即可获胜。5. 随着快乐值增长，见证你的宠物从婴儿到儿童再到成年。",
  },
  fairnessTitle: { en: "Provably fair nurturing", zh: "可验证公平培育" },
  fairnessCopy: {
    en: "The pet's initial stats are generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the stats cannot be extracted or scripted outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, happiness achieved) and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The TEE validates every action and ensures no stat tampering is possible.",
    zh: "宠物的初始状态由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此状态无法被提取、也无法在平之外用脚本破解。结算时飞地对结果（问题哈希、答案哈希、用时、已达成快乐值）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。TEE 验证每个动作，确保状态不可篡改。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a nursery path to begin", zh: "选择育成路线即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the pet", zh: "对局已开始——正在密封宠物" },
  statusShuffling: { en: "Creating your pet in the enclave…", zh: "正在飞地中创建宠物…" },
  checkDealAgain: { en: "Retry", zh: "重试" },
  expiredBanner: { en: "Game expired", zh: "对局已过期" },
  expiredBannerHint: { en: "The pet ran away…", zh: "宠物跑走了……" },
  statusSealing: { en: "Sealing your pet in the enclave…", zh: "正在飞地中密封宠物…" },
  statusDealt: { en: "Pet created and bound — the clock is running", zh: "宠物已创建绑定——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Pet happy! {payout} GAS credited", zh: "宠物快乐！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool refilling for this nursery path",
    zh: "该育成路线奖池补充中",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
};

export const messages = mergeMessages(appMessages);
