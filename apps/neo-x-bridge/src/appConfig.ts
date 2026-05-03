import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-neo-x-bridge";

export const appMeta = {
  networkLabel: "Neo N3 / Neo X",
  endpointLabel: "AxLabs / BaneLabs console",
};

export const manifest: MiniAppManifest = {
  name: "Neo X Bridge",
  description:
    "Operate Neo N3 and Neo X asset bridge, Message Bridge, and cross-chain status tracking in one console.",
  icon: "link",
  category: "defi",
  shell: "console",
  theme: { family: "finance", accentColor: "#00e599", density: "comfortable" },
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
          key: "payload",
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
  features: { walletRequired: true, chainWarning: true, comments: true, reviews: true },
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
  opAssetAction: { en: "Prepare Asset Intent", zh: "生成资产桥意图" },
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
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Operations", zh: "操作数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  lastRoute: { en: "Route", zh: "路径" },
  emptyPayload: { en: "No bridge intent prepared yet.", zh: "还没有生成跨链意图。" },
  statusReady: { en: "Bridge console ready", zh: "跨链控制台已就绪" },
  statusAssetReady: { en: "Asset bridge intent prepared", zh: "资产桥意图已生成" },
  statusMessageReady: { en: "Message bridge intent prepared", zh: "消息桥意图已生成" },
  statusTrackingReady: { en: "Tracking timeline refreshed", zh: "追踪时间线已刷新" },
  copiedPayload: { en: "Bridge payload copied", zh: "跨链载荷已复制" },
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
    en: "Asset intents are shaped around the official Neo X GAS bridge path.",
    zh: "资产意图围绕官方 Neo X GAS 跨链路径构造。",
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
} as const;

export const messages = mergeMessages(appMessages);
