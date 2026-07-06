import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Color Clash", zh: "色彩对决" },
  appSubtitle: {
    en: "Watch the TEE-sealed color sequence, then repeat it from memory before the clock runs out. Each correct press lights up the button — one mistake means game over.",
    zh: "观察 TEE 密封的颜色序列，在倒计时结束前凭记忆复现。每按对一次按钮亮起——按错即出局。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Enter the arcade", zh: "进入记忆街机" },
  playingTitle: { en: "{difficulty} sequence in play", zh: "{difficulty}序列进行中" },
  statusWonTitle: { en: "Sequence mastered!", zh: "序列掌握！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My memory record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },
  lobbyConsoleLabel: { en: "Color sequence console", zh: "颜色序列控制台" },

  difficultyTitle: { en: "Arcade mode", zh: "街机模式" },
  difficulty_easy: { en: "Pulse Arcade", zh: "脉冲街机" },
  difficulty_medium: { en: "Neon Rush", zh: "霓虹连击" },
  difficulty_hard: { en: "Master Circuit", zh: "冠军序列" },
  targetSeqLabel: { en: "{count} cues", zh: "{count} 个灯号" },
  sequenceCueCount: { en: "{count} cues", zh: "{count} 个灯号" },
  modeSummary: { en: "Selected arcade mode entry and clock", zh: "当前街机模式的报名费与时间" },
  modeObjective_easy: {
    en: "Warm up on a short glowing pattern with enough time to learn the rhythm.",
    zh: "从短灯光序列热身，留出足够时间熟悉节奏。",
  },
  modeObjective_medium: {
    en: "A faster neon lane with a longer pattern and a sharper payout.",
    zh: "更快的霓虹路线，序列更长，奖励也更高。",
  },
  modeObjective_hard: {
    en: "A championship memory run where every cue has to land cleanly.",
    zh: "冠军级记忆挑战，每一个灯号都要准确复现。",
  },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  timeAmount: { en: "{seconds}s", zh: "{seconds}秒" },
  poolLine: { en: "Pool {pool} GAS", zh: "奖池 {pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },

  startAction: { en: "Play sequence", zh: "开始记忆" },
  practiceAction: { en: "Free practice", zh: "自由练习" },
  rewardMode: { en: "Reward run", zh: "奖励局" },
  practiceMode: { en: "Practice mode", zh: "练习模式" },
  practiceBadge: { en: "Practice", zh: "练习" },
  practiceModeLine: {
    en: "Practice uses a local sequence and does not submit a transaction.",
    zh: "练习局使用本地序列，不会提交交易。",
  },
  practiceHint: {
    en: "Practice mode · pool refilling",
    zh: "练习模式 · 奖池补给中",
  },
  practiceWon: { en: "Clean run — sequence mastered", zh: "完美完成——序列掌握" },
  practiceLost: { en: "Missed color — try the rhythm again", zh: "颜色按错——再试一次节奏" },
  practiceExpired: { en: "Practice timer ended", zh: "练习计时结束" },
  practiceResultHint: {
    en: "No GAS moved in practice mode. Funded reward runs use the same buttons.",
    zh: "练习模式不会移动 GAS。正式奖励局使用同一套按钮。",
  },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Choose an arcade mode, pay the entry, then let the Morpheus enclave seal a secret color pattern. Pulse pays 0.1 GAS, Neon 0.5, Master 1.",
    zh: "选择街机模式并支付报名费，Morpheus 飞地会密封一组秘密颜色序列。脉冲赢 0.1 GAS，霓虹 0.5，冠军 1。",
  },
  watchPhase: { en: "Watch the sequence...", zh: "观察序列..." },
  repeatPhase: { en: "Repeat the sequence!", zh: "复现序列！" },
  pressButton: { en: "Press {color}", zh: "按下{color}" },
  wrongPress: { en: "Wrong! Game over", zh: "错了！游戏结束" },
  allCorrect: { en: "All correct! +{n}", zh: "全部正确！+{n}" },

  submitAction: { en: "Claim reward", zh: "领取奖励" },
  submitHint: { en: "Sequence completed — claim before the deadline", zh: "序列已复现——在截止前领取奖励" },
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

  solvedBanner: { en: "Correct! {payout} GAS credited", zh: "答案正确！已入账 {payout} GAS" },
  solvedBannerHint: { en: "Credited to your balance.", zh: "已计入你的余额。" },
  expiredBanner: { en: "Game released", zh: "对局已结算" },
  expiredBannerHint: { en: "The sequence expired.", zh: "该序列已过期。" },
  checkDealAgain: { en: "Retry", zh: "重试" },

  scoreReward: { en: "Reward at stake", zh: "本局奖励" },
  scoreTime: { en: "Time left", zh: "剩余时间" },
  scoreSeqLen: { en: "Sequence length", zh: "序列长度" },
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
  historyEmpty: { en: "Your completed sequences will appear here.", zh: "你完成的序列会显示在这里。" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "1. Pick an arcade mode and pay the entry (Pulse 0.02, Neon 0.10, Master 0.20 GAS). 2. The Morpheus enclave generates a secret color sequence (8/12/16 cues) and binds its hash commitment on-chain. 3. Watch the arcade buttons light up one by one. 4. Repeat the pattern from memory in the same order. One wrong press ends the run. 5. Complete the full sequence before the deadline to win (0.1/0.5/1 GAS). The shorter your time, the stronger your score.",
    zh: "1. 选择街机模式并支付报名费（脉冲 0.02、霓虹 0.10、冠军 0.20 GAS）。2. Morpheus 飞地生成秘密颜色序列（8/12/16 个灯号），并将其哈希承诺绑定上链。3. 观察街机按钮依次亮起。4. 凭记忆按相同顺序复现图案。按错一次即出局。5. 在截止时间前完成全部序列即可获胜（0.1/0.5/1 GAS）。用时越短，成绩越强。",
  },
  fairnessTitle: { en: "Provably fair sequences", zh: "可验证公平序列" },
  fairnessCopy: {
    en: "The color sequence is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the sequence cannot be extracted or scripted outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, sequence length achieved) and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The light sequence you see is all any client ever receives.",
    zh: "颜色序列由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此序列无法被提取、也无法在平台之外用脚本破解。结算时飞地对结果（问题哈希、答案哈希、用时、已复现序列长度）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。任何客户端能看到的只有灯光序列。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose an arcade mode to play", zh: "选择街机模式即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the sequence", zh: "对局已开始——正在密封序列" },
  statusShuffling: { en: "Sealing your sequence…", zh: "正在密封序列…" },
  statusSealing: { en: "Sealing your sequence in the enclave…", zh: "正在飞地中密封序列…" },
  statusDealt: { en: "Sequence sealed and bound — the clock is running", zh: "序列已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Correct! {payout} GAS credited", zh: "答案正确！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "Pool refilling for this arcade mode",
    zh: "该街机模式奖池补给中",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  color_red: { en: "Red", zh: "红" },
  color_blue: { en: "Blue", zh: "蓝" },
  color_green: { en: "Green", zh: "绿" },
  color_yellow: { en: "Yellow", zh: "黄" },
};

export const messages = mergeMessages(appMessages);
