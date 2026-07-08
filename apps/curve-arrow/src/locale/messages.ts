import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Curve Arrow", zh: "箭头会拐弯" },
  appSubtitle: {
    en: "Shoot, then hold to curve the arrow over the walls and hit every target before time runs out.",
    zh: "放箭后按住屏幕让箭拐弯越墙，在倒计时前命中所有箭靶。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Open the archery range", zh: "开启拐弯箭靶场" },
  playingTitle: { en: "{difficulty} game in play", zh: "{difficulty}对局进行中" },
  statusWonTitle: { en: "Range cleared!", zh: "通关成功！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My range record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Archery range", zh: "箭术靶场" },
  difficulty_easy: { en: "Meadow Range", zh: "草原靶场" },
  difficulty_medium: { en: "Forest Range", zh: "林间靶场" },
  difficulty_hard: { en: "Summit Range", zh: "山巅靶场" },
  routeEyebrow: { en: "archery range", zh: "箭术靶场" },
  routeSummary: { en: "Selected range reward, entry, targets, and clock", zh: "当前靶场的奖励、报名费、靶数和时间" },
  routeObjective_easy: {
    en: "An open meadow lane with low walls and a generous quiver. Good for learning the curve.",
    zh: "开阔的草原靶道，墙体较矮、箭数充裕。适合练习拐弯手感。",
  },
  routeObjective_medium: {
    en: "Denser forest walls that demand tighter loops and a stronger bounty.",
    zh: "更密的林间石墙，需要更精准的弧线，赏金也更强。",
  },
  routeObjective_hard: {
    en: "A long summit gauntlet for confident archers. Curve carefully, then settle the full bounty.",
    zh: "面向熟练射手的山巅长线挑战。稳住弧线，冲击完整赏金。",
  },
  lobbyPreviewLabel: {
    en: "{difficulty} range preview, {target} targets to clear",
    zh: "{difficulty}靶场预览，需命中 {target} 个箭靶",
  },
  lobbyHuntGoal: {
    en: "Clear {target} targets",
    zh: "命中 {target} 个箭靶",
  },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  targetRibbon: { en: "{target} targets", zh: "{target} 个箭靶" },
  arrowsRibbon: { en: "{arrows} arrows", zh: "{arrows} 支箭" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },
  walletRequiredStatus: {
    en: "Connect wallet to start",
    zh: "连接钱包后开始",
  },
  progressionChecking: {
    en: "Checking account range history",
    zh: "正在检查账户靶场记录",
  },
  progressionUnavailable: {
    en: "Range history is unavailable. Try again after the indexer reconnects.",
    zh: "靶场历史暂不可用。请在索引服务恢复后重试。",
  },
  progressionStatusLabel: {
    en: "Range",
    zh: "靶场",
  },
  progressionUnavailableShort: {
    en: "History offline",
    zh: "历史离线",
  },
  progressionNextRoute: {
    en: "Next: {difficulty}",
    zh: "下一局：{difficulty}",
  },
  progressionCleared: {
    en: "Range cleared. Play {difficulty} next.",
    zh: "该靶场已通关。下一局请挑战 {difficulty}。",
  },

  startAction: { en: "Start range", zh: "开始射箭" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pick an archery range, pay the entry, and the Morpheus enclave deals the wall layouts. Tap to shoot, hold to curve the arrow over the walls, and clear every target within the arrow budget before the clock runs out to win the fixed GAS bounty.",
    zh: "选择箭术靶场并支付报名费，Morpheus 飞地会发出石墙布局。点按放箭，按住让箭拐弯越墙，在箭数预算与倒计时内命中全部箭靶，即可赢取固定 GAS 赏金。",
  },
  submitAction: { en: "Submit win", zh: "提交胜利" },
  submitHint: { en: "All targets cleared — submit before the deadline", zh: "已命中全部箭靶——在截止前提交" },
  fillHint: { en: "Target {cleared}/{target}", zh: "箭靶 {cleared}/{target}" },
  arrowsHint: { en: "{arrows} arrows left", zh: "剩余 {arrows} 支箭" },
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

  rangeLabel: { en: "Archery field", zh: "射箭场地" },
  controlsHint: { en: "Tap to shoot · hold to curve", zh: "点按放箭 · 按住拐弯" },
  levelLabel: { en: "Target", zh: "箭靶" },
  arrowsLabel: { en: "Arrows", zh: "箭数" },
  targetLabel: { en: "Targets", zh: "箭靶数" },
  rewardNow: { en: "{amount} GAS", zh: "{amount} GAS" },
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
    en: "Your wall layouts are dealt inside the Morpheus enclave — only its hash commitment goes on-chain, and the layouts never leave the TEE unseen.",
    zh: "石墙布局在 Morpheus 飞地内发出——链上只记录其哈希承诺，布局不会在密封前泄露。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another range to climb the ranks.",
    zh: "已计入可提取余额——再开一局，冲击更高排名。",
  },
  outOfArrowsBanner: { en: "Out of arrows!", zh: "箭用完了！" },
  outOfArrowsBannerHint: {
    en: "The entry stays in the reward pool. Fresh walls, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },
  expiredBanner: { en: "That game expired", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh walls, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  rewardMetric: { en: "Reward", zh: "奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  timeMetric: { en: "Time", zh: "时间" },
  scoreLevels: { en: "Targets", zh: "箭靶" },
  scoreWon: { en: "Total won", zh: "累计赢取" },
  wonMetric: { en: "Won", zh: "已赢" },

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
  historyEmpty: { en: "Your solved games will appear here.", zh: "你完成的对局会显示在这里。" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Choose an archery range and pay the entry (Meadow 0.02, Forest 0.10, Summit 0.20 GAS). 2. The Morpheus enclave deals the stone-wall layouts from a per-game secret and binds its hash commitment on-chain. 3. Tap to shoot; while the arrow flies, press and hold anywhere to curve it upward — it can loop — and release to let it level out. 4. Land the arrow on the target board behind the walls. Clear every target (3/5/7) within the arrow budget (9/14/19) before the deadline (3/5/10 min) to win. 5. The enclave verifies your shots, signs the settlement, and the contract checks the signature and commitment before paying. A short anti-bot floor applies.",
    zh: "1. 选择箭术靶场并支付报名费（草原 0.02、林间 0.10、山巅 0.20 GAS）。2. Morpheus 飞地用每局独立的密钥发出石墙布局，并将哈希承诺绑定上链。3. 点按放箭；箭飞行中按住屏幕任意位置可让箭向上拐弯——甚至能翻转一圈——松开后箭会回到平飞。4. 让箭越过石墙命中后方的箭靶。在截止时间（3/5/10 分钟）与箭数预算（9/14/19）内命中全部箭靶（3/5/7）即可赢取奖励。5. 飞地验证每一箭并签署结算，合约核验签名与承诺后发奖。提交前有一段防脚本的最短用时。",
  },
  rulesShort: {
    en: "Tap to shoot, hold to curve over the walls, and clear every target before the clock expires.",
    zh: "点按放箭，按住拐弯越墙，在倒计时结束前命中所有箭靶。",
  },
  fairnessTitle: { en: "Provably fair walls", zh: "可验证公平墙体" },
  fairnessCopy: {
    en: "The wall layouts are generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the flight paths cannot be scripted outside the app. At settlement the enclave replays every recorded shot with the same integer flight engine, signs the result (problem hash, answer hash, time), and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The layouts you see are all any client ever receives.",
    zh: "石墙布局由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此飞行路径无法在平台之外用脚本模拟。结算时飞地用同一套整数飞行引擎重放每一箭，对结果（问题哈希、答案哈希、用时）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。任何客户端能看到的只有墙体布局。",
  },
  fairnessShort: {
    en: "Wall layouts stay inside the Morpheus TEE until settlement verification.",
    zh: "墙体布局保留在 Morpheus TEE 内，直到结算验证。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose an archery range to start", zh: "选择箭术靶场即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the walls", zh: "对局已开始——正在密封墙体" },
  statusShuffling: { en: "Dealing your walls…", zh: "正在布置墙体…" },
  statusSealing: { en: "Dealing your walls in the enclave…", zh: "正在飞地中布置墙体…" },
  statusDealt: { en: "Walls sealed and bound — the clock is running", zh: "墙体已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Correct! {payout} GAS credited", zh: "答案正确！已入账 {payout} GAS" },
  statusGameOver: { en: "Out of arrows — no reward", zh: "箭已用完——无奖励" },
  statusBoardIncomplete: { en: "Clear every target before submitting", zh: "命中全部箭靶后再提交" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool needs refill",
    zh: "奖池需要补充",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
};

export const messages = mergeMessages(appMessages);
