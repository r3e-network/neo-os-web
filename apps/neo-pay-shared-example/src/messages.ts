import { messages as sharedNeoPayMessages } from "@shared/composables/neo-pay";

const studioMessages = {
  title: { en: "NeoPay Stream Studio", zh: "NeoPay 流支付工作台" },
  studioName: { en: "NeoPay Stream Studio", zh: "NeoPay 流支付工作台" },
  studioEyebrow: { en: "Programmable payments", zh: "可编程支付" },
  studioHeroTitle: { en: "Shape one clear payment stream", zh: "清晰规划一条流式支付" },
  studioHeroSubtitle: {
    en: "Fund a real GAS or NEO route, review its release ticket, then confirm once in your wallet.",
    zh: "规划真实的 GAS 或 NEO 支付路线，核对释放票据，再在钱包中一次确认。",
  },
  studioStageAria: { en: "NeoPay payment stream workstation", zh: "NeoPay 流支付工作台" },
  paymentArtAlt: {
    en: "A bright payment vault streaming Neo assets to a recipient terminal",
    zh: "明亮的支付金库将 Neo 资产流式发送到收款终端",
  },
  liveContract: { en: "Live contract", zh: "实时合约" },
  networkMainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  networkTestnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  networkUnknown: { en: "Network unavailable", zh: "网络不可用" },
  networkAwaiting: { en: "Network on connect", zh: "连接后确定网络" },
  bindingVerified: { en: "Canonical NeoPay", zh: "NeoPay 官方合约" },
  bindingAwaiting: {
    en: "Connect to verify the NeoPay contract for your network.",
    zh: "连接后即可校验当前网络的 NeoPay 合约。",
  },
  bindingMismatch: {
    en: "NeoPay contract does not match this network. Wallet actions are locked.",
    zh: "NeoPay 合约与当前网络不匹配，钱包操作已锁定。",
  },
  serviceDisconnected: { en: "Connect wallet for live streams", zh: "连接钱包以加载实时资金流" },
  serviceLoading: { en: "Loading live stream state", zh: "正在加载实时资金流状态" },
  serviceLive: { en: "Live chain view", zh: "实时链上视图" },
  servicePartial: { en: "Partial chain view", zh: "不完整链上视图" },
  servicePending: { en: "Confirmation pending", zh: "等待链上确认" },
  serviceUnavailable: { en: "Live stream data unavailable", zh: "实时资金流数据不可用" },
  paymentTicket: { en: "Payment ticket", zh: "支付票据" },
  ticketDraft: { en: "Complete the payment route", zh: "完善支付路线" },
  ticketReady: { en: "Ready for wallet review", zh: "准备钱包确认" },
  ticketPending: { en: "Submitted — do not repeat", zh: "已提交——请勿重复操作" },
  assetPicker: { en: "Payment asset", zh: "支付资产" },
  officialAsset: { en: "Official Neo N3 asset", zh: "Neo N3 官方资产" },
  streamAmount: { en: "Stream amount", zh: "资金流金额" },
  amountPresets: { en: "Amount presets", zh: "金额快捷选项" },
  amountEmptyHint: { en: "Choose an amount to fund.", zh: "选择要注资的金额。" },
  // Zero-state for the ticket-overlay headline. Kept short and distinct from
  // `amountEmptyHint` (the sentence under the input): this one stands in a
  // 42px headline slot, so it is a phrase, not a sentence.
  amountEmptyValue: { en: "Enter an amount", zh: "输入金额" },
  neoWholeAmountRequired: {
    en: "NEO is indivisible. Enter a positive whole-token amount; your draft was not changed.",
    zh: "NEO 不可分割，请输入正整数金额；当前草稿不会被自动修改。",
  },
  gasFixed8Required: {
    en: "Enter a positive GAS amount with no more than 8 decimal places.",
    zh: "请输入正数 GAS 金额，小数最多 8 位。",
  },
  recipientRoute: { en: "Recipient route", zh: "收款路线" },
  recipientEmptyHint: { en: "Enter a valid Neo N3 address.", zh: "输入有效的 Neo N3 地址。" },
  // Endpoint label in the compact GAS -> recipient route diagram. The diagram
  // row is too narrow for `recipientEmptyHint`'s full sentence (which already
  // sits directly below it), so the unset endpoint names its own state.
  routeRecipientPending: { en: "Recipient pending", zh: "待填收款方" },
  durationDays: { en: "Release duration", zh: "释放周期" },
  durationRangeRequired: { en: "Use a whole number from 1 to 365 days.", zh: "请输入 1 至 365 的整数天数。" },
  daysValue: { en: "{days} days", zh: "{days} 天" },
  releasePreview: { en: "Release ticket", zh: "释放票据" },
  releaseWaiting: { en: "Add valid route details to preview the schedule.", zh: "完善有效的路线参数后即可预览释放计划。" },
  atomicFundingHint: {
    en: "One wallet transaction atomically funds and creates the stream. A fault rolls the complete transaction back.",
    zh: "一次钱包交易会原子完成注资和创建；若执行失败，整笔交易都会回滚。",
  },
  createStudioStream: { en: "Create payment stream", zh: "创建流式支付" },
  creatingStudioStream: { en: "Creating payment stream…", zh: "正在创建流式支付……" },
  defaultStreamTitle: { en: "Stream to {address}", zh: "支付给 {address} 的资金流" },
  studioBusy: { en: "Another stream action is already in progress.", zh: "另一项资金流操作正在处理中。" },
  checkPendingStream: { en: "Check pending transaction", zh: "检查待确认交易" },
  checkingPendingStream: { en: "Checking chain state…", zh: "正在检查链上状态……" },
  streamWorkspace: { en: "Streams & details", zh: "资金流与详情" },
  outgoingTab: { en: "Created", zh: "已创建" },
  incomingTab: { en: "Receiving", zh: "待领取" },
  exactTab: { en: "Ticket", zh: "精确票据" },
  guideTab: { en: "How it works", zh: "工作原理" },
  refreshStreams: { en: "Refresh chain view", zh: "刷新链上视图" },
  exactTicketTitle: { en: "Exact payment ticket", zh: "精确支付票据" },
  exactTicketSubtitle: {
    en: "Review contract, network, release calculation, and optional context away from the main stage.",
    zh: "在次级区域核对合约、网络、释放计算与可选备注，让主舞台保持清晰。",
  },
  contractAddress: { en: "Contract", zh: "合约" },
  pendingTransaction: { en: "Pending transaction", zh: "待确认交易" },
  noPendingTransaction: { en: "No pending transaction", zh: "没有待确认交易" },
  releaseRate: { en: "Release rate", zh: "释放速率" },
  noCreatedStudioStreams: { en: "No verified outgoing streams yet.", zh: "暂无已验证的已创建资金流。" },
  noIncomingStudioStreams: { en: "No verified incoming streams yet.", zh: "暂无已验证的待领取资金流。" },
  streamDataUnavailable: {
    en: "The chain list could not be verified. Counts and empty states are hidden until a read succeeds.",
    zh: "暂时无法验证链上列表；读取成功前不会显示数量或空列表结论。",
  },
  streamDataWaiting: {
    en: "Connect or finish the current chain read before drawing a conclusion about stream history.",
    zh: "请先连接钱包或等待本次链上读取完成，再查看资金流历史结论。",
  },
  streamLabel: { en: "Stream #{id}", zh: "资金流 #{id}" },
  streamCounterparty: { en: "Counterparty", zh: "交易对方" },
  confirmCancel: { en: "Confirm cancel", zh: "确认取消" },
  authoritativeActionHint: {
    en: "Claim and cancel are available only on streams loaded from the canonical contract.",
    zh: "仅可对官方合约已加载的资金流执行领取或取消。",
  },
  guideTitle: { en: "A payment stream in three steps", zh: "三步完成流式支付" },
  guideStep1: {
    en: "Choose GAS or NEO, a valid recipient, an amount, and a 1–365 day release horizon.",
    zh: "选择 GAS 或 NEO、有效收款地址、金额与 1 至 365 天释放周期。",
  },
  guideStep2: {
    en: "One atomic transaction funds the vault and creates the on-chain schedule.",
    zh: "一笔原子交易完成金库注资并创建链上释放计划。",
  },
  guideStep3: {
    en: "The listed beneficiary can claim vested funds; the listed creator can cancel and recover unreleased funds.",
    zh: "列表中的受益人可领取已释放资金；创建者可取消并收回未释放部分。",
  },
  docsSubtitle: {
    en: "A focused workstation for canonical NeoPay payment streams",
    zh: "面向 NeoPay 官方流式支付的专注工作台",
  },
  docsDescription: {
    en: "NeoPay Stream Studio keeps shared-runtime composition metadata while using the live MiniAppNeoPay contract for authoritative stream state and wallet actions.",
    zh: "NeoPay 流支付工作台保留共享运行时组合元数据，并以实时 MiniAppNeoPay 合约作为资金流状态与钱包操作的权威来源。",
  },
  feature1Name: { en: "Atomic funding", zh: "原子注资" },
  feature1Desc: { en: "Funding and stream creation share one transaction.", zh: "注资与资金流创建在同一笔交易中完成。" },
  feature2Name: { en: "Recoverable pending state", zh: "可恢复待确认状态" },
  feature2Desc: { en: "A submitted transaction stays pending until chain state confirms it.", zh: "已提交交易会保持待确认，直到链上状态完成确认。" },
  feature3Name: { en: "Authoritative actions", zh: "权威链上操作" },
  feature3Desc: { en: "Claim and cancel operate only on live listed streams.", zh: "领取与取消仅作用于实时链上列表中的资金流。" },
} as const;

export const messages = {
  ...sharedNeoPayMessages,
  ...studioMessages,
};
