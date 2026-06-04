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
  tabs: [{ key: "console", labelKey: "tabConsole", icon: "link", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "chain" },
    { labelKey: "statRequests", valueKey: "requestCount", format: "number", icon: "activity" },
    { labelKey: "statDigest", valueKey: "lastDigest", format: "text", icon: "key" },
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
          placeholder: "{\"type\":\"signal\",\"value\":\"...\"}",
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
  features: { walletRequired: false, chainWarning: true, comments: true, reviews: true },
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
  neoX: { en: "Neo X", zh: "Neo X" },
  assetBridge: { en: "Asset Bridge", zh: "资产桥" },
  messageBridge: { en: "Message Bridge", zh: "消息桥" },
  direction: { en: "Direction", zh: "方向" },
  routeN3ToNeoX: { en: "Neo N3 -> Neo X", zh: "Neo N3 -> Neo X" },
  routeNeoXToN3: { en: "Neo X -> Neo N3", zh: "Neo X -> Neo N3" },
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
  opTrackTitle: { en: "Operation Status", zh: "操作状态" },
  opTrackDesc: {
    en: "Track the local lifecycle from source transaction to destination finalization.",
    zh: "追踪从源链交易到目标链完成的本地生命周期。",
  },
  opTrackAction: { en: "Refresh Tracking", zh: "刷新追踪" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Console", zh: "控制台" },
  statRequests: { en: "Operations", zh: "操作数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  lastRoute: { en: "Route", zh: "路径" },
  emptyPayload: { en: "No bridge intent prepared yet.", zh: "还没有生成跨链意图。" },
  emptyPayloadHint: {
    en: "Prepare an asset or message intent from the operation panel to generate the signed bridge handoff.",
    zh: "在操作面板中准备资产或消息意图，即可生成已签名的跨链交接载荷。",
  },
  statusReady: { en: "Bridge console ready", zh: "跨链控制台已就绪" },
  statusAssetReady: { en: "Asset bridge handoff prepared", zh: "资产桥交接载荷已生成" },
  statusMessageReady: { en: "Message bridge intent prepared", zh: "消息桥意图已生成" },
  statusTrackingReady: { en: "Tracking timeline refreshed", zh: "追踪时间线已刷新" },
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
  heroEyebrow: { en: "AxLabs / BaneLabs Bridge Console", zh: "AxLabs / BaneLabs 跨链控制台" },
  heroTitle: {
    en: "Neo N3 and Neo X cross-chain control",
    zh: "Neo N3 与 Neo X 跨链控制",
  },
  heroBody: {
    en: "Prepare official bridge handoff payloads, arbitrary MessageBridge intents, and preview the cross-chain lifecycle from source transaction to destination finalization.",
    zh: "准备官方跨链交接载荷、任意 MessageBridge 意图，并预览从源链交易到目标链完成的跨链生命周期。",
  },
  heroAria: { en: "Neo X bridge overview", zh: "Neo X 跨链桥概览" },

  // Route card
  routeAria: { en: "Active route", zh: "当前路径" },
  routeN3Wallet: { en: "NEP-21 / NeoLine", zh: "NEP-21 / NeoLine" },
  routeNeoXWallet: { en: "EVM / MetaMask", zh: "EVM / MetaMask" },

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
  destinationPlaceholder: { en: "Neo N3 or Neo X address", zh: "Neo N3 或 Neo X 地址" },
  amountPresetsAria: { en: "GAS amount presets", zh: "GAS 数量预设" },
  targetContractPlaceholder: { en: "0x... or Neo script hash", zh: "0x... 或 Neo 脚本哈希" },
  messagePayloadRequired: {
    en: "Enter a payload to send across the bridge.",
    zh: "请输入要跨链发送的载荷。",
  },

  // Preview labels
  previewRoute: { en: "Route", zh: "路径" },
  previewAmount: { en: "Amount", zh: "数量" },
  previewRecipient: { en: "Recipient", zh: "接收地址" },
  previewTarget: { en: "Target", zh: "目标" },
  previewPayload: { en: "Payload", zh: "载荷" },
  previewBridge: { en: "Bridge", zh: "桥" },
  previewSourceTx: { en: "Source tx", zh: "源链交易" },
  previewReady: { en: "Ready", zh: "就绪" },

  // Buttons
  btnPrepareAsset: { en: "Prepare asset handoff", zh: "生成资产交接" },
  btnPrepareMessage: { en: "Prepare message intent", zh: "生成消息意图" },
  btnRefreshTracking: { en: "Refresh tracking", zh: "刷新追踪" },

  // Output cards
  outputTitle: { en: "Generated bridge handoff", zh: "生成的跨链交接载荷" },
  statusCardTitle: { en: "Operation status", zh: "操作状态" },
  recentTitle: { en: "Recent operations", zh: "最近操作" },
  copyLabel: { en: "Copy", zh: "复制" },
  copyAria: { en: "Copy generated JSON", zh: "复制生成的 JSON" },

  // Resources
  resourcesAria: { en: "Bridge resources", zh: "跨链资源" },
  resTestnetBridge: { en: "Testnet Bridge", zh: "测试网跨链桥" },
  resAssetBridgeDocs: { en: "Asset Bridge Docs", zh: "资产桥文档" },
  resMessageBridgeDocs: { en: "MessageBridge Docs", zh: "MessageBridge 文档" },
  resBridgeSdk: { en: "BaneLabs SDK", zh: "BaneLabs SDK" },

  // Success notices
  noticeAssetReady: { en: "Asset bridge handoff prepared.", zh: "资产桥交接载荷已生成。" },
  noticeMessageReady: { en: "Message bridge intent prepared.", zh: "消息桥意图已生成。" },
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
