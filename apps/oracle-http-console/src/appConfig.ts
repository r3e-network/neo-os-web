import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  getExternalIntegrationConfig,
  getNetwork,
  resolveNeoNetwork,
} from "@shared/constants/rpc";
import type { NeoNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-http-console";
export const MORPHEUS_HTTP_ROUTE = "/oracle/smart-fetch";
export const MAX_ORACLE_HTTP_URL_LENGTH = 2_048;
export const MAX_ORACLE_HTTP_PATH_LENGTH = 256;
export const MAX_ORACLE_HTTP_BODY_BYTES = 32 * 1_024;

export interface OracleHttpEnvironment {
  network: NeoNetwork;
  networkLabel: string;
  serviceBaseUrl: string;
  defaultUrl: string;
}

/** Bind every draft to the same selected-network registry used by the platform. */
export function resolveOracleHttpEnvironment(network?: string | null): OracleHttpEnvironment {
  const selected = network ? resolveNeoNetwork(network) : getNetwork();
  const integration = getExternalIntegrationConfig(selected);
  return {
    network: selected,
    networkLabel: selected === "testnet" ? "Morpheus Testnet" : "Morpheus Mainnet",
    serviceBaseUrl: integration.morpheusPublicApiUrl.replace(/\/$/, ""),
    defaultUrl: `${integration.morpheusPublicApiUrl.replace(/\/$/, "")}/health`,
  };
}

const DEFAULT_ENVIRONMENT = resolveOracleHttpEnvironment();
export const DEFAULT_HTTP_URL = DEFAULT_ENVIRONMENT.defaultUrl;

/**
 * Resolve the network label from the launch selection instead of hardcoding a
 * service lane. The app stays local even when a canonical endpoint is seeded.
 */
export function resolveNetworkLabel(network?: string | null): string {
  return resolveOracleHttpEnvironment(network).networkLabel;
}

export const appMeta = {
  networkLabel: DEFAULT_ENVIRONMENT.networkLabel,
  endpointLabel: "Local payload builder",
};

export const manifest: MiniAppManifest = {
  name: "Oracle HTTP Console",
  description:
    "Prepare a network-bound Morpheus HTTP payload with a runtime-compatible extraction path.",
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
  features: { walletRequired: false, chainWarning: false },
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
};

const clean = (value: string | undefined, fallback: string) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

export interface OracleHttpPathValidation {
  valid: boolean;
  normalizedPath: string;
}

/**
 * Morpheus currently resolves extraction paths by splitting `json_path` on
 * dots. Accept familiar `$.data[0].price` input for convenience, but normalize
 * it to the runtime form `data.0.price`; reject JSONPath features the runtime
 * does not execute (recursive descent, wildcards, filters, and quoted keys).
 */
export function validateOracleHttpPath(value: string): OracleHttpPathValidation {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > MAX_ORACLE_HTTP_PATH_LENGTH) {
    return { valid: false, normalizedPath: raw };
  }
  let normalized = raw.startsWith("$.") ? raw.slice(2) : raw;
  normalized = normalized.replace(
    /\[(\d+)\]/g,
    (_match, index: string) => `.${index.replace(/^0+(?=\d)/, "")}`,
  );
  const valid = normalized.length > 0
    && normalized.length <= MAX_ORACLE_HTTP_PATH_LENGTH
    && /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(normalized);
  return { valid, normalizedPath: normalized };
}

/** Backwards-compatible export name retained for the focused shared tests. */
export function isValidJsonPath(path: string): boolean {
  return validateOracleHttpPath(path).valid;
}

export interface OracleHttpEndpointValidation {
  valid: boolean;
  normalizedUrl: string;
  errorKey: "" | "httpInvalidUrl" | "httpUrlCredentialsBlocked" | "httpUrlFragmentBlocked" | "httpUrlPrivateHostBlocked";
}

function isNonPublicHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.includes(":")) {
    const mappedIpv4 = host.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
    if (mappedIpv4) return isNonPublicHostname(mappedIpv4);
    return host === "::" || host === "::1" || host.startsWith("::ffff:") || host.startsWith("fc") || host.startsWith("fd") || /^fe[89ab]/.test(host);
  }
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a = 0, b = 0] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

