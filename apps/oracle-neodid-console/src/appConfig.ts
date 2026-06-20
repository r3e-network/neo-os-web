import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import { getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-neodid-console";

/**
 * Resolve the network label from the launched network instead of a hardcoded
 * "Morpheus Testnet". The NeoDID lanes are live on the mainnet nitro worker
 * while the testnet runtime is still degraded (getNetwork() defaults to mainnet).
 */
export function resolveNetworkLabel(): string {
  return getNetwork() === "testnet" ? "Morpheus Testnet" : "Morpheus Mainnet";
}

export const appMeta = {
  networkLabel: resolveNetworkLabel(),
  // buildResult only computes a local digest; it never calls the verifier. Mark
  // the endpoint stat as a preview builder so "NeoDID verifier" on the live
  // network label does not read as "identity verified".
  endpointLabel: "Verification preview builder",
};

const DEFAULT_DID = "did:neo:testnet:sample-user";
const DEFAULT_CLAIM = "profile.kyc";

export const manifest: MiniAppManifest = {
  name: "Oracle NeoDID Console",
  description:
    "Preview NeoDID verification requests for Morpheus oracle flows.",
  icon: "did",
  category: "oracle",
  shell: "console",
  theme: { family: "social", accentColor: "#a78bfa", density: "comfortable" },
  tabs: [{ key: "neodid", labelKey: "tabNeoDid", icon: "did", default: true }],
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
      icon: "verified",
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
  permissions: { oracle: true, confidential: true, datafeed: true },
};

const clean = (value: string | undefined, fallback: string) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

// A DID must follow the did:neo:<method-specific-id> shape; a callback (when
// provided) must be a 20-byte hash160 — the same type the host operation panel
// declares for this param (neo-manifest.json callback: hash160).
const DID_PATTERN = /^did:neo:[a-z0-9:_-]+$/i;
const HASH160_PATTERN = /^0x[0-9a-f]{40}$/i;
const PROVIDER_LABEL_KEYS: Record<string, string> = {
  "neodid-registry": "providerRegistry",
  "wallet-signature": "providerWallet",
  "social-attestation": "providerSocial",
};

export function isValidDid(did: string): boolean {
  return DID_PATTERN.test(did);
}

export function isValidCallback(callback: string): boolean {
  return callback === "" || HASH160_PATTERN.test(callback);
}

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
      key: "did",
      labelKey: "did",
      placeholderKey: "didPlaceholder",
      type: "text",
      defaultValue: DEFAULT_DID,
    },
    {
      key: "provider",
      labelKey: "provider",
      type: "select",
      defaultValue: "neodid-registry",
      options: [
        { value: "neodid-registry", labelKey: "providerRegistry" },
        { value: "wallet-signature", labelKey: "providerWallet" },
        { value: "social-attestation", labelKey: "providerSocial" },
      ],
    },
    {
      key: "claim",
      labelKey: "claim",
      placeholderKey: "claimPlaceholder",
      type: "text",
      defaultValue: DEFAULT_CLAIM,
    },
    {
      key: "callback",
      labelKey: "callback",
      placeholderKey: "callbackPlaceholder",
      type: "text",
      defaultValue: "",
    },
  ],
  buildResult(values, t) {
    const did = clean(values.did, "");
    const provider = clean(values.provider, "neodid-registry");
    const claim = clean(values.claim, "");
    const callback = clean(values.callback, "");
    if (!did || !claim) {
      return {
        status: t("inputRequired"),
        summary: t("inputRequiredSummary"),
        rows: [],
        payload: {
          kind: "oracle.neodid.verify",
          status: "input_required",
          required: ["did", "claim"],
          execution: "preview_only",
          dispatchReady: false,
        },
      };
    }
    // Non-empty but malformed DID / callback are validation failures: surface
    // them in explicit validity rows and flag the payload input_required so the
    // shared panel warns instead of previewing junk as a verifiable request.
    const didValid = isValidDid(did);
    const callbackValid = isValidCallback(callback);
    const formatOk = didValid && callbackValid;
    const status = !didValid
      ? t("didInvalid")
      : !callbackValid
        ? t("callbackInvalid")
        : t("verifyReady");
    const digest = previewId(`${did}|${provider}|${claim}|${callback}`);
    const providerLabelKey = PROVIDER_LABEL_KEYS[provider];

    return {
      status,
      summary: formatOk ? t("verifySummary", { claim }) : status,
      rows: [
        { label: t("did"), value: did },
        { label: t("didValid"), value: didValid ? t("yes") : t("no") },
        {
          label: t("providerShort"),
          value: providerLabelKey ? t(providerLabelKey) : provider,
        },
        { label: t("claim"), value: claim },
        ...(callback
          ? [
              {
                label: t("callbackValid"),
                value: callbackValid ? t("yes") : t("no"),
              },
            ]
          : []),
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.neodid.verify",
        ...(formatOk ? {} : { status: "input_required" as const }),
        did,
        didValid,
        provider,
        claim,
        callback,
        callbackValid,
        digest,
        execution: "preview_only",
        dispatchReady: false,
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle NeoDID Console", zh: "预言机 NeoDID 控制台" },
  title: { en: "Oracle NeoDID", zh: "预言机 NeoDID" },
  tabNeoDid: { en: "NeoDID", zh: "NeoDID" },
  panelEyebrow: { en: "Identity oracle", zh: "身份预言机" },
  panelTitle: { en: "NeoDID Verification Preview", zh: "NeoDID 校验预览" },
  panelDescription: {
    en: "Prepare a reviewable NeoDID verification package before Morpheus dispatch. This preview builder computes a local digest and does not verify identity. Confirm the exact provider id and claim type against the live Morpheus NeoDID catalog (GET /neodid/providers) before dispatch.",
    zh: "在 Morpheus 分发前准备可复核的 NeoDID 校验包。此预览构建器只计算本地摘要，不会验证身份。分发前请对照 Morpheus NeoDID 实时目录（GET /neodid/providers）确认确切的提供方 id 与声明类型。",
  },
  runAction: { en: "Preview Verification", zh: "预览校验" },
  did: { en: "DID", zh: "DID" },
  didPlaceholder: { en: DEFAULT_DID, zh: DEFAULT_DID },
  provider: {
    en: "Provider (example - verify against live catalog)",
    zh: "提供方（示例 - 请对照实时目录核实）",
  },
  providerShort: { en: "Provider", zh: "提供方" },
  providerRegistry: { en: "NeoDID registry", zh: "NeoDID 注册表" },
  providerWallet: { en: "Wallet signature", zh: "钱包签名" },
  providerSocial: { en: "Social attestation", zh: "社交证明" },
  providerRegistryHint: {
    en: "Registry-backed credential lookup",
    zh: "基于注册表的凭证查询",
  },
  providerWalletHint: {
    en: "Wallet-controlled proof check",
    zh: "钱包控制的证明检查",
  },
  providerSocialHint: { en: "External attestation signal", zh: "外部证明信号" },
  claim: { en: "Claim", zh: "声明" },
  claimPlaceholder: {
    en: "e.g. profile.kyc - match a live provider claim type",
    zh: "例如 profile.kyc - 需与实时提供方声明类型匹配",
  },
  callback: { en: "Callback Contract", zh: "回调合约" },
  callbackShort: { en: "Callback", zh: "回调" },
  callbackPlaceholder: {
    en: "Optional callback contract hash",
    zh: "可选回调合约哈希",
  },
  didValid: { en: "DID format valid", zh: "DID 格式有效" },
  didInvalid: {
    en: "Enter a valid did:neo identifier",
    zh: "请输入有效的 did:neo 标识符",
  },
  didInvalidHint: {
    en: "Use did:neo:<method-specific-id>.",
    zh: "请使用 did:neo:<method-specific-id>。",
  },
  didReadyHint: {
    en: "DID shape is ready for preview.",
    zh: "DID 形态已可用于预览。",
  },
  callbackValid: { en: "Callback hash valid", zh: "回调哈希有效" },
  callbackInvalid: {
    en: "Callback must be a 0x hash160",
    zh: "回调必须是 0x hash160",
  },
  callbackInvalidHint: {
    en: "Optional, but when present it must be a 0x hash160.",
    zh: "可选；填写时必须是 0x hash160。",
  },
  callbackReadyHint: {
    en: "Callback is optional and format-safe.",
    zh: "回调为可选项，当前格式安全。",
  },
  callbackOptional: { en: "No callback", zh: "无回调" },
  claimReadyHint: { en: "Claim type is present.", zh: "声明类型已填写。" },
  claimMissingHint: {
    en: "Choose the claim type to verify.",
    zh: "请选择要验证的声明类型。",
  },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  inputRequired: { en: "Required fields missing", zh: "缺少必填字段" },
  inputRequiredSummary: {
    en: "Enter a DID and claim before building a NeoDID preview.",
    zh: "请输入 DID 和声明字段后再生成 NeoDID 预览。",
  },
  verifyReady: { en: "Verification preview ready", zh: "校验预览已准备" },
  verifySummary: {
    en: "Claim '{claim}' prepared for review",
    zh: "声明“{claim}”已准备复核",
  },
  ready: { en: "Ready", zh: "已就绪" },
  validationBlocked: { en: "Validation blocked", zh: "校验已阻止" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
  digestPlaceholder: { en: "—", zh: "—" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  neodidHeroAlt: {
    en: "Abstract identity credential flowing through an oracle verifier",
    zh: "抽象身份凭证流经预言机校验器",
  },
  neodidHeroCopy: {
    en: "Stage the subject, provider, claim, and callback as one reviewable identity request before any live Morpheus dispatch.",
    zh: "在任何 Morpheus 实时分发前，将主体、提供方、声明和回调整理成一个可复核的身份请求。",
  },
  neodidStatusLabel: { en: "NeoDID preview status", zh: "NeoDID 预览状态" },
  neodidFlowTitle: { en: "NeoDID verification flow", zh: "NeoDID 校验流程" },
  neodidFlowSubject: { en: "Subject DID", zh: "主体 DID" },
  neodidFlowSubjectDesc: {
    en: "Check the DID shape first",
    zh: "先检查 DID 形态",
  },
  neodidFlowProvider: { en: "Provider catalog", zh: "提供方目录" },
  neodidFlowProviderDesc: {
    en: "Match the live claim source",
    zh: "匹配实时声明来源",
  },
  neodidFlowReceipt: { en: "Digest receipt", zh: "摘要回执" },
  neodidFlowReceiptDesc: { en: "Preview package only", zh: "仅生成预览包" },
  neodidPlan: { en: "Verification workspace", zh: "校验工作台" },
  neodidPlanCopy: {
    en: "Build the request from identity context, not from a raw form.",
    zh: "从身份上下文组织请求，而不是填写裸表单。",
  },
  neodidCatalogTitle: { en: "Preview only", zh: "仅预览" },
  neodidCatalogCopy: {
    en: "Provider and claim options are examples. Check GET /neodid/providers before dispatching a real request.",
    zh: "提供方与声明选项为示例。分发真实请求前请检查 GET /neodid/providers。",
  },
  neodidSubjectTitle: { en: "Identity subject", zh: "身份主体" },
  neodidSubjectCopy: {
    en: "Start with the DID that the oracle should evaluate.",
    zh: "先确认预言机需要评估的 DID。",
  },
  neodidProviderTitle: { en: "Evidence source", zh: "证明来源" },
  neodidProviderCopy: {
    en: "Choose the example provider lane that matches the claim.",
    zh: "选择与声明匹配的示例提供方通道。",
  },
  neodidClaimTitle: { en: "Claim and callback", zh: "声明与回调" },
  neodidClaimCopy: {
    en: "Bind the claim type and optional callback contract.",
    zh: "绑定声明类型和可选回调合约。",
  },
  neodidReceipt: { en: "Verification receipt", zh: "校验回执" },
  neodidValidationReady: { en: "Ready to preview", zh: "可预览" },
  neodidEmptyTitle: { en: "No receipt yet", zh: "尚无回执" },
  neodidEmptyCopy: {
    en: "Preview the request to see the digest, validation rows, and copyable payload.",
    zh: "预览请求后可查看摘要、校验行和可复制载荷。",
  },
  dispatchReady: { en: "Dispatch ready", zh: "可分发" },
  payload: { en: "Payload", zh: "载荷" },
  previewReady: { en: "Preview ready", zh: "预览已就绪" },
  docsSubtitle: {
    en: "A clean control surface for identity verification oracle requests.",
    zh: "面向身份校验预言机请求的清晰控制台。",
  },
  docSubtitle: {
    en: "A clean control surface for identity verification oracle requests.",
    zh: "面向身份校验预言机请求的清晰控制台。",
  },
  feature1Name: { en: "DID Focused", zh: "聚焦 DID" },
  feature1Desc: {
    en: "DID, provider, claim, and callback fields are grouped together.",
    zh: "DID、提供方、声明和回调字段集中展示。",
  },
  feature2Name: { en: "Dispatch Aware", zh: "分发感知" },
  feature2Desc: {
    en: "The payload mirrors the subject, claim, provider, and callback fields needed later.",
    zh: "载荷映射后续所需的 subject、claim、provider 和 callback 字段。",
  },
  feature3Name: { en: "Reviewable", zh: "可复核" },
  feature3Desc: {
    en: "A local digest helps catch mismatched identity requests.",
    zh: "本地摘要有助于发现身份请求不一致。",
  },
} as const;

export const messages = mergeMessages(appMessages);
