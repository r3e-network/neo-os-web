import { mergeMessages } from "@shared/locale/base-messages";
import { getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";
import {
  REQUEST_DIGEST_SCOPE,
  resolveComputeRouteSnapshot,
  type ComputeProfile,
  type SourceDisclosure,
} from "./compute-workbench";

export const appId = "miniapp-oracle-compute-lab";

export const DEFAULT_COMPUTE_SOURCE = '{"asset":"GAS","window":"24h","signals":["price","volume"]}';

export const PROFILE_OPTIONS: Array<{
  value: ComputeProfile;
  labelKey: string;
  hintKey: string;
}> = [
  { value: "risk-signal", labelKey: "profileRisk", hintKey: "profileRiskHint" },
  { value: "proof-review", labelKey: "profileProof", hintKey: "profileProofHint" },
  { value: "batch-transform", labelKey: "profileBatch", hintKey: "profileBatchHint" },
];

export const DISCLOSURE_OPTIONS: Array<{
  value: SourceDisclosure;
  labelKey: string;
  hintKey: string;
}> = [
  { value: "digest-only", labelKey: "policyDigestOnly", hintKey: "policyDigestOnlyHint" },
  { value: "public-input", labelKey: "policyPublic", hintKey: "policyPublicHint" },
];

const routeSnapshot = resolveComputeRouteSnapshot(getNetwork());

export const appMeta = {
  network: routeSnapshot.network,
  networkLabel: routeSnapshot.network === "testnet" ? "Neo N3 Testnet" : "Neo N3 Mainnet",
  endpointLabel: `${routeSnapshot.workflow} · ${routeSnapshot.route}`,
  workflow: routeSnapshot.workflow,
  route: routeSnapshot.route,
  runtimeBaseUrl: routeSnapshot.runtimeBaseUrl,
  oracleContract: routeSnapshot.registryOracleContract,
  envelopeVersion: routeSnapshot.envelopeVersion,
  policiesLabel: routeSnapshot.policies.join(" · "),
  teeRequired: routeSnapshot.teeRequired,
  deliveryMode: routeSnapshot.deliveryMode,
  requestDigestScope: REQUEST_DIGEST_SCOPE,
};

export const manifest: MiniAppManifest = {
  name: "Oracle Compute Lab",
  description:
    "Prepare a SHA-256-bound Morpheus compute request package without pretending the compute job has run.",
  icon: "brain",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#0f9f83", density: "comfortable" },
  features: { walletRequired: false, chainWarning: false },
  docs: [
    { titleKey: "docsBoundaryTitle", contentKey: "docsBoundaryCopy", type: "text" },
    { titleKey: "docsRouteTitle", contentKey: "docsRouteCopy", type: "text" },
    { titleKey: "docsRecoveryTitle", contentKey: "docsRecoveryCopy", type: "text" },
  ],
  // This release performs local validation + SHA-256 packaging only. It does
  // not ask the platform for compute/confidential/on-chain capabilities.
  permissions: {},
};

const appMessages = {
  appName: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  title: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  panelEyebrow: { en: "Morpheus compute workbench", zh: "Morpheus 计算工作台" },
  panelTitle: {
    en: "Prepare a compute request package",
    zh: "准备计算请求包",
  },
  panelSubtitle: {
    en: "Local package only — no compute job is submitted",
    zh: "仅生成本地请求包——不会提交计算任务",
  },
  networkTargetBadge: { en: "Registry target", zh: "注册表目标" },
  prepareAction: { en: "Prepare request package", zh: "准备请求包" },
  preparingAction: { en: "Hashing source locally…", zh: "正在本地计算摘要…" },
  copyPackage: { en: "Copy package", zh: "复制请求包" },
  workbenchDetails: { en: "Source & package", zh: "源数据与请求包" },

  sourceStageTitle: { en: "Source chamber", zh: "源数据舱" },
  sourceStageCopy: {
    en: "Shape the source locally, bind it with SHA-256, then review exactly what would leave this app.",
    zh: "在本地整理源数据，以 SHA-256 绑定，再准确审阅哪些内容会离开此应用。",
  },
  sourceImageAlt: {
    en: "A bright confidential-compute workspace carrying source through protected processing stations.",
    zh: "明亮的机密计算工作台，源数据经过受保护的处理节点。",
  },
  sourceLocalBadge: { en: "Raw source remains local", zh: "原始源数据保留在本地" },
  sourcePublicBadge: { en: "Package includes source", zh: "请求包会包含源数据" },
  sourceTitle: { en: "Source", zh: "源数据" },
  sourceJson: { en: "JSON source", zh: "JSON 源数据" },
  sourceValid: { en: "Valid JSON", zh: "JSON 有效" },
  sourceNeedsFix: { en: "Needs attention", zh: "需要修复" },
  sourceBytes: { en: "{count} bytes", zh: "{count} 字节" },
  sourceShapeObject: { en: "Object · {keys}", zh: "对象 · {keys}" },
  sourceShapeArray: { en: "Array · {count} items", zh: "数组 · {count} 项" },
  sourceShapeValue: { en: "JSON value", zh: "JSON 值" },
  sourceRequired: { en: "Add JSON source data.", zh: "请添加 JSON 源数据。" },
  sourceTooLarge: {
    en: "Keep source data at or below 64 KB.",
    zh: "源数据请控制在 64 KB 以内。",
  },
  sourceTooDeep: {
    en: "Keep JSON nesting at or below 64 levels.",
    zh: "JSON 嵌套层级请控制在 64 层以内。",
  },
  sourceUnsafeNumber: {
    en: "Use finite numbers and keep whole numbers within JavaScript's exact integer range.",
    zh: "请使用有限数值，并将整数控制在 JavaScript 可精确表示的范围内。",
  },
  sourceInvalidJson: { en: "Fix the JSON before preparing a package.", zh: "请先修复 JSON，再准备请求包。" },

  policyTitle: { en: "Policy", zh: "策略" },
  policyCopy: {
    en: "Choose intent and source disclosure. These are request-planning controls, not execution results.",
    zh: "选择任务意图与源数据披露方式。这些是请求规划，不是执行结果。",
  },
  profileLabel: { en: "Intent preset", zh: "意图预设" },
  profileRisk: { en: "Risk signal", zh: "风险信号" },
  profileRiskHint: {
    en: "Prepare market or account signals for later compute.",
    zh: "为后续计算准备市场或账户信号。",
  },
  profileProof: { en: "Proof review", zh: "证明审阅" },
  profileProofHint: {
    en: "Prepare a proof-shaped claim; no proof is verified here.",
    zh: "准备证明类声明；此处不会校验证明。",
  },
  profileBatch: { en: "Batch transform", zh: "批量转换" },
  profileBatchHint: {
    en: "Prepare repeatable transform input for later execution.",
    zh: "为后续执行准备可重复的转换输入。",
  },
  disclosureLabel: { en: "Source disclosure", zh: "源数据披露" },
  policyDigestOnly: { en: "Keep source local", zh: "源数据仅留本地" },
  policyDigestOnlyHint: {
    en: "The package contains only the source digest. This is omission, not encryption.",
    zh: "请求包只包含源数据摘要。这是省略原文，不是加密。",
  },
  policyPublic: { en: "Include public source", zh: "包含公开源数据" },
  policyPublicHint: {
    en: "Use only when the JSON is intentionally public.",
    zh: "仅在 JSON 明确可公开时使用。",
  },

  flowLabel: { en: "Request preparation flow", zh: "请求准备流程" },
  flowSource: { en: "Source", zh: "源数据" },
  flowPolicy: { en: "Policy", zh: "策略" },
  flowPackage: { en: "Request package", zh: "请求包" },
  flowBoundary: { en: "Result boundary", zh: "结果边界" },
  flowReady: { en: "Ready", zh: "就绪" },
  flowDraft: { en: "Draft", zh: "草稿" },
  flowPrepared: { en: "Prepared locally", zh: "已在本地准备" },
  flowNotRun: { en: "Not run", zh: "未执行" },
  packageTitle: { en: "Request package", zh: "请求包" },
  packageEmpty: {
    en: "Prepare once to create a cryptographic request digest.",
    zh: "准备一次即可生成加密级请求摘要。",
  },
  packageReady: { en: "Local request package prepared", zh: "本地请求包已准备" },
  packageDigestLabel: { en: "Request SHA-256", zh: "请求 SHA-256" },
  inputDigestLabel: { en: "Source SHA-256", zh: "源数据 SHA-256" },
  packageCountLabel: { en: "Local packages", zh: "本地请求包" },
  packageFormatLabel: { en: "Package format", zh: "请求包格式" },
  packageScopeLabel: { en: "Digest covers", zh: "摘要覆盖范围" },
  packageScopeValue: { en: "Payload + registry target", zh: "载荷 + 注册表目标" },
  noDigest: { en: "Not prepared", zh: "尚未准备" },
  packageCopyReady: { en: "Review or copy the exact local package below.", zh: "可在下方审阅或复制准确的本地请求包。" },
  packageCopied: { en: "Request package copied", zh: "请求包已复制" },
  packageCopyUnavailable: { en: "Prepare a package before copying.", zh: "请先准备请求包，再复制。" },

  boundaryTitle: { en: "Runtime boundary", zh: "运行时边界" },
  boundaryHeadline: { en: "No compute job was submitted", zh: "未提交任何计算任务" },
  boundaryCopy: {
    en: "This app does not hold a runtime credential and does not create a job ID. Result, proof, and attestation remain unavailable.",
    zh: "此应用不持有运行时凭证，也不会创建任务 ID，因此结果、证明与认证均不可用。",
  },
  boundaryResult: { en: "Result", zh: "结果" },
  boundaryProof: { en: "Proof", zh: "证明" },
  boundaryAttestation: { en: "Attestation", zh: "认证" },
  unavailable: { en: "Unavailable", zh: "不可用" },
  boundaryRecovery: {
    en: "No write exists, so pending, retry, and readback do not apply.",
    zh: "不存在写操作，因此待处理、重试和回读均不适用。",
  },

  drawerSource: { en: "Source", zh: "源数据" },
  drawerPackage: { en: "Package", zh: "请求包" },
  drawerRoute: { en: "Route", zh: "路由" },
  sourceEditorTitle: { en: "Edit source JSON", zh: "编辑源 JSON" },
  sourceEditorHint: {
    en: "Stored only in component memory. Preparing a digest-only package omits the raw JSON.",
    zh: "仅存于组件内存中。准备仅摘要请求包时会省略原始 JSON。",
  },
  sourcePreviewTitle: { en: "Package visibility", zh: "请求包可见性" },
  sourceRedacted: { en: "Raw source omitted", zh: "已省略原始源数据" },
  routeTitle: { en: "Registry route snapshot", zh: "注册表路由快照" },
  routeCopy: {
    en: "Reference metadata from the checked-in Morpheus catalog. It is not a live service check or a dispatch confirmation.",
    zh: "来自仓库内 Morpheus 目录的参考元数据；不是实时服务检查，也不是分发确认。",
  },
  routeWorkflow: { en: "Workflow", zh: "工作流" },
  routeEndpoint: { en: "Authenticated route", zh: "需认证路由" },
  routeRuntime: { en: "Runtime target", zh: "运行时目标" },
  routeEnvelope: { en: "Envelope version", zh: "信封版本" },
  routePolicies: { en: "Runtime policies", zh: "运行时策略" },
  routeContract: { en: "Registry Oracle contract", zh: "注册表预言机合约" },
  routeTee: { en: "TEE required", zh: "需要 TEE" },
  routeDelivery: { en: "Delivery mode", zh: "交付模式" },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },

  statusReady: { en: "Ready to prepare", zh: "可以开始准备" },
  statusPreparing: { en: "Hashing source locally", zh: "正在本地计算源数据摘要" },
  statusPrepared: { en: "Local request package prepared", zh: "本地请求包已准备" },
  statusInvalid: { en: "Source JSON needs attention", zh: "源 JSON 需要修复" },
  statusFailed: { en: "Package could not be prepared", zh: "无法准备请求包" },
  digestUnavailable: {
    en: "SHA-256 is unavailable in this host. Open the app in a secure browser context.",
    zh: "当前环境无法使用 SHA-256，请在安全的浏览器环境中打开此应用。",
  },

  docsBoundaryTitle: { en: "Honest result boundary", zh: "真实结果边界" },
  docsBoundaryCopy: {
    en: "The workbench validates JSON and creates SHA-256-bound local request metadata. It does not execute compute, encrypt input, issue a job ID, verify a proof, or produce an attestation.",
    zh: "工作台会校验 JSON 并生成 SHA-256 绑定的本地请求元数据；不会执行计算、加密输入、签发任务 ID、校验证明或生成认证。",
  },
  docsRouteTitle: { en: "Canonical route", zh: "规范路由" },
  docsRouteCopy: {
    en: "The checked-in Morpheus catalog defines compute.execute at /compute/execute with tenant and risk policies, TEE execution, and API-response delivery. Dispatch requires authenticated runtime integration.",
    zh: "仓库内 Morpheus 目录将 compute.execute 定义在 /compute/execute，采用 tenant 与 risk 策略、TEE 执行和 API 响应交付；分发需要经过认证的运行时集成。",
  },
  docsRecoveryTitle: { en: "Pending and recovery", zh: "待处理与恢复" },
  docsRecoveryCopy: {
    en: "This release performs no network write. There is therefore no pending transaction or job to retry/read back. A future dispatch lane must persist the job ID first and retry readback rather than executing again.",
    zh: "此版本不执行网络写入，因此没有待处理交易或任务可重试、回读。未来分发通道必须先持久化任务 ID，并重试回读而不是再次执行。",
  },
} as const;

export const messages = mergeMessages(appMessages);
