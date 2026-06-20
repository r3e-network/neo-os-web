import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-neo-x-bridge";

export const appMeta = {
  networkLabel: "Neo N3 / Neo X",
  endpointLabel: "AxLabs / BaneLabs",
};

export const manifest: MiniAppManifest = {
  name: "Neo X Bridge",
  description:
    "Prepare official Neo N3 and Neo X bridge handoffs and cross-chain status tracking in one console.",
  icon: "link",
  category: "defi",
  shell: "console",
  theme: { family: "finance", accentColor: "#16c784", density: "comfortable" },
  tabs: [
    { key: "console", labelKey: "tabConsole", icon: "link", default: true },
  ],
  stats: [
    {
      labelKey: "statNetwork",
      valueKey: "networkLabel",
      format: "text",
      icon: "globe",
    },
    {
      labelKey: "statEndpoint",
      valueKey: "endpointLabel",
      format: "text",
      icon: "chain",
    },
    {
      labelKey: "statRequests",
      valueKey: "requestCount",
      format: "number",
      icon: "activity",
    },
    {
      labelKey: "statDigest",
      valueKey: "lastDigest",
      format: "text",
      icon: "key",
    },
  ],
  operations: [
    {
      key: "assetBridge",
      titleKey: "opAssetTitle",
      descriptionKey: "opAssetDesc",
      actionKey: "opAssetAction",
      actionMethod: "prepareAssetBridge",
      fields: [
        {
          key: "direction",
          type: "select",
          labelKey: "direction",
          default: "n3-to-neox",
          options: [
            { value: "n3-to-neox", labelKey: "routeN3ToNeoX" },
            { value: "neox-to-n3", labelKey: "routeNeoXToN3" },
          ],
        },
        {
          key: "asset",
          type: "select",
          labelKey: "asset",
          default: "GAS",
          options: [{ value: "GAS", label: "GAS" }],
        },
        {
          key: "amount",
          type: "amount",
          labelKey: "amount",
          placeholder: "12.5",
          required: true,
          validation: { min: 0.00000001 },
        },
        {
          key: "recipient",
          type: "text",
          labelKey: "recipient",
          placeholder: "Neo N3 or Neo X address",
          required: true,
        },
      ],
    },
    {
      key: "messageBridge",
      titleKey: "opMessageTitle",
      descriptionKey: "opMessageDesc",
      actionKey: "opMessageAction",
      actionMethod: "prepareMessageBridge",
      fields: [
        {
          key: "direction",
          type: "select",
          labelKey: "direction",
          default: "n3-to-neox",
          options: [
            { value: "n3-to-neox", labelKey: "routeN3ToNeoX" },
            { value: "neox-to-n3", labelKey: "routeNeoXToN3" },
          ],
        },
        {
          key: "targetContract",
          type: "text",
          labelKey: "targetContract",
          placeholder: "0x... or Neo script hash",
          required: true,
        },
        {
          key: "method",
          type: "text",
          labelKey: "targetMethod",
          placeholder: "onCrossChainMessage",
          default: "onCrossChainMessage",
        },
        {
          key: "message",
          type: "text",
          labelKey: "messagePayload",
          placeholder: '{"type":"signal","value":"..."}',
          required: true,
        },
        {
          key: "gasLimit",
          type: "number",
          labelKey: "gasLimit",
          placeholder: "250000",
          default: 250000,
          validation: { min: 21000 },
        },
      ],
    },
    {
      key: "trackOperation",
      titleKey: "opTrackTitle",
      descriptionKey: "opTrackDesc",
      actionKey: "opTrackAction",
      actionMethod: "trackBridgeOperation",
      fields: [
        {
          key: "bridgeKind",
          type: "select",
          labelKey: "bridgeKind",
          default: "asset",
          options: [
            { value: "asset", labelKey: "assetBridge" },
            { value: "message", labelKey: "messageBridge" },
          ],
        },
        {
          key: "direction",
          type: "select",
          labelKey: "direction",
          default: "n3-to-neox",
          options: [
            { value: "n3-to-neox", labelKey: "routeN3ToNeoX" },
            { value: "neox-to-n3", labelKey: "routeNeoXToN3" },
          ],
        },
        {
          key: "operationId",
          type: "text",
          labelKey: "operationId",
          placeholder: "N3X-ASSET-...",
        },
        {
          key: "sourceTx",
          type: "text",
          labelKey: "sourceTx",
          placeholder: "0x...",
        },
      ],
    },
  ],
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "lastRoute", valueKey: "lastRoute", format: "text" },
      { labelKey: "statDigest", valueKey: "lastDigest", format: "text" },
    ],
  },
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
  permissions: { payments: true },
};

