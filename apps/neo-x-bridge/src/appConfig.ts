import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-neo-x-bridge";

export const appMeta = {
  networkLabel: "Neo N3 / Neo X",
  endpointLabel: "Official bridge / source-chain RPC",
};

export const manifest: MiniAppManifest = {
  name: "Neo X Bridge",
  description:
    "Review a Neo N3 / Neo X GAS or NEO route, verify source-wallet readiness, continue on the official bridge, and check source receipts without guessing delivery.",
  icon: "link",
  category: "defi",
  shell: "console",
  theme: { family: "finance", accentColor: "#16c784", density: "comfortable" },
  tabs: [{ key: "console", labelKey: "tabConsole", icon: "link", default: true }],
  stats: [],
  // The designed route workspace owns its controls; the generic operation
  // panel must stay empty so this product never falls back to a survey form.
  operations: [],
  sidebar: { titleKey: "appName", items: [] },
  features: {
    walletRequired: false,
    chainWarning: true,
    comments: true,
    reviews: true,
  },
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
  permissions: { payments: false },
};

const appMessages = {
  appName: { en: "Neo X Bridge", zh: "Neo X 跨链桥" },
  tabConsole: { en: "Bridge", zh: "跨链" },
  docsSubtitle: {
    en: "A route-first GAS and NEO workspace that verifies source-wallet readiness, hands execution to the official bridge, and checks source receipts separately.",
    zh: "以路径为核心的 GAS 与 NEO 工作区：核验源钱包准备度，执行交给官方跨链桥，并单独检查源链回执。",
  },
  feature1Name: { en: "Official GAS and NEO routes", zh: "官方 GAS 与 NEO 路径" },
  feature1Desc: {
    en: "The review ticket binds environment, direction, chain IDs, asset precision, source account, amount, destination wallet, and local expiry.",
    zh: "核对票据绑定环境、方向、链 ID、资产精度、源账户、数量、目标钱包和本地有效期。",
  },
  feature2Name: { en: "Official execution boundary", zh: "官方执行边界" },
  feature2Desc: {
    en: "Live limits, fees, approvals, signing, and submission remain on the official bridge and are rechecked there.",
    zh: "实时限额、费用、授权、签名与提交均在官方跨链桥重新核对并完成。",
  },
  feature3Name: { en: "Honest receipt checks", zh: "诚实的回执检查" },
  feature3Desc: {
    en: "Source receipts are checked live; destination delivery remains unverified without a destination event and state readback.",
    zh: "实时检查源链回执；缺少目标链事件与状态读回时，目标链交付保持未验证。",
  },

  heroEyebrow: { en: "Neo N3 ↔ Neo X", zh: "Neo N3 ↔ Neo X" },
  heroTitleShort: {
    en: "Bridge GAS or NEO with both chains in view",
    zh: "同时看清两条链，跨链 GAS 或 NEO",
  },
  heroNoFundsShort: {
    en: "Review here; reconnect, quote, and sign on the official bridge.",
    zh: "在此核对；在官方跨链桥重新连接、报价并签名。",
  },
  workspaceModeAria: { en: "Bridge workspace mode", zh: "跨链工作区模式" },
  bridgeStageAria: { en: "Cross-chain route stage", zh: "跨链路径舞台" },
  testnet: { en: "Testnet", zh: "测试网" },
  mainnet: { en: "Mainnet", zh: "主网" },
  // "T5"/"T4" are internal net numbers that mean nothing to a store visitor.
  // Name the networks plainly instead; the exact chain id still travels with
  // every wallet attestation and route payload.
  testnetRoute: { en: "Neo N3 TestNet ↔ Neo X TestNet", zh: "Neo N3 测试网 ↔ Neo X 测试网" },
  mainnetRoute: { en: "Neo N3 MainNet ↔ Neo X MainNet", zh: "Neo N3 主网 ↔ Neo X 主网" },
  // The headline badge used to stamp "{environment} workspace" on the entry
  // surface. With no host-provided network the app follows its deliberate
  // never-promote-to-mainnet default (see `resolveBridgeEnvironment`), so a
  // cold store visit was branded "Testnet workspace" before the visitor did
  // anything — a staleness chip on a funds-bridging surface.
  //
  // The badge now names what this app IS (a review console; every quote,
  // approval and signature happens on the official bridge). The network is not
  // hidden: it stays one glance away in the route card, which is the surface
  // that is actually about the route and states the target network for both
  // environments.
  reviewWorkspace: { en: "Review workspace", zh: "核对工作区" },
  liveRoute: { en: "Configured official route", zh: "已配置的官方路径" },
  sourceChain: { en: "Source chain", zh: "源链" },
  destinationChain: { en: "Destination chain", zh: "目标链" },
  swapRoute: { en: "Reverse route", zh: "反转路径" },
  serviceBoundaryTitle: { en: "Route services", zh: "路径服务" },
  sourceRpc: { en: "Source RPC", zh: "源链 RPC" },
  destinationRpc: { en: "Destination RPC", zh: "目标链 RPC" },
  officialQuoteOnly: { en: "Quote on official bridge", zh: "报价由官方跨链桥提供" },

  bridgeAssets: { en: "Bridge assets", zh: "资产跨链" },
  verifyTransfer: { en: "Check source receipt", zh: "检查源链回执" },
  assetTicketEyebrow: { en: "{asset} review ticket", zh: "{asset} 核对票据" },
  bridgeAssetTitle: { en: "Review a {asset} route", zh: "核对 {asset} 跨链路径" },
  assetSelectorAria: { en: "Bridge asset", zh: "跨链资产" },
  asset: { en: "Asset", zh: "资产" },
  amount: { en: "Amount", zh: "数量" },
  amountPresetsAria: { en: "{asset} amount presets", zh: "{asset} 数量预设" },
  destinationAddress: { en: "Destination wallet", zh: "目标钱包" },
  recipient: { en: "Destination wallet", zh: "目标钱包" },
  recipientNeoX: { en: "Neo X 0x address", zh: "Neo X 0x 地址" },
  recipientNeoN3: { en: "Checksum-valid Neo N3 address", zh: "通过校验和验证的 Neo N3 地址" },
  recipientMatchBoundary: {
    en: "Review only: this address is not sent to the official bridge. Connect and verify the same destination wallet there.",
    zh: "仅用于核对：该地址不会传给官方跨链桥。请在官方页面连接并确认同一目标钱包。",
  },
  recipientMatchesConnectedWallet: {
    en: "This address is bound to the connected destination wallet for the local review ticket.",
    zh: "该地址已与连接的目标钱包绑定到本地核对票据。",
  },
  connectWallet: { en: "Connect wallet", zh: "连接钱包" },
  connectingWallet: { en: "Connecting…", zh: "连接中…" },
  connectSourceWallet: { en: "Connect source wallet", zh: "连接源钱包" },
  sourceWallet: { en: "Source wallet", zh: "源钱包" },
  sourceBalance: { en: "Verified source balance", zh: "已核验源链余额" },
  neoBalanceWithGasReserve: {
    en: "{neo} NEO · {gas} GAS fee reserve",
    zh: "{neo} NEO · {gas} GAS 手续费余额",
  },
  connectSourceForBalance: { en: "Connect source wallet", zh: "连接源钱包后查看" },
  balanceUnavailable: { en: "Balance unavailable", zh: "余额暂不可用" },
  balanceAtOfficialBridge: {
    en: "Rechecked on official bridge",
    zh: "由官方跨链桥重新核对",
  },
  errAmountFixed8: {
    en: "Use a positive GAS amount with no more than 8 decimal places.",
    zh: "请输入正数 GAS，且小数不超过 8 位。",
  },
  errAmountNeoWhole: {
    en: "Use a positive whole-number NEO amount.",
    zh: "NEO 数量必须是正整数。",
  },
  errAddressNeoX: {
    en: "This route settles on Neo X. Enter a Neo X 0x address.",
    zh: "该路径在 Neo X 结算，请输入 Neo X 0x 地址。",
  },
  errAddressNeoN3: {
    en: "This route settles on Neo N3. Enter a checksum-valid Neo N3 address.",
    zh: "该路径在 Neo N3 结算，请输入通过校验和验证的 Neo N3 地址。",
  },
  errDestinationWalletMismatch: {
    en: "The destination address does not match the connected destination wallet.",
    zh: "目标地址与已连接的目标钱包不一致。",
  },
  hintAssetGate: {
    en: "Enter a supported asset amount and matching destination wallet.",
    zh: "请输入受支持的资产数量和匹配的目标钱包。",
  },
  handoffFactsTitle: { en: "Bound handoff", zh: "交接绑定" },
  quoteOutput: { en: "Quoted output", zh: "报价输出" },
  officialBridgeRequired: { en: "Shown on official bridge", zh: "由官方跨链桥展示" },
  costsBridgeFee: { en: "Bridge fee", zh: "桥接费用" },
  feeAtOfficialBridge: { en: "Shown before wallet signing", zh: "钱包签名前展示" },
  estimatedTime: { en: "Typical completion", zh: "通常完成时间" },
  oneToTwoMinutes: { en: "About 1–2 min", zh: "约 1–2 分钟" },
  approval: { en: "Wallet step", zh: "钱包步骤" },
  approvalIfRequired: { en: "Approval reviewed on official bridge", zh: "在官方跨链桥核对授权" },
  walletReviewAtOfficialBridge: { en: "Review and sign on official bridge", zh: "在官方跨链桥核对并签名" },
  snapshotExpiry: { en: "Snapshot expiry", zh: "快照有效期" },
  expiresInMinutes: { en: "{minutes} min", zh: "{minutes} 分钟" },
  tenMinuteSnapshot: { en: "10 min after preparation", zh: "生成后 10 分钟" },
  handoffBound: { en: "Review ticket ready — nothing submitted", zh: "核对票据已就绪——尚未提交" },
  handoffExpired: { en: "Expired", zh: "已过期" },
  handoffExpiredTitle: { en: "Review ticket expired", zh: "核对票据已过期" },
  handoffExpiredBody: {
    en: "Renew it to refresh the local ten-minute review window.",
    zh: "请更新票据，以刷新本地十分钟核对窗口。",
  },
  requestId: { en: "Local ticket ID", zh: "本地票据 ID" },

  sourceVerificationEyebrow: { en: "Read-only chain evidence", zh: "只读链上证据" },
  verifySourceTitle: {
    en: "Check the source receipt, never guess delivery",
    zh: "检查源链回执，不猜测交付",
  },
  verifySourceBody: {
    en: "A source receipt proves only the source transaction. Destination delivery needs its own event and state readback.",
    zh: "源链回执只能证明源交易；目标链交付还需要独立的事件与状态读回证据。",
  },
  sourceTx: { en: "Source transaction hash", zh: "源链交易哈希" },
  sourceTransaction: { en: "Source transaction", zh: "源链交易" },
  sourceBridgeEvent: { en: "Source bridge event", zh: "源链桥事件" },
  destinationDelivery: { en: "Destination delivery", zh: "目标链交付" },
  checking: { en: "Checking…", zh: "检查中…" },
  checkingSource: { en: "Checking source…", zh: "正在检查源链…" },
  sourceConfirmed: { en: "Source confirmed", zh: "源链已确认" },
  sourceFaulted: { en: "Source faulted", zh: "源链执行失败" },
  sourcePending: { en: "Source pending", zh: "源链待确认" },
  sourceUnknown: { en: "Source unavailable", zh: "源链状态未知" },
  sourceNotChecked: { en: "Not checked", zh: "尚未检查" },
  verified: { en: "Verified", zh: "已核验" },
  notVerified: { en: "Not verified", zh: "未核验" },
  sourceOnlyConfirmed: {
    en: "Source confirmed; destination still unverified",
    zh: "源链已确认；目标链仍未核验",
  },
  sourcePendingRetry: {
    en: "Source transaction pending — check again later",
    zh: "源链交易待确认——请稍后再次检查",
  },
  sourceFaultedFinal: {
    en: "Source transaction faulted — do not expect delivery",
    zh: "源链交易执行失败——不要等待目标链到账",
  },
  verificationRetryable: {
    en: "No final evidence yet — safe to retry",
    zh: "尚无最终证据，可安全重试",
  },
  destinationNeverInferred: {
    en: "A source receipt never marks the destination as delivered.",
    zh: "源链回执绝不会把目标链标记为已交付。",
  },
  errSourceTx: {
    en: "Enter 0x followed by a 64-character transaction hash.",
    zh: "请输入 0x 加 64 位十六进制交易哈希。",
  },
  errSourceNetworkMismatch: {
    en: "The source RPC does not match this route's network. Switch networks or try again later.",
    zh: "源链 RPC 与当前路径网络不匹配，请切换网络或稍后重试。",
  },
  errHandoffBindingChanged: {
    en: "The route or request binding changed. Prepare a fresh handoff before checking this receipt.",
    zh: "路径或请求绑定已变化，请先重新准备交接，再检查本次回执。",
  },
  connectNeoN3WalletFirst: {
    en: "Connect the Neo N3 wallet for this route first.",
    zh: "请先连接当前路径所需的 Neo N3 钱包。",
  },
  connectNeoXWalletFirst: {
    en: "Connect the Neo X wallet for this route first.",
    zh: "请先连接当前路径所需的 Neo X 钱包。",
  },
  errNeoN3WalletAccount: { en: "The Neo N3 wallet returned an invalid account.", zh: "Neo N3 钱包返回了无效账户。" },
  errNeoXWalletAccount: { en: "The Neo X wallet returned an invalid account.", zh: "Neo X 钱包返回了无效账户。" },
  errWalletBalance: { en: "The wallet returned an invalid balance.", zh: "钱包返回了无效余额。" },
  errWalletChangedDuringRead: {
    en: "The wallet account or network changed during the balance read. Reconnect and try again.",
    zh: "读取余额时钱包账户或网络发生变化，请重新连接后再试。",
  },
  errWalletNetworkMismatch: {
    en: "The wallet network does not match this bridge workspace.",
    zh: "钱包网络与当前跨链工作区不匹配。",
  },
  errInsufficientBalance: {
    en: "The amount exceeds the verified source balance. Keep additional GAS available for live bridge and network fees.",
    zh: "数量超过已核验的源链余额；还需额外保留 GAS 支付实时桥接费和网络费。",
  },
  errGasReserve: {
    en: "This wallet needs GAS for the live bridge and network fees before bridging NEO.",
    zh: "跨链 NEO 前，该钱包需要预留 GAS 支付实时桥接费与网络费。",
  },
  errWalletChain: { en: "Choose a supported Neo N3 or Neo X wallet.", zh: "请选择受支持的 Neo N3 或 Neo X 钱包。" },
  errHandoffStorage: {
    en: "The review ticket could not be recovered from local storage, so it was not accepted.",
    zh: "本地存储无法读回核对票据，因此本次票据未被接受。",
  },
  errVerificationStorage: {
    en: "The receipt check could not be recovered locally, so the chain read was not started.",
    zh: "本地无法读回回执检查请求，因此未启动链上读取。",
  },

  prepareHandoffAction: { en: "Prepare bridge handoff", zh: "准备跨链交接" },
  renewHandoffAction: { en: "Renew review ticket", zh: "更新核对票据" },
  continueOfficialBridge: { en: "Continue on official bridge", zh: "前往官方跨链桥继续" },
  verifySourceAction: { en: "Check source receipt", zh: "检查源链回执" },
  checkAgain: { en: "Check again", zh: "再次检查" },
  refreshServices: { en: "Refresh services", zh: "刷新服务" },
  details: { en: "Details", zh: "详情" },
  bridgeDetails: { en: "Bridge details", zh: "跨链详情" },
  evidenceTitle: { en: "Evidence", zh: "证据" },
  resourcesAria: { en: "Bridge resources", zh: "跨链资源" },
  resOfficialBridge: { en: "Official bridge", zh: "官方跨链桥" },
  resAssetBridgeDocs: { en: "Asset bridge guide", zh: "资产桥指南" },
  resBridgeIndexer: { en: "Bridge indexer", zh: "跨链索引器" },
  resMessageBridgeDocs: { en: "MessageBridge developer guide", zh: "MessageBridge 开发者指南" },
  viewSourceTxExplorer: { en: "Open source transaction in explorer", zh: "在浏览器中打开源链交易" },
  messageBridgeAdvancedNote: {
    en: "MessageBridge is a developer resource only. This asset workspace does not imitate its ABI, relay, fee, or destination-execution flow.",
    zh: "MessageBridge 仅作为开发者资源。本资产工作区不会伪造其 ABI、中继、费用或目标链执行流程。",
  },

  statusReady: { en: "Route review ready", zh: "路径核对已就绪" },
  statusHandoffRestored: { en: "Recovered the last local review ticket", zh: "已恢复上次的本地核对票据" },
  statusHandoffExpired: {
    en: "The recovered review ticket expired; renew it before continuing",
    zh: "恢复的核对票据已过期，请更新后再继续",
  },
  statusAssetReady: { en: "Bridge review ticket prepared", zh: "跨链核对票据已生成" },
  statusNeoN3WalletReady: { en: "Neo N3 wallet and balances verified", zh: "Neo N3 钱包与余额已核验" },
  statusNeoXWalletReady: { en: "Neo X wallet and native GAS balance verified", zh: "Neo X 钱包与原生 GAS 余额已核验" },
  statusWalletRefreshed: { en: "Wallet readiness refreshed", zh: "钱包准备度已刷新" },
  statusIntentPrepared: { en: "Intent prepared", zh: "意图已生成" },
  statusCheckingSource: { en: "Checking the bound source chain", zh: "正在检查已绑定的源链" },
  statusSourceConfirmedNotDelivered: {
    en: "Source confirmed; destination delivery is still unverified",
    zh: "源链已确认；目标链交付仍未核验",
  },
  statusSourcePending: { en: "Source transaction is pending", zh: "源链交易待确认" },
  statusSourceFaulted: { en: "Source transaction faulted", zh: "源链交易执行失败" },
  statusSourceUnknown: {
    en: "Source evidence unavailable; retry safely",
    zh: "源链证据暂不可用，可安全重试",
  },
  emptyPayload: { en: "No bridge review ticket prepared yet.", zh: "还没有生成跨链核对票据。" },
  errBridgeGeneric: { en: "The bridge request could not be completed.", zh: "无法完成本次跨链请求。" },

  tlIntentLabel: { en: "Review ticket", zh: "核对票据" },
  tlIntentReady: { en: "{operation} is ready for {route}.", zh: "{operation} 已就绪，路径 {route}。" },
  tlIntentPending: { en: "Prepare an asset review ticket first.", zh: "请先准备资产核对票据。" },
  tlOfficialWalletLabel: { en: "Official wallet review", zh: "官方钱包核对" },
  tlOfficialWalletWaiting: {
    en: "Reconnect both wallets and review any required {asset} approval on the official bridge.",
    zh: "请在官方跨链桥重新连接两端钱包，并核对 {asset} 所需的授权。",
  },
  tlOfficialWalletDone: {
    en: "A wallet-submitted source transaction is available for verification.",
    zh: "已有钱包提交的源链交易可供核验。",
  },
  tlSourceLabel: { en: "Source transaction", zh: "源链交易" },
  tlSourceChecking: { en: "Reading {sourceTx} from its bound source chain…", zh: "正在从已绑定的源链读取 {sourceTx}…" },
  tlSourceNeedsVerification: {
    en: "{sourceTx} is entered but has not been read from the source chain.",
    zh: "已输入 {sourceTx}，但尚未从源链读取。",
  },
  tlSourceConfirmed: { en: "{sourceTx} is confirmed on the source chain only.", zh: "{sourceTx} 仅已在源链确认。" },
  tlSourcePending: { en: "{sourceTx} exists but has no receipt yet.", zh: "{sourceTx} 已存在，但尚无回执。" },
  tlSourceFaulted: {
    en: "{sourceTx} faulted on the source chain. No destination delivery is inferred.",
    zh: "{sourceTx} 在源链执行失败，不能推断目标链已交付。",
  },
  tlSourceUnknown: {
    en: "The source chain could not find or confirm {sourceTx}. Retry when the RPC is available.",
    zh: "源链暂时找不到或无法确认 {sourceTx}，请在 RPC 恢复后重试。",
  },
  tlSourceWaiting: { en: "Waiting for a wallet-signed source transaction.", zh: "等待钱包签名的源链交易。" },
  tlSourceEventLabel: { en: "Source bridge event", zh: "源链桥事件" },
  tlSourceEventVerified: { en: "The expected source bridge event is present.", zh: "已找到预期的源链桥事件。" },
  tlSourceEventUnverified: {
    en: "The transaction is confirmed, but an expected bridge event was not verified.",
    zh: "交易已确认，但未核验到预期的桥接事件。",
  },
  tlSourceEventWaiting: { en: "Check the source receipt before event evidence.", zh: "请先检查源链回执，再检查事件证据。" },
  tlDestinationEventLabel: { en: "Destination bridge event", zh: "目标链桥事件" },
  tlDestinationEventVerified: { en: "An authenticated destination bridge event is present.", zh: "已找到可信的目标链桥事件。" },
  tlDestinationEventWaiting: {
    en: "No authenticated destination event service is configured in this miniapp.",
    zh: "本小程序尚未配置可信的目标链事件服务。",
  },
  tlDestinationReadbackLabel: { en: "Destination readback", zh: "目标链读回" },
  tlDestinationReadbackVerified: {
    en: "The destination state matches this request.",
    zh: "目标链状态已与本次请求匹配。",
  },
  tlDestinationReadbackWaiting: {
    en: "Delivery needs a destination-chain readback matched to this request.",
    zh: "交付还需要与本次请求匹配的目标链状态读回。",
  },
} as const;

export const messages = mergeMessages(appMessages);