/** Match the public endpoint shape that an oracle lane can actually fetch. */
export function validateOracleHttpEndpoint(value: string): OracleHttpEndpointValidation {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > MAX_ORACLE_HTTP_URL_LENGTH) return { valid: false, normalizedUrl: raw, errorKey: "httpInvalidUrl" };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, normalizedUrl: raw, errorKey: "httpInvalidUrl" };
    }
    if (parsed.username || parsed.password) {
      return { valid: false, normalizedUrl: raw, errorKey: "httpUrlCredentialsBlocked" };
    }
    if (parsed.hash) {
      return { valid: false, normalizedUrl: raw, errorKey: "httpUrlFragmentBlocked" };
    }
    if (isNonPublicHostname(parsed.hostname)) {
      return { valid: false, normalizedUrl: raw, errorKey: "httpUrlPrivateHostBlocked" };
    }
    return { valid: true, normalizedUrl: parsed.toString(), errorKey: "" };
  } catch {
    return { valid: false, normalizedUrl: raw, errorKey: "httpInvalidUrl" };
  }
}

export interface OracleHttpBodyValidation {
  valid: boolean;
  bytes: number;
  errorKey: "" | "httpBodyTooLarge" | "httpBodyInvalidJson";
}

export function validateOracleHttpBody(method: string, value: string): OracleHttpBodyValidation {
  if (method !== "POST") return { valid: true, bytes: 0, errorKey: "" };
  const body = String(value ?? "");
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes > MAX_ORACLE_HTTP_BODY_BYTES) {
    return { valid: false, bytes, errorKey: "httpBodyTooLarge" };
  }
  if (!body.trim()) return { valid: true, bytes, errorKey: "" };
  try {
    JSON.parse(body);
    return { valid: true, bytes, errorKey: "" };
  } catch {
    return { valid: false, bytes, errorKey: "httpBodyInvalidJson" };
  }
}

export interface MorpheusHttpPayload {
  url: string;
  method: "GET" | "POST";
  json_path: string;
  target_chain: "neo_n3";
  headers?: { "content-type": "application/json" };
  body?: string;
}

