import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "NeoPay", zh: "流式支付" },
  createTab: { en: "Create", zh: "创建" },
  vaultsTab: { en: "Streams", zh: "资金流" },

  // Hero + overview
  heroEyebrow: { en: "Payment streams", zh: "流式支付" },
  heroTitle: { en: "Stream payments over time", zh: "随时间流式发放资金" },
  heroSubtitle: {
    en: "Lock GAS or NEO and release it on a schedule — for payrolls, subscriptions, and allowances.",
    zh: "锁定 GAS 或 NEO 并按计划释放——适用于工资、订阅与津贴。",
  },
  paymentStageAria: {
    en: "Payment stream stage",
    zh: "流式支付舞台",
  },
  streamFlowPreview: {
    en: "Payment stream preview",
    zh: "支付流预览",
  },
  stagedFlow: {
    en: "Live stream route",
    zh: "资金流路径",
  },
  payerWallet: {
    en: "Your wallet",
    zh: "你的钱包",
  },
  streamVault: {
    en: "Stream vault",
    zh: "资金流金库",
  },
  stageIdle: {
    en: "Ready to plan",
    zh: "准备配置",
  },
  stageDraft: {
    en: "Drafting stream",
    zh: "正在草拟",
  },
  stageReady: {
    en: "Ready to sign",
    zh: "准备签名",
  },
  stageSigning: {
    en: "Signing stream",
    zh: "正在签名",
  },
  stageLive: {
    en: "Streams live",
    zh: "资金流运行中",
  },
  totalStreams: { en: "Total Streams", zh: "总流数量" },
  active: { en: "Active", zh: "活跃" },
  createdByYou: { en: "Created by You", zh: "你创建的" },
  youAreBeneficiary: { en: "You're Beneficiary", zh: "你是受益人" },

  // Create form
  createStream: { en: "Create Stream", zh: "创建资金流" },
  creatingStream: { en: "Creating stream...", zh: "正在创建资金流……" },
  streamConsole: { en: "Stream console", zh: "资金流控制台" },
  createStreamDescription: {
    en: "Create a funded GAS or NEO payment stream for a Neo N3 recipient.",
    zh: "为 Neo N3 收款地址创建已注资的 GAS 或 NEO 流式支付。",
  },
  recipient: { en: "Recipient Address", zh: "收款地址" },
  recipientPlaceholder: { en: "N3 address...", zh: "输入 N3 地址……" },
  amount: { en: "Amount", zh: "金额" },
  duration: { en: "Duration", zh: "周期" },
  durationPlaceholder: { en: "Number of days", zh: "天数" },
  token: { en: "Token", zh: "代币" },

  // Lists
  yourCreatedStreams: { en: "Your Created Streams", zh: "你创建的资金流" },
  streamsYouReceive: { en: "Streams You Receive", zh: "你收到的资金流" },
  noCreatedStreams: {
    en: "You haven't created any streams yet",
    zh: "你还没有创建任何资金流",
  },
  noBeneficiaryStreams: { en: "No incoming streams", zh: "暂无收到的资金流" },
  streamListUnavailableTitle: {
    en: "Stream index unavailable",
    zh: "资金流索引暂不可用",
  },
  streamListUnavailable: {
    en: "The payment stream index could not be loaded right now. You can still prepare a new stream; created and incoming stream lists refresh once the stream contract is reachable.",
    zh: "暂时无法加载资金流索引。你仍可以准备新的资金流；当资金流合约可访问时，已创建和待领取列表会自动刷新。",
  },
  streamActionUnavailable: {
    en: "The stream action could not be completed right now. Review the stream details here, then try again.",
    zh: "暂时无法完成该资金流操作。你可以先在此检查资金流参数，然后重试。",
  },
  to: { en: "To", zh: "收款方" },
  from: { en: "From", zh: "付款方" },

  vaultName: { en: "Stream name", zh: "资金流名称" },
  vaultNamePlaceholder: { en: "Monthly payroll stream", zh: "每月工资流" },
  beneficiary: { en: "Beneficiary address", zh: "受益人地址" },
  beneficiaryPlaceholder: { en: "Enter Neo N3 address", zh: "输入 Neo N3 地址" },
  assetType: { en: "Asset", zh: "资产" },
  assetNeo: { en: "NEO", zh: "NEO" },
  assetGas: { en: "GAS", zh: "GAS" },
  totalAmount: { en: "Total amount", zh: "总金额" },
  totalAmountPlaceholder: { en: "20", zh: "20" },
  totalAmountHint: { en: "Funds are locked in the stream", zh: "资金将锁定在该资金流中" },
  rateAmount: { en: "Release per interval", zh: "每期释放" },
  rateAmountPlaceholder: { en: "1.5", zh: "1.5" },
  intervalDays: { en: "Interval (days)", zh: "周期（天）" },
  intervalDaysPlaceholder: { en: "30", zh: "30" },
  intervalHint: { en: "Minimum 1 day, maximum 365 days", zh: "最少 1 天，最多 365 天" },
  notes: { en: "Notes (optional)", zh: "备注（可选）" },
  notesPlaceholder: { en: "Add context for the recipient", zh: "补充说明" },
  streamId: { en: "Stream ID", zh: "资金流 ID" },
  streamIdPlaceholder: { en: "1", zh: "1" },
  claimStreamDescription: {
    en: "Claim vested funds from an incoming stream.",
    zh: "从收到的资金流中领取已释放资金。",
  },
  cancel: { en: "Cancel", zh: "取消" },
  cancelStreamDescription: {
    en: "Cancel one of your outgoing streams and recover unreleased funds.",
    zh: "取消你创建的资金流并取回未释放资金。",
  },

  createVault: { en: "Create Stream", zh: "创建资金流" },
  vaultCreated: { en: "Stream created", zh: "资金流已创建" },

  // Action success notifications (passed to notify.guard in main.tsx; run through t()).
  streamCreated: { en: "Stream created", zh: "资金流已创建" },
  streamCancelled: { en: "Stream cancelled", zh: "资金流已取消" },
  streamClaimed: { en: "Funds claimed", zh: "资金已领取" },
  streamNotFound: { en: "Stream not found", zh: "未找到资金流" },

  contractMissing: { en: "Contract address not configured", zh: "合约地址未配置" },

  invalidAddress: { en: "Invalid beneficiary address", zh: "受益人地址无效" },
  invalidAmount: { en: "Enter a valid amount", zh: "请输入有效金额" },
  rateTooHigh: { en: "Release amount exceeds total", zh: "释放金额超过总金额" },
  intervalInvalid: { en: "Interval out of range", zh: "周期超出范围" },
  depositStrandedRecoverable: {
    en: "Your deposit landed but the stream was not created. The prepaid credit is held on the contract under your address — submit again to reuse it without depositing twice.",
    zh: "存入已到账，但资金流未能创建。预付额度已在合约中保留在你的地址名下——再次提交即可复用，无需重复存入。",
  },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },

  myCreated: { en: "Created by you", zh: "我创建的" },
  beneficiaryVaults: { en: "For you", zh: "受益给我的资金流" },
  emptyVaults: { en: "No streams yet", zh: "暂无资金流" },
  awaitingActivity: { en: "Awaiting activity", zh: "等待链上活动" },
  refresh: { en: "Refresh", zh: "刷新" },
  sidebarCreatedStreams: { en: "Created Streams", zh: "已创建流" },
  sidebarBeneficiaryStreams: { en: "Beneficiary Streams", zh: "受益流" },
  sidebarTotalStreams: { en: "Total Streams", zh: "总流数量" },

  statusActive: { en: "Active", zh: "活跃" },
  streamSingular: { en: "Stream", zh: "流" },
  streamPlural: { en: "Streams", zh: "流" },
  statusCompleted: { en: "Completed", zh: "已完成" },
  statusCancelled: { en: "Cancelled", zh: "已取消" },
  totalLocked: { en: "Total locked", zh: "总锁定" },
  released: { en: "Released", zh: "已释放" },
  remaining: { en: "Remaining", zh: "剩余" },
  claimable: { en: "Claimable", zh: "可领取" },
  intervalLabel: { en: "Interval", zh: "周期" },
  rateLabel: { en: "Release", zh: "释放" },

  claim: { en: "Claim", zh: "领取" },
  claiming: { en: "Claiming...", zh: "领取中..." },
  cancelling: { en: "Cancelling...", zh: "取消中..." },

  docSubtitle: {
    en: "Scheduled releases for payrolls, subscriptions, and allowances",
    zh: "用于工资、订阅与津贴的定期释放",
  },
  docDescription: {
    en: "A payment stream locks GAS or NEO and stores a release schedule on-chain. Claimable amounts accrue per interval, letting beneficiaries claim over time while creators can cancel and recover unvested funds.",
    zh: "资金流会锁定 GAS 或 NEO，并将释放计划记录在链上。可领取金额按周期累积，受益人按期领取，创建者可取消并收回未释放的余额。",
  },
  step1: {
    en: "Create a stream with beneficiary, asset, total amount, and interval.",
    zh: "填写受益人、资产、总金额与周期来创建资金流。",
  },
  step2: { en: "Funds lock immediately and begin the release schedule.", zh: "资金立即锁定并开始按周期释放。" },
  step3: { en: "Beneficiary claims accumulated amounts each period.", zh: "受益人按期领取累积的可领取金额。" },
  step4: { en: "Creator can cancel and reclaim remaining balance.", zh: "创建者可取消并取回剩余余额。" },
  feature1Name: { en: "Time-based Vesting", zh: "时间释放" },
  feature1Desc: { en: "Release amount is tied to a fixed interval.", zh: "释放金额与固定周期绑定。" },
  feature2Name: { en: "Claim Tracking", zh: "领取跟踪" },
  feature2Desc: { en: "On-chain tracking of released vs remaining funds.", zh: "链上记录已释放与剩余金额。" },
  ariaStreams: { en: "Streams", zh: "流" },
  feature3Name: { en: "Cancelable", zh: "可取消" },
  feature3Desc: { en: "Creators can reclaim unvested funds at any time.", zh: "创建者可随时取回未释放余额。" },

  // Shared-runtime example hero + transaction preview (neo-pay-shared-example).
  // Defined here so the shared example localizes consistently with the form
  // instead of falling back to inline English under the zh locale.
  sharedRuntime: { en: "Shared runtime", zh: "共享运行时" },
  sharedRuntimeTitle: { en: "NeoPay shared streams", zh: "NeoPay 共享资金流" },
  sharedRuntimeSubtitle: {
    en: "Create a funded payment stream through the shared vault and vesting modules.",
    zh: "通过共享金库与释放模块创建已注资的流式支付。",
  },
  reviewStream: { en: "Complete stream details", zh: "请完善资金流信息" },
  enterDetails: { en: "Enter details", zh: "填写详情" },
  transactionPreview: { en: "Transaction preview", zh: "交易预览" },
  transactionPreviewHint: {
    en: "Funds lock in the stream immediately. The wallet shows the exact GAS network fee before you sign.",
    zh: "资金会立即锁入资金流。钱包会在签名前显示准确的 GAS 网络费。",
  },
  network: { en: "Network", zh: "网络" },
  networkMainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  networkTestnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  networkFee: { en: "Network fee", zh: "网络费" },
  networkFeeValue: { en: "Estimated in GAS at signing", zh: "签名时以 GAS 估算" },
  streamMetadata: { en: "Stream details", zh: "资金流详情" },
  gasAssetHint: { en: "Fees + streams", zh: "费用与支付" },
  neoAssetHint: { en: "Whole-token streams", zh: "整数释放" },
  howItWorksTitle: { en: "How streaming payments work", zh: "流式支付如何工作" },
  howStep1: {
    en: "Set the recipient, amount, and duration above. GAS and NEO are supported.",
    zh: "在上方设置收款人、金额和周期。支持 GAS 和 NEO。",
  },
  howStep2: {
    en: "Funds lock in the stream on creation and release on a fixed daily schedule.",
    zh: "创建后资金会锁入资金流，并按固定每日计划释放。",
  },
  howStep3: {
    en: "The recipient claims released funds anytime; you can cancel to reclaim what is unreleased.",
    zh: "收款人可随时领取已释放资金；你可以取消并取回未释放部分。",
  },
  howFootnote: {
    en: "Your created and incoming streams will appear here once the first one is on-chain.",
    zh: "第一条资金流上链后，你创建和收到的资金流会显示在这里。",
  },
  clear: { en: "Clear", zh: "清空" },
  // Daily linear release model: the preview rate is per day, so label it
  // explicitly to match the derived schedule the contract receives.
  releasePerDay: { en: "Release per day", zh: "每日释放" },
  releasePerDayValue: { en: "{amount} {token} / day", zh: "{amount} {token} / 天" },
  rateRoundsToZero: {
    en: "Amount is too small for this duration — increase the amount or shorten the duration.",
    zh: "相对该周期金额过小——请增加金额或缩短周期。",
  },
  // ── Create-form disclosures (2-signature flow + NEO cliff) ───────────────
  twoStepSignNotice: {
    en: "Creating a stream needs two wallet signatures: first the {token} deposit, then the stream setup.",
    zh: "创建资金流需要两次钱包签名：先存入 {token}，再设置资金流。",
  },
  schedulePreview: {
    en: "Releases {amount} {token}/day for {days} days.",
    zh: "在 {days} 天内每天释放 {amount} {token}。",
  },
  neoCliffNotice: {
    en: "Less than 1 NEO/day at this duration — all {amount} NEO releases in a single cliff at day {days}, not gradually.",
    zh: "按此期限每天不足 1 NEO——全部 {amount} NEO 将在第 {days} 天一次性释放，而非逐步释放。",
  },
  claimNothingYet: {
    en: "Nothing to claim yet — funds vest over time.",
    zh: "暂无可领取——资金会随时间逐步释放。",
  },
} as const;

export const messages = mergeMessages(appMessages);
