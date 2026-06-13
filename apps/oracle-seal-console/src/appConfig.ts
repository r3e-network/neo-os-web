import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import { getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-seal-console";

/**
 * Resolve the network label from the launched network instead of a hardcoded
 * "Morpheus Testnet". The privacy_oracle / oracle/public-key lanes are live on
 * the mainnet nitro worker; testnet stays degraded (getNetwork() → mainnet).
 */
export function resolveNetworkLabel(): string {
  return getNetwork() === "testnet" ? "Morpheus Testnet" : "Morpheus Mainnet";
}

export const appMeta = {
  networkLabel: resolveNetworkLabel(),
  endpointLabel: "Envelope reference (not encrypted)",
};

export const manifest: MiniAppManifest = {
  name: "Oracle Seal Console",
  description: "Organize oracle request details into a reference envelope (a non-cryptographic checksum — this tool does not encrypt).",
  icon: "locked",
  category: "oracle",
  shell: "console",
  // A sealed/private indigo, not the platform amber warning hue: a brand-new,
  // error-free seal console should read as "private input", not "something is
  // wrong". Amber stays reserved for genuine warning states. Indigo-600 keeps the
  // badge/pill/notice text >=4.5:1 on the panel's 12%-alpha soft fill.
  theme: { family: "default", accentColor: "#4f46e5", density: "comfortable" },
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
    // The field's contract is "private JSON payload": validate it so malformed
    // input is surfaced instead of being silently packaged.
    let payloadValid = true;
    try {
      JSON.parse(payload);
    } catch {
      payloadValid = false;
    }
    const payloadDigest = previewId(payload);
    const digest = previewId(`${purpose}|${recipient}|${payloadDigest}`);

    return {
      status: payloadValid ? t("sealReady") : t("sealInvalidJson"),
      summary: t("sealSummary", { purpose }),
      rows: [
        // Surface the "not encrypted / reference only" truth on the result
        // itself (not just buried in docs), so the lock branding does not
        // over-promise at the moment a preview is produced.
        { label: t("protectionLabel"), value: t("protectionValue") },
        { label: t("purpose"), value: purpose },
        // Show an em-dash for an empty recipient so the row never renders blank.
        { label: t("recipient"), value: recipient || t("digestPlaceholder") },
        { label: t("payloadValid"), value: payloadValid ? t("yes") : t("no") },
        { label: t("payloadDigest"), value: payloadDigest },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.seal.envelope",
        // Invalid JSON is a validation failure: flag it input_required so the
        // shared panel classifies the preview as a warning (no green toast, no
        // Requests increment, digest placeholder preserved) — matching the
        // visible "Payload is valid JSON: No" row instead of contradicting it
        // with a success signal (the http console's pattern).
        ...(payloadValid ? {} : { status: "input_required" as const }),
        purpose,
        // Distinguish a blank recipient (null) from a present one so two
        // envelopes that differ only by blank-vs-set recipient are comparable.
        recipient: recipient || null,
        payloadValid,
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
  panelEyebrow: { en: "Oracle request envelope reference", zh: "预言机请求信封引用" },
  panelTitle: { en: "Request Envelope Reference Builder", zh: "请求信封引用构建器" },
  panelDescription: {
    en: "Organize request details into an envelope reference with a stable non-cryptographic checksum. The checksum is not encryption — the payload is not sealed, hidden, or tamper-proof.",
    zh: "把请求细节整理为信封引用，并附带稳定的非加密校验值。该校验值不是加密——载荷不会被封装、隐藏或防篡改。",
  },
  runAction: { en: "Build Reference", zh: "生成引用" },
  purpose: { en: "Purpose", zh: "用途" },
  purposeInput: { en: "Oracle input", zh: "预言机输入" },
  purposeCallback: { en: "Callback secret", zh: "回调密钥" },
  purposeAttestation: { en: "Attestation", zh: "证明材料" },
  recipient: { en: "Recipient", zh: "接收方" },
  recipientPlaceholder: { en: "Enter recipient or oracle route", zh: "输入接收方或预言机路由" },
  payload: { en: "Request Payload (not encrypted)", zh: "请求载荷（未加密）" },
  payloadPlaceholder: {
    en: "Paste the JSON payload — NOT encrypted by this tool, kept as a plain reference",
    zh: "粘贴 JSON 载荷——本工具不会加密，仅作为明文引用保留",
  },
  payloadDigest: { en: "Payload Checksum", zh: "载荷校验值" },
  protectionLabel: { en: "Protection", zh: "保护" },
  protectionValue: {
    en: "Not encrypted — reference checksum only",
    zh: "未加密——仅为引用校验值",
  },
  sealReady: { en: "Envelope preview ready", zh: "封装预览已生成" },
  sealInvalidJson: { en: "Preview ready (payload is not valid JSON)", zh: "预览已生成（载荷不是有效 JSON）" },
  sealSummary: { en: "{purpose} envelope reference prepared", zh: "{purpose} 信封引用已准备" },
  payloadValid: { en: "Payload is valid JSON", zh: "载荷为有效 JSON" },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Envelopes", zh: "封装数" },
  statDigest: { en: "Checksum", zh: "校验值" },
  digestPlaceholder: { en: "—", zh: "—" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A focused surface for organizing oracle request references before dispatch (no encryption is performed here).",
    zh: "面向预言机请求引用整理的清晰工作台（此处不进行加密）。",
  },
  docSubtitle: {
    en: "A focused surface for organizing oracle request references before dispatch (no encryption is performed here).",
    zh: "面向预言机请求引用整理的清晰工作台（此处不进行加密）。",
  },
  feature1Name: { en: "Reference Only", zh: "仅作引用" },
  feature1Desc: { en: "The payload is summarized by a short non-cryptographic checksum for reference — it is not encrypted, hidden, or tamper-proof.", zh: "载荷由一个简短的非加密校验值进行引用——并未加密、隐藏或防篡改。" },
  feature2Name: { en: "Purpose Bound", zh: "用途绑定" },
  feature2Desc: { en: "Purpose and recipient feed into the local reference checksum so previews stay distinguishable.", zh: "用途和接收方都会参与本地引用校验值，便于区分预览。" },
  feature3Name: { en: "Oracle Friendly", zh: "预言机友好" },
  feature3Desc: { en: "The preview carries an explicit envelope version for downstream routing.", zh: "预览包含明确封装版本，便于后续路由。" },
} as const;

export const messages = mergeMessages(appMessages);
