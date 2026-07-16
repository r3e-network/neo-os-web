import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "Breakup Contract", zh: "分手合约" },
  subtitle: {
    en: "Put skin in the game for the people you care about.",
    zh: "为你珍视的人，押上一点真心。",
  },
  contractTitle: { en: "A PROMISE, ON-CHAIN", zh: "链上的承诺" },
  heroIconTitle: { en: "Two people sharing a pact", zh: "共守约定的两个人" },
  heroImageAlt: { en: "A quiet table prepared for two people to review and sign a pact", zh: "为两个人复核并签署约定而准备的安静桌面" },
  clause1: {
    en: "Two people, one promise: you each lock a matching GAS stake. Honor it to the end and both stakes come back in full — break it, and yours goes to your partner.",
    zh: "两个人，一个承诺：各自锁定等额 GAS 质押。坚持到期满则双方质押全额退回 — 若违约，你的质押便归对方所有。",
  },

  partnerLabel: { en: "Partner Address", zh: "伴侣地址" },
  partnerAddress: { en: "Partner Address", zh: "伴侣地址" },
  titleLabel: { en: "Contract Title", zh: "合约标题" },
  stakeLabel: { en: "Stake Amount", zh: "质押金额" },
  stakeAmount: { en: "Stake", zh: "质押" },
  durationLabel: { en: "Contract Duration", zh: "合约期限" },
  durationDays: { en: "Duration", zh: "期限" },
  termsLabel: { en: "Contract Terms", zh: "合约条款" },
  contractTerms: { en: "Terms", zh: "条款" },
  signatureLabel: { en: "Your Signature", zh: "您的签名" },
  signatureEmoji: { en: "Signature mark", zh: "签名标记" },
  heartIcon: { en: "Active relationship heart", zh: "活跃关系爱心" },
  brokenHeartIcon: { en: "Broken relationship", zh: "破裂关系" },

  partnerPlaceholder: { en: "Enter partner's NEO address", zh: "输入伴侣的 NEO 地址" },
  titlePlaceholder: { en: "Short title (max 100 chars)", zh: "简短标题（最多100字符）" },
  contractTitlePlaceholder: { en: "Our covenant", zh: "我们的约定" },
  stakePlaceholder: { en: "Amount in GAS", zh: "GAS 金额" },
  durationPlaceholder: { en: "Days", zh: "天数" },
  termsPlaceholder: { en: "Optional terms (max 2000 chars)", zh: "可选条款（最多2000字符）" },
  contractTermsPlaceholder: { en: "Optional notes, expectations, and exit rules", zh: "可选备注、约定和退出规则" },
  connectWallet: { en: "Connect wallet to sign", zh: "连接钱包以签名" },
  // Shown by the shell chrome while the wallet-scoped contract read is in
  // flight. Manifest bindings are string-valued, so the chrome cannot show a
  // skeleton — the pending phase reaches it as words. See manifest.ts.
  breakupReading: { en: "Reading…", zh: "读取中…" },
  // The settled no-wallet state for those same read-outs. `connectWallet` above
  // is the signing CTA ("Connect wallet to sign"); these tiles are reporting a
  // count, not asking for a signature.
  breakupAwaitingWallet: { en: "Connect wallet", zh: "连接钱包" },
  partnerRequired: { en: "Partner address is required", zh: "需要填写伴侣地址" },
  partnerInvalid: { en: "Invalid partner address", zh: "伴侣地址无效" },
  stakeRequired: { en: "Stake amount is required", zh: "需要填写质押金额" },
  stakeOrDurationInvalid: {
    en: "Stake must be a plain GAS amount with at most 8 decimals (minimum 1); duration must be 30–3650 whole days.",
    zh: "质押必须是最多 8 位小数的普通 GAS 金额（至少 1 GAS）；期限必须是 30–3650 个完整天数。",
  },

  createBtn: { en: "Sign & Create Contract", zh: "签署并创建合约" },
  createContract: { en: "Create Contract", zh: "创建合约" },
  newContract: { en: "New Contract", zh: "新建合约" },
  contracts: { en: "Contracts", zh: "合约" },
  refreshRecords: { en: "Refresh contracts", zh: "刷新合约" },
  walletAction: { en: "Wallet action", zh: "钱包操作" },
  noContracts: { en: "No contracts yet", zh: "暂无合约" },
  noContractsHint: {
    en: "Pacts you create or are named in will appear here. Connect your wallet to load them from the chain.",
    zh: "你创建或被指定参与的约定会显示在这里。连接钱包以从链上加载。",
  },
  contractDescription: {
    en: "Draft a stake-backed relationship agreement with a partner, duration, and terms before confirming the wallet intent.",
    zh: "填写伴侣、期限和条款，创建由质押支持的关系协议，并在钱包确认前复核。",
  },
  builderTitle: { en: "Build pact", zh: "创建约定" },
  pactDetails: { en: "Pact details", zh: "约定详情" },
  advancedPactDetails: { en: "Custom stake, term, and local notes", zh: "自定义质押、期限与本地备注" },
  advancedPactDetailsCopy: {
    en: "The presets cover the common path. Open these fields only when you need a custom fixed-8 GAS amount, a custom whole-day term, or device-local notes.",
    zh: "预设已覆盖常用路径。仅在需要自定义 fixed-8 GAS 金额、完整天数期限或设备本地备注时使用这些字段。",
  },
  builderStepPartner: { en: "Partner and title", zh: "伴侣与标题" },
  builderStepStake: { en: "Stake and duration", zh: "质押与期限" },
  builderStepTerms: { en: "Terms and confirmation", zh: "条款与确认" },
  localNotes: { en: "Local notes", zh: "本地备注" },
  notesAdded: { en: "Notes added", zh: "已添加备注" },
  pactPreview: { en: "Live pact preview", zh: "实时约定预览" },
  pactPreviewUntitled: { en: "Untitled pact", zh: "未命名约定" },
  pactPreviewTitleHint: { en: "Name it in Pact details", zh: "在“约定详情”中命名" },
  // The desk card renders the fields the contract records. It sits beside the
  // live preview, so it needs its own label — reusing pactPreview here printed
  // the same eyebrow twice on one screen.
  deskOnChainTitle: { en: "Recorded on-chain", zh: "链上记录" },
  deskOnChainCopy: {
    en: "These three fields are written into the pact contract. The title and notes stay on this device.",
    zh: "这三项会写入约定合约；标题与备注仅保存在本设备。",
  },
  pactPreviewPartner: { en: "Partner address appears here", zh: "伴侣地址将在这里显示" },
  pactPreviewTerms: { en: "Add optional notes, expectations, or exit rules. Only stake and duration are enforced on-chain.", zh: "可补充备注、期待或退出规则。链上强制执行的是质押与期限。" },
  pactPreviewRule: {
    en: "Honor the term and each stake becomes its owner's contract credit. Break early and the other partner receives both stakes as credit; every payout still requires Withdraw GAS.",
    zh: "履约到期后，双方质押分别进入各自合约额度；提前违约时，另一方获得两份质押额度。所有款项仍需执行“提取 GAS”才能回到钱包。",
  },
  heroTagStakeBacked: { en: "Stake-backed", zh: "质押背书" },
  heroTagOnChain: { en: "On-chain", zh: "链上" },
  heroTagRefundable: { en: "Refundable", zh: "可退款" },
  howItWorksTitle: { en: "How it works", zh: "运作方式" },
  howItWorksStakeTitle: { en: "Both partners stake", zh: "双方质押" },
  howItWorksStakeCopy: {
    en: "You and your partner each lock matching GAS into the pact. The contract holds it until the agreement resolves.",
    zh: "你和伴侣各自将等额 GAS 锁入约定。合约会保管这笔资金，直到约定结束。",
  },
  howItWorksBreakTitle: { en: "If someone breaks it", zh: "如果有人毁约" },
  howItWorksBreakCopy: {
    en: "The partner who breaks the pact forfeits their stake — the other side receives both stakes back.",
    zh: "毁约的一方将失去其质押，另一方将取回两份质押。",
  },
  howItWorksSettleTitle: { en: "If it runs its term", zh: "如果约定到期" },
  howItWorksSettleCopy: {
    en: "When the duration passes with no break, anyone may settle; each stake becomes its owner's withdrawable contract credit.",
    zh: "若约定期满且无人毁约，任何人都可触发结算；双方质押分别进入各自可提取的合约额度。",
  },
  tabCreate: { en: "Create", zh: "创建" },
  tabContracts: { en: "Contracts", zh: "合约" },
  daysSuffix: { en: "Days", zh: "天" },

  activeContracts: { en: "Active Contracts", zh: "活跃合约" },
  partner: { en: "Partner", zh: "伴侣" },
  stake: { en: "Stake", zh: "质押" },
  duration: { en: "Duration", zh: "期限" },
  daysLeft: { en: "days left", zh: "天剩余" },
  progress: { en: "Progress", zh: "进度" },

  pending: { en: "Pending", zh: "待签署" },
  total: { en: "Total", zh: "总计" },
  active: { en: "Active", zh: "活跃" },
  broken: { en: "Broken", zh: "已破裂" },
  ended: { en: "Ended", zh: "已结束" },
  cancelled: { en: "Cancelled", zh: "已取消" },

  signContract: { en: "Sign Contract", zh: "签署合约" },
  breakContract: { en: "Break Contract", zh: "违约" },
  cancelContract: { en: "Cancel & reclaim", zh: "取消并取回" },
  settleContract: { en: "Settle", zh: "结算退还" },
  untitledContract: { en: "Untitled pact", zh: "未命名约定" },
  partnerTermsOffChain: {
    en: "The stake, parties, duration, and lifecycle are on-chain. The title and notes stay on this device — review them together before matching the stake.",
    zh: "参与方、质押、期限和状态在链上记录；标题与备注仅保存在本设备。匹配质押前，请双方共同核对。",
  },

  contractCreated: { en: "Pact #{id} is confirmed on-chain.", zh: "约定 #{id} 已在链上确认。" },
  contractSigned: { en: "Contract signed", zh: "合约已签署" },
  contractBroken: {
    en: "Pact broken. Both stakes are now withdrawable by the other partner.",
    zh: "约定已违约；两份质押已记入另一方的可提取额度。",
  },
  contractSettled: {
    en: "Pact honored. Each stake is now available in its owner's withdrawable credit.",
    zh: "约定已履行；双方质押已分别记入各自的可提取额度。",
  },
  contractCancelled: {
    en: "Pact cancelled. Your stake is now available as withdrawable credit.",
    zh: "约定已取消；你的质押已记入可提取额度。",
  },
  signNotPartner: {
    en: "Only the named partner can sign this pact.",
    zh: "只有被指定的伴侣才能签署此约定。",
  },
  contractPreparing: {
    en: "Preparing wallet confirmation for \"{title}\" with {amount} stake.",
    zh: "正在为「{title}」准备 {amount} 质押的钱包确认。",
  },
  preparingWallet: {
    en: "Preparing wallet",
    zh: "准备钱包确认",
  },
  awaitingChain: { en: "Awaiting chain result", zh: "等待链上结果" },
  checkPendingAction: { en: "Check pending pact", zh: "检查待确认约定" },
  checkPendingHint: {
    en: "Read the saved transaction status without signing or submitting again.",
    zh: "只读取已保存的交易状态，不会再次签名或提交。",
  },
  contractSubmitted: {
    en: "Contract \"{title}\" submitted. Refreshing contract state.",
    zh: "合约「{title}」已提交，正在刷新状态。",
  },
  contractSigning: {
    en: "Preparing signature confirmation for contract #{id}.",
    zh: "正在为合约 #{id} 准备签署确认。",
  },
  contractBreaking: {
    en: "Preparing breakup confirmation for contract #{id}.",
    zh: "正在为合约 #{id} 准备违约确认。",
  },
  contractCancelling: {
    en: "Preparing cancellation for pending pact #{id}.",
    zh: "正在为待签约定 #{id} 准备取消操作。",
  },
  contractSettling: {
    en: "Preparing settlement for pact #{id} — refunding both stakes.",
    zh: "正在为约定 #{id} 准备结算 — 退还双方质押。",
  },
  partnerSelf: {
    en: "You cannot name yourself as the partner.",
    zh: "不能将自己设为伴侣。",
  },
  pactIdRequired: {
    en: "Could not resolve the on-chain pact for this action.",
    zh: "无法解析该操作对应的链上约定。",
  },
  depositPrepaidNoContract: {
    en: "Your stake was deposited but the pact was not created. The stake is held on the contract as reusable prepaid credit — retry to create the pact.",
    zh: "你的质押已存入，但约定未能创建。质押作为可复用的预付额度保留在合约上 — 请重试以创建约定。",
  },
  depositPrepaidNoSign: {
    en: "Your matching stake was deposited but the pact was not signed. The stake is held on the contract as reusable prepaid credit — retry to sign.",
    zh: "你的等额质押已存入，但约定未能签署。质押作为可复用的预付额度保留在合约上 — 请重试签署。",
  },
  actionBusy: { en: "Another pact action is still running.", zh: "另一项约定操作仍在进行中。" },
  transactionNotBroadcast: { en: "The wallet did not broadcast this transaction.", zh: "钱包未广播这笔交易。" },
  transactionFaulted: {
    en: "The exact transaction ended with VM FAULT. Its pending lock has been released.",
    zh: "该笔精确交易已以 VM FAULT 结束，pending 锁定已解除。",
  },
  invalidTransactionId: { en: "The wallet returned an invalid transaction id.", zh: "钱包返回了无效的交易 ID。" },
  transactionIdMismatch: {
    en: "The wallet returned two different transaction ids for one intent. The first persisted txid remains authoritative; refresh to reconcile it.",
    zh: "钱包为同一意图返回了两个不同的交易 ID。首个已保存 txid 仍为权威记录，请刷新核验。",
  },
  transactionPending: { en: "pending transaction", zh: "待确认交易" },
  actionPendingConfirmation: {
    en: "Transaction broadcast, but its chain result is not confirmed yet. Refresh before trying again.",
    zh: "交易已广播，但链上结果尚未确认。请先刷新，不要重复提交。",
  },
  actionPendingRecovery: {
    en: "Waiting for chain confirmation ({txid}). Refresh to reconcile this action; do not submit it twice.",
    zh: "正在等待链上确认（{txid}）。请刷新以恢复状态，不要重复提交。",
  },
  recoveryStorageUnavailable: {
    en: "Reliable recovery storage is unavailable. New writes are blocked; if your wallet already displayed a txid, preserve it and refresh this page.",
    zh: "可靠的恢复存储不可用，新的写操作已被阻止；若钱包已经显示 txid，请保留它并刷新本页。",
  },
  pendingBlocksWrites: {
    en: "A broadcast transaction is still pending. Refresh to reconcile it before opening another wallet action.",
    zh: "已有一笔广播交易仍处于 pending。请先刷新核验，再发起新的钱包操作。",
  },
  invalidRecoveryRecord: {
    en: "A recovery record exists but no longer matches the exact transaction schema. Writes remain locked; preserve the record for manual reconciliation.",
    zh: "存在一条不再符合精确交易结构的恢复记录。写操作保持锁定，请保留该记录以便人工核验。",
  },
  depositPendingConfirmation: {
    en: "A stake deposit is still being confirmed. Refresh before retrying so GAS is not deposited twice.",
    zh: "一笔质押存款仍在确认中。请先刷新再重试，避免重复存入 GAS。",
  },
  depositConfirmedRetry: {
    en: "The prepaid GAS is confirmed. You can safely resume the pact action without depositing again.",
    zh: "预存 GAS 已确认；可安全继续约定操作，不会再次充值。",
  },
  pendingCreateRecovered: {
    en: "Recovered confirmed pact #{id} from chain state.",
    zh: "已从链上状态恢复确认的约定 #{id}。",
  },
  contractCreatedMetadataWarning: {
    en: "Pact #{id} is confirmed on-chain, but this browser could not save its local title and notes.",
    zh: "约定 #{id} 已在链上确认，但浏览器未能保存本地标题和备注。",
  },
  contractServiceUnavailableTitle: { en: "Couldn't load pacts", zh: "无法加载约定" },
  contractWalletUnavailable: {
    en: "Connect your wallet to stake and confirm the pact on-chain.",
    zh: "请连接钱包，以在链上质押并确认约定。",
  },
  lastSubmittedContract: {
    en: "Last submitted: {title}",
    zh: "上次提交：{title}",
  },
  createHintPartner: {
    en: "Partner slot empty.",
    zh: "伴侣槽位为空。",
  },
  createHintStake: {
    en: "Stake below minimum.",
    zh: "质押低于最低值。",
  },
  createHintDuration: {
    en: "Term below minimum.",
    zh: "期限低于最低值。",
  },
  createHintTitle: {
    en: "Title slot empty.",
    zh: "标题槽位为空。",
  },
  createHintReady: {
    en: "Ready for wallet.",
    zh: "可唤起钱包。",
  },
  titleRequired: { en: "Contract title is required", zh: "请填写合约标题" },
  titleTooLong: { en: "Title must be 100 characters or less", zh: "标题最多100字符" },
  termsTooLong: { en: "Terms must be 2000 characters or less", zh: "条款最多2000字符" },
  titleCounter: { en: "{count}/{max} characters", zh: "{count}/{max} 字符" },
  termsCounter: { en: "{count}/{max} characters", zh: "{count}/{max} 字符" },
  contractUnavailable: { en: "Contract not configured", zh: "合约未配置" },
  chainContextMismatch: {
    en: "Wallet network and the canonical Breakup Contract binding could not be verified. No write was opened.",
    zh: "无法核验钱包网络与分手合约的权威绑定，本次未发起写操作。",
  },
  lastPactIdUnavailable: {
    en: "The latest pact id is unavailable. It was not treated as zero, and no stake was moved.",
    zh: "最新约定 ID 暂不可用；系统没有将其当作 0，也没有移动质押。",
  },
  loadFailed: { en: "Failed to load contracts", zh: "加载合约失败" },
  loadFailedKeepState: {
    en: "Could not refresh pact history. The last confirmed view is still shown.",
    zh: "无法刷新约定记录；当前仍显示上一次确认的状态。",
  },
  partialLoad: {
    en: "{count} pact record(s) could not be decoded. Refresh to retry those records.",
    zh: "有 {count} 条约定记录暂时无法解析，请刷新重试。",
  },
  historyLimited: {
    en: "Showing the newest {count} pacts.",
    zh: "当前显示最新的 {count} 条约定。",
  },
  creditReadFailed: {
    en: "Pacts loaded, but withdrawable GAS could not be verified. Refresh before depositing or withdrawing.",
    zh: "约定已加载，但无法核验可提取 GAS。充值或提取前请刷新。",
  },
  creditReadRequired: {
    en: "Could not verify your prepaid GAS credit. No funds were moved; refresh and try again.",
    zh: "无法核验你的预存 GAS 额度；本次未移动资金，请刷新后重试。",
  },
  pactNotPending: { en: "This pact is no longer pending.", zh: "该约定已不再处于待签状态。" },
  pactNotActive: { en: "This pact is not active.", zh: "该约定当前不是活跃状态。" },
  pactExpired: { en: "This pending pact has expired and can no longer be signed.", zh: "该待签约定已过期，无法再签署。" },
  pactNotExpired: { en: "This pact has not reached its settlement time.", zh: "该约定尚未到达结算时间。" },
  pactExpiredSettle: { en: "This pact has reached its term. Settle it instead of breaking it.", zh: "该约定已到期，请执行结算而不是违约。" },
  pactPendingUseCancel: { en: "Pending pacts must be cancelled by their creator.", zh: "待签约定只能由创建者取消。" },
  cancelNotCreator: { en: "Only the creator can cancel a pending pact.", zh: "只有创建者可以取消待签约定。" },
  breakNotParty: { en: "Only a pact participant can break it.", zh: "只有约定参与方可以执行违约。" },

  creditRecoveryTitle: { en: "Withdraw your GAS", zh: "提取你的 GAS" },
  creditRecoveryCopy: {
    en: "GAS owed to you is held as credit on the contract — a break payout (both stakes), a settlement refund (your stake back), or a stake you deposited without completing the pact. Withdraw it to your wallet anytime.",
    zh: "合约上以额度形式保留着应付给你的 GAS——可能是分手赔付（双方质押）、和解退款（退回你的质押），或你已存入但未完成约定的质押。可随时提取到你的钱包。",
  },
  recoverCredit: { en: "Withdraw GAS", zh: "提取 GAS" },
  creditUnknownTitle: { en: "GAS credit not verified", zh: "GAS 额度尚未核验" },
  creditUnknownCopy: {
    en: "Refresh chain state before depositing or withdrawing. An unknown balance is never treated as zero.",
    zh: "充值或提取前请刷新链上状态；未知余额不会被当作零处理。",
  },
  creditRecovering: { en: "Withdrawing your GAS credit…", zh: "正在提取你的 GAS 额度…" },
  creditRecovered: { en: "{amount} GAS withdrawn to your wallet.", zh: "{amount} GAS 已提取到你的钱包。" },
  noCreditToRecover: { en: "No GAS credit to withdraw.", zh: "没有可提取的 GAS 额度。" },
  readyToSettle: { en: "Ready to settle", zh: "可结算" },
  daysRemaining: { en: "{count} days left", zh: "剩余 {count} 天" },

  docSubtitle: { en: "Stake-backed relationship agreements", zh: "带质押的关系合约" },
  docDescription: {
    en: "Breakup Contract lets two parties lock GAS into a timed agreement with clear terms. Both parties sign on-chain, the stake is held by the contract, and early termination triggers forfeits according to the rules.",
    zh: "分手合约支持双方将 GAS 锁定在有期限的协议中并明确条款。双方在链上签署后由合约托管质押，提前终止将按规则触发违约处理。",
  },
  step1: { en: "Connect your wallet and create a contract draft.", zh: "连接钱包并创建合约草案。" },
  step2: { en: "Set partner address, stake amount, and terms.", zh: "填写伴侣地址、质押金额与条款。" },
  step3: { en: "Both parties sign to lock the stake on-chain.", zh: "双方签署后质押上链锁定。" },
  step4: { en: "Track status, completion, or early termination.", zh: "跟踪合约状态、完成或提前终止。" },
  feature1Name: { en: "Crypto Stakes", zh: "加密质押" },
  feature1Desc: { en: "Real GAS locked in contract.", zh: "真实的 GAS 锁定在合约中。" },
  feature2Name: { en: "On-Chain Proof", zh: "链上证明" },
  feature2Desc: { en: "Immutable relationship records.", zh: "不可变的关系记录。" },
  feature3Name: { en: "Dual Signature", zh: "双签确认" },
  feature3Desc: { en: "Both parties must sign before activation.", zh: "双方签署后合约才会生效。" },
} as const;

export const messages = mergeMessages(appMessages);
