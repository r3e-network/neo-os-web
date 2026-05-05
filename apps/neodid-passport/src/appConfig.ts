import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-neodid-passport";

export const appMeta = {
  networkLabel: "NeoDID",
  endpointLabel: "Credential preview",
};

export const manifest: MiniAppManifest = {
  name: "NeoDID Passport",
  description: "Compose portable NeoDID credential previews for identity flows.",
  icon: "did",
  category: "tool",
  shell: "console",
  theme: { family: "social", accentColor: "#7dd3fc", density: "comfortable" },
  tabs: [{ key: "passport", labelKey: "tabPassport", icon: "did", default: true }],
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
    { key: "subject", labelKey: "subject", placeholderKey: "subjectPlaceholder", type: "text", defaultValue: "" },
    {
      key: "provider",
      labelKey: "provider",
      type: "select",
      defaultValue: "wallet",
      options: [
        { value: "wallet", labelKey: "walletProvider" },
        { value: "github", label: "GitHub" },
        { value: "email", labelKey: "emailProvider" },
      ],
    },
    { key: "claim", labelKey: "claim", placeholderKey: "claimPlaceholder", type: "text", defaultValue: "" },
    { key: "audience", labelKey: "audience", placeholderKey: "audiencePlaceholder", type: "text", defaultValue: "" },
  ],
  buildResult(values, t) {
    const subject = clean(values.subject, "");
    const provider = clean(values.provider, "wallet");
    const claim = clean(values.claim, "");
    const audience = clean(values.audience, "");
    const digest = previewId(`${subject}|${provider}|${claim}|${audience}`);

    return {
      status: t("passportReady"),
      summary: t("passportSummary", { provider, claim }),
      rows: [
        { label: t("subject"), value: subject },
        { label: t("provider"), value: provider },
        { label: t("claim"), value: claim },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "neodid.passport.preview",
        subject,
        provider,
        claim,
        audience,
        digest,
      },
    };
  },
};

const appMessages = {
  appName: { en: "NeoDID Passport", zh: "NeoDID 身份护照" },
  title: { en: "NeoDID Passport", zh: "NeoDID 身份护照" },
  tabPassport: { en: "Passport", zh: "护照" },
  panelEyebrow: { en: "Identity credential", zh: "身份凭证" },
  panelTitle: { en: "Credential Passport Builder", zh: "凭证护照构建器" },
  panelDescription: {
    en: "Create a readable NeoDID credential preview for wallet, account, and app access flows.",
    zh: "为钱包、账户和应用访问流程创建可读的 NeoDID 凭证预览。",
  },
  runAction: { en: "Build Passport", zh: "生成护照" },
  subject: { en: "Subject DID", zh: "主体 DID" },
  subjectPlaceholder: { en: "Enter subject DID", zh: "输入主体 DID" },
  provider: { en: "Provider", zh: "提供方" },
  walletProvider: { en: "Wallet signature", zh: "钱包签名" },
  emailProvider: { en: "Email proof", zh: "邮箱证明" },
  claim: { en: "Claim", zh: "声明" },
  claimPlaceholder: { en: "Enter credential claim", zh: "输入凭证声明" },
  audience: { en: "Audience", zh: "受众" },
  audiencePlaceholder: { en: "Enter relying party or app ID", zh: "输入依赖方或小程序 ID" },
  passportReady: { en: "Passport preview ready", zh: "身份护照预览已生成" },
  passportSummary: { en: "{provider} claim '{claim}' prepared", zh: "{provider} 声明“{claim}”已准备" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Previews", zh: "预览次数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A compact credential planning tool for NeoDID-backed miniapp access.",
    zh: "面向 NeoDID 小程序访问的轻量凭证规划工具。",
  },
  docSubtitle: {
    en: "A compact credential planning tool for NeoDID-backed miniapp access.",
    zh: "面向 NeoDID 小程序访问的轻量凭证规划工具。",
  },
  feature1Name: { en: "Portable", zh: "可携带" },
  feature1Desc: { en: "Credential payloads are shaped for wallet and app handoff.", zh: "凭证载荷适合钱包和应用之间传递。" },
  feature2Name: { en: "Readable", zh: "可读" },
  feature2Desc: { en: "Important subject, provider, and claim fields are visible before use.", zh: "使用前即可看到主体、提供方和声明等关键信息。" },
  feature3Name: { en: "NeoDID Ready", zh: "NeoDID 就绪" },
  feature3Desc: { en: "The digest gives each preview a stable local reference.", zh: "摘要为每次预览提供稳定的本地引用。" },
} as const;

export const messages = mergeMessages(appMessages);
