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
  scenePointsUnit: { en: "pts", zh: "分" },
  sceneShotUnit: { en: "shot", zh: "次出手" },
  sceneShotsUnit: { en: "shots", zh: "次出手" },
  sceneComboUnit: { en: "combo", zh: "连击" },
  sceneHitFeedback: { en: "HIT!", zh: "命中！" },
  sceneMissFeedback: { en: "MISS", zh: "偏出" },
  sceneStartingAction: { en: "Starting…", zh: "正在开局…" },
  sceneSubmittingAction: { en: "Submitting…", zh: "正在提交…" },
  scenePoolLabel: { en: "Pool", zh: "奖池" },
  sceneEntryLabel: { en: "Entry", zh: "报名" },
  scenePreparingRound: { en: "Preparing round", zh: "正在准备本轮" },
  sceneSealingPattern: { en: "TEE is sealing the aim pattern", zh: "TEE 正在密封瞄准轨迹" },
  sceneLocalPreparing: { en: "Setting up your local run", zh: "正在准备本地练习" },
  sceneTapCenter: { en: "Tap when the reticle crosses center", zh: "准星扫过中心时点击" },
  sceneSubmitVerified: { en: "Submit your verified shot sequence", zh: "提交已确认的出手记录" },
  sceneChooseLane: { en: "Choose a target lane to enter", zh: "选择靶道即可开始" },
  scenePoolNeedsGas: { en: "Reward pool needs GAS before entry", zh: "奖池需要补充 GAS 后才能报名" },
  sceneStartingSealed: { en: "Starting sealed round", zh: "正在开启密封对局" },
  sceneShotFailed: { en: "Shot was not recorded — try again", zh: "本次出手未记录——请重试" },
  scenePatternInvalid: { en: "Target pattern unavailable — retry sealing", zh: "瞄准轨迹不可用——请重试密封" },
  a11yStageLabel: { en: "Aim Master target range", zh: "瞄准大师靶场" },
  a11yOpeningRange: { en: "Opening target range", zh: "正在打开靶场" },
  a11yDifficultyGroup: { en: "Choose target lane", zh: "选择瞄准靶道" },
  a11yShoot: { en: "Fire at the current reticle position", zh: "向当前准星位置射击" },

  releaseAction: { en: "Release game", zh: "结算过期对局" },
  releaseHint: {
    en: "Frees the reward reservation of an expired game.",
    zh: "释放过期对局占用的奖励额度。",
  },
  releaseNotReady: {
    en: "The on-chain recovery window is not open yet.",
    zh: "链上恢复窗口尚未开启。",
  },
  refreshGame: { en: "Check settlement", zh: "检查结算" },
  withdrawAction: { en: "Withdraw {amount} GAS", zh: "提取 {amount} GAS" },
  withdrawTitle: { en: "Withdraw winnings", zh: "提取奖金" },
  withdrawHint: {
    en: "Pulls your winnings and unused entry credit back to your wallet.",
    zh: "将奖金与未使用的报名余额提回钱包。",
  },
  timeUpAction: { en: "Time is up", zh: "时间已到" },

  shufflingCopy: {
    en: "Your target pattern is seeded inside the Morpheus enclave. The browser receives the moving view and its commitment, while the hidden seed stays inside the TEE.",
    zh: "靶心模式由 Morpheus 飞地生成。浏览器只接收移动轨迹视图及其承诺，隐藏种子始终保留在 TEE 内。",
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
    en: "1. Choose a target lane and pay the entry (Warm-up 0.02, Arcade 0.10, Pro 0.20 GAS). 2. The Morpheus enclave seeds a hidden target pattern and returns its session commitment before play. 3. Tap the range when the moving reticle crosses center. Land 3/5/7 clean hits within 60/90/120 seconds to win 0.1/0.5/1 GAS. 4. The enclave replays the confirmed shot log; the registered oracle delivers the verified result, and the contract stores the commitment and settles the pull-payment credit.",
    zh: "1. 选择瞄准靶道并支付报名费（热身 0.02、街机 0.10、职业 0.20 GAS）。2. Morpheus 飞地生成隐藏靶心模式，并在开局前返回会话承诺。3. 准星扫过中心时点击靶场，在 60/90/120 秒内完成 3/5/7 次精准命中，即可赢取 0.1/0.5/1 GAS。4. 飞地回放已确认的出手记录；注册预言机传回验证结果，合约保存承诺并将奖金计入可提取余额。",
  },
  rulesShort: {
    en: "Tap the range when the moving reticle crosses the bullseye.",
    zh: "当移动准星扫过靶心时点击靶场。",
  },
  fairnessTitle: { en: "Provably fair target", zh: "可验证公平靶心" },
  fairnessCopy: {
    en: "The Morpheus TEE derives each target pattern from a per-game secret and returns a SHA-256 session commitment before play. The browser never receives the seed. At settlement, the enclave replays the durable shot log; only the registered oracle can deliver the verified payload, after which the contract stores the commitment and answer hash. This cannot perfectly distinguish people from bots, but it prevents client-forged scores and combines timing gates, entry fees, daily caps, and a reserved pool to limit farming.",
    zh: "Morpheus TEE 使用每局独立秘密生成靶心模式，并在开局前返回 SHA-256 会话承诺；浏览器不会获得种子。结算时，飞地会回放持久化出手记录，只有注册预言机能够提交验证结果，随后合约保存承诺与答案哈希。这无法完美区分真人与机器人，但可阻止客户端伪造成绩，并结合时间门槛、报名费、每日上限和预留奖池限制刷取。",
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
  statusDealt: { en: "Target sealed inside the TEE — the clock is running", zh: "靶心已在 TEE 内密封——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusPatternInvalid: {
    en: "The sealed target pattern was invalid — retry sealing.",
    zh: "密封瞄准轨迹无效——请重试密封。",
  },
  statusShotSyncFailed: {
    en: "The TEE did not acknowledge that shot.",
    zh: "TEE 未确认本次出手。",
  },
  statusRunRecovered: {
    en: "Recovered the confirmed shot log — take the shot again.",
    zh: "已恢复确认过的出手记录——请重新出手。",
  },
  statusSessionMismatch: {
    en: "The sealed session does not match this game. Recovery was stopped safely.",
    zh: "密封会话与当前对局不一致，已安全停止恢复。",
  },
  statusContractMismatch: {
    en: "The connected contract does not match the reviewed Aim Master deployment.",
    zh: "当前连接的合约与已审核的瞄准大师部署不一致。",
  },
  statusContractAttestationFailed: {
    en: "The reviewed contract checksum or ABI could not be verified. GAS actions remain locked.",
    zh: "无法验证已审核合约的校验和或 ABI，GAS 操作将保持锁定。",
  },
  statusContractPaused: {
    en: "The verified range is temporarily paused. Guest practice is still available.",
    zh: "验证靶场暂时停用，仍可继续游客练习。",
  },
  statusStorageUnavailable: {
    en: "This browser cannot preserve the verified shot log. Enable local storage before entering a GAS range.",
    zh: "当前浏览器无法保存验证出手记录。进入 GAS 靶场前请启用本地存储。",
  },
  statusWalletChanged: {
    en: "The wallet changed during an active game. Input is locked until the original account is restored and recovery succeeds.",
    zh: "对局进行中钱包已变更。恢复原账户并完成恢复前，输入将保持锁定。",
  },
  statusStartPending: {
    en: "The entry was submitted, but the exact game could not be confirmed yet. Check recovery shortly.",
    zh: "报名已提交，但暂时无法确认对应对局。请稍后检查恢复状态。",
  },
  connectWalletFirst: {
    en: "Connect your wallet before entering a verified GAS range.",
    zh: "进入 GAS 验证靶场前请先连接钱包。",
  },
  statusSettlementPending: {
    en: "Settlement submitted — waiting for the verified chain result.",
    zh: "结算已提交——正在等待链上验证结果。",
  },
  statusRecoveryUnavailable: {
    en: "The active-game read is temporarily unavailable. Recovery stays locked until the chain can be checked.",
    zh: "暂时无法读取活跃对局。完成链上检查前，恢复流程将保持锁定。",
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
  withdrawPending: {
    en: "Withdrawal submitted — waiting for the exact chain confirmation.",
    zh: "提取已提交——正在等待精确的链上确认。",
  },

  // ── Guest (free / local) mode copy ──────────────────────────────────────────
  // Describes the game, not the mode: the launcher already appends the shared
  // `entryGuestOnlyCopy` ("Free to play — no wallet needed.") for a guest-only
  // build, and the in-game stage carries a "Local run" badge — so restating
  // "no wallet needed" here printed the same promise twice in one paragraph.
  guestSubtitle: {
    en: "Chain clean hits as the moving reticle crosses the bullseye. Best scores are saved on your device.",
    zh: "在移动准星扫过靶心时连续精准命中。最佳成绩保存在你的设备上。",
  },
  guestModeLine: { en: "Guest mode — local play, scores saved off-chain.", zh: "游客模式——本地游玩，成绩离线保存。" },
  guestBestLabel: { en: "Best score", zh: "最佳成绩" },
  guestModeTag: { en: "Mode", zh: "模式" },
  guestModeValue: { en: "Local run", zh: "本地练习" },
  guestPoolLabel: { en: "Local practice range", zh: "本地练习靶场" },
  guestRewardLabel: { en: "Local", zh: "本地" },
  guestEntryLabel: { en: "Free", zh: "免费" },
  guestLobbyStatus: { en: "Pick a lane to start a local run", zh: "选择靶道开始本地练习" },
  guestDealt: { en: "Local run live — tap as the reticle crosses center", zh: "本地练习进行中——准星过中心时点击" },
  guestRunComplete: { en: "Local run complete — {points} pts!", zh: "本地练习完成——{points} 分！" },
  guestScoreValue: { en: "{points} pts", zh: "{points} 分" },
  guestExpired: { en: "Time up — run the range again", zh: "时间到——再来一局" },
  guestEntropyUnavailable: {
    en: "Secure randomness is unavailable on this device. Reload the range and try again.",
    zh: "当前设备无法提供安全随机数。请重新加载靶场后再试。",
  },
  guestLeaderboardIntro: {
    en: "Local scores are saved off-chain — no wallet or GAS required.",
    zh: "本地成绩离线保存——无需钱包或 GAS。",
  },
  guestRulesTitle: { en: "Local range rules", zh: "本地靶场规则" },
  guestRulesCopy: {
    en: "Choose a lane, fire when the moving reticle crosses the center, and land 3, 5, or 7 clean hits before time runs out. Local runs use no wallet, GAS, contract, or oracle.",
    zh: "选择靶道，在移动准星扫过中心时出手，并在倒计时结束前完成 3、5 或 7 次精准命中。本地练习不使用钱包、GAS、合约或预言机。",
  },
  // Product-voice statement of a deliberate configuration, not an outage. This
  // string is reached only from the startGame action guard (a REAL attempted
  // paid start), never from the store-facing launcher — release-engineering
  // detail ("testnet reward pool", "settlement proven end to end") does not
  // belong in front of a first-time visitor.
  gameFiMaintenanceShort: {
    en: "Reward mode is paused. Local target practice remains fully available.",
    zh: "奖励模式暂未开放，本地打靶练习仍可完整游玩。",
  },
  // Trust-badge selling points for the guest-only build. These replace the
  // maintenance sentence that used to occupy a store-facing hero chip.
  guestOffChainBadge: { en: "Scores saved on device", zh: "成绩保存在本机" },
  gameFiModeDocTitle: { en: "Reward mode", zh: "奖励模式" },
  continue: { en: "Continue", zh: "继续" },
  gameActionFailed: {
    en: "The target range could not continue",
    zh: "瞄准靶场暂时无法继续",
  },
  enableGameSound: { en: "Enable game sound", zh: "开启游戏声音" },
  muteGameSound: { en: "Mute game sound", zh: "关闭游戏声音" },
};

export const messages = mergeMessages(appMessages);
