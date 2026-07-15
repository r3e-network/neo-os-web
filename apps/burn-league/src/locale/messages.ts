import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Burn League", zh: "燃烧联盟" },
  subtitle: { en: "Feed the arena, climb the pool", zh: "点燃竞技场，冲上奖池榜首" },
  launchBadge: { en: "Season match", zh: "赛季对局" },
  launchTitle: { en: "Burn League", zh: "燃烧联盟" },
  launchDescription: {
    en: "Choose local fire-streak practice or enter the verified winner-takes-all GAS season.",
    zh: "选择本地炉火连击练习，或进入经验证的 GAS 胜者全得赛季。",
  },
  launchPrimary: { en: "Enter arena", zh: "进入竞技场" },
  launchCtaTitle: { en: "Ready to fuel the arena?", zh: "准备点燃竞技场？" },
  // Hint for the collapsed details row — previews what opening it reveals,
  // rather than repeating launchCtaTitle back to the reader. Kept under the
  // 56-character limit the launcher applies to this slot.
  launchDetailsHint: { en: "Season rules, prize and safety", zh: "赛季规则、奖励与安全说明" },
  launchCtaDesc: {
    en: "Practice locally, or review every wallet-signed burn before joining the live season.",
    zh: "可先在本地练习；加入实时赛季前，每次燃烧都会要求你在钱包中单独确认。",
  },
  launchTrustChain: { en: "Neo N3", zh: "Neo N3" },
  launchTrustWallet: { en: "Wallet signed", zh: "钱包签名" },
  launchTrustResult: { en: "Verified result", zh: "结果可验证" },
  startAction: { en: "Enter arena", zh: "进入竞技场" },
  playTab: { en: "Play", zh: "对局" },
  rulesTitle: { en: "Rules", zh: "规则" },
  ranksTab: { en: "Ranks", zh: "排行" },
  arenaAlt: {
    en: "Golden Burn League arena with GAS tokens flowing into a prize brazier",
    zh: "金色燃烧联盟竞技场，GAS 代币流向奖池燃烧台",
  },
  totalBurned: { en: "Total Burned", zh: "总燃烧量" },
  youBurned: { en: "You Burned", zh: "你的燃烧量" },
  yourBurns: { en: "Your Burns", zh: "你的燃烧量" },
  rewardPool: { en: "Reward Pool", zh: "奖励池" },
  rank: { en: "Rank", zh: "排名" },
  yourRank: { en: "Your Rank", zh: "你的排名" },
  // Honest zero-state for a wallet that has not burned yet, in place of the
  // former "--" em-dash void. Read by `formattedRank`, so it lands on the rank
  // tile, the in-game HUD, the sidebar and the platform stat strip at once.
  rankUnranked: { en: "Unranked", zh: "未上榜" },
  outOf: { en: "of {total} players", zh: "共 {total} 名玩家" },
  burnTokens: { en: "Ignite GAS into the arena pool", zh: "将 GAS 点燃进竞技场奖池" },
  amount: { en: "Amount", zh: "数量" },
  enterAmount: { en: "Amount to burn", zh: "燃烧数量" },
  amountPlaceholder: { en: "Amount to burn", zh: "燃烧数量" },
  estimatedReward: { en: "Est. Reward", zh: "预估奖励" },
  estimatedRewards: { en: "Estimated Rewards", zh: "预估奖励" },
  entryAmount: { en: "Entry amount", zh: "参赛燃烧量" },
  projectedTotal: { en: "Projected total", zh: "预计总燃烧量" },
  projectedRank: { en: "Projected rank", zh: "预计排名" },
  burnPresets: { en: "Fuel capsules", zh: "燃料胶囊" },
  burnRange: {
    en: "Allowed charge {min}-{max} GAS",
    zh: "可装填 {min}-{max} GAS",
  },
  burnRangeError: {
    en: "Enter a burn amount from {min} to {max} GAS.",
    zh: "请输入 {min} 到 {max} GAS 的燃烧数量。",
  },
  fuelConsole: { en: "Fuel rack", zh: "燃料装填台" },
  fuelCore: { en: "Fuel core", zh: "燃料核心" },
  fuelLoadHint: { en: "Capsules tune the next ignition", zh: "胶囊用于调节下一次点燃" },
  fuelDialLabel: { en: "Fuel tuner", zh: "燃料调节器" },
  fuelMeter: { en: "Burn fuel meter", zh: "燃烧燃料仪表" },
  arenaConsoleLabel: {
    en: "Arena burn console",
    zh: "竞技场燃烧控制台",
  },
  decreaseBurn: { en: "Decrease burn amount", zh: "减少燃烧数量" },
  increaseBurn: { en: "Increase burn amount", zh: "增加燃烧数量" },
  scoreboardEyebrow: { en: "Next burn", zh: "下一次燃烧" },
  readyToBurn: { en: "Core armed", zh: "核心已装填" },
  chooseFuel: { en: "Fuel core", zh: "燃料核心" },
  seasonStatus: { en: "Season status", zh: "赛季状态" },
  liveLeague: { en: "Live league", zh: "实时联赛" },
  heroFirstBurnPrompt: {
    en: "Be the first to burn this season and top the leaderboard.",
    zh: "成为本赛季首位燃烧者，登上排行榜榜首。",
  },
  localPreview: { en: "Data pending", zh: "数据待同步" },
  seasonStatusHint: {
    en: "Stats refresh when the league service is available.",
    zh: "联赛服务可用后会刷新统计。",
  },
  projectedRankHint: {
    en: "Estimated from the visible leaderboard preview.",
    zh: "根据当前可见排行榜预估。",
  },
  // ── Season lifecycle (on-chain MiniAppBurnLeague) ──────────────────────
  seasonLabel: { en: "Season", zh: "赛季" },
  seasonActive: { en: "Live now", zh: "进行中" },
  seasonEnded: { en: "Ended — awaiting settle", zh: "已结束 — 待结算" },
  seasonDormant: { en: "Not started", zh: "尚未开始" },
  seasonDormantHint: {
    en: "No active season yet — the first burn starts a fresh season.",
    zh: "暂无进行中的赛季 — 第一次燃烧将开启新赛季。",
  },
  seasonDormantHintWithLength: {
    en: "No active season yet — the first burn starts a fresh {length} season. Only the top burner wins the pool; all other burns are forfeited to it.",
    zh: "暂无进行中的赛季 — 第一次燃烧将开启一个 {length} 的新赛季。只有燃烧榜首赢得奖池，其余燃烧将被并入奖池。",
  },
  seasonEndsIn: { en: "Ends in", zh: "剩余时间" },
  seasonEndedHint: {
    en: "The season has ended. Settle to award the {amount} pool to the top burner.",
    zh: "赛季已结束。结算后将把 {amount} 奖池发放给燃烧榜首。",
  },
  settleSeason: { en: "Settle season", zh: "结算赛季" },
  settleSuccess: {
    en: "Season settled — the pool is claimable by the top burner.",
    zh: "赛季已结算 — 奖池已记入燃烧榜首的可提取额度。",
  },
  burnSuccess: {
    en: "Burn confirmed — your season total is updated.",
    zh: "燃烧已确认 — 你的赛季总量已更新。",
  },
  burnConnectAction: { en: "Connect wallet", zh: "连接钱包" },
  burnConnectingAction: { en: "Connecting...", zh: "正在连接..." },
  burnConnectFirst: {
    en: "Connect your wallet first. Burning always requires a separate confirmation.",
    zh: "请先连接钱包。燃烧必须在连接后单独确认。",
  },
  burnWalletConnected: {
    en: "Wallet connected. Choose fuel, then review the burn.",
    zh: "钱包已连接。请选择燃料并确认燃烧。",
  },
  burnIgniteAction: { en: "Review {amount} GAS burn", zh: "检查燃烧 {amount} GAS" },
  burnConfirmAction: { en: "Confirm burn {amount} GAS", zh: "确认燃烧 {amount} GAS" },
  burnConfirmTitle: { en: "Confirm irreversible burn", zh: "确认不可撤销燃烧" },
  burnConfirmPrompt: {
    en: "Press again to burn {amount} GAS. This is irreversible; only the season leader wins the pool.",
    zh: "请再次点击燃烧 {amount} GAS。操作不可撤销，只有赛季榜首赢得奖池。",
  },
  burnConfirmExpired: {
    en: "Burn confirmation expired. Review the amount again.",
    zh: "燃烧确认已过期，请重新检查数量。",
  },
  burnBusy: { en: "A league action is already in progress.", zh: "联赛操作正在处理中。" },
  burnInsufficientBalance: {
    en: "Not enough GAS: {required} {tokenGas} is needed from your wallet; {available} is available.",
    zh: "GAS 余额不足：钱包需支付 {required} {tokenGas}，当前可用 {available}。",
  },
  burnInsufficientHint: {
    en: "Wallet GAS plus prepaid credit cannot cover this burn.",
    zh: "钱包 GAS 与预付额度不足以完成本次燃烧。",
  },
  burnBalanceUnavailable: {
    en: "Wallet GAS balance could not be verified. Refresh before burning.",
    zh: "无法验证钱包 GAS 余额，请刷新后再燃烧。",
  },
  burnDepositUnknown: {
    en: "The GAS deposit was broadcast but is not verified yet. Check it before trying again.",
    zh: "GAS 充值已广播但尚未验证，请确认结果后再试。",
  },
  burnTransactionUnknown: {
    en: "The burn was broadcast but is not verified yet. Do not submit another burn; check this transaction.",
    zh: "燃烧已广播但尚未验证。请勿重复提交，先检查本次交易。",
  },
  burnPendingBlocksNew: {
    en: "Resolve the pending burn transaction before starting another one.",
    zh: "请先确认待处理燃烧交易，再发起新交易。",
  },
  burnRecheckAction: { en: "Check transaction", zh: "检查交易" },
  burnCheckingAction: { en: "Checking...", zh: "正在检查..." },
  burnCheckingTitle: { en: "Verifying chain result", zh: "正在验证链上结果" },
  burnRecoveryUnavailable: {
    en: "The transaction result could not be checked. Keep the txid and try again shortly.",
    zh: "暂时无法检查交易结果。请保留交易 ID，稍后重试。",
  },
  burnDepositReady: {
    en: "Deposit confirmed as reusable credit. Review and confirm the burn again; it was not auto-submitted.",
    zh: "充值已确认为可复用额度。请重新检查并确认燃烧，系统不会自动提交。",
  },
  settleTransactionUnknown: {
    en: "Settlement was broadcast but is not verified yet. Refresh before trying again.",
    zh: "结算已广播但尚未验证，请刷新确认后再试。",
  },
  settleActionUnavailable: {
    en: "The settlement was not broadcast. Please try again.",
    zh: "结算交易未广播，请重试。",
  },
  withdrawTransactionUnknown: {
    en: "Withdrawal was broadcast but is not verified yet. Check your balance before retrying.",
    zh: "提取已广播但尚未验证，请先检查余额再重试。",
  },
  withdrawActionUnavailable: {
    en: "The withdrawal was not broadcast. Your credit is unchanged.",
    zh: "提取交易未广播，你的额度未发生变化。",
  },
  burnArenaLoading: { en: "Opening Burn League arena", zh: "正在进入燃烧联盟竞技场" },
  // Concise canvas copy. These strings are bridged into Phaser so the playable
  // surface follows the active locale instead of falling back to English.
  sceneNoBurns: { en: "No burns yet - ignite first", zh: "暂无燃烧 - 点燃开始" },
  sceneReady: { en: "Ready", zh: "就绪" },
  sceneWalletBurning: { en: "Wallet burn in progress", zh: "钱包燃烧处理中" },
  sceneEndedStatus: {
    en: "Season ended. Settle before the next burn",
    zh: "赛季已结束，结算后再发起燃烧",
  },
  sceneDormantStatus: {
    en: "First burn opens a fresh season",
    zh: "首次燃烧将开启新赛季",
  },
  sceneEmptyStatus: {
    en: "Top burner wins the whole pool",
    zh: "燃烧榜首赢得全部奖池",
  },
  sceneActiveStatus: {
    en: "Burn more GAS to climb the live board",
    zh: "继续燃烧 GAS，攀升实时榜单",
  },
  sceneGuestContinue: {
    en: "Bank the run now, or keep stoking and risk a flare-out",
    zh: "现在收火锁定成绩，或继续添柴并承担爆燃熄灭风险",
  },
  // ── Season length disclosure (read from seasonDuration()) ─────────────
  seasonLengthLabel: { en: "Season length", zh: "赛季时长" },
  durationSeconds: { en: "{count}s", zh: "{count} 秒" },
  durationMinutes: { en: "{count} min", zh: "{count} 分钟" },
  durationHours: { en: "{count}h", zh: "{count} 小时" },
  durationDays: { en: "{count}d", zh: "{count} 天" },
  seasonDurationUnsafe: {
    en: "This network still uses a {duration} demo season. Burns are paused until the daily-season contract is deployed; existing credit can still be withdrawn.",
    zh: "当前网络仍使用 {duration} 的演示赛季，部署日赛合约前已暂停燃烧；已有额度仍可提取。",
  },
  // ── Exit path (withdraw unused deposits or settled winnings) ──────────
  prepaidCreditLabel: { en: "Claimable credit", zh: "可提取额度" },
  prepaidCreditHint: {
    en: "Unused burn deposits and settled winnings live here. Reuse this credit on a burn, or withdraw it now.",
    zh: "未使用的燃烧充值和已结算奖金都会记在这里。可用于下次燃烧，也可立即提取。",
  },
  withdrawCredit: { en: "Withdraw credit", zh: "提取额度" },
  withdrawingCredit: { en: "Withdrawing...", zh: "提取中..." },
  creditWithdrawn: { en: "Withdrew {amount} {tokenGas} claimable credit", zh: "已提取可提取额度 {amount} {tokenGas}" },
  noCredit: { en: "No claimable credit to withdraw", zh: "没有可提取额度" },
  settleBeforeBurn: {
    en: "The season has ended. Settle it before burning into a new season.",
    zh: "赛季已结束。请先结算，再燃烧进入新赛季。",
  },
  burnBlockedSettle: {
    en: "Burning is paused until the ended season is settled.",
    zh: "在已结束的赛季结算之前，燃烧将暂停。",
  },
  burnDepositHeld: {
    en: "Your GAS was deposited as reusable burn credit, but the burn did not complete. Try again — no funds were lost.",
    zh: "你的 GAS 已存入为可复用的燃烧额度，但燃烧未完成。请重试 — 资金未丢失。",
  },
  // ── Real prize model (whole pool → top burner) ────────────────────────
  prizePool: { en: "Prize pool", zh: "奖池" },
  currentLeader: { en: "Current leader", zh: "当前榜首" },
  noLeaderYet: { en: "No burns yet", zh: "暂无燃烧" },
  burnReview: { en: "Burn review checklist", zh: "燃烧确认清单" },
  reviewAmount: { en: "Confirm amount", zh: "确认数量" },
  reviewLeaderboard: { en: "Review rank impact", zh: "检查排名影响" },
  reviewWallet: { en: "Sign wallet intent", zh: "签名钱包意图" },
  resetBurn: { en: "Reset", zh: "重置" },
  points: { en: "GAS", zh: "GAS" },
  burning: { en: "Burning...", zh: "燃烧中..." },
  burn: { en: "Burn Now", zh: "立即燃烧" },
  burnNow: { en: "Burn Now", zh: "立即燃烧" },
  burnActionHint: {
    en: "Burning deposits GAS to the on-chain pool, then records your season total. Review the amount, projected leaderboard impact, and wallet confirmation before signing.",
    zh: "燃烧会将 GAS 存入链上奖池，并记录你的赛季总量。签名前请确认金额、排行榜影响和钱包确认内容。",
  },
  burnPreparing: {
    en: "Preparing a {amount} burn wallet confirmation. Keep this window open while the platform asks for approval.",
    zh: "正在准备 {amount} 燃烧钱包确认。平台请求确认时请保持此窗口打开。",
  },
  burnServiceUnavailableTitle: { en: "Burn league data unavailable", zh: "燃烧联赛数据暂不可用" },
  burnServiceUnavailable: {
    en: "League state cannot be verified, so paid burns are paused. Refresh the arena or play locally.",
    zh: "联赛状态暂时无法验证，付费燃烧已暂停。请刷新竞技场或先进行本地对局。",
  },
  // Player-facing gate on the first scene: say what they can and cannot do
  // here. The contract-binding detail behind it ("not bound to the reviewed
  // Burn League v1.1 deployment") is release vocabulary, not a player's.
  burnDeploymentUnverified: {
    en: "Paid burns are unavailable on this network. Local play is open — your runs stay on this device.",
    zh: "当前网络暂不支持付费燃烧。本地对局仍可进行 — 你的记录保存在本设备。",
  },
  burnActionUnavailable: {
    en: "The burn could not be submitted to the contract. Please try again.",
    zh: "无法将燃烧提交到合约。请重试。",
  },
  burnWalletUnavailable: {
    en: "Connect your wallet to confirm the burn transaction.",
    zh: "请连接钱包以确认燃烧交易。",
  },
  burnSubmitted: {
    en: "Burn confirmed on chain. Refreshing the pool and leaderboard.",
    zh: "燃烧已在链上确认，正在刷新奖池和排行榜。",
  },
  lastSubmitted: {
    en: "Last submitted burn: {amount}",
    zh: "上次提交燃烧：{amount}",
  },
  leaderboard: { en: "Leaderboard", zh: "排行榜" },
  closeDrawer: { en: "Close league drawer", zh: "关闭联赛抽屉" },
  noEntriesTitle: { en: "No leaderboard entries yet", zh: "暂无排行榜记录" },
  noEntries: { en: "Burns appear here with rank and burned GAS as soon as they confirm on chain for this season.", zh: "本赛季的燃烧在链上确认后，会以排名和 GAS 数量显示在这里。" },
  burned: { en: "Burned", zh: "已燃烧" },
  success: { en: "successfully!", zh: "成功！" },
  minBurn: { en: "Minimum burn is {amount} {tokenGas}", zh: "最低燃烧 {amount} {tokenGas}" },
  maxBurn: { en: "Maximum burn is {amount} {tokenGas}", zh: "最高燃烧 {amount} {tokenGas}" },
  missingContract: { en: "Contract not configured", zh: "合约未配置" },
  loadFailed: { en: "Failed to load burn data", zh: "燃烧数据加载失败" },
  docSubtitle: {
    en: "Competitive token burning with seasonal rewards",
    zh: "带有赛季奖励的竞争性代币销毁",
  },
  docDescription: {
    en: "Burn League is an all-pay seasonal contest: burn GAS into the season pool and climb the leaderboard. When the season is settled, ONLY the top burner wins the entire pool — every other burn is forfeited to the pool. It is winner-takes-all, not tiered rewards.",
    zh: "Burn League 是一个全员付费的赛季竞赛：将 GAS 燃烧进赛季奖池并攀登排行榜。赛季结算时，只有燃烧榜首赢得全部奖池——其余所有燃烧都将并入奖池。这是赢者通吃，而非分级奖励。",
  },
  step1: {
    en: "Connect your Neo wallet and join the current season",
    zh: "连接您的 Neo 钱包并加入当前赛季",
  },
  step2: {
    en: "Burn tokens to earn points and climb the leaderboard",
    zh: "销毁代币以赚取积分并攀登排行榜",
  },
  step3: {
    en: "Compete with others for top positions before season ends",
    zh: "在赛季结束前与他人竞争顶级位置",
  },
  step4: {
    en: "When the season ends, the single top burner wins the entire pool — everyone else forfeits their burn",
    zh: "赛季结束时，唯一的燃烧榜首赢得全部奖池——其他人的燃烧都将被没收",
  },
  feature1Name: { en: "Seasonal Competitions", zh: "赛季竞赛" },
  feature1Desc: {
    en: "Time-limited seasons with fresh leaderboards and prize pools.",
    zh: "限时赛季，全新排行榜和奖池。",
  },
  feature2Name: { en: "On-Chain Leaderboard", zh: "链上排行榜" },
  feature2Desc: {
    en: "All burns and rankings are transparently recorded on Neo N3.",
    zh: "所有销毁和排名都透明地记录在 Neo N3 上。",
  },
  feature3Name: { en: "Winner-Takes-All", zh: "赢者通吃" },
  feature3Desc: {
    en: "Only the season's top burner wins the entire pool; all other burns are forfeited to the pool.",
    zh: "只有赛季燃烧榜首赢得全部奖池；其余所有燃烧都将并入奖池。",
  },
  // ── Win / settle celebration ──────────────────────────────────────────
  settleWinTitle: { en: "You won the pool!", zh: "你赢得了奖池！" },
  settleWinBody: {
    en: "The season settled and {amount} was added to your claimable credit. Withdraw it from the league drawer.",
    zh: "赛季已结算，{amount} 已记入你的可提取额度。可在联赛抽屉中提取。",
  },
  settleDoneTitle: { en: "Season settled", zh: "赛季已结算" },
  settleDoneBody: {
    en: "The {amount} pool was credited to the top burner. A fresh season is ready — burn to climb.",
    zh: "{amount} 奖池已记入燃烧榜首的可提取额度。新赛季已就绪 — 燃烧即可攀升。",
  },
  celebrationDismiss: { en: "Continue", zh: "继续" },
  // ── Leader badge (live, active season) ────────────────────────────────
  youLeadBadge: { en: "You're #1 — defend the pool", zh: "你是第一名 — 守住奖池" },
  // ── Honest empty / dormant hero ───────────────────────────────────────
  heroPoolLabel: { en: "Prize pool", zh: "奖池" },
  heroPoolEmptyHint: {
    en: "Be the first burn and open a fresh season.",
    zh: "成为首次燃烧者，开启全新赛季。",
  },
  dashPlaceholder: { en: "—", zh: "—" },
  startTheSeason: { en: "Start the season", zh: "开启赛季" },
  startPool: { en: "Pool opens on first burn", zh: "首次燃烧开启奖池" },
  impactPoolEmptyHint: {
    en: "No live pool yet — your first burn starts the season and fills these in.",
    zh: "暂无进行中的奖池 — 你的首次燃烧将开启赛季并填入这些数据。",
  },
  // ── How burning wins (inline 3-step rhythm) ───────────────────────────
  howItWorks: { en: "How burning wins", zh: "燃烧如何获胜" },
  howStepPick: { en: "Pick an amount", zh: "选择燃烧数量" },
  howStepBurn: { en: "Burn into the pool", zh: "燃烧进奖池" },
  howStepClimb: { en: "Climb the leaderboard", zh: "攀登排行榜" },
  howStepWin: { en: "Top burner takes it all", zh: "燃烧榜首赢得全部" },
  tieRule: {
    en: "Ties keep the current leader — first to the total stays ahead",
    zh: "总量相同时当前榜首保持领先 — 先达到者优先",
  },
  // App-specific sidebar keys
  ariaLeaderboard: { en: "Leaderboard", zh: "排行榜" },
  sidebarRank: { en: "Rank", zh: "排名" },
  sidebarBurns: { en: "Burns", zh: "燃烧次数" },
  sidebarRewardPool: { en: "Reward Pool", zh: "奖励池" },
  gasSuffix: { en: "GAS", zh: "GAS" },
  rankGold: { en: "1st place", zh: "第一名" },
  rankSilver: { en: "2nd place", zh: "第二名" },
  rankBronze: { en: "3rd place", zh: "第三名" },

  // ── Guest (local) mode — a local burn-streak game, NO GAS / pool / reward ──
  // framing. All copy avoids on-chain / stake language.
  guestEyebrow: { en: "Local run", zh: "本地对局" },
  guestStageTitle: { en: "Stoke the fire", zh: "添柴燃烧" },
  guestSubtitle: {
    en: "A local burn-streak challenge — push your heat, bank it before the fire flares out.",
    zh: "本地热度连击挑战——尽情累积热度，在炉火熄灭前记入成绩。",
  },
  guestBest: { en: "Best banked", zh: "最佳锁定热度" },
  guestRun: { en: "This run", zh: "本轮热度" },
  guestTopRun: { en: "Top run", zh: "最高热度" },
  guestStreakLabel: { en: "Streak", zh: "连击" },
  guestStreakBadge: { en: "Streak x{streak}", zh: "连击 x{streak}" },
  guestStokeVerb: { en: "Stoke", zh: "添柴" },
  guestHeatUnit: { en: "heat", zh: "热度" },
  guestBoardTitle: { en: "Local runs", zh: "本地榜单" },
  guestNoRuns: { en: "No runs yet - stoke to start", zh: "还没有记录 - 添柴开始" },
  guestYouTag: { en: "you", zh: "你" },
  guestSummaryTitle: { en: "Local burn streak", zh: "本地热度连击" },
  guestSummaryLine: {
    en: "Every stoke rolls a local heat bonus. Bank safely, or push the streak and risk losing the unbanked heat.",
    zh: "每次添柴都会掷出本地热度加成。可主动收火记分，也可继续连击并承担损失未记热度的风险。",
  },
  guestHowTitle: { en: "How the streak works", zh: "连击玩法" },
  guestStepPick: { en: "Pick a fuel load", zh: "选择燃料量" },
  guestStepStoke: { en: "Stoke the fire for RNG heat", zh: "添柴获得随机热度" },
  guestStepStreak: { en: "Chain stokes to grow the streak", zh: "连续添柴提升连击" },
  guestStepBank: { en: "Bank before a flare-out to lock the run on the local board", zh: "在爆燃熄灭前主动收火，将本轮锁定到本地榜单" },
  guestBankAction: { en: "Bank run", zh: "收火记分" },
  guestBanked: {
    en: "Banked {score} heat after a x{streak} streak - fresh fire ready.",
    zh: "已在 x{streak} 连击后锁定 {score} 热度——新一轮炉火已就绪。",
  },
  guestNextStoke: { en: "Next stoke", zh: "下次添柴" },
  guestIntro: {
    en: "Stoke the fire to build a heat streak — the local board is yours to top.",
    zh: "点燃炉火，累积热度连击——本地榜单等你登顶。",
  },
  guestStoking: { en: "Stoking the fire...", zh: "正在添柴..." },
  guestStoked: { en: "+{gained} heat - streak x{streak}", zh: "+{gained} 热度 - 连击 x{streak}" },
  guestSurge: { en: "Surge! +{gained} heat - streak x{streak}", zh: "爆燃！+{gained} 热度 - 连击 x{streak}" },
  guestFlareOut: {
    en: "Flare-out after {streak} stokes - {score} unbanked heat lost. Fresh fire ready.",
    zh: "连击 {streak} 次后爆燃熄灭——损失 {score} 未锁定热度，新一轮炉火已就绪。",
  },
  guestFuelInvalid: { en: "Choose a fuel load between {min} and {max}.", zh: "请选择 {min} 到 {max} 之间的燃料量。" },
  guestSecureRandomUnavailable: {
    en: "Secure randomness is unavailable. Your run is unchanged; retry in a supported browser.",
    zh: "安全随机数暂不可用。本轮进度未改变，请在受支持的浏览器中重试。",
  },
  continue: { en: "Continue", zh: "继续" },
  gameActionFailed: {
    en: "The burn arena could not continue",
    zh: "燃烧竞技场暂时无法继续",
  },
  enableGameSound: { en: "Enable game sound", zh: "开启游戏声音" },
  muteGameSound: { en: "Mute game sound", zh: "关闭游戏声音" },
} as const;

export const messages = mergeMessages(appMessages);
