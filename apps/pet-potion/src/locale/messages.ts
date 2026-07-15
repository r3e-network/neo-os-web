import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Pet Potion", zh: "宠物药水" },
  appSubtitle: {
    en: "Care, collect four essences, brew a potion, and help your pet evolve.",
    zh: "照护宠物、收集四种精华、炼制药水，陪伴它完成进化。",
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
  gameplayFeatureTitle: { en: "Care, collect, and brew", zh: "照护、收集、炼制" },
  gameplayFeatureCopy: {
    en: "Interact with the illustrated pet and four real care tools. Balance satiety and energy, collect one essence from each tool, evolve the pet, then brew and save the finished potion.",
    zh: "直接操作插画宠物与四种真实照护道具。平衡饱食与精力，从每种道具收集一份精华，让宠物进化，最后炼制并保存成品药水。",
  },
  guestStartDescription: {
    en: "Choose a nursery path and begin a complete free local care-and-brew run. No wallet prompt, no token entry, and no chain write.",
    zh: "选择育成路线，开始完整的免费本地照护与炼制流程。无需钱包、无需代币报名，也不会写入链上。",
  },
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
  statHunger: { en: "Satiety", zh: "饱食" },
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
  recipeShelfTitle: { en: "Potion recipe", zh: "药水配方" },
  recipeComplete: { en: "Recipe ready", zh: "配方齐全" },
  recipeIncomplete: { en: "Collect all four", zh: "收集四种精华" },
  brewPotionAction: { en: "Brew potion", zh: "炼制药水" },
  recipeNotReady: {
    en: "Raise happiness and collect one essence from every care tool first.",
    zh: "请先提升快乐值，并从每种照护道具收集一份精华。",
  },
  potionBrewedStatus: { en: "Potion brewed — save the finished run!", zh: "药水炼成——保存这次成果吧！" },

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
  // Nursery stat meters before a run exists. The egg's starting stats are chosen
  // inside the enclave and are genuinely unknown until the run is dealt, so we
  // must not print a number here — "0" would be fabricated data, and the bare
  // "--" this replaced read as a broken meter. Name the state instead: it is the
  // same sealed egg the stage badge above already calls out.
  statSealed: { en: "Sealed", zh: "封存" },

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
    en: "Pick a nursery path. Feed restores satiety, Play spends satiety and energy for the biggest happiness gain, Pet gives a safe small boost, and Rest restores energy while using some satiety. Collect at least one essence from every tool, reach the path's happiness target, brew the potion, and save before time runs out.",
    zh: "选择育成路线。喂食恢复饱食，玩耍消耗饱食和精力并带来最大快乐提升，抚摸提供稳定的小幅提升，休息消耗少量饱食并恢复精力。每种道具至少收集一份精华，达到路线快乐目标，炼制药水，并在时间结束前保存。",
  },
  fairnessTitle: { en: "Provably fair nurturing", zh: "可验证公平培育" },
  fairnessCopy: {
    en: "The reviewed Morpheus engine starts every pet from the same public 20 happiness, 40 satiety, and 60 energy state. The enclave applies the deterministic care deltas, enforces 1.5-second action spacing, replays the action log, and signs the peak happiness for contract settlement. New paid starts remain unavailable until a funded live settlement proves the whole path.",
    zh: "经核对的 Morpheus 引擎让每只宠物都从公开固定状态开始：快乐 20、饱食 40、精力 60。飞地执行确定性的照护变化，强制动作间隔 1.5 秒，重放动作日志，并为合约结算签署峰值快乐值。新的付费开局将在有资金的实时结算完整证明整条链路后开放。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  // Phaser canvas copy. The scene receives this localized dictionary through
  // the bridge so its playable surface always matches the shell language.
  sceneBrand: { en: "PET POTION", zh: "宠物药水" },
  sceneAriaLabel: { en: "Pet Potion nursery game", zh: "宠物药水育成游戏" },
  sceneLoadingLabel: { en: "Opening pet nursery", zh: "正在打开宠物育成室" },
  sceneTitlePreparing: { en: "Preparing pet", zh: "正在准备宠物" },
  sceneTitleSealPending: { en: "Seal pending", zh: "密封待确认" },
  sceneTitleSettlementPending: { en: "Settlement pending", zh: "结算待确认" },
  sceneTitleSolved: { en: "Potion complete!", zh: "药水炼成！" },
  sceneTitleClosed: { en: "Run closed", zh: "本局已结束" },
  sceneTitleTimedOut: { en: "Time is up", zh: "照护时间到" },
  sceneTitlePlaying: { en: "Nurture the pet", zh: "培育你的宠物" },
  sceneTitleLobby: { en: "Open the nursery", zh: "开启育成室" },
  sceneSubtitleSealPending: { en: "Retry this exact sealed run", zh: "重试当前这局密封流程" },
  sceneSubtitleSettlementPending: { en: "Recheck this exact game on-chain", zh: "重新核验当前对局的链上状态" },
  sceneSubtitlePath: { en: "{path} path · target {target}", zh: "{path}路线 · 目标 {target}" },
  sceneSubtitleGuestPath: { en: "{path} · goal {target}", zh: "{path} · 目标 {target}" },
  sceneSubtitleGameFiPath: {
    en: "{entry} GAS entry · {reward} GAS reward",
    zh: "报名 {entry} GAS · 奖励 {reward} GAS",
  },
  scenePathEasy: { en: "Sprout", zh: "嫩芽" },
  scenePathMedium: { en: "Glow", zh: "荧光" },
  scenePathHard: { en: "Royal", zh: "皇家" },
  sceneStatFed: { en: "Fed", zh: "饱食" },
  sceneStageEgg: { en: "Sealed egg", zh: "密封宠物蛋" },
  sceneStageResting: { en: "Pet resting", zh: "宠物休息中" },
  sceneGoalProgress: { en: "Goal {current}/{target}", zh: "目标 {current}/{target}" },
  sceneConnectWallet: { en: "Connect wallet", zh: "连接钱包" },
  sceneConnectingWallet: { en: "Connecting wallet…", zh: "正在连接钱包…" },
  sceneWorking: { en: "Working…", zh: "处理中…" },
  sceneSettleRun: { en: "Settle run", zh: "结算本局" },
  sceneSaveScore: { en: "Save score", zh: "保存成绩" },
  sceneRaiseAnother: { en: "Raise another pet", zh: "再培育一只" },
  sceneTryAgain: { en: "Try again", zh: "再试一次" },
  sceneRetrySealing: { en: "Retry sealing", zh: "重试密封" },
  sceneCheckSettlement: { en: "Check settlement", zh: "核验结算" },
  sceneReleaseRun: { en: "Release run", zh: "释放本局" },
  sceneStatusPreparingGuest: { en: "Preparing your pet…", zh: "正在准备你的宠物…" },
  sceneStatusPreparingGameFi: {
    en: "Wallet and enclave are preparing the run.",
    zh: "钱包与飞地正在准备本局。",
  },
  sceneStatusSealPending: {
    en: "Sealing is taking longer than usual. Retry this exact run.",
    zh: "密封耗时较长，请重试当前这局。",
  },
  sceneStatusSolvedGuest: {
    en: "Run saved. Raise another pet when ready.",
    zh: "成绩已保存，随时可以再培育一只。",
  },
  sceneStatusSolvedGameFi: {
    en: "Reward confirmed. Start another care run when ready.",
    zh: "奖励已确认，随时可以开始新一局。",
  },
  sceneStatusClosed: {
    en: "This run is closed. Start a fresh pet when ready.",
    zh: "本局已结束，准备好后可培育新宠物。",
  },
  sceneStatusTimeUp: {
    en: "Time is up. Settle this exact run.",
    zh: "照护时间到，请结算当前这局。",
  },
  sceneStatusTargetGuest: { en: "Recipe ready! Brew the potion.", zh: "配方齐全！开始炼制药水。" },
  sceneStatusTargetGameFi: {
    en: "Care target ready. Brew before settlement.",
    zh: "照护目标已达成，请在结算前炼制药水。",
  },
  sceneStatusReleaseCountdown: {
    en: "Settlement pending · recovery unlocks in {time}",
    zh: "结算待确认 · {time} 后可释放",
  },
  sceneStatusReleaseReady: {
    en: "Check settlement or release the abandoned run.",
    zh: "请核验结算，或释放这局未完成对局。",
  },
  scenePotionReady: { en: "Potion ready!", zh: "药水炼成！" },
  sceneStatusRecipeMissing: {
    en: "Happiness ready — collect one essence from every care tool.",
    zh: "快乐值已达标——还需从每种照护道具收集一份精华。",
  },
  sceneStatusPotionBrewed: { en: "Potion ready — save this run.", zh: "药水已炼成——保存本局成果。" },
  sceneReleaseWindow: { en: "Recovery", zh: "恢复等待" },

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
  statusInputSyncFailed: {
    en: "Care verification paused — recover the exact run before continuing.",
    zh: "照护验证已暂停——请先恢复当前对局再继续。",
  },
  sceneStatusReconnectWallet: {
    en: "Reconnect your wallet to recover this exact care run.",
    zh: "请重新连接钱包，以恢复这一局准确的照护状态。",
  },
  paidRunsUnavailable: {
    en: "New paid care runs are unavailable until live settlement validation completes.",
    zh: "新的付费照护对局将在实时结算验证完成后开放。",
  },
  paidRunsUnavailableShort: { en: "Paid care unavailable", zh: "付费照护暂未开放" },
  statusSessionMismatch: {
    en: "The enclave session does not match this on-chain game.",
    zh: "飞地会话与当前链上对局不匹配。",
  },
  statusStartPending: {
    en: "The start transaction is not confirmed yet. Rechecking this game.",
    zh: "开局交易尚未确认，正在重新核验当前对局。",
  },
  statusRecovered: { en: "The current game was recovered safely.", zh: "已安全恢复当前对局。" },
  statusSettlementPending: {
    en: "Settlement is still pending. No reward is shown until chain state confirms it.",
    zh: "结算仍待确认；链上状态确认前不会显示奖励成功。",
  },
  releaseNotReady: {
    en: "This run can be released only after the contract recovery window.",
    zh: "只能在合约恢复等待期结束后释放本局。",
  },
  withdrawPending: {
    en: "Withdrawal was broadcast but is not confirmed yet.",
    zh: "提取交易已广播，但尚未确认。",
  },
  connectWalletFirst: { en: "Connect your wallet first.", zh: "请先连接钱包。" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  // ── Guest (free / local) mode ─────────────────────────────────────────────
  // Local-play framing that replaces the GAS-at-stake / pool / reward copy in
  // guest. GAMEFI copy above stays exactly as-is.
  guestRunLabel: { en: "Local run", zh: "本地对局" },
  guestRunValue: { en: "Free play", zh: "自由练习" },
  guestBestLabel: { en: "Best happiness", zh: "最佳快乐值" },
  guestModeLine: {
    en: "Guest mode — a complete local care-and-brew game with your best saved on this device.",
    zh: "游客模式——完整的本地照护与炼制游戏，最佳成绩保存在本设备。",
  },
  guestRunComplete: {
    en: "Local run complete — happiness {happiness}!",
    zh: "本地对局完成——快乐值 {happiness}！",
  },
  guestRunRecovered: {
    en: "Nursery restored — continue caring from your last action.",
    zh: "育成进度已恢复——从上一次照护继续。",
  },
  guestRunExpired: {
    en: "Time ran out — happiness {happiness} was saved as local progress.",
    zh: "时间结束——快乐值 {happiness} 已保存为本地进度。",
  },
  guestResultLine: {
    en: "Last run: happiness {happiness} · {time}",
    zh: "上次对局：快乐值 {happiness} · {time}",
  },
  guestRulesCopy: {
    en: "Choose a path, then operate the four illustrated care tools. Balance satiety and energy, collect one essence from Feed, Play, Pet, and Rest, reach the happiness goal, brew the potion, and save it within 40 actions. The active nursery auto-saves on this device. Everything runs locally with no wallet, fee, TEE request, or chain write.",
    zh: "选择路线后，直接操作四种插画照护道具。平衡饱食与精力，从喂食、玩耍、抚摸和休息各收集一份精华，在 40 次操作内达到快乐目标、炼制并保存药水。当前育成进度会自动保存在本设备。全部在本地运行：无需钱包、无费用、不请求 TEE，也不上链。",
  },
  guestLeaderboardIntro: { en: "Local pet-care bests and completed potions.", zh: "本地宠物照护最佳成绩与已完成药水。" },

  continue: { en: "Continue", zh: "继续" },
  sceneErrorLabel: { en: "The pet nursery could not start", zh: "宠物育成室启动失败" },
  enableGameSound: { en: "Enable nursery sound", zh: "开启育成室声音" },
  muteGameSound: { en: "Mute nursery sound", zh: "关闭育成室声音" },
  closeDrawer: { en: "Close leaderboard and rules", zh: "关闭排行榜与规则" },
  a11yDifficultyGroup: { en: "Choose a nursery path", zh: "选择育成路线" },
  a11yDifficultyDetail: { en: "Target happiness {happiness}", zh: "目标快乐值 {happiness}" },
  a11yCareAction: { en: "{action}, {count} essences collected", zh: "{action}，已收集 {count} 份精华" },
  a11yRecoverRun: { en: "Recover verified care run", zh: "恢复已验证照护对局" },
  a11yLiveStatus: {
    en: "Happiness {happiness} of {target}. {actions} care actions. {recipe}.",
    zh: "快乐值 {happiness}/{target}，已照护 {actions} 次，{recipe}。",
  },
};

export const messages = mergeMessages(appMessages);
