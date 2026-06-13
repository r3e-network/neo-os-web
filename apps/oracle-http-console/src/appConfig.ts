import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import { getExternalIntegrationConfig, getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-http-console";
// Default the example URL to the launched network's Morpheus public API (the
// mainnet nitro worker is the restored lane; the testnet runtime is still the
// degraded emergency runtime), so the seeded request targets a live endpoint.
const DEFAULT_HTTP_URL = `${getExternalIntegrationConfig().morpheusPublicApiUrl}/health`;

/**
 * Resolve the network label from the launched network instead of a hardcoded
 * "Morpheus Testnet" string (getNetwork() defaults to mainnet, the live lane).
 */
export function resolveNetworkLabel(): string {
  return getNetwork() === "testnet" ? "Morpheus Testnet" : "Morpheus Mainnet";
}

export const appMeta = {
  networkLabel: resolveNetworkLabel(),
  endpointLabel: "HTTP data request",
};

export const manifest: MiniAppManifest = {
  name: "Oracle HTTP Console",
  description: "Prepare HTTP oracle reads with URL, method, and extraction path.",
  icon: "radio",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#16c784", density: "comfortable" },
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

/**
 * Lightweight JSONPath validity check: the extraction path must start with the
 * root `$`, have balanced `[`/`]`, and contain no empty `..` / trailing `.`
 * segments. This is a syntax sanity gate (matching the http(s) URL row), not a
 * full JSONPath engine — a typo like `$status`, `status.`, or `$.a[` is caught
 * before the request would be bound on-chain.
 */
export function isValidJsonPath(path: string): boolean {
  if (!path.startsWith("$")) return false;
  // After the root `$`, the path must either end or continue with `.` (member
  // / recursive descent) or `[` (subscript). `$status` (root glued to a key) is
  // rejected — exactly the typo this row is meant to catch.
  if (path.length > 1 && path[1] !== "." && path[1] !== "[") return false;
  let depth = 0;
  for (const char of path) {
    if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  if (depth !== 0) return false;
  // Reject empty dotted segments: a trailing dot or `..` (other than the
  // recursive-descent `..` operator, which is followed by a key or `*`).
  if (/\.$/.test(path)) return false;
  if (/\.\.(?![A-Za-z0-9_*[])/.test(path)) return false;
  if (/\.(?=[.])/.test(path.replace(/\.\./g, ""))) return false;
  return true;
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
      key: "method",
      labelKey: "method",
      type: "select",
      defaultValue: "GET",
      options: [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
      ],
    },
    { key: "url", labelKey: "url", placeholderKey: "urlPlaceholder", type: "text", defaultValue: DEFAULT_HTTP_URL },
    { key: "jsonPath", labelKey: "jsonPath", placeholderKey: "jsonPathPlaceholder", type: "text", defaultValue: "$.status" },
    { key: "body", labelKey: "body", placeholderKey: "bodyPlaceholder", type: "textarea", defaultValue: "" },
  ],
  buildResult(values, t) {
    const method = clean(values.method, "GET");
    const url = clean(values.url, DEFAULT_HTTP_URL);
    const jsonPath = clean(values.jsonPath, "$.status");
    // Only POST carries a request body; folding a GET body into the digest and
    // payload would misrepresent the request that gets bound on-chain.
    const body = method === "POST" ? clean(values.body, "") : "";
    // Validate the endpoint has an http(s) scheme so a malformed URL is surfaced
    // (non-blocking) instead of being silently previewed.
    let urlValid = false;
    try {
      const parsed = new URL(url);
      urlValid = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      urlValid = false;
    }
    // Validate the extraction path too: a typo'd path (`$status`, `status.`)
    // would otherwise preview as "ready" and only fail after on-chain binding.
    const pathValid = isValidJsonPath(jsonPath);
    const inputOk = urlValid && pathValid;
    const status = !urlValid
      ? t("httpInvalidUrl")
      : !pathValid
        ? t("httpInvalidPath")
        : t("httpReady");
    const digest = previewId(`${method}|${url}|${jsonPath}|${body}`);

    return {
      status,
      summary: inputOk ? t("httpSummary", { method }) : status,
      rows: [
        { label: t("method"), value: method },
        { label: t("url"), value: url },
        { label: t("urlValid"), value: urlValid ? t("yes") : t("no") },
        { label: t("jsonPath"), value: jsonPath },
        { label: t("pathValid"), value: pathValid ? t("yes") : t("no") },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.http.request",
        // A failed http(s) scheme or JSONPath syntax check is a validation
        // failure: flag it as input_required so the shared ConsoleToolPanel
        // classifies the preview as a warning (no success toast, no Requests
        // increment, digest placeholder preserved) — matching the visible
        // "URL valid: No" / "Path valid: No" rows instead of contradicting them
        // with a green success signal.
        ...(inputOk ? {} : { status: "input_required" as const }),
        method,
        url,
        urlValid,
        jsonPath,
        pathValid,
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
  urlPlaceholder: { en: DEFAULT_HTTP_URL, zh: DEFAULT_HTTP_URL },
  jsonPath: { en: "JSON Path", zh: "JSON 路径" },
  jsonPathPlaceholder: { en: "$.status", zh: "$.status" },
  body: { en: "Body", zh: "Body" },
  bodyPlaceholder: { en: "Optional POST body", zh: "可选 POST body" },
  httpReady: { en: "HTTP request ready", zh: "HTTP 请求已准备" },
  httpInvalidUrl: { en: "Enter a valid http(s) URL", zh: "请输入有效的 http(s) 网址" },
  httpInvalidPath: { en: "Enter a valid JSON path (start with $)", zh: "请输入有效的 JSON 路径（以 $ 开头）" },
  urlValid: { en: "URL valid", zh: "网址有效" },
  pathValid: { en: "Path valid", zh: "路径有效" },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  httpSummary: { en: "{method} oracle request prepared", zh: "{method} 预言机请求已准备" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
  digestPlaceholder: { en: "—", zh: "—" },
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
