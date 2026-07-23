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
  // Chrome pendingKey: the stat rail / sidebar value is still being read.
  statAwaitingRead: { en: "Reading…", zh: "读取中…" },
  // Settled ranking with no board position (always so in local guest play).
  // A real reading — never "0", which is not a rank.
  rankUnranked: { en: "Unranked", zh: "未上榜" },
  sidebarTitle: { en: "My jumping record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },
  poolShort: { en: "Pool", zh: "奖池" },
  creditShort: { en: "Credit", zh: "余额" },

  difficultyTitle: { en: "Jump route", zh: "跳跃路线" },
  /**
   * Launcher chips. They previously reused `guestModeValue` and
   * `gameplayFeatureTitle`, which the hero badge and the features header
   * already render — "Local" appeared three times and "A real platform-jumping
   * game" twice on one screen. Insisting a game is "a real game" also reads as
   * a defence rather than a feature. These name what the player actually does.
   */
  controlBadge: { en: "Hold and release to jump", zh: "按住蓄力，松手起跳" },
  recoveryBadge: { en: "Recover from a miss", zh: "落空可恢复" },
  gameplayFeatureTitle: { en: "A real platform-jumping game", zh: "真正的平台跳跃游戏" },
  gameplayFeatureCopy: {
    en: "Guide an illustrated bunny across grass islands, learn each gap through hold-and-release power, chase center landings, collect the golden carrot, and recover from a miss without leaving the arena.",
    zh: "操控插画小兔越过草地浮岛，用按住蓄力、松手起跳掌握每段距离，追求中心着陆，收集金色胡萝卜；落空后也能在场内恢复。",
  },
  guestStartDescription: {
    en: "Choose Meadow, Cloud, or Summit and jump straight into free local play. No wallet prompt, no token entry, and no chain write.",
    zh: "选择草地、云端或山巅路线，立即开始免费本地游玩。无需连接钱包、无需代币报名，也不会写入链上。",
  },
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
  drawerSummaryLabel: { en: "Jump Rush account summary", zh: "跳一跳账户摘要" },
  moreActions: { en: "More", zh: "更多" },
  activeRunTitle: { en: "Active run", zh: "当前路线" },
  nextRunTitle: { en: "Next run", zh: "下一局路线" },
  runEconomyLine: {
    en: "Entry {entry} GAS · prize {reward} GAS",
    zh: "报名 {entry} GAS · 奖励 {reward} GAS",
  },
  lastRunLine: {
    en: "Last verified: {payout} in {time}",
    zh: "上局已验证：{payout}，用时 {time}",
  },
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
    en: "1. Pick a jump route and pay the entry (Meadow 0.02, Cloud 0.10, Summit 0.20 GAS). 2. The Morpheus enclave generates a deterministic platform layout for the shared PlatformGame session. 3. Hold to charge power, release to jump. Land on the center 30% of each platform for a Perfect! bonus. Missing a platform ends the run. 4. Reach the target number of jumps before the deadline to win. Paid runs do not allow undo. 5. Finalization seals the operation log; the kernel replays it in the reviewed engine before PlatformGame credits any payout.",
    zh: "1. 选择跳跃路线并支付报名费（草地 0.02、云端 0.10、山巅 0.20 GAS）。2. Morpheus 飞地为共享 PlatformGame 会话生成确定性平台布局。3. 按住蓄力，松开跳跃。落在平台中间 30% 区域可获得「完美着陆」加分。未踩中平台则游戏结束。4. 在截止时间前达到目标跳跃次数即可获胜；付费模式不允许撤回。5. 结算时操作日志会被密封，内核使用已审核引擎重放验证后，PlatformGame 才会入账奖励。",
  },
  fairnessTitle: { en: "Provably fair platforms", zh: "可验证公平布局" },
  fairnessCopy: {
    en: "The platform layout is generated inside the Morpheus TEE from a per-game secret. Each input is recorded in the generic confidential session. At finalization the operation log is sealed to the oracle, replayed by the reviewed engine, and delivered through the kernel callback; PlatformGame credits a payout only after that callback passes its app, player, timing, and score checks.",
    zh: "平台布局由 Morpheus TEE 使用每局独立密钥生成，每次输入都记录在通用机密会话中。结算时操作日志会密封给预言机，由已审核引擎重放，并通过内核回调返回；只有应用、玩家、时限与得分校验全部通过后，PlatformGame 才会入账奖励。",
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
  statusSettlementPending: {
    en: "Settlement is still pending — keep this run open and check again shortly.",
    zh: "结算仍在确认中——请保留本局并稍后再次检查。",
  },
  statusSolved: { en: "Run verified! {payout} GAS credited", zh: "成绩验证通过！已入账 {payout} GAS" },
  statusUndoUsed: { en: "Undo recorded — reward now {pct}%", zh: "撤回已记录——奖励降至 {pct}%" },
  undoLimitReached: { en: "No undos left for this run", zh: "本局撤回次数已用完" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusBoardIncomplete: { en: "Target jumps not reached yet", zh: "尚未达到目标跳跃次数" },
  statusPoolLow: {
    en: "Pool refilling for this route",
    zh: "该路线奖池补充中",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  statusInputSyncFailed: {
    en: "Jump verification paused — retry after the session reconnects",
    zh: "跳跃验证已暂停——会话恢复后再试",
  },
  statusReleasePending: {
    en: "This run is still inside the contract recovery window",
    zh: "本局仍处于合约恢复等待期",
  },
  paidModeUnavailable: {
    en: "Wallet rewards are in maintenance; free local play is ready.",
    zh: "钱包奖励功能维护中；可继续免费本地游玩。",
  },
  statusMissed: { en: "You missed the platform!", zh: "没踩中平台！" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  perfectLanding: { en: "Perfect!", zh: "完美着陆" },
  comboMultiplier: { en: "{x}x combo", zh: "{x}倍连击" },
  chargeHint: { en: "Hold to charge, release to jump", zh: "按住蓄力，松开跳跃" },
  jumpsCount: { en: "{count} platforms", zh: "{count}个平台" },
  targetJumps: { en: "Target: {count}", zh: "目标: {count}次" },

  // ── In-canvas (Phaser) strings — routed to the scene via bridgeState so the
  //    canvas honors the active locale instead of hardcoding English. ──────────
  chargeHold: { en: "Hold — release in the gold band", zh: "按住蓄力——在金色区间松手" },
  chargeRelease: { en: "Release to jump", zh: "松开跳跃" },
  submitSettleHint: { en: "TEE settlement", zh: "TEE 结算" },
  submitVerifiedHint: { en: "Verified payout", zh: "已验证奖励" },
  timeExpiredLabel: { en: "Time expired", zh: "时间已到" },
  releaseThisRun: { en: "Release this run", zh: "结算本局" },
  waitLabel: { en: "Wait {clock}", zh: "等待 {clock}" },
  antiBotFloor: { en: "Anti-bot floor", zh: "防脚本下限" },
  recoveryWindow: { en: "Contract recovery window", zh: "合约恢复等待期" },
  keepJumping: { en: "Keep jumping", zh: "继续跳跃" },
  targetNotCleared: { en: "Target not cleared", zh: "尚未通关" },
  startJump: { en: "Start jump", zh: "开始跳跃" },
  preparingLabel: { en: "Preparing…", zh: "准备中…" },
  startSealHint: { en: "Pay entry and seal route", zh: "支付报名并密封路线" },
  loadingRouteHint: { en: "Loading route…", zh: "路线加载中…" },
  preparingPlatforms: { en: "Preparing platforms", zh: "正在准备平台" },
  sealingFairRoute: { en: "TEE is sealing a fair route", zh: "TEE 正在密封公平路线" },
  missedTitle: { en: "Missed the platform", zh: "没踩中平台" },
  missedCopy: { en: "Use an undo or wait for expiry.", zh: "使用撤回或等待过期。" },
  clearedTitle: { en: "Route cleared!", zh: "路线通关！" },
  undoLeftLabel: { en: "Undo ({n} left)", zh: "撤回（剩 {n} 次）" },
  noUndosLabel: { en: "No undos left", zh: "撤回次数已用完" },
  cardJumps: { en: "{count} jumps", zh: "{count} 跳" },
  cardReward: { en: "{amount} GAS", zh: "{amount} GAS" },
  cardEntry: { en: "Entry {amount}", zh: "报名 {amount}" },

  // ── Guest (free / local) mode copy — shown only when app.mode is "guest".
  //    Guest has no token, so it never uses GAS / pool / reward framing. ────────
  guestSubtitle: {
    en: "Hold, jump, land clean, and clear the local route. Free practice — no GAS.",
    zh: "按住蓄力，精准跳跃，完成本地路线。免费练习——无需 GAS。",
  },
  guestJumpsValue: { en: "{count} jumps", zh: "{count} 跳" },
  guestBestLabel: { en: "Best run", zh: "最佳" },
  /**
   * Honest zero-state for the guest best-run readouts. The guest best is read
   * synchronously from the local profile, so a zero is settled fact ("you have
   * not finished a run"), never a read still in flight — hence plain copy and
   * no skeleton. Replaces a bare "--" that read as a broken tile on first entry.
   */
  guestBestEmpty: { en: "No runs yet", zh: "暂无记录" },
  guestRouteLabel: { en: "Route", zh: "路线" },
  guestJumpsLabel: { en: "Jumps", zh: "跳跃" },
  guestModeLabel: { en: "Mode", zh: "模式" },
  guestModeValue: { en: "Local", zh: "本地" },
  guestRunsLabel: { en: "Runs", zh: "局数" },
  guestRunEconomyLine: {
    en: "Free local run · clear {jumps} jumps",
    zh: "本地免费对局 · 通关 {jumps} 跳",
  },
  guestLastRunLine: {
    en: "Last local run: {count} jumps in {time}",
    zh: "上局本地：{count} 跳，用时 {time}",
  },
  guestLeaderboardIntro: {
    en: "Local practice scores, saved to an off-chain board — no GAS, no chain.",
    zh: "本地练习成绩，保存在离线榜单——无 GAS、不上链。",
  },
  guestGuideTitle: { en: "Local practice", zh: "本地练习" },
  guestRulesCopy: {
    en: "Pick a route, hold to charge, and release to jump. Land on each platform to clear the route. A miss pauses the run: use an undo to retry, or end and restart after your undos are used. Everything runs locally — no entry, no GAS, nothing on-chain.",
    zh: "选择路线，按住蓄力，松开跳跃。落在每个平台上即可推进路线。落空会暂停本局：可使用撤回重试；撤回用尽后结束并重新开局。全部在本地运行——无报名费、无 GAS、不涉及链上。",
  },
  guestModeLine: {
    en: "Guest mode — local play, scores saved off-chain.",
    zh: "游客模式——本地游玩，成绩离线保存。",
  },
  guestRunComplete: { en: "Local run complete — {count} jumps cleared!", zh: "本地对局完成——通关 {count} 跳！" },
  guestStatusReady: { en: "Pick a route to start a local run", zh: "选择路线开始本地对局" },
  guestStatusStarting: { en: "Building your local route…", zh: "正在生成本地路线…" },
  guestStatusDealt: { en: "Local route ready — jump!", zh: "本地路线就绪——开跳！" },
  guestRunRecovered: { en: "Local run restored — keep jumping!", zh: "已恢复本地对局——继续跳！" },
  guestRandomUnavailable: {
    en: "Local route generation is unavailable — reload and try again.",
    zh: "暂时无法生成本地路线——请刷新后重试。",
  },
  guestStatusUndo: { en: "Undo used — {left} left", zh: "已撤回——剩 {left} 次" },
  // In-canvas (scene) guest overrides, routed through sceneText under the SAME
  // keys the scene reads, so the canvas swaps GAS/TEE framing for local framing.
  guestStartHint: { en: "Start a local run", zh: "开始本地对局" },
  guestSubmitHint: { en: "Local score", zh: "本地成绩" },
  guestSubmitDoneHint: { en: "Saved off-chain", zh: "离线保存" },
  guestBuildingTitle: { en: "Building route", zh: "正在生成路线" },
  guestBuildingHint: { en: "Laying out your local route", zh: "正在铺设本地路线" },
  guestReadyHint: { en: "Ready to jump", zh: "准备起跳" },
  guestMissedCopy: { en: "Use an undo to retry, or end this run when none remain.", zh: "使用撤回重试；次数用尽后可结束本局。" },
  guestEndRun: { en: "End this run", zh: "结束本局" },
  guestCardReward: { en: "Free play", zh: "免费畅玩" },
  guestCardEntry: { en: "Local run", zh: "本地对局" },

  // Runtime and semantic controls. These mirror the illustrated Phaser
  // surface without adding a visible form layer over the game.
  gameAriaLabel: { en: "Jump Rush illustrated platform-jumping game", zh: "跳一跳插画平台跳跃游戏" },
  gameLoadingLabel: { en: "Loading the jump arena", zh: "正在加载跳跃竞技场" },
  continue: { en: "Continue", zh: "继续" },
  gameActionFailed: { en: "The game surface could not start", zh: "游戏场景启动失败" },
  enableGameSound: { en: "Enable game sound", zh: "开启游戏声音" },
  muteGameSound: { en: "Mute game sound", zh: "关闭游戏声音" },
  closeDrawer: { en: "Close leaderboard and rules", zh: "关闭排行榜与规则" },
  a11yDifficultyGroup: { en: "Choose a jump route", zh: "选择跳跃路线" },
  a11yDifficultyDetail: { en: "{count} platforms to clear", zh: "需要通过 {count} 个平台" },
  a11yStartRoute: { en: "Start selected route", zh: "开始所选路线" },
  a11yChargePower: { en: "Jump power {power} percent", zh: "跳跃力度 {power}%" },
  a11yJumpAtPower: { en: "Jump at {power} percent power", zh: "以 {power}% 力度起跳" },
  a11yUndoJump: { en: "Undo missed jump, {count} left", zh: "撤回落空跳跃，剩 {count} 次" },
  a11yEndRun: { en: "End this run", zh: "结束本局" },
  a11ySubmitRun: { en: "Save cleared route", zh: "保存通关成绩" },
};

export const messages = mergeMessages(appMessages);
