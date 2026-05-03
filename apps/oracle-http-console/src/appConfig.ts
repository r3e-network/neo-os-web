import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-http-console";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "HTTP data request",
};

export const manifest: MiniAppManifest = {
  name: "Oracle HTTP Console",
  description: "Prepare HTTP oracle reads with URL, method, and extraction path.",
  icon: "radio",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#34d399", density: "comfortable" },
  tabs: [{ key: "http", labelKey: "tabHttp", icon: "radio", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "signal" },
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
    {
      key: "method",
      labelKey: "method",
      type: "select",
      defaultValue: "GET",
      options: [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
      ],
    },
    { key: "url", labelKey: "url", placeholderKey: "urlPlaceholder", type: "text", defaultValue: "https://api.example.com/prices/neo" },
    { key: "jsonPath", labelKey: "jsonPath", placeholderKey: "jsonPathPlaceholder", type: "text", defaultValue: "$.price" },
    { key: "body", labelKey: "body", placeholderKey: "bodyPlaceholder", type: "textarea", defaultValue: "" },
  ],
  buildResult(values, t) {
    const method = clean(values.method, "GET");
    const url = clean(values.url, "https://api.example.com/prices/neo");
    const jsonPath = clean(values.jsonPath, "$.price");
    const body = clean(values.body, "");
    const digest = previewId(`${method}|${url}|${jsonPath}|${body}`);

    return {
      status: t("httpReady"),
      summary: t("httpSummary", { method }),
      rows: [
        { label: t("method"), value: method },
        { label: t("url"), value: url },
        { label: t("jsonPath"), value: jsonPath },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.http.request",
        method,
        url,
        jsonPath,
        body,
        digest,
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle HTTP Console", zh: "预言机 HTTP 控制台" },
  title: { en: "Oracle HTTP", zh: "预言机 HTTP" },
  tabHttp: { en: "HTTP", zh: "HTTP" },
  panelEyebrow: { en: "HTTP data feed", zh: "HTTP 数据源" },
  panelTitle: { en: "HTTP Oracle Request", zh: "HTTP 预言机请求" },
  panelDescription: {
    en: "Prepare a clear web-data request for Morpheus before binding it to an on-chain callback.",
    zh: "绑定链上回调前，先准备清晰的 Morpheus Web 数据请求。",
  },
  runAction: { en: "Preview Request", zh: "预览请求" },
  method: { en: "Method", zh: "方法" },
  url: { en: "URL", zh: "URL" },
  urlPlaceholder: { en: "https://api.example.com/prices/neo", zh: "https://api.example.com/prices/neo" },
  jsonPath: { en: "JSON Path", zh: "JSON 路径" },
  jsonPathPlaceholder: { en: "$.price", zh: "$.price" },
  body: { en: "Body", zh: "Body" },
  bodyPlaceholder: { en: "Optional POST body", zh: "可选 POST body" },
  httpReady: { en: "HTTP request ready", zh: "HTTP 请求已准备" },
  httpSummary: { en: "{method} oracle request prepared", zh: "{method} 预言机请求已准备" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A focused request builder for HTTP-backed Morpheus oracle reads.",
    zh: "面向 HTTP 数据源的 Morpheus 预言机请求构建器。",
  },
  docSubtitle: {
    en: "A focused request builder for HTTP-backed Morpheus oracle reads.",
    zh: "面向 HTTP 数据源的 Morpheus 预言机请求构建器。",
  },
  feature1Name: { en: "Explicit", zh: "显式" },
  feature1Desc: { en: "Method, URL, path, and body are kept visible.", zh: "方法、URL、路径和 body 都保持可见。" },
  feature2Name: { en: "Callback Ready", zh: "回调就绪" },
  feature2Desc: { en: "The preview is shaped for a later on-chain callback binding.", zh: "预览结构适合后续绑定链上回调。" },
  feature3Name: { en: "Auditable", zh: "可审计" },
  feature3Desc: { en: "The digest lets teams compare the intended request with the submitted one.", zh: "摘要便于团队比对预期请求和实际提交请求。" },
} as const;

export const messages = mergeMessages(appMessages);
