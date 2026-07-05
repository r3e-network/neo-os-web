import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import { getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-seal-console";

/**
 * Resolve the network label from the launched network instead of a hardcoded
 * "Morpheus Testnet". The privacy_oracle / oracle/public-key lanes are live on
 * the mainnet nitro worker; testnet stays degraded (getNetwork() defaults to mainnet).
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
  description:
    "Organize oracle request details into a reference envelope (a non-cryptographic checksum — this tool does not encrypt).",
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
      icon: "locked",
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

const PURPOSE_LABEL_KEYS: Record<string, string> = {
  "oracle-input": "purposeInput",
  "callback-secret": "purposeCallback",
  attestation: "purposeAttestation",
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
    {
      key: "recipient",
      labelKey: "recipient",
      placeholderKey: "recipientPlaceholder",
      type: "text",
      defaultValue: "",
    },
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
    const purposeLabel = t(PURPOSE_LABEL_KEYS[purpose] ?? "purposeInput");

    return {
      status: payloadValid ? t("sealReady") : t("sealInvalidJson"),
      summary: t("sealSummary", { purpose: purposeLabel }),
      rows: [
        // Surface the "not encrypted / reference only" truth on the result
        // itself (not just buried in docs), so the lock branding does not
        // over-promise at the moment a preview is produced.
        { label: t("protectionLabel"), value: t("protectionValue") },
        { label: t("purpose"), value: purposeLabel },
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
  panelEyebrow: {
    en: "Oracle request envelope reference",
    zh: "预言机请求信封引用",
  },
  panelTitle: {
    en: "Request Envelope Reference Builder",
    zh: "请求信封引用构建器",
  },
  buildRequest: { en: "Build Request", zh: "构建请求" },
  panelDescription: {
    en: "Organize request details into an envelope reference with a stable non-cryptographic checksum. The checksum is not encryption — the payload is not sealed, hidden, or tamper-proof.",
    zh: "把请求细节整理为信封引用，并附带稳定的非加密校验值。该校验值不是加密——载荷不会被封装、隐藏或防篡改。",
  },
  sealHeroAlt: {
    en: "Transparent oracle envelope reference with checksum prism.",
    zh: "带校验棱镜的透明预言机引用信封。",
  },
  sealHeroCopy: {
    en: "Prepare a plain reference envelope for downstream oracle routing. This builder creates checksums and versioned metadata only; it does not encrypt or hide the payload.",
    zh: "为后续预言机路由准备明文引用信封。本构建器只生成校验值和版本元数据；不会加密或隐藏载荷。",
  },
  sealStatusLabel: { en: "Envelope reference status", zh: "信封引用状态" },
  runAction: { en: "Build Reference", zh: "生成引用" },
  purpose: { en: "Purpose", zh: "用途" },
  purposeInput: { en: "Oracle input", zh: "预言机输入" },
  purposeCallback: { en: "Callback secret", zh: "回调密钥" },
  purposeAttestation: { en: "Attestation", zh: "证明材料" },
  purposeInputHint: {
    en: "Reference data intended for an oracle request.",
    zh: "为预言机请求准备的引用数据。",
  },
  purposeCallbackHint: {
    en: "Route-bound value, still not encrypted here.",
    zh: "与路由绑定的值，此处仍不会加密。",
  },
  purposeAttestationHint: {
    en: "Package claim metadata for later review.",
    zh: "打包声明元数据供后续审阅。",
  },
  recipient: { en: "Recipient", zh: "接收方" },
  recipientPlaceholder: {
    en: "Enter recipient or oracle route",
    zh: "输入接收方或预言机路由",
  },
  recipientHint: {
    en: "Optional, but included in the envelope checksum when set.",
    zh: "可选；填写后会参与信封校验值。",
  },
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
  sealInvalidJson: {
    en: "Enter a valid JSON payload",
    zh: "请输入有效的 JSON 载荷",
  },
  sealSummary: {
    en: "{purpose} envelope reference prepared",
    zh: "{purpose} 信封引用已准备",
  },
  payloadValid: { en: "Payload is valid JSON", zh: "载荷为有效 JSON" },
  sealFlowTitle: { en: "Envelope reference flow", zh: "信封引用流程" },
  sealFlowPlain: { en: "Plain reference", zh: "明文引用" },
  sealFlowPlainDesc: {
    en: "Checksum only, no encryption.",
    zh: "仅校验值，不加密。",
  },
  sealFlowRoute: { en: "Route context", zh: "路由上下文" },
  sealFlowRouteDesc: {
    en: "Purpose and recipient bind the preview.",
    zh: "用途和接收方绑定预览。",
  },
  sealFlowChecksum: { en: "Checksum receipt", zh: "校验回执" },
  sealFlowChecksumDesc: {
    en: "Copy metadata for downstream review.",
    zh: "复制元数据供后续审阅。",
  },
  sealPlan: { en: "Reference plan", zh: "引用方案" },
  sealPlanCopy: {
    en: "Organize a versioned envelope reference without over-promising secrecy.",
    zh: "整理带版本的信封引用，同时不夸大保密能力。",
  },
  sealStageTitle: { en: "Envelope workbench", zh: "信封工作台" },
  sealStageIdle: { en: "Ready to build reference", zh: "可生成引用" },
  sealStageBuilding: {
    en: "Building envelope reference...",
    zh: "正在生成信封引用...",
  },
  sealStageCopying: {
    en: "Copying reference metadata...",
    zh: "正在复制引用元数据...",
  },
  sealStageReady: { en: "Receipt ready to copy", zh: "回执可复制" },
  sealStageCopy: {
    en: "Source JSON is reduced to route context and checksum metadata.",
    zh: "JSON 来源会被整理为路由上下文和校验元数据。",
  },
  sealBuildActionActive: {
    en: "Building Reference",
    zh: "正在生成引用",
  },
  sealCopyActionActive: {
    en: "Copying Metadata",
    zh: "正在复制元数据",
  },
  sealProtectionTitle: { en: "Reference only", zh: "仅作引用" },
  sealProtectionCopy: {
    en: "The payload is summarized by checksum and never copied into the result payload, but this tool does not encrypt it.",
    zh: "载荷会被摘要为校验值，不会复制进结果 payload，但本工具不会加密它。",
  },
  sealPurposeTitle: { en: "Envelope purpose", zh: "信封用途" },
  sealPurposeCopy: {
    en: "Pick the envelope lane.",
    zh: "选择信封通道。",
  },
  sealComposerTitle: { en: "Reference package", zh: "引用包" },
  sealComposerCopy: {
    en: "Route plus JSON source.",
    zh: "路由 + JSON 来源。",
  },
  sealRecipientTitle: { en: "Recipient or route", zh: "接收方或路由" },
  sealRecipientCopy: {
    en: "Optional route binding.",
    zh: "可选路由绑定。",
  },
  sealPayloadTitle: { en: "Payload reference", zh: "载荷引用" },
  sealPayloadCopy: {
    en: "JSON source, checksum only.",
    zh: "JSON 来源，仅生成校验值。",
  },
  sealPayloadChamberLabel: {
    en: "Payload chamber",
    zh: "载荷舱",
  },
  sealPayloadChamberTitle: {
    en: "JSON payload chamber",
    zh: "JSON 载荷舱",
  },
  sealPayloadStateReady: {
    en: "Valid JSON",
    zh: "JSON 有效",
  },
  sealPayloadStateInvalid: {
    en: "Needs repair",
    zh: "需要修复",
  },
  payloadReadyHint: {
    en: "JSON is valid; only its checksum enters the result payload.",
    zh: "JSON 有效；结果 payload 只包含它的校验值。",
  },
  payloadInvalidHint: {
    en: "Fix JSON before building a successful reference.",
    zh: "请修复 JSON 后再生成成功引用。",
  },
  sealPayloadSize: { en: "Payload size", zh: "载荷大小" },
  sealPayloadChars: { en: "{count} chars", zh: "{count} 字符" },
  sealReferenceOnly: { en: "Reference only", zh: "仅作引用" },
  sealReceipt: { en: "Envelope receipt", zh: "信封回执" },
  sealValidationReady: { en: "Reference ready", zh: "引用已就绪" },
  sealEmptyTitle: { en: "Build a reference receipt", zh: "生成引用回执" },
  sealEmptyCopy: {
    en: "The receipt will show protection truth, purpose, recipient, payload checksum, and copyable metadata without echoing the payload body.",
    zh: "回执会显示保护事实、用途、接收方、载荷校验值和可复制元数据，不回显载荷正文。",
  },
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
  feature1Desc: {
    en: "The payload is summarized by a short non-cryptographic checksum for reference — it is not encrypted, hidden, or tamper-proof.",
    zh: "载荷由一个简短的非加密校验值进行引用——并未加密、隐藏或防篡改。",
  },
  feature2Name: { en: "Purpose Bound", zh: "用途绑定" },
  feature2Desc: {
    en: "Purpose and recipient feed into the local reference checksum so previews stay distinguishable.",
    zh: "用途和接收方都会参与本地引用校验值，便于区分预览。",
  },
  feature3Name: { en: "Oracle Friendly", zh: "预言机友好" },
  feature3Desc: {
    en: "The preview carries an explicit envelope version for downstream routing.",
    zh: "预览包含明确封装版本，便于后续路由。",
  },
} as const;

export const messages = mergeMessages(appMessages);
