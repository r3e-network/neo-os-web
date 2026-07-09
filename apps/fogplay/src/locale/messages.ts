import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  appEyebrow: { en: "FogPlay", zh: "迷雾对决" },
  appSubtitle: {
    en: "Pick heads or tails, lock the wager, and reveal the fair flip on the next block.",
    zh: "选择正反面，锁定筹码，并在下一区块揭晓公平抛掷结果。",
  },
  eyebrow: { en: "On-chain coin toss", zh: "链上抛硬币" },
  title: { en: "FogPlay", zh: "迷雾对决" },
  wins: { en: "Wins", zh: "胜利" },
  losses: { en: "Losses", zh: "失败" },
  won: { en: "Won", zh: "赢得" },
  makeChoice: { en: "Choose Side", zh: "选择面" },
  placeBet: { en: "Place Your Bet", zh: "请下注" },
  youPicked: { en: "You picked", zh: "你选择" },
  payoutPreviewLabel: { en: "2x payout", zh: "2 倍赔付" },
  oddsChip: {
    en: "50% chance · pays 2x · no house edge",
    zh: "50% 胜率 · 2 倍赔付 · 无庄家抽水",
  },
  // In-canvas (Phaser scene) strings — surfaced to the scene through
  // bridgeState so the coin table honors the active locale.
  tableTitle: { en: "FOGPLAY FLIP TABLE", zh: "迷雾对决翻转台" },
  headsHint: { en: "bright side", zh: "亮面" },
  tailsHint: { en: "quiet side", zh: "静面" },
  oddsShort: { en: "50/50 · pays 2x", zh: "五五开 · 2 倍赔付" },
  awaitingReveal: { en: "Waiting for block reveal", zh: "等待区块揭晓" },
  flipCta: { en: "FLIP", zh: "抛掷" },
  flippingCta: { en: "FLIPPING", zh: "抛掷中" },
  resultWin: { en: "WIN", zh: "赢" },
  resultMiss: { en: "MISS", zh: "输" },
  tryAgainShort: { en: "Try again", zh: "再试一次" },
  wager: { en: "Wager Amount", zh: "下注金额" },
  betAmountPlaceholder: { en: "0.05", zh: "0.05" },
  heads: { en: "Heads", zh: "正面" },
  tails: { en: "Tails", zh: "反面" },
  vs: { en: "VS", zh: "VS" },
  flipping: { en: "Flipping...", zh: "抛掷中..." },
  committing: { en: "Placing bet...", zh: "下注中..." },
  revealingNextBlock: {
    en: "Revealing next block...",
    zh: "下一区块揭晓中...",
  },
  betPlacedRevealing: {
    en: "Bet placed — revealing on the next block…",
    zh: "下注已提交 — 将在下一区块揭晓…",
  },
  commitRevealTimeline: { en: "Commit reveal timeline", zh: "提交揭晓进度" },
  timelineCommit: { en: "Commit", zh: "提交" },
  timelineBlock: { en: "Block", zh: "区块" },
  timelineSettle: { en: "Settle", zh: "结算" },
  timelineReady: { en: "Ready", zh: "待命" },
  timelineOnChain: { en: "On-chain", zh: "已上链" },
  timelineListening: { en: "Listening", zh: "监听中" },
  timelineWaiting: { en: "Waiting", zh: "等待" },
  timelineResultReady: { en: "Ready", zh: "已就绪" },
  timelineReveal: { en: "Reveal", zh: "揭晓" },
  timelineWon: { en: "Win paid", zh: "胜局赔付" },
  timelineLost: { en: "Closed", zh: "已结束" },
  timelineNeedsRetry: { en: "Retry", zh: "重试" },
  revealStalled: {
    en: "Bet placed but the reveal hasn't landed yet — tap to reveal.",
    zh: "下注已提交但尚未揭晓 — 点击立即揭晓。",
  },
  revealResult: { en: "Reveal result", zh: "揭晓结果" },
  playAgain: { en: "Play again", zh: "再来一局" },
  betCommitted: { en: "Bet placed", zh: "下注已提交" },
  flipCoin: { en: "Flip Coin", zh: "迷雾对决" },
  initiateBet: { en: "Place Bet", zh: "下注" },
  youWon: { en: "You Won!", zh: "你赢了！" },
  youLost: { en: "You Lost", zh: "你输了" },
  overlayUnlucky: { en: "Unlucky", zh: "运气不佳" },
  overlayWinLabel: { en: "You won the flip", zh: "这局你赢了" },
  overlayLoseLabel: { en: "Bet was lost", zh: "本次下注失败" },
  overlayTapContinue: { en: "Tap to continue", zh: "点击继续" },
  minBet: { en: "Min bet: 0.05 GAS", zh: "最小下注：0.05 GAS" },
  connectWallet: { en: "Connect wallet to continue", zh: "请连接钱包" },
  invalidBetAmount: { en: "Invalid bet amount", zh: "下注金额无效" },
  betPending: {
    en: "Bet confirmation not available yet",
    zh: "下注确认尚未完成",
  },
  betMissing: { en: "Bet id or seed missing", zh: "下注信息缺失" },
  scriptHashMissing: {
    en: "Verification script unavailable",
    zh: "验证脚本不可用",
  },
  game: { en: "Play", zh: "游戏" },
  totalWon: { en: "Total Earnings", zh: "总收益" },
  totalGames: { en: "Total Games", zh: "总局数" },
  choiceHeader: { en: "Pick", zh: "选择" },
  outcomeHeader: { en: "Result", zh: "结果" },
  betHeader: { en: "Bet", zh: "下注" },
  payoutHeader: { en: "Payout", zh: "赔付" },
  gameHistory: { en: "Recent Games", zh: "最近对局" },
  noHistory: {
    en: "No games played yet. Place your first bet.",
    zh: "暂无对局，先下注一局。",
  },
  firstRoundPrompt: {
    en: "Flip to play your first round",
    zh: "抛硬币，开启你的第一局",
  },
  firstRoundHint: {
    en: "Pick a side, set your wager, and flip — 50/50 odds, pays 2x.",
    zh: "选择一面、设置下注金额并抛掷 — 五五胜率，2 倍赔付。",
  },
  fairnessNote: {
    en: "FogPlay uses a commit/reveal flip: your bet locks before a later block decides the outcome.",
    zh: "迷雾对决采用提交/揭晓：下注先锁定，再由更晚区块决定结果。",
  },
  betLockedReassure: {
    en: "Your bet is locked on-chain — the result reveals on the next block.",
    zh: "你的下注已锁定上链 — 结果将在下一区块揭晓。",
  },
  docSubtitle: {
    en: "Provably-fair on-chain coin toss with a 2x payout",
    zh: "可证明公平的链上抛硬币，赢取 2 倍赔付",
  },
  docDescription: {
    en: "FogPlay uses a commit/reveal flip. You first place your bet (the wager is escrowed and the house exposure reserved), then the outcome is revealed from a LATER block's native randomness and the winner is paid 2x from the house bankroll. Because the result is unknowable when you place the bet, it cannot be peeked at or aborted on a loss. Every outcome is recorded on-chain for auditability.",
    zh: "迷雾对决采用「提交—揭晓」机制。您先下注（金额被托管、庄家敞口被预留），随后由更晚区块的原生随机数揭晓结果，胜者由庄家奖池支付 2 倍赔付。由于下注时结果无法预知，因此无法被窥探或在将输时中止交易。每个结果都会上链记录以供审计。",
  },
  step1: {
    en: "Choose your side: Heads or Tails.",
    zh: "选择你的面：正面或反面。",
  },
  step2: {
    en: "Enter the amount of GAS you want to wager.",
    zh: "输入你想下注的 GAS 金额。",
  },
  step3: {
    en: "Click 'Flip Coin' to place the bet, then the result is revealed on the next block and paid out automatically.",
    zh: "点击「抛硬币」下注，结果将在下一区块揭晓并自动结算。",
  },
  step4: {
    en: "View your win/loss stats in the Stats tab.",
    zh: "在统计标签页查看您的胜负统计。",
  },
  feature1Name: { en: "Provably Fair", zh: "可证明公平" },
  feature1Desc: {
    en: "A commit/reveal flip: the outcome is drawn from a later block's randomness, so it can't be peeked or aborted on a loss.",
    zh: "采用「提交—揭晓」抛掷：结果取自更晚区块的随机数，无法被窥探或在将输时中止。",
  },
  feature2Name: { en: "Instant Payout", zh: "即时支付" },
  feature2Desc: {
    en: "Winnings are automatically sent via smart contract.",
    zh: "奖金通过智能合约自动发送。",
  },
  feature3Name: { en: "On-chain Outcome", zh: "链上结果" },
  feature3Desc: {
    en: "Each flip stores the verified result on-chain.",
    zh: "每次抛掷的验证结果都会上链记录。",
  },
  connectWalletToPlay: { en: "Connect wallet to play", zh: "连接钱包开始游戏" },
  flipFailed: { en: "Flip failed", zh: "翻转失败" },
  commitFailed: { en: "Bet could not be placed", zh: "下注未能提交" },
  commitNoBetId: {
    en: "Bet placed but its id couldn't be read — refresh to reveal it",
    zh: "下注已提交但无法读取编号 — 请刷新后揭晓",
  },
  betAlreadyPending: {
    en: "A bet is already awaiting its reveal — reveal it first",
    zh: "已有下注等待揭晓 — 请先揭晓",
  },
  noPendingBet: { en: "No bet awaiting reveal", zh: "没有等待揭晓的下注" },
  revealPending: { en: "Reveal not confirmed yet", zh: "揭晓尚未确认" },
  revealFailedRetry: {
    en: "The reveal didn't land — tap Reveal result to try again (your bet is safe on-chain)",
    zh: "本次揭晓未成功 — 点击「揭晓结果」重试（您的下注已安全上链）",
  },
  betPrepaidNoCommit: {
    en: "Wager prepaid but the bet didn't commit — your credit is held; reuse it on your next bet or withdraw it below",
    zh: "下注金额已预付但本局未提交 — 余额已保留，可用于下次下注，或在下方提取",
  },
  invalidAmountNumber: { en: "Enter a valid number", zh: "请输入有效数字" },
  minBetError: {
    en: "Minimum bet is {min} {tokenGas}",
    zh: "最低下注 {min} {tokenGas}",
  },
  maxBetError: {
    en: "Maximum bet is {max} {tokenGas}",
    zh: "最高下注 {max} {tokenGas}",
  },
  invalidAmountDecimals: { en: "Maximum 8 decimal places", zh: "最多8位小数" },
  gameErrorFallback: { en: "Something went wrong", zh: "出现错误" },
  wagerRange: { en: "0.05 - 100", zh: "0.05 - 100" },
  customBet: { en: "Custom Bet Amount", zh: "自定义下注金额" },
  betAmount: { en: "Bet amount", zh: "下注金额" },
  depositStranded: {
    en: "Deposit succeeded but the bet failed — withdraw from your balance to recover the GAS",
    zh: "下注资金已存入但投注失败 — 请从余额中提取以取回 GAS",
  },
  betPrepaidNoFlip: {
    en: "Wager prepaid but the flip didn't settle — your credit is held; reuse it on your next bet or withdraw it below",
    zh: "下注金额已预付但本局未结算 — 余额已保留，可用于下次下注，或在下方提取",
  },
  prepaidCredit: { en: "Prepaid credit", zh: "预付余额" },
  withdrawCredit: { en: "Withdraw", zh: "提取" },
  creditWithdrawn: { en: "Prepaid credit withdrawn", zh: "预付余额已提取" },
  noCreditToWithdraw: {
    en: "No prepaid credit to withdraw",
    zh: "没有可提取的预付余额",
  },
  maxPayableHint: {
    en: "House can currently pay up to {max}",
    zh: "庄家当前最多可赔付 {max}",
  },
  bankrollTooLow: {
    en: "House bankroll too low for this bet — try a smaller wager",
    zh: "庄家奖池余额不足以支付此注 — 请减小下注金额",
  },
  bankrollTooLowCap: {
    en: "House bankroll too low for this bet — max payable bet is {max} {tokenGas}",
    zh: "庄家奖池余额不足以支付此注 — 当前最大可下注 {max} {tokenGas}",
  },

  // -- Guest (free / local) mode --------------------------------------------
  // Local framing: no GAS at stake, no pool, no chain. Guest builds a win streak.
  guestSubtitle: {
    en: "Pick heads or tails and flip locally — build your best win streak.",
    zh: "选择正面或反面，本地抛掷 — 冲击你的最佳连胜。",
  },
  guestModeBadge: { en: "Local play", zh: "本地游玩" },
  guestStreak: { en: "Streak", zh: "连胜" },
  guestBestStreak: { en: "Best streak", zh: "最佳连胜" },
  guestStreakBadge: { en: "Streak {n}", zh: "连胜 {n}" },
  guestStatusIdle: {
    en: "Local flip · 50/50 · build a streak",
    zh: "本地抛掷 · 五五开 · 冲击连胜",
  },
  guestStatusFlipping: { en: "Flipping the coin…", zh: "抛掷硬币中…" },
  guestFairnessNote: {
    en: "Guest mode runs every flip locally with in-browser randomness — no wallet, no GAS, no chain. Scores are kept off-chain.",
    zh: "游客模式使用浏览器内随机数在本地完成每次抛掷 — 无需钱包、不涉及 GAS、不上链。成绩离线保存。",
  },
} as const;

export const messages = mergeMessages(appMessages);