function sha256Hex0x(value: string): string {
  const bytes = sha256(new TextEncoder().encode(value));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function buildMorpheusPayload(
  method: "GET" | "POST",
  url: string,
  jsonPath: string,
  body: string,
): MorpheusHttpPayload {
  const bodyIncluded = method === "POST" && body.trim().length > 0;
  return {
    url,
    method,
    json_path: jsonPath,
    target_chain: "neo_n3",
    ...(bodyIncluded
      ? { headers: { "content-type": "application/json" as const }, body }
      : {}),
  };
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
      defaultValue: "status",
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
    const method = clean(values.method, "GET").toUpperCase() === "POST" ? "POST" : "GET";
    // Defaults belong to the composed UI state. The builder itself must not
    // silently replace missing caller input (especially a testnet URL) with
    // the module-load network default.
    const rawUrl = String(values.url ?? "").trim();
    const pathInput = String(values.jsonPath ?? "").trim();
    // A request body is byte-for-byte meaningful. Do not trim or reserialize it;
    // GET omits it while POST validates and hashes the exact string the user saw.
    const body = method === "POST" ? String(values.body ?? "") : "";
    const environment = resolveOracleHttpEnvironment(values.network);
    const endpoint = validateOracleHttpEndpoint(rawUrl);
    const urlValid = endpoint.valid;
    const url = endpoint.valid ? endpoint.normalizedUrl : rawUrl;
    const path = validateOracleHttpPath(pathInput);
    const bodyState = validateOracleHttpBody(method, body);
    const inputOk = urlValid && path.valid && bodyState.valid;
    const status = !urlValid
      ? t(endpoint.errorKey || "httpInvalidUrl")
      : !path.valid
        ? t("httpInvalidPath")
        : !bodyState.valid
          ? t(bodyState.errorKey)
          : t("httpReady");
    const morpheusPayload = buildMorpheusPayload(
      method,
      url,
      path.normalizedPath,
      body,
    );
    const digest = inputOk
      ? sha256Hex0x(JSON.stringify({
          version: 1,
          network: environment.network,
          route: MORPHEUS_HTTP_ROUTE,
          payload: morpheusPayload,
        }))
      : "";

    return {
      status,
      summary: inputOk ? t("httpSummary", { method }) : status,
      rows: [
        { label: t("statNetwork"), value: environment.networkLabel },
        { label: t("httpRouteLabel"), value: MORPHEUS_HTTP_ROUTE },
        { label: t("method"), value: method },
        { label: t("url"), value: url },
        { label: t("urlValid"), value: urlValid ? t("yes") : t("no") },
        { label: t("jsonPath"), value: path.normalizedPath },
        { label: t("pathValid"), value: path.valid ? t("yes") : t("no") },
        { label: t("bodyValid"), value: bodyState.valid ? t("yes") : t("no") },
        { label: t("statDigest"), value: digest || t("digestPlaceholder") },
      ],
      payload: {
        kind: "oracle.http.request",
        ...(inputOk ? {} : { status: "input_required" as const }),
        version: 1,
        network: environment.network,
        serviceBaseUrl: environment.serviceBaseUrl,
        route: MORPHEUS_HTTP_ROUTE,
        execution: "preview_only",
        dispatchReady: false,
        method,
        url,
        urlValid,
        jsonPath: path.normalizedPath,
        pathValid: path.valid,
        bodyValid: bodyState.valid,
        bodyBytes: bodyState.bytes,
        morpheusPayload,
        ...(inputOk
          ? {
              digest,
              previewId: digest,
              digestAlgorithm: "sha256-canonical-morpheus-draft-v1",
            }
          : {}),
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle HTTP Console", zh: "预言机 HTTP 控制台" },
  title: { en: "Oracle HTTP", zh: "预言机 HTTP" },
  tabHttp: { en: "HTTP", zh: "HTTP" },
  detailsLabel: { en: "Details", zh: "详情" },
  localBuilderMode: { en: "Local payload builder · no network call", zh: "本地 Payload 构建器 · 不发起网络请求" },
  panelEyebrow: { en: "HTTP data feed", zh: "HTTP 数据源" },
  panelTitle: { en: "HTTP Oracle Request", zh: "HTTP 预言机请求" },
  buildRequest: { en: "Prepare Payload", zh: "准备 Payload" },
  panelDescription: {
    en: "Prepare the exact Morpheus smart-fetch payload before callback binding. This workspace validates and hashes the draft locally; it never calls the source or submits an oracle request.",
    zh: "绑定回调前，准备准确的 Morpheus smart-fetch payload。工作台只在本地校验并计算草稿摘要，不会访问数据源，也不会提交预言机请求。",
  },
  httpHeroAlt: {
    en: "Transparent HTTP oracle pipeline machine composing a Morpheus payload.",
    zh: "透明 HTTP 预言机数据管线正在编排 Morpheus Payload。",
  },
  httpHeroCopy: {
    en: "Compose the exact HTTP read the oracle lane should execute: choose the method, lock the endpoint, map the Morpheus dot path, and compare the local draft digest before callback binding.",
    zh: "编排预言机通道需要执行的 HTTP 读取：选择方法、锁定端点、映射 Morpheus 点路径，并在绑定回调前比对本地草稿摘要。",
  },
  httpStatusLabel: { en: "HTTP request status", zh: "HTTP 请求状态" },
  runAction: { en: "Prepare Payload", zh: "准备 Payload" },
  previewingRequest: { en: "Preparing payload...", zh: "正在准备 Payload..." },
  copyingPayload: { en: "Copying payload...", zh: "正在复制 payload..." },
  method: { en: "Method", zh: "方法" },
  url: { en: "URL", zh: "URL" },
  urlPlaceholder: { en: DEFAULT_HTTP_URL, zh: DEFAULT_HTTP_URL },
  jsonPath: { en: "Extraction path", zh: "抽取路径" },
  jsonPathPlaceholder: { en: "status", zh: "status" },
  body: { en: "JSON body", zh: "JSON 请求体" },
  bodyPlaceholder: { en: "Optional JSON for POST", zh: "POST 可选 JSON" },
  httpReady: { en: "Morpheus payload ready", zh: "Morpheus Payload 已准备" },
  httpInputsReady: { en: "Ready to prepare", zh: "已就绪，可准备 Payload" },
  httpInvalidUrl: {
    en: "Enter a valid http(s) URL",
    zh: "请输入有效的 http(s) 网址",
  },
  httpInvalidPath: {
    en: "Use a Morpheus dot path such as status or data.0.price",
    zh: "请使用 Morpheus 点路径，例如 status 或 data.0.price",
  },
  httpBodyInvalidJson: {
    en: "POST body must be valid JSON",
    zh: "POST 请求体必须是有效 JSON",
  },
  httpBodyTooLarge: {
    en: "Keep the POST body within 32 KiB",
    zh: "请将 POST 请求体控制在 32 KiB 以内",
  },
  urlValid: { en: "URL valid", zh: "网址有效" },
  pathValid: { en: "Path valid", zh: "路径有效" },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  httpSummary: {
    en: "{method} Morpheus payload prepared",
    zh: "{method} Morpheus Payload 已准备",
  },
  httpFlowTitle: { en: "Oracle request flow", zh: "预言机请求流程" },
  httpFlowTarget: { en: "Target source", zh: "目标数据源" },
  httpFlowTargetDesc: {
    en: "Use an http(s) endpoint only.",
    zh: "仅使用 http(s) 端点。",
  },
  httpFlowExtract: { en: "Extract value", zh: "抽取字段" },
  httpFlowExtractDesc: {
    en: "Use the dot-path syntax executed by Morpheus.",
    zh: "使用 Morpheus 实际执行的点路径语法。",
  },
  httpFlowBind: { en: "Bind later", zh: "稍后绑定" },
  httpFlowBindDesc: {
    en: "Preview locally before callback binding.",
    zh: "回调绑定前先本地预览。",
  },
  httpRequestPlan: { en: "Request plan", zh: "请求方案" },
  httpRequestPlanCopy: {
    en: "Shape the web-data read as a compact, reviewable Morpheus payload.",
    zh: "把 Web 数据读取整理成简洁、可审阅的 Morpheus Payload。",
  },
  httpRouteWorkbench: { en: "Oracle route map", zh: "预言机路线图" },
  httpRouteWorkbenchCopy: {
    en: "Follow the request as a source, extractor, and draft package instead of a raw form.",
    zh: "以数据源、抽取器和草稿包的路线审阅请求，而不是只看原始表单。",
  },
  httpRouteSourceNode: { en: "Source node", zh: "数据源节点" },
  httpRouteExtractNode: { en: "Extractor", zh: "抽取器" },
  httpRouteDigestNode: { en: "Draft package", zh: "草稿包" },
  httpSignalsLabel: { en: "Route signals", zh: "路线信号" },
  httpPipelineTitle: { en: "Request pipeline", zh: "请求管线" },
  httpPipelineCopy: {
    en: "Compose the source, Morpheus extraction path, and optional JSON body as one reviewable route.",
    zh: "把数据源、Morpheus 抽取路径和可选 JSON 请求体编排成一条可审阅路线。",
  },
  httpMethodTitle: { en: "Transport mode", zh: "传输方式" },
  httpMethodCopy: {
    en: "Pick the request style before the draft digest is computed.",
    zh: "计算草稿摘要前先选择请求方式。",
  },
  httpMethodGetHint: {
    en: "Read a public endpoint without a request body.",
    zh: "读取公开端点，不携带请求体。",
  },
  httpMethodPostHint: {
    en: "Include a compact JSON body in the local draft digest.",
    zh: "把简洁 JSON 请求体纳入本地草稿摘要。",
  },
  httpEndpointTitle: { en: "Data source", zh: "数据源" },
  httpEndpointCopy: {
    en: "Paste the exact URL the oracle lane should fetch.",
    zh: "粘贴预言机通道需要抓取的准确 URL。",
  },
  httpUrlReadyHint: {
    en: "Public HTTP endpoint ready for preview.",
    zh: "公开 HTTP 端点可用于预览。",
  },
  httpUrlInvalidHint: {
    en: "Use a valid http(s) URL before previewing.",
    zh: "预览前请使用有效的 http(s) URL。",
  },
  httpUrlCredentialsBlocked: {
    en: "Remove credentials from the URL before previewing.",
    zh: "预览前请移除 URL 中的用户名或密码。",
  },
  httpUrlFragmentBlocked: {
    en: "Remove the URL fragment; fragments are not sent in HTTP requests.",
    zh: "请移除 URL 片段；HTTP 请求不会发送片段。",
  },
  httpUrlPrivateHostBlocked: {
    en: "Use a public endpoint; local and private-network hosts cannot be prepared for the oracle lane.",
    zh: "请使用公开端点；本地与私有网络地址不能用于预言机通道。",
  },
  httpExtractionTitle: { en: "Extraction path", zh: "抽取路径" },
  httpExtractionCopy: {
    en: "Name the response field using Morpheus dot-path syntax.",
    zh: "使用 Morpheus 点路径语法指定响应字段。",
  },
  httpPathReadyHint: {
    en: "Morpheus dot path is ready.",
    zh: "Morpheus 点路径可用。",
  },
  httpPathInvalidHint: {
    en: "Use keys separated by dots; array indexes use numeric segments.",
    zh: "请用点号分隔字段；数组索引使用数字段。",
  },
  httpBodyPanelTitle: { en: "Request body", zh: "请求体" },
  httpBodyPanelPostCopy: {
    en: "POST drafts include this JSON body and fold its exact bytes into the local digest.",
    zh: "POST 草稿会包含这段 JSON 请求体，并把其准确字节纳入本地摘要。",
  },
  httpBodyPanelGetCopy: {
    en: "GET drafts intentionally omit the body. Switch to POST when JSON must be part of the Morpheus payload.",
    zh: "GET 草稿会刻意省略请求体。需要把 JSON 纳入 Morpheus Payload 时，请切换到 POST。",
  },
  httpBodyPostHint: {
    en: "Valid JSON only; included for POST and folded into the draft digest.",
    zh: "仅接受有效 JSON；POST 会携带并纳入草稿摘要。",
  },
  httpBodyGetHint: {
    en: "Disabled for GET because its Morpheus payload omits request bodies.",
    zh: "GET 下禁用，因为其 Morpheus Payload 不包含请求体。",
  },
  httpBodyIncluded: { en: "Body included", zh: "包含请求体" },
  httpBodyEmpty: { en: "No POST body", zh: "POST 未包含请求体" },
  httpBodyIgnored: { en: "No body for GET", zh: "GET 不携带请求体" },
  httpSourceLabel: { en: "Source", zh: "来源" },
  httpExtractionLabel: { en: "Extract", zh: "抽取" },
  httpBodyState: { en: "Body", zh: "请求体" },
  httpResultPreview: { en: "Draft receipt", zh: "草稿回执" },
  httpValidationReady: { en: "Payload prepared", zh: "Payload 已准备" },
  httpDraftChanged: { en: "Draft changed — prepare again", zh: "草稿已变更，请重新准备" },
  httpEmptyTitle: { en: "Prepare the Morpheus payload", zh: "准备 Morpheus Payload" },
  httpEmptyCopy: {
    en: "When the draft is ready, the receipt shows a SHA-256 draft digest and exposes the exact Morpheus payload for copying. It is not proof of execution.",
    zh: "草稿准备好后，回执会显示 SHA-256 草稿摘要，并可复制准确的 Morpheus Payload；这不代表已经执行。",
  },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Drafts", zh: "草稿数" },
  statDigest: { en: "Draft digest", zh: "草稿摘要" },
  digestPlaceholder: { en: "Not prepared yet", zh: "尚未准备" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A focused payload builder for HTTP-backed Morpheus oracle reads.",
    zh: "面向 HTTP 数据源的 Morpheus 预言机 Payload 构建器。",
  },
  docSubtitle: {
    en: "A focused payload builder for HTTP-backed Morpheus oracle reads.",
    zh: "面向 HTTP 数据源的 Morpheus 预言机 Payload 构建器。",
  },
  feature1Name: { en: "Explicit", zh: "显式" },
  feature1Desc: {
    en: "Method, source, runtime-compatible path, and JSON body stay reviewable.",
    zh: "方法、数据源、兼容运行时的路径和 JSON 请求体都可审阅。",
  },
  feature2Name: { en: "Callback Ready", zh: "回调就绪" },
  feature2Desc: {
    en: "The copied payload uses Morpheus `json_path` and target-chain fields.",
    zh: "复制的 Payload 使用 Morpheus 的 `json_path` 与目标链字段。",
  },
  feature3Name: { en: "Comparable", zh: "可比对" },
  feature3Desc: {
    en: "The network-bound SHA-256 draft digest helps compare payloads. It is not a signature or proof of oracle execution.",
    zh: "绑定网络的 SHA-256 草稿摘要便于比对 Payload；它不是签名，也不代表预言机已经执行。",
  },
  httpRouteLabel: { en: "Morpheus route", zh: "Morpheus 路由" },
  bodyValid: { en: "Body valid", zh: "请求体有效" },
  copyPayload: { en: "Copy Morpheus payload", zh: "复制 Morpheus Payload" },
  payloadCopied: { en: "Morpheus payload copied", zh: "Morpheus Payload 已复制" },
} as const;

export const messages = mergeMessages(appMessages);
