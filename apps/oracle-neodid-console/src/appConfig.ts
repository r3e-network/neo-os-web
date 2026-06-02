import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-neodid-console";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "NeoDID verifier",
};

const DEFAULT_DID = "did:neo:testnet:sample-user";
const DEFAULT_CLAIM = "profile.kyc";

export const manifest: MiniAppManifest = {
  name: "Oracle NeoDID Console",
  description: "Preview NeoDID verification requests for Morpheus oracle flows.",
  icon: "did",
  category: "oracle",
  shell: "console",
  theme: { family: "social", accentColor: "#a78bfa", density: "comfortable" },
  tabs: [{ key: "neodid", labelKey: "tabNeoDid", icon: "did", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "verified" },
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
  permissions: { oracle: true, confidential: true, datafeed: true },
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
    { key: "did", labelKey: "did", placeholderKey: "didPlaceholder", type: "text", defaultValue: DEFAULT_DID },
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
    { key: "claim", labelKey: "claim", placeholderKey: "claimPlaceholder", type: "text", defaultValue: DEFAULT_CLAIM },
    { key: "callback", labelKey: "callback", placeholderKey: "callbackPlaceholder", type: "text", defaultValue: "" },
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
    const digest = previewId(`${did}|${provider}|${claim}|${callback}`);

    return {
      status: t("verifyReady"),
      summary: t("verifySummary", { claim }),
      rows: [
        { label: t("did"), value: did },
        { label: t("provider"), value: provider },
        { label: t("claim"), value: claim },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.neodid.verify",
        did,
        provider,
        claim,
        callback,
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
    en: "Prepare a reviewable NeoDID verification package before Morpheus dispatch.",
    zh: "在 Morpheus 分发前准备可复核的 NeoDID 校验包。",
  },
  runAction: { en: "Preview Verification", zh: "预览校验" },
  did: { en: "DID", zh: "DID" },
  didPlaceholder: { en: DEFAULT_DID, zh: DEFAULT_DID },
  provider: { en: "Provider", zh: "提供方" },
  providerRegistry: { en: "NeoDID registry", zh: "NeoDID 注册表" },
  providerWallet: { en: "Wallet signature", zh: "钱包签名" },
  providerSocial: { en: "Social attestation", zh: "社交证明" },
  claim: { en: "Claim", zh: "声明" },
  claimPlaceholder: { en: DEFAULT_CLAIM, zh: DEFAULT_CLAIM },
  callback: { en: "Callback Contract", zh: "回调合约" },
  callbackPlaceholder: { en: "Optional callback contract hash", zh: "可选回调合约哈希" },
  inputRequired: { en: "Required fields missing", zh: "缺少必填字段" },
  inputRequiredSummary: {
    en: "Enter a DID and claim before building a NeoDID preview.",
    zh: "请输入 DID 和声明字段后再生成 NeoDID 预览。",
  },
  verifyReady: { en: "Verification preview ready", zh: "校验预览已准备" },
  verifySummary: { en: "Claim '{claim}' prepared for review", zh: "声明“{claim}”已准备复核" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A clean control surface for identity verification oracle requests.",
    zh: "面向身份校验预言机请求的清晰控制台。",
  },
  docSubtitle: {
    en: "A clean control surface for identity verification oracle requests.",
    zh: "面向身份校验预言机请求的清晰控制台。",
  },
  feature1Name: { en: "DID Focused", zh: "聚焦 DID" },
  feature1Desc: { en: "DID, provider, claim, and callback fields are grouped together.", zh: "DID、提供方、声明和回调字段集中展示。" },
  feature2Name: { en: "Dispatch Aware", zh: "分发感知" },
  feature2Desc: { en: "The payload mirrors the subject, claim, provider, and callback fields needed later.", zh: "载荷映射后续所需的 subject、claim、provider 和 callback 字段。" },
  feature3Name: { en: "Reviewable", zh: "可复核" },
  feature3Desc: { en: "A local digest helps catch mismatched identity requests.", zh: "本地摘要有助于发现身份请求不一致。" },
} as const;

export const messages = mergeMessages(appMessages);
