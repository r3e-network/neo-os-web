import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appEyebrow: { en: "Merge Kingdom", zh: "合并王国" },
  appTitle: { en: "Merge Kingdom", zh: "合并王国" },
  appSubtitle: {
    en: "Merge buildings into the crown before the clock runs out.",
    zh: "在倒计时结束前，把建筑合并成王冠。",
  },
  playTab: { en: "Play", zh: "对局" },
  ranksTab: { en: "Ranks", zh: "排行" },
  lobbyTitle: { en: "Build the kingdom", zh: "建造你的王国" },
  gameTitle: { en: "Kingdom board", zh: "王国棋盘" },
  playingTitle: { en: "{difficulty} merge in play", zh: "{difficulty}合并进行中" },
  statusWonTitle: { en: "Kingdom merged!", zh: "王国合并！" },
  networkBadge: { en: "Neo N3", zh: "Neo N3" },
  rankBadge: { en: "Rank #{rank}", zh: "第 {rank} 名" },
  rankLabel: { en: "Global rank", zh: "全网排名" },
  sidebarTitle: { en: "My merge record", zh: "我的战绩" },
  creditLabel: { en: "Withdrawable credit", zh: "可提取余额" },

  // Phaser scene copy. Keep gameplay text in the locale catalog so the canvas
  // never leaks translation keys or falls back to mixed-language UI.
  canvasEyebrow: { en: "Verified merge quest", zh: "可验证合并挑战" },
  /**
   * Guest twin of `canvasEyebrow`. A local run is never verified on chain, so
   * the GameFi "Verified" framing contradicted every other label on the same
   * screen ("Local run", "Free practice", "no wallet, fees, or GAS at stake").
   * The tagline below already had this guest/gamefi split; the eyebrow was
   * simply missed when it was added.
   */
  canvasGuestEyebrow: { en: "Local merge practice", zh: "本地合并练习" },
  canvasTagline: {
    en: "Move, merge, and raise the target building.",
    zh: "移动并合并建筑，升级到本局目标。",
  },
  canvasGuestTagline: {
    en: "Build freely and save your best local kingdom.",
    zh: "自由建造，保存你的本地最高王国。",
  },
  canvasRouteTitle: {
    en: "{difficulty} realm",
    zh: "{difficulty}王国",
  },
  canvasReachTarget: {
    en: "Raise {building} before time runs out",
    zh: "在倒计时结束前升级到 {building}",
  },
  canvasCardTarget: { en: "Target: {building}", zh: "目标：{building}" },
  canvasFreePractice: { en: "Free practice", zh: "免费练习" },
  canvasBuildRealm: { en: "Build realm", zh: "开始建造" },
  canvasConnectWallet: { en: "Connect wallet", zh: "连接钱包" },
  canvasConnectingWallet: { en: "Connecting…", zh: "正在连接…" },
  canvasBuilding: { en: "Building…", zh: "正在建造…" },
  canvasLocalPracticeStatus: {
    en: "Local practice — no wallet, fees, or GAS at stake",
    zh: "本地练习——无需钱包、费用或 GAS",
  },
  canvasConnectStatus: {
    en: "Connect once; the next press confirms the entry",
    zh: "先连接钱包，再确认本局报名",
  },
  canvasPoolLow: {
    en: "Pool low ({pool} GAS available)",
    zh: "奖池不足（可用 {pool} GAS）",
  },
  canvasEntryReward: {
    en: "Entry {entry} GAS · Reward {reward} GAS",
    zh: "报名 {entry} GAS · 奖励 {reward} GAS",
  },
  canvasTimeLimit: { en: "{minutes} min limit", zh: "限时 {minutes} 分钟" },
  canvasSecondsLimit: { en: "{seconds} sec limit", zh: "限时 {seconds} 秒" },
  canvasPreparing: { en: "Preparing your kingdom…", zh: "正在准备你的王国…" },
  canvasSealing: { en: "Sealing the realm board…", zh: "正在密封王国棋盘…" },
  canvasOpening: { en: "Opening the kingdom gate…", zh: "正在开启王国大门…" },
  canvasSettlementTitle: { en: "Settlement pending", zh: "结算处理中" },
  canvasSettlementHint: {
    en: "Waiting for the verified oracle callback",
    zh: "正在等待可验证预言机回调",
  },
  canvasTime: { en: "Time", zh: "时间" },
  canvasTarget: { en: "Target: {current} / {target}", zh: "目标：{current} / {target}" },
  canvasMoves: { en: "Moves: {count}", zh: "步数：{count}" },
  canvasBest: { en: "Best: {tile}", zh: "最高：{tile}" },
  canvasBestUnset: { en: "Best: —", zh: "最高：—" },
  canvasSelectTile: {
    en: "Tap or drag a building · arrow keys also work",
    zh: "点击或拖动建筑；也可使用方向键",
  },
  canvasSelectDestination: {
    en: "Tap, swipe, or press an arrow toward a neighbour",
    zh: "点击、滑动或按方向键移向相邻格",
  },
  canvasMoving: { en: "Revealing this move…", zh: "正在确认这一步…" },
  statusInputSyncFailed: {
    en: "Move sync paused — use recovery in the rules drawer",
    zh: "移动同步暂停——请在规则抽屉中恢复对局",
  },
  canvasTargetReached: { en: "Target reached!", zh: "目标达成！" },
  canvasFinishLocal: { en: "Finish your local run", zh: "完成本地对局" },
  canvasProofWarming: {
    en: "Verified claim unlocks in {time}",
    zh: "可验证领取将在 {time} 后开放",
  },
  canvasPlayAgain: { en: "Play again", zh: "再玩一局" },
  canvasBuildNext: { en: "Build next realm", zh: "建造下一座王国" },
  canvasGuestVictory: { en: "Kingdom raised!", zh: "王国建成！" },
  canvasVictory: { en: "Victory!", zh: "胜利！" },
  canvasRunOver: { en: "Run over", zh: "对局结束" },
  canvasTimeUp: { en: "Time's up", zh: "时间到" },
  canvasLocalSaved: { en: "Local run saved", zh: "本地成绩已保存" },
  canvasReward: { en: "Reward: {amount} GAS", zh: "奖励：{amount} GAS" },
  canvasBestTile: { en: "Best building: {tile}", zh: "最高建筑：{tile}" },
  gameAriaLabel: { en: "Merge Kingdom board game", zh: "合并王国棋盘游戏" },
  gameLoadingLabel: { en: "Opening kingdom board", zh: "正在打开王国棋盘" },
  a11yControlsLabel: { en: "Accessible kingdom controls", zh: "王国无障碍操作" },
  a11yBoardLabel: { en: "Four by four kingdom board", zh: "四乘四王国棋盘" },
  a11yStartRun: { en: "Start {difficulty} local kingdom", zh: "开始{difficulty}本地王国" },
  a11ySelected: { en: "Selected. Choose an adjacent destination.", zh: "已选中，请选择相邻目标格。" },
  a11yMoveRejected: { en: "That building cannot move there.", zh: "该建筑无法移动到那里。" },
  closeDrawer: { en: "Close leaderboard and rules", zh: "关闭排行榜与规则" },
  recoveryActionsLabel: { en: "Game recovery actions", zh: "对局恢复操作" },
  checkingSettlement: { en: "Checking settlement…", zh: "正在检查结算…" },
  checkSettlementAction: { en: "Check settlement", zh: "检查结算" },
  checkSettlementHint: {
    en: "Re-check the exact active game without creating another entry.",
    zh: "仅重新检查当前对局，不会重复报名。",
  },
  recoverRunAction: { en: "Recover active run", zh: "恢复当前对局" },
  recoveryHint: {
    en: "Recovery reads the authoritative active game before enabling another move.",
    zh: "恢复会先读取权威对局状态，再允许继续移动。",
  },
  statusSettlementPending: { en: "Settlement pending", zh: "结算处理中" },
  gameFiMaintenanceShort: { en: "GameFi entry paused", zh: "GameFi 报名暂停" },
  gameFiMaintenanceBody: {
    en: "Free local play is open. New GAS entries stay paused until the reward pool, oracle callback allowlist, and full testnet settlement flow are verified.",
    zh: "免费本地玩法已开放。奖励池、预言机回调白名单和完整测试网结算流程验证前，新的 GAS 报名保持暂停。",
  },

  difficultyTitle: { en: "Kingdom route", zh: "王国路线" },
  difficulty_easy: { en: "Easy", zh: "简单" },
  difficulty_medium: { en: "Medium", zh: "中等" },
  difficulty_hard: { en: "Hard", zh: "困难" },
  lobbyPreviewLabel: { en: "{difficulty} board preview", zh: "{difficulty}棋盘预览" },
  lobbyQuest: { en: "Merge to {tile}; win {reward} GAS.", zh: "合并到 {tile}，赢 {reward} GAS。" },
  routeGoal: { en: "Reach {tile}", zh: "冲到 {tile}" },
  winAmount: { en: "Win {amount} GAS", zh: "赢 {amount} GAS" },
  entryAmount: { en: "Entry {amount} GAS", zh: "报名 {amount} GAS" },
  entryLabel: { en: "Entry", zh: "报名" },
  timeLimitLabel: { en: "Time", zh: "时限" },
  timeAmount: { en: "{minutes} min", zh: "{minutes} 分钟" },
  poolLine: { en: "Reward pool: {pool} GAS available", zh: "奖池可用：{pool} GAS" },
  creditLine: { en: "your credit {credit} GAS", zh: "你的余额 {credit} GAS" },
  walletRequiredStatus: {
    en: "Connect wallet to start",
    zh: "连接钱包后开始",
  },

  startAction: { en: "Start game", zh: "开始对局" },
  startHint: { en: "Entry {amount} GAS — deposited with this transaction", zh: "报名费 {amount} GAS——随本交易一并存入" },
  startDescription: {
    en: "Pay the entry and the Morpheus enclave generates a secret board with initial tiles — only its hash commitment goes on-chain. Easy pays 0.1 GAS, Medium 0.5, Hard 1.",
    zh: "支付报名费后，Morpheus 飞地生成秘密初始棋盘——链上只记录哈希承诺。简单赢 0.1 GAS，中等 0.5，困难 1。",
  },

  tileScore: { en: "Highest tile", zh: "最高方块" },
  tileTarget: { en: "Target: {tile}", zh: "目标：{tile}" },
  tileAchieved: { en: "Achieved: {tile}", zh: "已达：{tile}" },
  srTargetBarLabel: { en: "Progress toward tile {tile}", zh: "冲向 {tile} 的进度" },
  srTargetReached: { en: "Target tile {tile} reached", zh: "已达成目标方块 {tile}" },
  srTimeLow: { en: "Less than 30 seconds left", zh: "剩余时间不足 30 秒" },
  srTimerBarLabel: { en: "Time remaining", zh: "剩余时间" },
  tileEmpty: { en: "Empty cell, row {row}, column {col}", zh: "空格，第 {row} 行第 {col} 列" },
  tileOccupied: {
    en: "{name}, row {row}, column {col}",
    zh: "{name}，第 {row} 行第 {col} 列",
  },
  movesCount: { en: "Moves: {n}", zh: "步数：{n}" },
  mergeBonus: { en: "Merge!", zh: "合并！" },
  selectTile: { en: "Select a tile to move", zh: "选择一个要移动的方块" },
  selectedTile: { en: "Tap destination to move or merge", zh: "点击目标位置进行移动或合并" },

  submitAction: { en: "Claim reward", zh: "领取奖励" },
  submitHint: { en: "Target tile reached — claim before the deadline", zh: "已达目标方块——在截止前领取奖励" },
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
  scoreTile: { en: "Highest tile", zh: "最高方块" },
  scoreWon: { en: "Total won", zh: "累计赢取" },

  drawerTitle: { en: "Leaderboard & rules", zh: "排行榜与规则" },
  drawerSummaryLabel: { en: "Merge Kingdom player summary", zh: "合并王国玩家摘要" },
  moreActions: { en: "More actions", zh: "更多操作" },
  poolLabel: { en: "Reward pool", zh: "奖励池" },
  activeRouteLine: {
    en: "{route} route · {moves} moves · target {target} · {time}",
    zh: "{route}路线 · {moves} 步 · 目标 {target} · {time}",
  },
  lastResultLine: {
    en: "Last settlement: {payout} · {time}",
    zh: "上次结算：{payout} · {time}",
  },
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
  historyEmpty: { en: "Your completed merges will appear here.", zh: "你完成的合并记录会显示在这里。" },

  rulesTitle: { en: "How it works", zh: "玩法说明" },
  rulesCopy: {
    en: "The dormant GameFi route uses the same building rules as local play: move a building to an adjacent empty plot or merge matching neighbours to raise the next tier. Its TEE session is designed to reveal each fresh resource one move at a time and verify the final target before settlement. New paid entries remain unavailable until the deployed pool and callback route pass the complete testnet flow.",
    zh: "暂未开放的 GameFi 路线与本地玩法使用同一套建筑规则：把建筑移到相邻空地，或合并相邻的相同建筑以升级到下一阶。TEE 会话计划逐步揭示每次生成的新资源，并在结算前验证最终目标。部署的奖励池与回调路线完成整套测试网验证前，新的付费报名保持关闭。",
  },
  fairnessTitle: { en: "Provably fair boards", zh: "可验证公平棋盘" },
  fairnessCopy: {
    en: "The initial board is generated inside the Morpheus TEE from a per-game secret: only its SHA-256 commitment is bound on-chain at the start, so the board cannot be extracted or scripted outside the app. At settlement the enclave signs the result (problem hash, answer hash, time, highest tile achieved) and the contract verifies both the signature and that the problem hash equals the original commitment before paying. The TEE validates every move and ensures no tile tampering is possible.",
    zh: "初始棋盘由 Morpheus TEE 用每局独立的密钥在飞地内生成：开局时链上只绑定其 SHA-256 承诺，因此棋盘无法被提取、也无法在平台之外用脚本破解。结算时飞地对结果（问题哈希、答案哈希、用时、已达成最高方块）签名，合约先核验签名、再核验问题哈希与开局承诺一致后才发奖。TEE 验证每个移动，确保方块不可篡改。",
  },
  commitmentLine: {
    en: "Game #{gameId} · sealed commitment {commitment}",
    zh: "对局 #{gameId} · 密封承诺 {commitment}",
  },

  statusReady: { en: "Choose a kingdom route to start", zh: "选择一条王国路线即可开始" },
  statusStarting: { en: "Paying entry and starting…", zh: "正在支付报名费并开局…" },
  statusStarted: { en: "Game started — sealing the board", zh: "对局已开始——正在密封棋盘" },
  statusShuffling: { en: "Creating your board in the enclave…", zh: "正在飞地中创建棋盘…" },
  checkDealAgain: { en: "Retry", zh: "重试" },
  statusSealing: { en: "Sealing your board in the enclave…", zh: "正在飞地中密封棋盘…" },
  statusDealt: { en: "Board sealed and bound — the clock is running", zh: "棋盘已密封上链——计时开始" },
  statusDealPending: {
    en: "Sealing is taking longer than usual — retry shortly.",
    zh: "密封比平时慢——请稍后重试。",
  },
  statusSubmitting: { en: "Enclave verifying — settling on-chain…", zh: "飞地验证中——正在链上结算…" },
  statusSolved: { en: "Kingdom merged! {payout} GAS credited", zh: "王国合并！已入账 {payout} GAS" },
  statusExpired: { en: "Game released", zh: "对局已结算" },
  statusPoolLow: {
    en: "The reward pool cannot cover this difficulty right now",
    zh: "奖池暂时无法覆盖该难度的奖励",
  },
  statusMoveRejected: {
    en: "That building move was rejected. Recover the active run before trying again.",
    zh: "该建筑移动未通过验证，请先恢复当前对局再重试。",
  },
  invalidBoardState: {
    en: "The verified board response was invalid. This run is paused for safe recovery.",
    zh: "可验证棋盘响应无效，当前对局已暂停并等待安全恢复。",
  },
  walletConnectedReady: {
    en: "Wallet connected. Your historical GameFi runs are ready to recover.",
    zh: "钱包已连接，可以恢复历史 GameFi 对局。",
  },
  walletUnavailable: {
    en: "The wallet did not connect. Free local play is still available.",
    zh: "钱包未连接，仍可继续免费本地游玩。",
  },
  statusFailed: { en: "Something went wrong", zh: "操作失败" },
  noCreditToWithdraw: { en: "No credit to withdraw", zh: "暂无可提取余额" },
  creditWithdrawn: { en: "Credit withdrawn to your wallet", zh: "余额已提回钱包" },

  // ── Guest (free / local) mode ─────────────────────────────────────────────
  // GUEST is a purely local merge puzzle: no wallet, no fees, no chain/oracle/
  // reward. These strings replace the GAS-at-stake / pool / reward framing so
  // guest carries only local practice framing.
  guestModeLine: {
    en: "Guest mode — local play with on-device progress recovery.",
    zh: "游客模式——本地游玩，并可在本设备恢复进度。",
  },
  guestRunLabel: { en: "Local run", zh: "本地对局" },
  guestRunValue: { en: "Free play", zh: "自由练习" },
  guestBestLabel: { en: "Best building", zh: "最高建筑" },
  guestScoreLabel: { en: "Local best", zh: "本地最高" },
  guestClearsLabel: { en: "Routes cleared", zh: "通关路线" },
  guestClearsCount: { en: "{count} clears", zh: "通关 {count} 次" },
  guestHistoryWon: { en: "Cleared", zh: "已通关" },
  guestHistoryFinished: { en: "Finished", zh: "已结束" },
  guestStartHint: {
    en: "Free local run — no wallet or entry needed",
    zh: "免费本地对局——无需钱包或报名费",
  },
  guestRoutesCopy: {
    en: "Choose a 45, 60, or 90 second route. Raise a Watchtower, Market, or Forge before the clock closes.",
    zh: "选择 45、60 或 90 秒路线，在倒计时结束前升级到瞭望塔、集市或锻造坊。",
  },
  guestLeaderboardCopy: {
    en: "Your strongest finished building becomes the score. The active kingdom and recent results persist on this device; the practice ranking never represents GAS winnings.",
    zh: "已完成对局中的最高建筑会成为分数；当前王国与最近结果保存在本设备，练习排行不代表 GAS 奖励。",
  },
  guestSubmitAction: { en: "Finish run", zh: "结束对局" },
  guestSubmitHint: {
    en: "Target tile reached — save your local run",
    zh: "已达目标方块——保存本地对局",
  },
  guestRunComplete: {
    en: "Local run complete — raised tile {tile}!",
    zh: "本地对局完成——达成方块 {tile}！",
  },
  guestRunStarted: {
    en: "Kingdom opened — merge matching buildings before the clock closes.",
    zh: "王国已开启——在倒计时结束前合并相同建筑。",
  },
  guestRunRecovered: {
    en: "Your unfinished local kingdom was restored on this device.",
    zh: "已在本设备恢复未完成的本地王国。",
  },
  secureRandomUnavailable: {
    en: "This browser cannot provide secure local randomness. The board was not changed.",
    zh: "当前浏览器无法提供安全的本地随机数，棋盘未发生变化。",
  },
  guestGameOver: {
    en: "Run over — best tile {tile}.",
    zh: "对局结束——最高方块 {tile}。",
  },
  guestRulesTitle: { en: "How guest mode works", zh: "游客模式说明" },
  /**
   * Launcher hero subtitle. Deliberately separate from `guestRulesCopy`: the
   * hero slot clamps at 138 chars, and pointing it at the 331-char rules
   * paragraph truncated it mid-clause ("...or combine two matching...") on a
   * 1365px desktop. Rules belong in the docs accordion and the in-game panel,
   * which render `guestRulesCopy` in full; the hero gets one sentence that
   * fits, leaving room for the shared free-play tail appended by MiniAppRoot.
   */
  guestSubtitle: {
    en: "Drag matching buildings together and raise a stronger realm before the route timer runs out. Runs resume on this device.",
    zh: "拖动合并相同建筑，在路线倒计时结束前建起更强大的王国。未完成的对局会保存在本设备。",
  },
  /** Launcher chip: a gameplay hook, not a caption about an absent mode. */
  mergeMechanicBadge: { en: "Merge to build", zh: "合并升级" },
  /**
   * Docs entry describing what this release includes. It replaces a
   * "GameFi entry paused" / "...until the reward pool, oracle callback
   * allowlist, and full testnet settlement flow are verified" accordion, which
   * put maintenance status and testnet internals on a store-facing surface.
   * The in-game `gameFiMaintenance*` keys keep their failure voice — they fire
   * on a real attempted action, not on first paint.
   */
  freePlayScopeTitle: { en: "What this release includes", zh: "本次发布包含的内容" },
  freePlayScopeBody: {
    en: "This release is the complete free game: every route, building tier, and the local leaderboard. It runs entirely on this device — no wallet, no fee, and no chain write. GAS rewards are not part of this release.",
    zh: "本次发布包含完整的免费游戏：全部路线、建筑等级与本地排行榜。游戏完全在本设备运行——无需钱包、无需费用、不写入链上。本次发布不包含 GAS 奖励。",
  },
  guestRulesCopy: {
    en: "Free local play uses real kingdom resources: drag or select a building, move it to an adjacent empty plot, or combine two matching buildings to raise the next tier. Reach the route target before time runs out. No wallet, fee, oracle, or chain write is used; your active board, best building, and recent results stay on this device.",
    zh: "免费本地玩法使用真实王国资源：拖动或点选建筑，将其移动到相邻空地，或合并两个相同建筑以升级到下一阶。在倒计时结束前达成路线目标。无需钱包、费用、预言机或链上写入；当前棋盘、最高建筑和最近结果保存在本设备。",
  },

  building_2: { en: "Meadow", zh: "草地" },
  building_4: { en: "Timber hut", zh: "木屋" },
  building_8: { en: "Stone cottage", zh: "石屋" },
  building_16: { en: "Village house", zh: "村舍" },
  building_32: { en: "Watchtower", zh: "瞭望塔" },
  building_64: { en: "Market", zh: "集市" },
  building_128: { en: "Forge", zh: "锻造坊" },
  building_256: { en: "Castle gate", zh: "城门" },
  building_512: { en: "Castle keep", zh: "主堡" },
  building_1024: { en: "Royal castle", zh: "王家城堡" },
  building_2048: { en: "Crystal citadel", zh: "水晶堡垒" },
  building_4096: { en: "Crown palace", zh: "王冠宫殿" },

  proofNotReady: {
    en: "The verified minimum play time has not elapsed yet.",
    zh: "尚未达到可验证的最短对局时间。",
  },
  releaseNotReady: {
    en: "Recovery unlocks only after the contract deadline and settlement grace.",
    zh: "只有超过合约截止时间与结算宽限期后才能释放恢复。",
  },
};

export const messages = mergeMessages(appMessages);
