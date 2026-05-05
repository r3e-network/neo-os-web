import { mergeMessages } from "@shared/locale/base-messages";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-private-transfer";

export const manifest: MiniAppManifest = {
  name: "Confidential Transfer",
  description: "Private Neo N3 transfer intents sealed locally and verified by Morpheus confidential compute.",
  icon: "locked",
  category: "defi",
  shell: "console",
  theme: { family: "finance", accentColor: "#00e599", density: "comfortable" },
  tabs: [{ key: "transfer", labelKey: "tabTransfer", icon: "locked", default: true }],
  stats: [
    { labelKey: "statPrivacy", valueKey: "privacyMode", format: "text", icon: "locked" },
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statRequests", valueKey: "requestCount", format: "number", icon: "activity" },
    { labelKey: "statDigest", valueKey: "lastDigest", format: "text", icon: "key" },
  ],
  sidebar: {
    titleKey: "sidebarTitle",
    items: [
      { labelKey: "statPrivacy", valueKey: "privacyMode", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "statDigest", valueKey: "lastDigest", format: "text" },
    ],
  },
  features: { walletRequired: false, chainWarning: true },
  permissions: {
    payments: true,
    oracle: true,
    compute: true,
    confidential: true,
  },
  docs: [
    { titleKey: "docsTitle", contentKey: "docsBody", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
};

const appMessages = {
  appName: { en: "Confidential Transfer", zh: "隐私转账" },
  title: { en: "Confidential Transfer", zh: "隐私转账" },
  tabTransfer: { en: "Transfer", zh: "转账" },
  sidebarTitle: { en: "Privacy Status", zh: "隐私状态" },
  statPrivacy: { en: "Privacy", zh: "隐私" },
  statNetwork: { en: "Network", zh: "网络" },
  statRequests: { en: "Sealed Requests", zh: "封装请求" },
  statDigest: { en: "Commitment", zh: "承诺" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsTitle: { en: "How it works", zh: "工作方式" },
  docsBody: {
    en: "The MiniApp does not put zk curve verification inside Neo VM. It seals transfer details in the browser, stores only ciphertext through Morpheus, and uses confidential compute to produce an attestable settlement intent.",
    zh: "该小程序不会在 Neo VM 内直接做 zk 曲线验证，而是在浏览器本地封装转账细节，只通过 Morpheus 存储密文，并由隐私计算生成可验证的结算意图。",
  },
  feature1Name: { en: "Browser Sealed", zh: "浏览器封装" },
  feature1Desc: { en: "Recipient, amount, memo, and note secret are encrypted before they leave the page.", zh: "收款方、金额、备注和 note secret 在离开页面前完成加密。" },
  feature2Name: { en: "TEE Verified", zh: "TEE 校验" },
  feature2Desc: { en: "Morpheus confidential compute decrypts and validates the private payload inside the TEE.", zh: "Morpheus 隐私计算在 TEE 内解密并校验隐私载荷。" },
  feature3Name: { en: "No Neo zk Curve Assumption", zh: "不依赖 Neo zk 曲线" },
  feature3Desc: { en: "The workflow is designed for Neo N3 without requiring unsupported zk curve verification on-chain.", zh: "该流程面向 Neo N3 设计，不要求链上支持特定 zk 曲线验证。" },
} as const;

export const messages = mergeMessages(appMessages);
