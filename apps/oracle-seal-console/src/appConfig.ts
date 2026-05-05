import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-seal-console";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "Sealed envelope",
};

export const manifest: MiniAppManifest = {
  name: "Oracle Seal Console",
  description: "Package sensitive oracle input as a sealed envelope preview.",
  icon: "locked",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#facc15", density: "comfortable" },
  tabs: [{ key: "seal", labelKey: "tabSeal", icon: "locked", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "locked" },
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
  permissions: { compute: true },
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
    {
      key: "purpose",
      labelKey: "purpose",
      type: "select",
      defaultValue: "oracle-input",
      options: [
        { value: "oracle-input", labelKey: "purposeInput" },
        { value: "callback-secret", labelKey: "purposeCallback" },
        { value: "attestation", labelKey: "purposeAttestation" },
      ],
    },
    { key: "recipient", labelKey: "recipient", placeholderKey: "recipientPlaceholder", type: "text", defaultValue: "" },
    {
      key: "payload",
      labelKey: "payload",
      placeholderKey: "payloadPlaceholder",
      type: "textarea",
      defaultValue: "",
    },
  ],
  buildResult(values, t) {
    const purpose = clean(values.purpose, "oracle-input");
    const recipient = clean(values.recipient, "");
    const payload = clean(values.payload, "{}");
    const payloadDigest = previewId(payload);
    const digest = previewId(`${purpose}|${recipient}|${payloadDigest}`);

    return {
      status: t("sealReady"),
      summary: t("sealSummary", { purpose }),
      rows: [
        { label: t("purpose"), value: purpose },
        { label: t("recipient"), value: recipient },
        { label: t("payloadDigest"), value: payloadDigest },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.seal.envelope",
        purpose,
        recipient,
        payloadDigest,
        envelopeVersion: "morpheus-seal-v1",
        digest,
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle Seal Console", zh: "预言机加密封装控制台" },
  title: { en: "Oracle Seal", zh: "预言机封装" },
  tabSeal: { en: "Seal", zh: "封装" },
  panelEyebrow: { en: "Private oracle input", zh: "私密预言机输入" },
  panelTitle: { en: "Sealed Envelope Builder", zh: "加密封装构建器" },
  panelDescription: {
    en: "Turn sensitive request details into a sealed-envelope preview with a stable digest.",
    zh: "把敏感请求细节整理为带稳定摘要的加密封装预览。",
  },
  runAction: { en: "Build Envelope", zh: "生成封装" },
  purpose: { en: "Purpose", zh: "用途" },
  purposeInput: { en: "Oracle input", zh: "预言机输入" },
  purposeCallback: { en: "Callback secret", zh: "回调密钥" },
  purposeAttestation: { en: "Attestation", zh: "证明材料" },
  recipient: { en: "Recipient", zh: "接收方" },
  recipientPlaceholder: { en: "Enter recipient or oracle route", zh: "输入接收方或预言机路由" },
  payload: { en: "Sensitive Payload", zh: "敏感载荷" },
  payloadPlaceholder: { en: "Paste the private JSON payload to seal", zh: "粘贴需要封装的私密 JSON 载荷" },
  payloadDigest: { en: "Payload Digest", zh: "载荷摘要" },
  sealReady: { en: "Envelope preview ready", zh: "封装预览已生成" },
  sealSummary: { en: "{purpose} envelope prepared", zh: "{purpose} 封装已准备" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Envelopes", zh: "封装数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A focused surface for sealing sensitive oracle inputs before dispatch.",
    zh: "面向敏感预言机输入封装的清晰工作台。",
  },
  docSubtitle: {
    en: "A focused surface for sealing sensitive oracle inputs before dispatch.",
    zh: "面向敏感预言机输入封装的清晰工作台。",
  },
  feature1Name: { en: "Privacy First", zh: "隐私优先" },
  feature1Desc: { en: "Sensitive payloads are represented by digest in the visible result.", zh: "可见结果中使用摘要代表敏感载荷。" },
  feature2Name: { en: "Purpose Bound", zh: "用途绑定" },
  feature2Desc: { en: "Purpose and recipient are part of the local digest.", zh: "用途和接收方都会参与本地摘要。" },
  feature3Name: { en: "Oracle Friendly", zh: "预言机友好" },
  feature3Desc: { en: "The preview uses an explicit envelope version for downstream routing.", zh: "预览包含明确封装版本，便于后续路由。" },
} as const;

export const messages = mergeMessages(appMessages);
