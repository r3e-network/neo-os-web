import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import {
  getExternalIntegrationConfig,
  getNetwork,
} from "@shared/constants/rpc";
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
  // buildResult does no network I/O — it only computes a local digest. Mark the
  // endpoint stat as a preview builder so the live network label doesn't read as
  // "the HTTP read already executed".
  endpointLabel: "Request builder (preview)",
};

export const manifest: MiniAppManifest = {
  name: "Oracle HTTP Console",
  description:
    "Prepare HTTP oracle reads with URL, method, and extraction path.",
  icon: "radio",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#16c784", density: "comfortable" },
  tabs: [{ key: "http", labelKey: "tabHttp", icon: "radio", default: true }],
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
      icon: "signal",
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
    {
      key: "url",
      labelKey: "url",
      placeholderKey: "urlPlaceholder",
      type: "text",
      defaultValue: DEFAULT_HTTP_URL,
    },
    {
      key: "jsonPath",
      labelKey: "jsonPath",
      placeholderKey: "jsonPathPlaceholder",
      type: "text",
      defaultValue: "$.status",
    },
    {
      key: "body",
      labelKey: "body",
      placeholderKey: "bodyPlaceholder",
      type: "textarea",
      defaultValue: "",
    },
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
    en: "Prepare a clear web-data request for Morpheus before binding it to an on-chain callback. This is a preview builder — it computes the request digest locally and does not call the URL; the actual fetch runs on the Morpheus lane after you bind the request.",
    zh: "绑定链上回调前，先准备清晰的 Morpheus Web 数据请求。这是预览构建器——它在本地计算请求摘要，不会调用该 URL；实际抓取在绑定请求后由 Morpheus 通道执行。",
  },
  httpHeroAlt: {
    en: "Transparent HTTP oracle pipeline machine validating web data.",
    zh: "透明 HTTP 预言机数据管线正在验证 Web 数据。",
  },
  httpHeroCopy: {
    en: "Compose the exact HTTP read the oracle lane should attest: choose the method, lock the endpoint, extract the JSON value, and preview the digest before any on-chain binding.",
    zh: "编排预言机通道要证明的 HTTP 读取：选择方法、锁定端点、抽取 JSON 值，并在链上绑定前预览摘要。",
  },
  httpStatusLabel: { en: "HTTP request status", zh: "HTTP 请求状态" },
  runAction: { en: "Preview Request", zh: "预览请求" },
  method: { en: "Method", zh: "方法" },
  url: { en: "URL", zh: "URL" },
  urlPlaceholder: { en: DEFAULT_HTTP_URL, zh: DEFAULT_HTTP_URL },
  jsonPath: { en: "JSON Path", zh: "JSON 路径" },
  jsonPathPlaceholder: { en: "$.status", zh: "$.status" },
  body: { en: "Body", zh: "Body" },
  bodyPlaceholder: { en: "Optional POST body", zh: "可选 POST body" },
  httpReady: { en: "HTTP request ready", zh: "HTTP 请求已准备" },
  httpInvalidUrl: {
    en: "Enter a valid http(s) URL",
    zh: "请输入有效的 http(s) 网址",
  },
  httpInvalidPath: {
    en: "Enter a valid JSON path (start with $)",
    zh: "请输入有效的 JSON 路径（以 $ 开头）",
  },
  urlValid: { en: "URL valid", zh: "网址有效" },
  pathValid: { en: "Path valid", zh: "路径有效" },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  httpSummary: {
    en: "{method} oracle request prepared",
    zh: "{method} 预言机请求已准备",
  },
  httpFlowTitle: { en: "Oracle request flow", zh: "预言机请求流程" },
  httpFlowTarget: { en: "Target source", zh: "目标数据源" },
  httpFlowTargetDesc: {
    en: "Use an http(s) endpoint only.",
    zh: "仅使用 http(s) 端点。",
  },
  httpFlowExtract: { en: "Extract value", zh: "抽取字段" },
  httpFlowExtractDesc: {
    en: "Keep JSONPath explicit and reviewable.",
    zh: "JSONPath 清晰可审计。",
  },
  httpFlowBind: { en: "Bind later", zh: "稍后绑定" },
  httpFlowBindDesc: {
    en: "Preview locally before callback binding.",
    zh: "回调绑定前先本地预览。",
  },
  httpRequestPlan: { en: "Request plan", zh: "请求方案" },
  httpRequestPlanCopy: {
    en: "Shape the web-data read as a small, auditable oracle intent.",
    zh: "把 Web 数据读取整理成简洁、可审计的预言机意图。",
  },
  httpRouteWorkbench: { en: "Live oracle route", zh: "实时预言机路线" },
  httpRouteWorkbenchCopy: {
    en: "Follow the request as a source, extractor, and digest instead of a raw form.",
    zh: "以数据源、抽取器和摘要的路线审阅请求，而不是只看原始表单。",
  },
  httpRouteSourceNode: { en: "Source node", zh: "数据源节点" },
  httpRouteExtractNode: { en: "Extractor", zh: "抽取器" },
  httpRouteDigestNode: { en: "Digest beacon", zh: "摘要信标" },
  httpSignalsLabel: { en: "Route signals", zh: "路线信号" },
  httpPipelineTitle: { en: "Request pipeline", zh: "请求管线" },
  httpPipelineCopy: {
    en: "Compose the source, extraction path, and optional body as one reviewable oracle route.",
    zh: "把数据源、抽取路径和可选请求体编排成一条可审阅的预言机路线。",
  },
  httpMethodTitle: { en: "Transport mode", zh: "传输方式" },
  httpMethodCopy: {
    en: "Pick the request style before the digest is computed.",
    zh: "计算摘要前先选择请求方式。",
  },
  httpMethodGetHint: {
    en: "Read a public endpoint without a request body.",
    zh: "读取公开端点，不携带请求体。",
  },
  httpMethodPostHint: {
    en: "Include a compact body in the preview digest.",
    zh: "把简洁请求体纳入预览摘要。",
  },
  httpEndpointTitle: { en: "Data source", zh: "数据源" },
  httpEndpointCopy: {
    en: "Paste the exact URL the oracle lane should fetch.",
    zh: "粘贴预言机通道需要抓取的准确 URL。",
  },
  httpUrlReadyHint: {
    en: "Ready for oracle preview.",
    zh: "可用于预言机预览。",
  },
  httpUrlInvalidHint: {
    en: "Use a valid http(s) URL before previewing.",
    zh: "预览前请使用有效的 http(s) URL。",
  },
  httpExtractionTitle: { en: "Extraction path", zh: "抽取路径" },
  httpExtractionCopy: {
    en: "Name the response field that becomes the attested value.",
    zh: "指定响应里要作为证明值的字段。",
  },
  httpPathReadyHint: {
    en: "JSONPath syntax is ready.",
    zh: "JSONPath 语法可用。",
  },
  httpPathInvalidHint: {
    en: "Start with $ and avoid unfinished brackets or trailing dots.",
    zh: "请以 $ 开头，避免未闭合括号或结尾点号。",
  },
  httpBodyPanelTitle: { en: "Request body", zh: "请求体" },
  httpBodyPanelPostCopy: {
    en: "POST previews include this body and fold it into the digest shown in the receipt.",
    zh: "POST 预览会包含这段请求体，并把它纳入回执里显示的摘要。",
  },
  httpBodyPanelGetCopy: {
    en: "GET previews intentionally ignore the body. Switch to POST when this data must be part of the signed request preview.",
    zh: "GET 预览会刻意忽略请求体。需要把这段数据纳入签名请求预览时，请切换到 POST。",
  },
  httpBodyPostHint: {
    en: "Included only for POST and folded into the digest.",
    zh: "仅 POST 会携带，并会进入摘要。",
  },
  httpBodyGetHint: {
    en: "Disabled for GET because the digest omits request bodies.",
    zh: "GET 下禁用，因为摘要不会包含请求体。",
  },
  httpBodyIncluded: { en: "Body included", zh: "包含请求体" },
  httpBodyIgnored: { en: "No body for GET", zh: "GET 不携带请求体" },
  httpSourceLabel: { en: "Source", zh: "来源" },
  httpExtractionLabel: { en: "Extract", zh: "抽取" },
  httpBodyState: { en: "Body", zh: "请求体" },
  httpResultPreview: { en: "Preview receipt", zh: "预览回执" },
  httpValidationReady: { en: "Inputs ready", zh: "输入已就绪" },
  httpEmptyTitle: { en: "Preview the oracle intent", zh: "预览预言机意图" },
  httpEmptyCopy: {
    en: "When the request is ready, the receipt will show validation rows, digest, and the exact payload that can be copied for review.",
    zh: "请求准备好后，回执会显示校验行、摘要，以及可复制审阅的准确 payload。",
  },
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
  feature1Desc: {
    en: "Method, URL, path, and body are kept visible.",
    zh: "方法、URL、路径和 body 都保持可见。",
  },
  feature2Name: { en: "Callback Ready", zh: "回调就绪" },
  feature2Desc: {
    en: "The preview is shaped for a later on-chain callback binding.",
    zh: "预览结构适合后续绑定链上回调。",
  },
  feature3Name: { en: "Auditable", zh: "可审计" },
  feature3Desc: {
    en: "The digest lets teams compare the intended request with the submitted one.",
    zh: "摘要便于团队比对预期请求和实际提交请求。",
  },
} as const;

export const messages = mergeMessages(appMessages);
