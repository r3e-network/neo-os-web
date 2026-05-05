import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-vrf-console";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "VRF request",
};

export const manifest: MiniAppManifest = {
  name: "Oracle VRF Console",
  description: "Prepare Morpheus verifiable randomness requests.",
  icon: "dice",
  category: "oracle",
  shell: "console",
  theme: { family: "gaming", accentColor: "#fb7185", density: "comfortable" },
  tabs: [{ key: "vrf", labelKey: "tabVrf", icon: "dice", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "dice" },
    { labelKey: "statRequests", valueKey: "requestCount", format: "number", icon: "activity" },
    { labelKey: "statDigest", valueKey: "lastDigest", format: "text", icon: "key" },
  ],
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "statDigest", valueKey: "lastDigest", format: "text" },
    ],
  },
  features: { walletRequired: false, chainWarning: true },
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
  permissions: { randomness: true },
};

const clean = (value: string | undefined, fallback: string) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

export const consoleConfig: ConsoleToolConfig = {
  titleKey: "panelTitle",
  eyebrowKey: "panelEyebrow",
  descriptionKey: "panelDescription",
  primaryActionKey: "runAction",
  resetActionKey: "reset",
  copyActionKey: "copy",
  copiedKey: "copied",
  fields: [
    { key: "consumer", labelKey: "consumer", placeholderKey: "consumerPlaceholder", type: "text" },
    { key: "salt", labelKey: "salt", placeholderKey: "saltPlaceholder", type: "text" },
    { key: "rounds", labelKey: "rounds", placeholderKey: "roundsPlaceholder", type: "number", defaultValue: "1" },
    {
      key: "mode",
      labelKey: "mode",
      type: "select",
      defaultValue: "single-proof",
      options: [
        { value: "single-proof", labelKey: "modeSingle" },
        { value: "batch-proof", labelKey: "modeBatch" },
      ],
    },
  ],
  buildResult(values, t) {
    const consumer = clean(values.consumer, "");
    const salt = clean(values.salt, "");
    const rounds = clean(values.rounds, "1");
    const mode = clean(values.mode, "single-proof");
    if (!consumer || !salt) {
      return {
        status: t("inputRequired"),
        summary: t("inputRequiredSummary"),
        rows: [],
        payload: {
          kind: "oracle.vrf.request",
          status: "input_required",
          required: ["consumer", "salt"],
        },
      };
    }
    const requestId = previewId(`${consumer}|${salt}|${rounds}|${mode}`);

    return {
      status: t("vrfReady"),
      summary: t("vrfSummary", { rounds }),
      rows: [
        { label: t("consumer"), value: consumer },
        { label: t("salt"), value: salt },
        { label: t("rounds"), value: rounds },
        { label: t("clientDigest"), value: requestId },
      ],
      payload: {
        kind: "oracle.vrf.request",
        consumer,
        salt,
        rounds,
        mode,
        client_digest: requestId,
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle VRF Console", zh: "预言机随机数控制台" },
  title: { en: "Oracle VRF", zh: "预言机 VRF" },
  tabVrf: { en: "VRF", zh: "VRF" },
  panelEyebrow: { en: "Verifiable randomness", zh: "可验证随机数" },
  panelTitle: { en: "VRF Request Builder", zh: "VRF 请求构建器" },
  panelDescription: {
    en: "Prepare randomness requests with consumer, salt, proof mode, and repeat count.",
    zh: "用消费者、盐值、证明模式和轮次准备随机数请求。",
  },
  runAction: { en: "Build VRF Request", zh: "生成 VRF 请求" },
  consumer: { en: "Consumer", zh: "消费者" },
  consumerPlaceholder: { en: "MiniApp contract hash or app id", zh: "小程序合约哈希或 app id" },
  salt: { en: "Salt", zh: "盐值" },
  saltPlaceholder: { en: "Unique round or request salt", zh: "唯一回合或请求盐值" },
  rounds: { en: "Rounds", zh: "轮次" },
  roundsPlaceholder: { en: "1", zh: "1" },
  mode: { en: "Proof Mode", zh: "证明模式" },
  modeSingle: { en: "Single proof", zh: "单次证明" },
  modeBatch: { en: "Batch proof", zh: "批量证明" },
  requestId: { en: "Request ID", zh: "请求 ID" },
  clientDigest: { en: "Client Digest", zh: "客户端摘要" },
  inputRequired: { en: "Required fields missing", zh: "缺少必填字段" },
  inputRequiredSummary: { en: "Enter a consumer and salt before building a VRF request.", zh: "请输入消费者和盐值后再生成 VRF 请求。" },
  vrfReady: { en: "VRF request ready", zh: "VRF 请求已准备" },
  vrfSummary: { en: "{rounds} randomness round(s) prepared", zh: "{rounds} 轮随机数已准备" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Request ID", zh: "请求 ID" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A compact console for Morpheus randomness request planning.",
    zh: "面向 Morpheus 随机数请求规划的轻量控制台。",
  },
  docSubtitle: {
    en: "A compact console for Morpheus randomness request planning.",
    zh: "面向 Morpheus 随机数请求规划的轻量控制台。",
  },
  feature1Name: { en: "Unambiguous", zh: "无歧义" },
  feature1Desc: { en: "Consumer, salt, mode, and count are part of the request ID.", zh: "消费者、盐值、模式和轮次都会参与请求 ID。" },
  feature2Name: { en: "Game Ready", zh: "游戏就绪" },
  feature2Desc: { en: "The form is tuned for game rounds, raffles, and randomized app flows.", zh: "表单适合游戏回合、抽奖和随机化应用流程。" },
  feature3Name: { en: "Proof Aware", zh: "证明感知" },
  feature3Desc: { en: "Proof mode is explicit in the payload before submission.", zh: "提交前即可看到载荷中的证明模式。" },
} as const;

export const messages = mergeMessages(appMessages);
