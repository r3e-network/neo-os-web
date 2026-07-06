import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Sheep Solitaire", zh: "羊了个羊" },
  appSubtitle: {
    en: "Pick cards from the pile into your slot bar — three matching cards auto-eliminate. Clear the board before the slots fill up to win!",
    zh: "从牌堆选取卡片放入卡槽——三张相同卡片自动消除。在卡槽满溢前清空所有卡片即可获胜！",
  },
  rollTab: { en: "Board", zh: "牌局" },
  rollDescription: {
    en: "Pick exposed cards into the slot bar, match three to clear them, and empty the board before time runs out.",
    zh: "选择可见卡片放入卡槽，三张相同即消除，并在倒计时前清空牌面。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Clear the meadow board", zh: "清空草地牌局" },
  playingTitle: { en: "Sheep Solitaire", zh: "羊了个羊" },
  statusWonTitle: { en: "All cards cleared!", zh: "全部消除！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My game record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  difficultyTitle: { en: "Board route", zh: "牌局路线" },
  easyLabel: { en: "Meadow Board", zh: "草地牌局" },
  mediumLabel: { en: "Festival Board", zh: "庆典牌局" },
  hardLabel: { en: "Mountain Board", zh: "山岭牌局" },
  routeEyebrow: { en: "match-3 route", zh: "三消路线" },
  routeSummary: { en: "Selected board reward, entry, and clock", zh: "当前牌局的奖励、报名费和时间" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },

  easyDesc: { en: "A friendly meadow with 8 symbol families and a quick 5-minute clock.", zh: "友好的草地牌局，8 组图案，5 分钟快节奏清盘。" },
  mediumDesc: { en: "A fuller festival spread with 12 symbol families and tighter slot pressure.", zh: "更丰富的庆典牌局，12 组图案，卡槽压力更高。" },
  hardDesc: { en: "A dense mountain layout with 15 symbol families for a serious clear.", zh: "密集的山岭牌局，15 组图案，面向认真挑战。" },

  startAction: { en: "Open board", zh: "开启牌局" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pay the entry and the Morpheus enclave seals your card layout — only its hash commitment goes on-chain.",
    zh: "支付报名费后，Morpheus 飞地密封你的牌面——链上只记录哈希承诺。",
  },
  submitAction: { en: "Submit win", zh: "提交获胜" },
  submitSolution: { en: "Submit win", zh: "提交获胜" },
  submitHint: { en: "All cards cleared — submit before the deadline", zh: "已清空所有卡片——在截止前提交" },
  timeUpAction: { en: "Time is up", zh: "时间到" },

  undoAction: { en: "Undo ({left} left, -30%)", zh: "撤回（剩 {left} 次，-30%）" },
  undoConfirm: { en: "Confirm undo — reward drops to {pct}%", zh: "确认撤回——奖励降至 {pct}%" },
  undoHint: {
    en: "Recorded by the enclave session — no transaction needed. Each undo burns 30% of the base reward; three max.",
    zh: "由飞地会话记录——无需交易。每次撤回扣除基础奖励的 30%，最多三次。",
  },

  shuffleAction: { en: "Shuffle ({left})", zh: "洗牌（{left}）" },
  shuffleHint: {
    en: "Reshuffle all cards in the slot bar back into the pile. One use per game.",
    zh: "将卡槽中所有卡片洗回牌堆。每局一次。",
  },
  remove3Action: { en: "Remove 3 ({left})", zh: "移出三张（{left}）" },
  remove3Hint: {
    en: "Remove any 3 cards from the slot bar. One use per game.",
    zh: "从卡槽中移出任意 3 张卡片。每局一次。",
  },

  releaseAction: { en: "Release game", zh: "结算过期对局" },
  expireGame: { en: "Release game", zh: "结算过期对局" },
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

  pileLabel: { en: "Card pile", zh: "牌堆" },
  slotBarLabel: { en: "Slot bar ({used}/{cap})", zh: "卡槽（{used}/{cap}）" },
  slotsFull: { en: "Slots full — game over!", zh: "卡槽已满——游戏结束！" },
  rewardNow: { en: "{amount} GAS ({pct}%)", zh: "{amount} GAS（{pct}%）" },
  cardsLeft: { en: "{count} cards left", zh: "剩余 {count} 张" },
  minSolveHint: {
    en: "Anti-bot floor: submission unlocks in {clock}",
    zh: "防脚本时间下限：{clock} 后可提交",
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
    en: "Your card layout is sealed inside the Morpheus enclave — only its hash commitment goes on-chain, and cards are revealed as you pick them.",
    zh: "牌面在 Morpheus 飞地内密封——链上只记录哈希承诺，卡片在你选取时才揭示。",
  },
  checkDealAgain: { en: "Retry sealing", zh: "重试密封" },

  solvedBanner: { en: "You won {payout}!", zh: "你赢得了 {payout}！" },
  solvedBannerHint: {
    en: "Credited to your withdrawable balance — start another game to climb the ranks.",
    zh: "已计入可提取余额——再来一局，冲击更高排名。",
  },
  gameOverBanner: { en: "Slots full — better luck next time", zh: "卡槽已满——下次加油" },
  gameOverBannerHint: {
    en: "The entry stays in the reward pool. Fresh layout, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },
  expiredBanner: { en: "That game got away", zh: "这一局没能完成" },
  expiredBannerHint: {
    en: "The entry stays in the reward pool. Fresh layout, fresh chances.",
    zh: "报名费留在奖池中。新的一局，新的机会。",
  },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scoreUndos: { en: "Undos left", zh: "剩余撤回" },
  scoreCards: { en: "Cards left", zh: "剩余卡片" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  leaderboardIntro: {
    en: "The global ranking is rebuilt from on-chain Solved events — every payout is independently verifiable.",
    zh: "全网排行由链上 Solved 事件重建——每笔奖励都可独立验证。",
  },
  leaderboardTitle: { en: "Global leaderboard", zh: "全网积分榜" },
  leaderboardEmpty: {
    en: "No verified games yet — the first name on this board could be yours.",
    zh: "暂无通关记录——榜单第一个名字可能就是你。",
  },
  refreshRanks: { en: "Refresh ranking", zh: "刷新排行" },
  solvesCount: { en: "{count} wins", zh: "{count} 次通关" },
  youTag: { en: "you", zh: "你" },
  historyTitle: { en: "My games", zh: "我的通关" },
  historyEmpty: { en: "Your verified games will appear here.", zh: "你完成的对局会显示在这里。" },
  historyUndos: { en: "{undos} undos", zh: "{undos} 次撤回" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Choose a board route and pay the entry (Meadow: 0.02, Festival: 0.10, Mountain: 0.20 GAS). 2. The Morpheus enclave generates a 3-layer card layout and binds its hash commitment on-chain — only exposed cards are visible. 3. Tap an exposed card to move it to the 7-slot bar. Three matching cards auto-eliminate. Clear all cards before the deadline to win! 4. Tools: Undo (3 max, -30% each), Shuffle (1/game, returns slot cards to pile), Remove 3 (1/game, removes any 3 from slots). 5. The enclave verifies your game, signs the settlement, and the contract pays after checking the signature and commitment.",
    zh: "1. 选择牌局路线并支付报名费（草地：0.02、庆典：0.10、山岭：0.20 GAS）。2. Morpheus 飞地生成三层牌面并将其哈希承诺绑定上链——只有暴露的卡片可见。3. 点击暴露的卡片将其移入 7 格卡槽。三张相同卡片自动消除。在截止时间前清空所有卡片即可获胜！4. 工具：撤回（最多 3 次，每次 -30%）、洗牌（每局 1 次，将卡槽卡片洗回牌堆）、移出三张（每局 1 次，从卡槽移除任意 3 张）。5. 飞地验证对局并签署结算，合约核验签名与承诺后发奖。",
  },
  fairnessTitle: { en: "Provably fair cards", zh: "可验证公平牌面" },
  fairnessNote: {
    en: "The layout is sealed inside the Morpheus enclave, revealed only as you pick exposed cards, and verified before payout.",
    zh: "牌面在 Morpheus 飞地内密封，只在你选择可见卡片时揭示，并在派奖前验证。",
  },
  fairnessCopy: {
    en: "The card layout is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, and each card's symbol is revealed only as you pick it — so the full layout cannot be extracted or searched outside the app. At settlement the enclave signs the result and the contract verifies both the signature and that the problem hash equals the original commitment before paying.",
    zh: "牌面由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，且每张卡片的图案只在你选取时才揭示——完整牌面无法在平台之外提取或搜索。结算时飞地对结果签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a board route to open", zh: "选择牌局路线后开启" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the card layout", zh: "对局已开始——正在密封牌面" },
  statusShuffling: { en: "Sealing your game…", zh: "正在密封对局…" },
  statusSealing: { en: "Sealing your game in the enclave…", zh: "正在飞地中密封对局…" },
  statusDealt: { en: "Game sealed and bound — the clock is running", zh: "对局已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Verified! {payout} GAS credited", zh: "验证通过！已入账 {payout} GAS" },
  statusUndoUsed: { en: "Undo recorded — reward now {pct}%", zh: "撤回已记录——奖励降至 {pct}%" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool needs refill",
    zh: "奖池需要补充",
  },
  walletRequiredStatus: {
    en: "Connect your wallet to start a game.",
    zh: "请先连接钱包再开始游戏。",
  },
  contractUnavailableStatus: {
    en: "This game is not configured for the selected network yet.",
    zh: "该游戏尚未配置到当前网络。",
  },
  startGameUnavailableStatus: {
    en: "The chain accepted the request, but no active game was returned. Please retry shortly.",
    zh: "链上请求已提交，但未返回有效对局。请稍后重试。",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },
};

export const messages = mergeMessages(appMessages);
