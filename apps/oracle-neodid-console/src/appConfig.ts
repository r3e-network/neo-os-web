import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-neodid-console";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "NeoDID verifier",
};

export const manifest: MiniAppManifest = {
  name: "Oracle NeoDID Console",
  description: "Prepare NeoDID verification requests for Morpheus oracle flows.",
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
  permissions: { datafeed: true },
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
    { key: "did", labelKey: "did", placeholderKey: "didPlaceholder", type: "text", defaultValue: "did:neo:builder" },
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
    { key: "claim", labelKey: "claim", placeholderKey: "claimPlaceholder", type: "text", defaultValue: "human-verified" },
    { key: "callback", labelKey: "callback", placeholderKey: "callbackPlaceholder", type: "text", defaultValue: "0x..." },
  ],
  buildResult(values, t) {
    const did = clean(values.did, "did:neo:unknown");
    const provider = clean(values.provider, "neodid-registry");
    const claim = clean(values.claim, "human-verified");
    const callback = clean(values.callback, "0x...");
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
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle NeoDID Console", zh: "预言机 NeoDID 控制台" },
  title: { en: "Oracle NeoDID", zh: "预言机 NeoDID" },
  tabNeoDid: { en: "NeoDID", zh: "NeoDID" },
  panelEyebrow: { en: "Identity oracle", zh: "身份预言机" },
  panelTitle: { en: "NeoDID Verification Request", zh: "NeoDID 校验请求" },
  panelDescription: {
    en: "Prepare a NeoDID verification payload that can be dispatched through Morpheus.",
    zh: "准备可通过 Morpheus 分发的 NeoDID 校验载荷。",
  },
  runAction: { en: "Preview Verification", zh: "预览校验" },
  did: { en: "DID", zh: "DID" },
  didPlaceholder: { en: "did:neo:builder", zh: "did:neo:builder" },
  provider: { en: "Provider", zh: "提供方" },
  providerRegistry: { en: "NeoDID registry", zh: "NeoDID 注册表" },
  providerWallet: { en: "Wallet signature", zh: "钱包签名" },
  providerSocial: { en: "Social attestation", zh: "社交证明" },
  claim: { en: "Claim", zh: "声明" },
  claimPlaceholder: { en: "human-verified", zh: "human-verified" },
  callback: { en: "Callback Contract", zh: "回调合约" },
  callbackPlaceholder: { en: "0x...", zh: "0x..." },
  verifyReady: { en: "Verification request ready", zh: "校验请求已准备" },
  verifySummary: { en: "Claim '{claim}' queued for verification", zh: "声明“{claim}”已进入校验预览" },
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
  feature2Name: { en: "Morpheus Ready", zh: "Morpheus 就绪" },
  feature2Desc: { en: "The payload mirrors a verification dispatch request.", zh: "载荷贴近校验分发请求结构。" },
  feature3Name: { en: "Reviewable", zh: "可复核" },
  feature3Desc: { en: "A local digest helps catch mismatched identity requests.", zh: "本地摘要有助于发现身份请求不一致。" },
} as const;

export const messages = mergeMessages(appMessages);
