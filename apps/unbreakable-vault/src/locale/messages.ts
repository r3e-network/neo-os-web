import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Unbreakable Vault", zh: "坚不可摧保险库" },
  vaultHeroChip: {
    en: "Build a bounty vault. Publish the challenge. Reward the breaker.",
    zh: "创建悬赏保险库，发布挑战，奖励破解者。",
  },
  vaultHeroImageAlt: {
    en: "A bright glass bounty vault with GAS chips and challenge panels.",
    zh: "明亮的玻璃悬赏保险库、GAS 筹码与挑战面板。",
  },
  vaultHeroVisualLabel: { en: "Challenge vault", zh: "挑战保险库" },
  vaultHeroVisualValue: { en: "Bounty live", zh: "悬赏进行中" },
  create: { en: "Create", zh: "创建" },
  break: { en: "Break", zh: "破解" },
  challengeConsole: { en: "Challenge console", zh: "挑战控制台" },
  challengeConsoleTitle: {
    en: "Build a bounty vault or inspect one to break",
    zh: "创建悬赏保险库，或加载目标发起破解",
  },
  myVaultsStat: { en: "My Vaults", zh: "我的保险库" },
  openVaultsStat: { en: "Open Vaults", zh: "开放保险库" },
  bountyLabel: { en: "Bounty", zh: "悬赏金" },
  bountyPlaceholder: { en: "Minimum 1", zh: "至少 1" },
  minBountyNote: { en: "Minimum bounty: 1 GAS", zh: "最低悬赏：1 GAS" },
  bountyPresetLabel: { en: "Bounty presets", zh: "悬赏预设" },
  netPayoutLabel: {
    en: "You win (after 2% fee)",
    zh: "你将获得（扣除 2% 手续费后）",
  },
  winnerShare: { en: "98% of escrow", zh: "托管额的 98%" },
  riskSummaryTitle: { en: "Asset and risk summary", zh: "资产与风险摘要" },
  netPayoutCompact: {
    en: "net settlement after protocol fee",
    zh: "扣除协议费后的净结算额",
  },
  attemptRiskCompact: {
    en: "non-refundable on every attempt",
    zh: "每次尝试均收取且不可退",
  },
  expiryRiskCompact: {
    en: "creator reclaim window",
    zh: "创建者到期取回窗口",
  },
  selectVaultExpiry: { en: "Select a vault", zh: "请选择金库" },
  bountyGrowthNote: {
    en: "Each failed attempt adds its fee to this bounty — it grows as more people try.",
    zh: "每次失败的尝试都会把费用加入此悬赏——尝试的人越多，悬赏越大。",
  },
  createFeeNote: {
    en: "A 2% protocol fee is deducted from winner payouts and creator expiry refunds; the net settlement is 98% of escrow.",
    zh: "获胜者结算和创建者到期取回均扣除 2% 协议费，净结算额为托管额的 98%。",
  },
  difficultyFeeNote: {
    en: "Difficulty sets the per-attempt fee that challengers pay (Easy 0.1 / Medium 0.5 / Hard 1 GAS). You only fund the bounty.",
    zh: "难度决定挑战者每次尝试支付的费用（简单 0.1 / 中等 0.5 / 困难 1 GAS）。你只需出资悬赏。",
  },
  titleLabel: { en: "Vault Title", zh: "保险库标题" },
  titlePlaceholder: { en: "Give your vault a name", zh: "给保险库起个名字" },
  descriptionLabel: { en: "Description", zh: "描述" },
  descriptionPlaceholder: {
    en: "Optional hints or lore",
    zh: "可选提示或背景",
  },
  descriptionPending: { en: "Hint pending", zh: "等待提示" },
  descriptionReady: { en: "Public hint armed", zh: "公开提示已就绪" },
  vaultTuningLabel: {
    en: "Challenge tuning",
    zh: "挑战调校",
  },
  difficultyLabel: { en: "Difficulty", zh: "难度" },
  difficultyEasy: { en: "Easy", zh: "简单" },
  difficultyMedium: { en: "Medium", zh: "中等" },
  difficultyHard: { en: "Hard", zh: "困难" },
  difficultyEasyHint: {
    en: "Low attempt fee for broad participation.",
    zh: "较低尝试费用，适合更多人参与。",
  },
  difficultyMediumHint: {
    en: "Balanced pressure for serious challengers.",
    zh: "压力适中，适合认真挑战者。",
  },
  difficultyHardHint: {
    en: "High-stakes attempts for premium bounties.",
    zh: "高投入挑战，适合高额悬赏。",
  },
  secretLabel: { en: "Vault Secret", zh: "保险库密钥" },
  secretPlaceholder: { en: "Enter a secret phrase", zh: "输入密钥短语" },
  confirmSecretLabel: { en: "Confirm Secret", zh: "确认密钥" },
  confirmSecretPlaceholder: { en: "Re-enter the secret", zh: "再次输入密钥" },
  secretMismatch: { en: "Secrets do not match", zh: "两次密钥不一致" },
  hashPreview: { en: "On-chain Hash", zh: "链上哈希" },
  createVault: { en: "Create Vault", zh: "创建保险库" },
  blueprintTitle: { en: "Vault blueprint", zh: "保险库蓝图" },
  blueprintUntitled: { en: "Untitled bounty vault", zh: "未命名悬赏保险库" },
  configureVault: { en: "Configure vault", zh: "配置保险库" },
  blueprintHintEmpty: {
    en: "Add a public hint so challengers understand what they are trying to break.",
    zh: "添加公开提示，让挑战者知道他们正在破解什么。",
  },
  secretReady: { en: "Hash armed", zh: "哈希已激活" },
  secretWaiting: { en: "Keys unarmed", zh: "密钥未激活" },
  createVaultButton: {
    en: "Seal Vault",
    zh: "封存保险库",
  },
  creatingVault: { en: "Creating vault...", zh: "正在创建保险库..." },
  createFineLabel: { en: "Fees & secret details", zh: "费用与密钥说明" },
  createNeedTitle: {
    en: "Add a vault title to continue.",
    zh: "请填写保险库标题以继续。",
  },
  createNeedBounty: {
    en: "Enter a bounty of at least 1 GAS.",
    zh: "请输入至少 1 GAS 的悬赏。",
  },
  createNeedSecret: {
    en: "Arm both key slots to seal the vault.",
    zh: "激活两枚密钥槽后封存保险库。",
  },
  createReady: {
    en: "Vault armed — plaintext stays local; only its digest is submitted.",
    zh: "保险库已激活——明文仅留在本地，只提交摘要。",
  },
  breakVault: { en: "Break a Vault", zh: "破解保险库" },
  challengeDeskTitle: { en: "Challenge target", zh: "挑战目标" },
  challengeDeskEmpty: {
    en: "Load a vault to challenge",
    zh: "加载保险库后挑战",
  },
  challengeDeskHint: {
    en: "Enter a vault ID to inspect the bounty, difficulty, attempt fee, and public hint before paying.",
    zh: "输入保险库编号，先查看悬赏、难度、尝试费用和公开提示，再决定是否支付。",
  },
  challengeDeskLoaded: {
    en: "Vault loaded and ready for inspection.",
    zh: "保险库已加载，可开始检查。",
  },
  secretNote: {
    en: "The secret is hashed locally and cannot be recovered by the app. Only someone who knows the exact phrase can break the vault.",
    zh: "密钥在本地哈希，应用无法恢复明文。只有知道完整短语的人才能破解保险库。",
  },
  vaultCreated: { en: "Vault Created", zh: "保险库已创建" },
  vaultIdLabel: { en: "Vault ID", zh: "保险库编号" },
  vaultIdPlaceholder: { en: "Enter vault ID", zh: "输入保险库编号" },
  loadVault: { en: "Load Vault", zh: "加载保险库" },
  secretAttemptLabel: { en: "Break Secret", zh: "破解密钥" },
  secretAttemptPlaceholder: { en: "Enter secret attempt", zh: "输入尝试密钥" },
  attemptFee: { en: "Attempt Fee", zh: "尝试费用" },
  selectVaultFee: { en: "Select a vault", zh: "请选择金库" },
  attemptFeeNote: {
    en: "Attempt fee (by difficulty): {fee} {tokenGas}",
    zh: "尝试费用（按难度）：{fee} {tokenGas}",
  },
  attemptCostNote: {
    en: "The attempt fee is charged on every try and is non-refundable. A wrong secret forfeits the fee and grows the bounty.",
    zh: "每次尝试都会收取尝试费用且不可退还。密钥错误将损失费用并增加悬赏。",
  },
  attemptBreak: { en: "Attempt Break", zh: "尝试破解" },
  attempting: { en: "Attempting...", zh: "破解中..." },
  vaultStatus: { en: "Status", zh: "状态" },
  active: { en: "Active", zh: "进行中" },
  broken: { en: "Broken", zh: "已破解" },
  expired: { en: "Expired", zh: "已过期" },
  claimable: { en: "Claimable", zh: "可取回" },
  reclaimed: { en: "Reclaimed", zh: "已取回" },
  claimBounty: { en: "Claim Bounty", zh: "领取悬赏" },
  reclaimVault: { en: "Reclaim Vault", zh: "取回保险库" },
  bountyClaimed: { en: "Bounty claimed", zh: "悬赏已领取" },
  vaultReclaimed: { en: "Vault reclaimed", zh: "保险库已取回" },
  settleFailed: { en: "Settlement failed", zh: "结算失败" },
  bountyPaidNote: {
    en: "This vault is broken — the bounty was paid to the winner.",
    zh: "该保险库已被破解，悬赏已支付给获胜者。",
  },
  creator: { en: "Creator", zh: "创建者" },
  attempts: { en: "Attempts", zh: "尝试次数" },
  winner: { en: "Winner", zh: "获胜者" },
  expiryLabel: { en: "Expiry", zh: "到期日" },
  remainingDaysLabel: { en: "Days Left", zh: "剩余天数" },
  daysUnit: { en: "days", zh: "天" },
  recentVaults: { en: "Recent Vaults", zh: "最新保险库" },
  noRecentVaults: { en: "No vaults found", zh: "暂无保险库" },
  vaultNotFound: { en: "Vault not found", zh: "未找到保险库" },
  vaultCreateFailed: { en: "Create failed", zh: "创建失败" },
  vaultAttemptFailed: { en: "Attempt failed", zh: "破解失败" },
  vaultAttemptConfirming: {
    en: "Attempt submitted — confirming the outcome on-chain. Reload the vault in a moment to see the result.",
    zh: "尝试已提交——正在链上确认结果。稍后重新加载保险库即可查看结果。",
  },
  walletRequired: {
    en: "Connect the wallet that will own or challenge this vault.",
    zh: "请连接将创建或挑战该保险库的钱包。",
  },
  chainProbingTitle: { en: "Checking network", zh: "正在检查网络" },
  chainProbing: {
    en: "Confirming the Unbreakable Vault contract on this network.",
    zh: "正在确认该网络上的坚不可摧保险库合约。",
  },
  chainAwaitingTitle: { en: "Connect to load vaults", zh: "连接后加载保险库" },
  chainAwaiting: {
    en: "Connect a wallet to browse live bounties and challenge a vault.",
    zh: "连接钱包即可浏览实时赏金并挑战保险库。",
  },
  chainUnavailableTitle: { en: "Vault locked", zh: "保险库已锁定" },
  chainContextMismatch: {
    en: "The selected network is not bound to the canonical Unbreakable Vault contract. Reads and writes are disabled.",
    zh: "当前网络未绑定到规范的坚不可摧保险库合约，读取与写入均已停用。",
  },
  writeUnavailableTitle: { en: "Transactions unavailable", zh: "暂不可交易" },
  writeUnavailable: {
    en: "Read-only data is available, but this network is not ready for a wallet transaction.",
    zh: "链上数据仍可读取，但当前网络尚未准备好钱包交易。",
  },
  contractPaused: {
    en: "The vault contract is paused. No wallet transaction was requested.",
    zh: "金库合约已暂停，未请求任何钱包交易。",
  },
  paymentHubUnavailable: {
    en: "Mainnet is read-only until the vault PaymentHub is configured on-chain.",
    zh: "金库 PaymentHub 完成链上配置前，主网仅支持读取。",
  },
  recoveryStorageUnavailable: {
    en: "Transaction recovery storage is unavailable. No wallet transaction was requested.",
    zh: "交易恢复存储不可用，未请求任何钱包交易。",
  },
  recoveryStorageTitle: { en: "Recovery journal paused", zh: "恢复记录已暂停" },
  retryRecoveryStorage: { en: "Retry storage", zh: "重试存储" },
  recoveryStorageRestored: {
    en: "Recovery storage is ready. Wallet actions are enabled again.",
    zh: "恢复存储已就绪，钱包操作已重新启用。",
  },
  recoveryJournalRestored: {
    en: "The exact pending transaction journal was restored. Confirm it before another payment.",
    zh: "已恢复精确的待处理交易记录。再次支付前请先完成确认。",
  },
  readUnavailableTitle: { en: "Live list needs refresh", zh: "实时列表需要刷新" },
  catalogReadFailed: {
    en: "The latest vault list could not be verified; the last verified list is retained.",
    zh: "最新保险库列表暂无法验证，当前保留上一次已验证列表。",
  },
  myVaultsReadFailed: {
    en: "Owned vaults could not be refreshed; load a known vault ID directly if needed.",
    zh: "我的保险库暂无法刷新；如有需要，可直接加载已知保险库编号。",
  },
  operationInProgress: {
    en: "Another vault operation is already in progress.",
    zh: "另一项保险库操作正在进行中。",
  },
  operationContextChanged: {
    en: "The wallet, vault, or reviewed input changed before broadcast. Review it again; no new transaction was requested.",
    zh: "广播前钱包、保险库或已确认输入发生变化。请重新检查；未请求新交易。",
  },
  transactionIdUnavailable: {
    en: "The wallet did not return a complete transaction ID. Check wallet activity before retrying.",
    zh: "钱包未返回完整交易 ID。重试前请先检查钱包活动。",
  },
  invalidTransactionId: {
    en: "The wallet returned an invalid transaction ID. Review the wallet activity before retrying.",
    zh: "钱包返回了无效交易 ID，重试前请先检查钱包活动。",
  },
  pendingBlocksWrites: {
    en: "A previous vault transaction still needs recovery. Confirm it before paying again.",
    zh: "上一笔保险库交易仍需恢复。请先确认，避免重复支付。",
  },
  pendingTitle: { en: "Transaction recovery", zh: "交易恢复" },
  transactionPending: {
    en: "The transaction was broadcast but its exact event and readback are not confirmed yet.",
    zh: "交易已广播，但精确事件与链上回读尚未确认。",
  },
  paymentRecoveryReady: {
    en: "The GAS payment was broadcast. Resume the contract action without paying again.",
    zh: "GAS 支付已广播。可继续执行合约操作，无需再次支付。",
  },
  recoverTransaction: { en: "Check & resume", zh: "检查并继续" },
  recoveringTransaction: { en: "Checking...", zh: "检查中..." },
  recoverySecretRequired: {
    en: "Re-enter the break secret to use the existing payment. It was never stored.",
    zh: "请重新输入破解密钥以使用现有支付。该密钥从未被存储。",
  },
  pendingContextMismatch: {
    en: "Reconnect the same wallet, network, and contract used for this pending transaction.",
    zh: "请连接该待处理交易使用的同一钱包、网络与合约。",
  },
  pendingInvalid: { en: "The saved recovery record is invalid.", zh: "保存的恢复记录无效。" },
  eventMismatch: {
    en: "The confirmation event does not match the reviewed vault operation.",
    zh: "确认事件与已审核的保险库操作不匹配。",
  },
  readbackMismatch: {
    en: "The contract readback does not prove the reviewed state change.",
    zh: "合约回读无法证明已审核的状态变更。",
  },
  transactionFaulted: {
    en: "The broadcast contract transaction faulted. No success was recorded.",
    zh: "已广播的合约交易执行失败，未记录成功。",
  },
  receiptIdLabel: { en: "Payment receipt ID", zh: "支付收据 ID" },
  receiptIdPlaceholder: {
    en: "Mainnet settled receipt",
    zh: "主网已结算收据",
  },
  receiptIdRequired: {
    en: "Mainnet requires a positive settled PaymentHub receipt ID.",
    zh: "主网需要有效的已结算 PaymentHub 收据 ID。",
  },
  invalidVaultId: {
    en: "Enter a positive vault ID.",
    zh: "请输入正整数保险库编号。",
  },
  vaultNotActive: {
    en: "This vault is no longer active. Refresh before moving GAS.",
    zh: "该保险库已不再有效。转移 GAS 前请刷新。",
  },
  attemptFeeUnavailable: {
    en: "The contract did not return a positive attempt fee. No payment was sent.",
    zh: "合约未返回有效尝试费用，未发送任何支付。",
  },
  vaultNotReclaimable: {
    en: "Only the creator can reclaim an unbroken, claimable vault.",
    zh: "只有创建者可以取回未破解且可取回的保险库。",
  },
  bountyIncreaseRecovered: {
    en: "The bounty increase was confirmed and recovered.",
    zh: "追加悬赏已确认并恢复。",
  },
  loadFailed: { en: "Failed to load vault", zh: "加载保险库失败" },
  myVaults: { en: "My Vaults", zh: "我的保险库" },
  invalidDifficulty: {
    en: "Choose a difficulty (Easy, Medium, or Hard).",
    zh: "请选择难度（简单、中等或困难）。",
  },
  secretRequired: {
    en: "Enter a secret phrase to lock the vault.",
    zh: "请输入用于锁定保险库的密钥短语。",
  },
  invalidSecretHash: {
    en: "The supplied secret digest must be exactly 32 bytes (64 hexadecimal characters).",
    zh: "提供的密钥摘要必须正好为 32 字节（64 个十六进制字符）。",
  },
  increaseBounty: { en: "Add Bounty", zh: "追加悬赏" },
  increaseBountyLabel: { en: "Increase Bounty (GAS)", zh: "追加悬赏（GAS）" },
  increaseBountyPlaceholder: {
    en: "Amount of GAS to add",
    zh: "要追加的 GAS 数量",
  },
  increaseBountySuccess: {
    en: "Added {amount} {tokenGas} to the bounty",
    zh: "已向悬赏追加 {amount} {tokenGas}",
  },
  increaseBountyFailed: { en: "Failed to increase bounty", zh: "追加悬赏失败" },
  increaseBountyInvalidId: {
    en: "Load a vault before adding to its bounty.",
    zh: "请先加载保险库再追加悬赏。",
  },
  increaseBountyInvalidAmount: {
    en: "Enter a positive GAS amount.",
    zh: "请输入正的 GAS 数量。",
  },
  mainnetVaultNote: {
    en: "Mainnet uses settled PaymentHub receipt IDs. The app remains read-only while the deployed vault has no PaymentHub configured.",
    zh: "主网使用已结算的 PaymentHub 收据 ID；已部署金库尚未配置 PaymentHub 时，应用保持只读。",
  },

  docSubtitle: {
    en: "Hacker bounty vaults secured by on-chain hashes",
    zh: "链上哈希保护的黑客悬赏保险库",
  },
  docDescription: {
    en: "Creators escrow GAS behind a SHA-256 digest. Non-refundable attempt fees grow the bounty after failures; winner payouts and creator expiry refunds settle at 98% after the 2% protocol fee.",
    zh: "创建者用 SHA-256 摘要托管 GAS。失败后不可退的尝试费会增加悬赏；获胜者结算与创建者到期取回均在扣除 2% 协议费后按 98% 结算。",
  },
  howItWorks: { en: "How It Works", zh: "运作方式" },
  stepsCombined: {
    en: "1. Create a vault with bounty, difficulty, and secret hash. 2. Share the vault ID publicly for challengers. 3. Challengers pay 0.1 / 0.5 / 1 GAS based on difficulty. 4. The correct secret wins the bounty; expired vaults can be reclaimed by the creator.",
    zh: "1. 设置悬赏、难度与密钥哈希创建保险库。2. 公开保险库编号吸引挑战者。3. 挑战者按难度支付 0.1 / 0.5 / 1 GAS 尝试破解。4. 密钥正确可获悬赏，过期后创建者可取回。",
  },
  step1: {
    en: "Create a vault with bounty, difficulty, and secret hash",
    zh: "设置悬赏、难度与密钥哈希创建保险库",
  },
  step2: {
    en: "Share the vault ID publicly for challengers",
    zh: "公开保险库编号吸引挑战者",
  },
  step3: {
    en: "Challengers pay 0.1 / 0.5 / 1 GAS based on difficulty",
    zh: "挑战者按难度支付 0.1 / 0.5 / 1 GAS 尝试破解",
  },
  step4: {
    en: "Correct secret wins the bounty; expired vaults can be reclaimed",
    zh: "密钥正确可获悬赏，过期后创建者可取回",
  },
  feature1Name: { en: "Local Digest Lock", zh: "本地摘要锁" },
  feature1Desc: {
    en: "Only the SHA-256 hash is stored on-chain.",
    zh: "链上仅保存 SHA-256 哈希。",
  },
  feature2Name: { en: "Bounty Growth", zh: "悬赏增长" },
  feature2Desc: {
    en: "Every failed attempt adds to the prize pool.",
    zh: "每次失败尝试都会增加奖池。",
  },
  feature3Name: { en: "Difficulty Tiers", zh: "难度分级" },
  feature3Desc: {
    en: "Attempt fees scale with difficulty.",
    zh: "尝试费用随难度提升。",
  },
  sidebarDifficulty: { en: "Difficulty", zh: "难度" },
  sidebarAttemptFee: { en: "Attempt Fee", zh: "尝试费用" },
} as const;

export const messages = mergeMessages(appMessages);