const appMessages = {
  appName: { en: "Neo X Bridge", zh: "Neo X 跨链桥" },
  title: { en: "Neo X Bridge", zh: "Neo X 跨链桥" },
  tabConsole: { en: "Console", zh: "控制台" },
  routeNeoN3: { en: "Neo N3", zh: "Neo N3" },
  neoX: { en: "Neo X", zh: "Neo X" },
  assetBridge: { en: "Asset Bridge", zh: "资产桥" },
  messageBridge: { en: "Message Bridge", zh: "消息桥" },
  direction: { en: "Direction", zh: "方向" },
  routeN3ToNeoX: { en: "Neo N3 -> Neo X", zh: "Neo N3 -> Neo X" },
  routeNeoXToN3: { en: "Neo X -> Neo N3", zh: "Neo X -> Neo N3" },
  routeN3ToNeoXHint: {
    en: "Deposit GAS from Neo N3, then receive it on Neo X.",
    zh: "从 Neo N3 存入 GAS，并在 Neo X 接收。",
  },
  routeNeoXToN3Hint: {
    en: "Withdraw bridged GAS from Neo X back to Neo N3.",
    zh: "从 Neo X 提回已桥接的 GAS 到 Neo N3。",
  },
  asset: { en: "Asset", zh: "资产" },
  amount: { en: "Amount", zh: "数量" },
  recipient: { en: "Recipient", zh: "接收地址" },
  targetContract: { en: "Target Contract", zh: "目标合约" },
  targetMethod: { en: "Target Method", zh: "目标方法" },
  messagePayload: { en: "Payload", zh: "消息载荷" },
  gasLimit: { en: "Gas Limit", zh: "Gas 上限" },
  bridgeKind: { en: "Bridge Type", zh: "桥类型" },
  operationId: { en: "Operation ID", zh: "操作 ID" },
  sourceTx: { en: "Source Tx", zh: "源链交易" },
  opAssetTitle: { en: "Asset Bridge", zh: "资产桥" },
  opAssetDesc: {
    en: "Prepare a GAS deposit or withdrawal intent for the official Neo X bridge flow.",
    zh: "为官方 Neo X 桥接流程准备 GAS 充值或提现意图。",
  },
  opAssetAction: { en: "Prepare Bridge Handoff", zh: "生成跨链桥交接载荷" },
  opMessageTitle: { en: "Message Bridge", zh: "Message Bridge" },
  opMessageDesc: {
    en: "Build an arbitrary cross-chain message payload for the BaneLabs MessageBridge SDK.",
    zh: "为 BaneLabs MessageBridge SDK 构造任意跨链消息载荷。",
  },
  opMessageAction: { en: "Prepare Message Intent", zh: "生成消息桥意图" },
  opTrackTitle: { en: "Lifecycle Preview", zh: "生命周期预览" },
  opTrackDesc: {
    en: "Preview the local lifecycle from source transaction to destination finalization. This is not a live status lookup — confirm real progress on the official bridge.",
    zh: "预览从源链交易到目标链完成的本地生命周期。这不是实时状态查询——请在官方跨链桥确认真实进度。",
  },
  opTrackAction: { en: "Refresh Preview", zh: "刷新预览" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Console", zh: "控制台" },
  statRequests: { en: "Operations", zh: "操作数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  lastRoute: { en: "Route", zh: "路径" },
  emptyPayload: {
    en: "No bridge intent prepared yet.",
    zh: "还没有生成跨链意图。",
  },
  emptyPayloadHint: {
    en: "Prepare an asset or message intent from the operation panel to generate a bridge handoff intent you then submit on the official bridge.",
    zh: "在操作面板中准备资产或消息意图，生成可在官方跨链桥提交的跨链交接意图。",
  },
  statusReady: { en: "Bridge console ready", zh: "跨链控制台已就绪" },
  statusAssetReady: {
    en: "Asset bridge handoff prepared",
    zh: "资产桥交接载荷已生成",
  },
  statusMessageReady: {
    en: "Message bridge intent prepared",
    zh: "消息桥意图已生成",
  },
  statusTrackingReady: {
    en: "Tracking timeline refreshed",
    zh: "追踪时间线已刷新",
  },
  statusIntentPrepared: { en: "Intent prepared", zh: "意图已生成" },
  statusMessageIntentPrepared: {
    en: "Message intent prepared",
    zh: "消息意图已生成",
  },
  // Status timeline — localized labels + details (interpolated at render).
  tlIntentLabel: { en: "Intent prepared", zh: "意图已生成" },
  tlIntentReady: {
    en: "{operation} is ready for {route}.",
    zh: "{operation} 已就绪，路线 {route}。",
  },
  tlIntentPending: {
    en: "Prepare a bridge intent from the operation panel.",
    zh: "请在操作面板中准备跨链意图。",
  },
  tlSourceLabel: { en: "Source transaction", zh: "源链交易" },
  tlSourceCaptured: {
    en: "Source tx {sourceTx} captured.",
    zh: "已记录源链交易 {sourceTx}。",
  },
  tlSourceWaiting: {
    en: "Waiting for the wallet-signed source-chain transaction.",
    zh: "等待钱包签名的源链交易。",
  },
  tlObservationLabel: { en: "Bridge observation", zh: "桥接观察" },
  tlObservationMessage: {
    en: "Relayer reconstructs the directional message hash chain.",
    zh: "中继器重建定向消息哈希链。",
  },
  tlObservationAsset: {
    en: "Relayer observes bridge events and reconstructs token hash-chain state.",
    zh: "中继器观察桥接事件并重建代币哈希链状态。",
  },
  tlAttestationLabel: { en: "Validator attestation", zh: "验证者证明" },
  tlAttestationDetail: {
    en: "Validator threshold signatures authenticate the next root commitment.",
    zh: "验证者门限签名认证下一个根承诺。",
  },
  tlDestinationLabel: { en: "Destination finalized", zh: "目标链完成" },
  tlDestinationMessage: {
    en: "Destination contract receives the verified payload.",
    zh: "目标合约接收已验证的载荷。",
  },
  tlDestinationAsset: {
    en: "Destination chain releases or mints the bridged GAS.",
    zh: "目标链释放或铸造跨链 GAS。",
  },
  errSourceTx: {
    en: "Enter a 0x-prefixed 64-character transaction hash.",
    zh: "请输入以 0x 开头的 64 位交易哈希。",
  },
  copiedPayload: { en: "Bridge payload copied", zh: "跨链载荷已复制" },
  errAmountPositive: {
    en: "Enter an amount greater than zero.",
    zh: "请输入大于零的数量。",
  },
  errAddressFormat: {
    en: "Enter a valid Neo X (0x...) or Neo N3 (N...) address.",
    zh: "请输入有效的 Neo X (0x...) 或 Neo N3 (N...) 地址。",
  },
  errAddressNeoX: {
    en: "This direction settles on Neo X. Enter a Neo X (0x...) address.",
    zh: "该方向在 Neo X 结算，请输入 Neo X (0x...) 地址。",
  },
  errAddressNeoN3: {
    en: "This direction settles on Neo N3. Enter a Neo N3 (N...) address.",
    zh: "该方向在 Neo N3 结算，请输入 Neo N3 (N...) 地址。",
  },
  errGasLimit: {
    en: "Gas limit must be a whole number of at least 21000.",
    zh: "Gas 上限必须是不小于 21000 的整数。",
  },
  errAssetForm: {
    en: "Enter a positive GAS amount and a valid destination address before preparing the bridge handoff.",
    zh: "请先输入正数的 GAS 数量和有效的目标地址，再生成跨链交接载荷。",
  },
  errMessageForm: {
    en: "Enter a valid target contract, payload, and a gas limit of at least 21000.",
    zh: "请输入有效的目标合约、载荷以及不小于 21000 的 Gas 上限。",
  },
  errTrackForm: {
    en: "Enter an operation id or source transaction to refresh tracking.",
    zh: "请输入操作 ID 或源链交易以刷新追踪。",
  },
  docsSubtitle: {
    en: "A unified AxLabs/BaneLabs bridge console for Neo N3, Neo X, assets, messages, and status tracking.",
    zh: "统一的 AxLabs/BaneLabs 跨链控制台，覆盖 Neo N3、Neo X、资产、消息和状态追踪。",
  },
  docSubtitle: {
    en: "A unified AxLabs/BaneLabs bridge console for Neo N3 and Neo X.",
    zh: "统一的 AxLabs/BaneLabs Neo N3 与 Neo X 跨链控制台。",
  },
  feature1Name: { en: "Native Bridge Flow", zh: "原生桥流程" },
  feature1Desc: {
    en: "Asset handoffs are shaped around the official Neo X GAS bridge path.",
    zh: "资产交接载荷围绕官方 Neo X GAS 跨链路径构造。",
  },
  feature2Name: { en: "MessageBridge Ready", zh: "MessageBridge 就绪" },
  feature2Desc: {
    en: "Message payloads include route, target contract, method, digest, and SDK handoff data.",
    zh: "消息载荷包含路径、目标合约、方法、摘要和 SDK 对接数据。",
  },
  feature3Name: { en: "Lifecycle Tracking", zh: "生命周期追踪" },
  feature3Desc: {
    en: "Status tracking follows source transaction, relayer observation, attestation, and destination finalization.",
    zh: "状态追踪覆盖源链交易、relayer 观测、验证者签名和目标链完成。",
  },

  // Hero
  heroEyebrow: {
    en: "AxLabs / BaneLabs Bridge Console",
    zh: "AxLabs / BaneLabs 跨链控制台",
  },
  heroTitle: {
    en: "Neo N3 and Neo X cross-chain control",
    zh: "Neo N3 与 Neo X 跨链控制",
  },
  heroBody: {
    en: "Prepare official bridge handoff payloads, arbitrary MessageBridge intents, and preview the cross-chain lifecycle from source transaction to destination finalization.",
    zh: "准备官方跨链交接载荷、任意 MessageBridge 意图，并预览从源链交易到目标链完成的跨链生命周期。",
  },
  heroNoFunds: {
    en: "No funds move from this console — it only prepares a handoff you submit on the official bridge.",
    zh: "本控制台不会转移任何资金——它只生成你需在官方跨链桥提交的交接载荷。",
  },
  heroAria: { en: "Neo X bridge overview", zh: "Neo X 跨链桥概览" },
  bridgeHeroImageAlt: {
    en: "Bright cross-chain bridge route with GAS moving between Neo N3 and Neo X checkpoints",
    zh: "明亮的跨链桥路径，GAS 在 Neo N3 与 Neo X 检查点之间流动",
  },

  // Route card
  routeAria: { en: "Active route", zh: "当前路径" },
  routeN3Wallet: { en: "NEP-21 / NeoLine", zh: "NEP-21 / NeoLine" },
  routeNeoXWallet: { en: "EVM / MetaMask", zh: "EVM / MetaMask" },
  routeCardTitle: { en: "How the bridge moves GAS", zh: "GAS 如何跨链" },
  routeSendLabel: { en: "Send from", zh: "从此发送" },
  routeReceiveLabel: { en: "Receive on", zh: "在此接收" },
  routeArrowAria: { en: "moves to", zh: "转移至" },
  handoffRailAria: { en: "Bridge handoff rail", zh: "跨链交接路径" },
  railSource: { en: "Source", zh: "源链" },
  railAttest: { en: "Attest", zh: "证明" },
  railAttestTitle: { en: "Validator checkpoint", zh: "验证者检查点" },
  railAttestDetail: {
    en: "Observed, signed, then released",
    zh: "观察、签名、再释放",
  },
  railDestination: { en: "Destination", zh: "目标链" },

  // Metrics strip
  metricsAria: { en: "Bridge console status", zh: "跨链控制台状态" },
  metricRoute: { en: "Route", zh: "路径" },
  metricStatus: { en: "Status", zh: "状态" },

  // Workspace card
  workspaceKicker: { en: "Bridge workspace", zh: "跨链工作区" },
  workspaceTitle: { en: "Build cross-chain handoff", zh: "构建跨链交接" },
  workspaceModeAria: { en: "Bridge workspace mode", zh: "跨链工作区模式" },
  tabAsset: { en: "Asset", zh: "资产" },
  tabMessage: { en: "Message", zh: "消息" },
  tabTrack: { en: "Track", zh: "追踪" },

  // Field labels
  destinationAddress: { en: "Destination address", zh: "目标地址" },
  destinationPlaceholder: {
    en: "Neo N3 or Neo X address",
    zh: "Neo N3 或 Neo X 地址",
  },
  amountPresetsAria: { en: "GAS amount presets", zh: "GAS 数量预设" },
  targetContractPlaceholder: {
    en: "0x... or Neo script hash",
    zh: "0x... 或 Neo 脚本哈希",
  },
  assetTicketEyebrow: { en: "GAS handoff ticket", zh: "GAS 交接票据" },
  assetTicketTitle: {
    en: "Prepare {route}",
    zh: "准备 {route}",
  },
  messageIntentEyebrow: {
    en: "MessageBridge intent",
    zh: "MessageBridge 意图",
  },
  messageIntentTitle: {
    en: "Package a cross-chain call",
    zh: "打包跨链调用",
  },
  messageIntentBody: {
    en: "Target, method, payload, and gas limit are bundled into one handoff for the official bridge flow.",
    zh: "目标、方法、载荷和 Gas 上限会打包成一个官方桥流程的交接意图。",
  },
  trackAssetHint: {
    en: "Follow a GAS handoff from source transaction to destination settlement.",
    zh: "跟踪 GAS 交接从源链交易到目标链结算的过程。",
  },
  trackMessageHint: {
    en: "Follow a MessageBridge call through observation, attestation, and delivery.",
    zh: "跟踪 MessageBridge 调用的观察、证明和交付过程。",
  },
  messagePayloadRequired: {
    en: "Enter a payload to send across the bridge.",
    zh: "请输入要跨链发送的载荷。",
  },
  // GAS-only constraint — the asset bridge path exposes GAS only.
  assetFixedNote: {
    en: "GAS only — this is the production token path for the native Neo X bridge.",
    zh: "仅支持 GAS——这是原生 Neo X 跨链桥的生产代币路径。",
  },
  assetFixedChip: { en: "GAS", zh: "GAS" },

  // Preview labels
  previewRoute: { en: "Route", zh: "路径" },
  previewAmount: { en: "You bridge", zh: "桥接数量" },
  previewRecipient: { en: "Recipient", zh: "接收地址" },
  previewTarget: { en: "Target", zh: "目标" },
  previewPayload: { en: "Payload", zh: "载荷" },
  previewBridge: { en: "Bridge", zh: "桥" },
  previewSourceTx: { en: "Source tx", zh: "源链交易" },
  previewReady: { en: "Ready", zh: "就绪" },

  // Costs & timing — surfaced honestly before handoff (no protocol fee on this
  // console; gas is paid on each chain; ETA derives from expectedSettlement).
  costsTitle: { en: "Costs & timing", zh: "费用与时间" },
  costsBridgeFee: { en: "Bridge protocol fee", zh: "桥接协议费" },
  costsBridgeFeeValue: { en: "None", zh: "无" },
  costsGas: { en: "Network gas", zh: "网络 Gas" },
  costsGasValue: {
    en: "Paid on each chain at submit",
    zh: "提交时在各链上支付",
  },
  costsEta: { en: "Settlement ETA", zh: "结算预计时间" },
  costsEtaValue: {
    en: "~1–2 min after source confirmation",
    zh: "源链确认后约 1–2 分钟",
  },
  costsFootnote: {
    en: "Estimate, not a guarantee — finalization time depends on chain congestion and validator attestation. This console moves no funds.",
    zh: "为预估值，并非保证——最终完成时间取决于链上拥堵和验证者签名。本控制台不会转移资金。",
  },

  // Inline gating hints (mirror the disabled-CTA pattern across DeFi apps)
  hintAssetGate: {
    en: "Enter a positive GAS amount and a valid destination address for the selected chain to continue.",
    zh: "请输入正数的 GAS 数量和所选链上的有效目标地址以继续。",
  },
  hintMessageGate: {
    en: "Enter a valid target contract, a message payload, and a gas limit of at least 21000 to continue.",
    zh: "请输入有效的目标合约、消息载荷以及不小于 21000 的 Gas 上限以继续。",
  },
  hintTrackGate: {
    en: "Enter an operation ID or a valid source transaction hash to preview the lifecycle.",
    zh: "请输入操作 ID 或有效的源链交易哈希以预览生命周期。",
  },

  // Buttons
  btnPrepareAsset: { en: "Prepare asset handoff", zh: "生成资产交接" },
  btnPrepareMessage: { en: "Prepare message intent", zh: "生成消息意图" },
  btnRefreshTracking: { en: "Refresh tracking", zh: "刷新追踪" },

  // Output cards
  outputTitle: { en: "Prepared bridge intent", zh: "已准备的跨链意图" },
  statusCardTitle: { en: "Lifecycle preview", zh: "生命周期预览" },
  recentTitle: { en: "Recent operations", zh: "最近操作" },
  copyLabel: { en: "Copy", zh: "复制" },
  copyAria: { en: "Copy generated JSON", zh: "复制生成的 JSON" },

  // Next-step handoff (the bridge actually happens on the official bridge app)
  nextStepTitle: {
    en: "Next step — bridge on the official app",
    zh: "下一步——在官方应用桥接",
  },
  nextStepBody: {
    en: "This console only prepared the handoff (no funds moved). Open the official bridge, paste this intent, and sign there to actually move funds.",
    zh: "本控制台仅生成了交接载荷（未转移资金）。请打开官方跨链桥，粘贴此意图，并在那里签名以真正转移资金。",
  },
  btnOpenOfficialBridge: {
    en: "Open official bridge to submit",
    zh: "打开官方跨链桥提交",
  },

  // Lifecycle-preview honesty + the one real fact (source tx) the user can verify
  trackPreviewNote: {
    en: "This is a local lifecycle preview from your inputs, not a live bridge status. Confirm real progress on the official bridge.",
    zh: "这是根据你的输入生成的本地生命周期预览，并非实时桥接状态。请在官方跨链桥确认真实进度。",
  },
  viewSourceTxExplorer: {
    en: "View source tx on explorer",
    zh: "在区块浏览器查看源链交易",
  },

  // Resources
  resourcesAria: { en: "Bridge resources", zh: "跨链资源" },
  resTestnetBridge: { en: "Testnet Bridge", zh: "测试网跨链桥" },
  resOfficialBridge: { en: "Official Bridge", zh: "官方跨链桥" },
  resAssetBridgeDocs: { en: "Asset Bridge Docs", zh: "资产桥文档" },
  resMessageBridgeDocs: { en: "MessageBridge Docs", zh: "MessageBridge 文档" },
  resBridgeSdk: { en: "BaneLabs SDK", zh: "BaneLabs SDK" },

  // Success notices
  noticeAssetReady: {
    en: "Asset bridge handoff prepared.",
    zh: "资产桥交接载荷已生成。",
  },
  noticeMessageReady: {
    en: "Message bridge intent prepared.",
    zh: "消息桥意图已生成。",
  },
  noticeTrackingReady: {
    en: "Bridge tracking timeline refreshed.",
    zh: "跨链追踪时间线已刷新。",
  },
  errBridgeGeneric: {
    en: "Bridge handoff could not be prepared.",
    zh: "无法生成跨链交接载荷。",
  },
} as const;

export const messages = mergeMessages(appMessages);
