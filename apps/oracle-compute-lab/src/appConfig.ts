import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import { getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-compute-lab";

/**
 * Resolve the network label from the launched network instead of a hardcoded
 * "Morpheus Testnet". Verified 2026-06-12: the Morpheus compute lanes are live
 * on the mainnet nitro worker while the testnet runtime is still the degraded
 * emergency runtime — the hero must reflect the actually-live lane the console
 * opened on (getNetwork() defaults to mainnet).
 */
export function resolveNetworkLabel(): string {
  return getNetwork() === "testnet" ? "Morpheus Testnet" : "Morpheus Mainnet";
}

export const appMeta = {
  networkLabel: resolveNetworkLabel(),
  // The lab only builds a local preview (execution: "preview_only",
  // dispatchReady: false); it never calls the network. Mark the endpoint stat
  // as a preview builder so the live network label reads as the intended
  // dispatch target, not a completed compute call.
  endpointLabel: "Compute preview builder (not dispatched)",
};

export const manifest: MiniAppManifest = {
  name: "Oracle Compute Lab",
  description:
    "Build Morpheus compute previews that keep sealed inputs redacted.",
  icon: "brain",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#22d3ee", density: "comfortable" },
  tabs: [
    { key: "compute", labelKey: "tabCompute", icon: "brain", default: true },
  ],
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
      icon: "tools",
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
  permissions: {
    compute: true,
    confidential: true,
    datafeed: true,
    oracle: true,
  },
};

const clean = (value: string | undefined, fallback: string) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

const sealedInputPreview = "[sealed input redacted]";

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
      key: "workflow",
      labelKey: "workflow",
      type: "select",
      defaultValue: "risk-score",
      options: [
        { value: "risk-score", labelKey: "workflowRisk" },
        { value: "proof-check", labelKey: "workflowProof" },
        { value: "batch-transform", labelKey: "workflowBatch" },
      ],
    },
    {
      key: "privacy",
      labelKey: "privacy",
      type: "select",
      defaultValue: "sealed",
      options: [
        { value: "sealed", labelKey: "privacySealed" },
        { value: "public", labelKey: "privacyPublic" },
      ],
    },
    {
      key: "input",
      labelKey: "input",
      placeholderKey: "inputPlaceholder",
      type: "textarea",
      defaultValue: '{"asset":"GAS","window":"24h"}',
    },
  ],
  buildResult(values, t) {
    const workflow = clean(values.workflow, "risk-score");
    const selectedPrivacy = clean(values.privacy, "sealed");
    const privacy = selectedPrivacy === "public" ? "public" : "sealed";
    const input = clean(values.input, "{}");
    // The input field's contract is a JSON compute payload — validate it so a
    // typo'd payload is surfaced (non-blocking) instead of silently previewing
    // as "Compute preview ready" (mirrors the seal/http sibling validation).
    let inputValid = true;
    try {
      JSON.parse(input);
    } catch {
      inputValid = false;
    }
    // Resolve the selected option labels through t() so the summary reads in the
    // active language instead of interpolating raw English enum values
    // ("risk-score sealed 预览已准备").
    const workflowLabel = t(WORKFLOW_LABEL_KEYS[workflow] ?? "workflowRisk");
    const privacyLabel = t(
      privacy === "public" ? "privacyPublic" : "privacySealed",
    );
    const inputDigest = previewId(input);
    const digest = previewId(`${workflow}|${privacy}|${inputDigest}`);
    const basePayload = {
      kind: "oracle.compute.request",
      // An unparseable input is a validation failure: flag it input_required so
      // the shared ConsoleToolPanel classifies the preview as a warning (no
      // green success toast, no Requests increment, digest placeholder kept) —
      // matching the visible "Input is valid JSON: No" row instead of
      // contradicting it with a success signal.
      ...(inputValid ? {} : { status: "input_required" as const }),
      workflow,
      privacy,
      inputValid,
      inputDigest,
      inputLength: input.length,
      digest,
      execution: "preview_only",
      dispatchReady: false,
    };
    const payload =
      privacy === "public"
        ? {
            ...basePayload,
            input,
            inputVisibility: "public",
          }
        : {
            ...basePayload,
            inputPreview: sealedInputPreview,
            inputVisibility: "redacted",
            sealedInputRequired: true,
          };

    return {
      status: inputValid ? t("computeReady") : t("computeInvalidJson"),
      summary: t("computeSummary", {
        workflow: workflowLabel,
        privacy: privacyLabel,
      }),
      rows: [
        { label: t("workflow"), value: workflowLabel },
        { label: t("privacy"), value: privacyLabel },
        { label: t("inputValid"), value: inputValid ? t("yes") : t("no") },
        { label: t("inputDigest"), value: inputDigest },
        { label: t("statDigest"), value: digest },
      ],
      payload,
    };
  },
};

const WORKFLOW_LABEL_KEYS: Record<string, string> = {
  "risk-score": "workflowRisk",
  "proof-check": "workflowProof",
  "batch-transform": "workflowBatch",
};

const appMessages = {
  appName: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  title: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  tabCompute: { en: "Compute", zh: "计算" },
  panelEyebrow: { en: "Morpheus compute", zh: "Morpheus 计算" },
  panelTitle: { en: "Compute Preview Builder", zh: "计算预览构建器" },
  buildRequest: { en: "Build Request", zh: "构建请求" },
  panelDescription: {
    en: "Shape compute work into a deterministic preview. Sealed mode keeps raw input out of visible payloads.",
    zh: "把计算任务整理为确定性预览；加密封装模式不会在可见载荷中暴露原始输入。",
  },
  computeHeroAlt: {
    en: "Sealed compute chamber turning private input into a deterministic digest.",
    zh: "密封计算舱将私密输入转换为确定性摘要。",
  },
  computeHeroCopy: {
    en: "Package Morpheus compute work without pretending it has already run: choose the workflow, decide whether input stays sealed, validate JSON, and copy an auditable preview package.",
    zh: "把 Morpheus 计算任务打包成预览，而不是伪装成已执行：选择工作流、决定输入是否密封、校验 JSON，并复制可审计预览包。",
  },
  computeStatusLabel: { en: "Compute preview status", zh: "计算预览状态" },
  runAction: { en: "Build Preview", zh: "生成预览" },
  workflow: { en: "Workflow", zh: "工作流" },
  workflowRisk: { en: "Risk score", zh: "风险评分" },
  workflowProof: { en: "Proof check", zh: "证明校验" },
  workflowBatch: { en: "Batch transform", zh: "批量转换" },
  workflowRiskHint: {
    en: "Score a compact market or account signal.",
    zh: "评估简洁的市场或账户信号。",
  },
  workflowProofHint: {
    en: "Check a proof-shaped claim before dispatch.",
    zh: "分发前校验证明类声明。",
  },
  workflowBatchHint: {
    en: "Prepare repeatable transforms for many items.",
    zh: "准备面向多项目的可重复转换。",
  },
  privacy: { en: "Privacy", zh: "隐私模式" },
  privacySealed: { en: "Sealed", zh: "加密封装" },
  privacyPublic: { en: "Public", zh: "公开" },
  privacySealedHint: {
    en: "Copyable payload redacts raw input.",
    zh: "可复制 payload 会隐藏原始输入。",
  },
  privacyPublicHint: {
    en: "Raw input is visible in the preview.",
    zh: "原始输入会显示在预览中。",
  },
  input: { en: "Input Payload", zh: "输入载荷" },
  inputPlaceholder: { en: '{"asset":"GAS"}', zh: '{"asset":"GAS"}' },
  inputValid: { en: "Input is valid JSON", zh: "输入为有效 JSON" },
  inputDigest: { en: "Input Digest", zh: "输入摘要" },
  computeReady: { en: "Compute preview ready", zh: "计算预览已准备" },
  computeBuildActive: { en: "Building preview...", zh: "正在生成预览..." },
  computeInvalidJson: {
    en: "Enter a valid JSON input payload",
    zh: "请输入有效的 JSON 输入载荷",
  },
  computeSummary: {
    en: "{workflow} {privacy} preview prepared",
    zh: "{workflow} {privacy} 预览已准备",
  },
  computeFlowTitle: { en: "Compute preview flow", zh: "计算预览流程" },
  computeFlowWorkflow: { en: "Choose workflow", zh: "选择工作流" },
  computeFlowWorkflowDesc: {
    en: "Pick the compute shape first.",
    zh: "先选择计算形态。",
  },
  computeFlowSeal: { en: "Protect input", zh: "保护输入" },
  computeFlowSealDesc: {
    en: "Sealed mode keeps raw data out.",
    zh: "密封模式隐藏原始数据。",
  },
  computeFlowDigest: { en: "Preview digest", zh: "预览摘要" },
  computeFlowDigestDesc: {
    en: "Review the deterministic package.",
    zh: "审阅确定性预览包。",
  },
  computePlan: { en: "Compute plan", zh: "计算方案" },
  computePlanCopy: {
    en: "Build a small, reviewable compute package with an explicit privacy boundary.",
    zh: "构建简洁、可审阅、隐私边界明确的计算包。",
  },
  computeControlsLabel: { en: "Compute package controls", zh: "计算包控制区" },
  computePipelineLabel: { en: "Compute request pipeline", zh: "计算请求管线" },
  computePipelineKicker: { en: "Service pipeline", zh: "服务管线" },
  computePipelineDraft: {
    en: "Fix input JSON before packaging.",
    zh: "修复输入 JSON 后再打包。",
  },
  computePipelineReady: {
    en: "Request package is ready to preview.",
    zh: "请求包已准备好生成预览。",
  },
  computePipelineBuilt: {
    en: "Preview package built and auditable.",
    zh: "预览包已生成，可审计。",
  },
  computePipelineWarn: {
    en: "Pipeline stopped at input validation.",
    zh: "管线停在输入校验阶段。",
  },
  computePipelineWorkflow: { en: "Workflow", zh: "工作流" },
  computePipelinePrivacy: { en: "Privacy seal", zh: "隐私封装" },
  computePipelineInput: { en: "JSON input", zh: "JSON 输入" },
  computePipelineDigest: { en: "Digest", zh: "摘要" },
  computeCapsuleTitle: { en: "Compute capsule", zh: "计算胶囊" },
  computeCapsuleCopy: {
    en: "Assemble workflow, privacy, and input as one package before reviewing the digest.",
    zh: "把工作流、隐私和输入组装成一个包，再审阅摘要。",
  },
  computePreviewOnly: { en: "Review mode", zh: "复核模式" },
  computeWorkflowTitle: { en: "Compute workflow", zh: "计算工作流" },
  computeWorkflowCopy: {
    en: "Choose the operation shape that downstream dispatch should execute.",
    zh: "选择后续分发应执行的操作形态。",
  },
  computePrivacyTitle: { en: "Privacy boundary", zh: "隐私边界" },
  computePrivacyCopy: {
    en: "Make input visibility a deliberate step before previewing.",
    zh: "预览前明确决定输入可见性。",
  },
  computeInputTitle: { en: "Input package", zh: "输入包" },
  computeInputSealedCopy: {
    en: "Raw input stays local to this editor; the preview payload exposes only its digest.",
    zh: "原始输入只留在编辑器里；预览 payload 只暴露摘要。",
  },
  computeInputPublicCopy: {
    en: "Public mode includes the raw JSON in the copied preview package.",
    zh: "公开模式会把原始 JSON 纳入可复制预览包。",
  },
  computeInputReadyHint: {
    en: "JSON is valid and ready for preview.",
    zh: "JSON 有效，可以生成预览。",
  },
  computeInputInvalidHint: {
    en: "Fix the JSON before building a successful preview.",
    zh: "请修复 JSON 后再生成成功预览。",
  },
  computeInputSize: { en: "Input size", zh: "输入大小" },
  computeInputBytes: { en: "{count} chars", zh: "{count} 字符" },
  computeVisibility: { en: "Visibility", zh: "可见性" },
  inputRedacted: { en: "Redacted", zh: "已隐藏" },
  inputPublic: { en: "Public", zh: "公开" },
  computeReceipt: { en: "Compute receipt", zh: "计算回执" },
  computeValidationReady: { en: "Inputs ready", zh: "输入已就绪" },
  computeEmptyTitle: { en: "Build a safe preview", zh: "生成安全预览" },
  computeEmptyCopy: {
    en: "The receipt will show workflow, privacy mode, input digest, and the exact copyable payload without leaking sealed input.",
    zh: "回执会显示工作流、隐私模式、输入摘要和准确可复制 payload，同时不泄漏密封输入。",
  },
  computeDrawerNoDigest: {
    en: "Build a preview to generate an auditable digest.",
    zh: "生成预览后会出现可审计摘要。",
  },
  computeDrawerRouteTitle: {
    en: "Preview route",
    zh: "预览路由",
  },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
  digestPlaceholder: { en: "—", zh: "—" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A safe preview surface for Morpheus compute workflows.",
    zh: "面向 Morpheus 计算工作流的安全规划界面。",
  },
  docSubtitle: {
    en: "A safe preview surface for Morpheus compute workflows.",
    zh: "面向 Morpheus 计算工作流的安全规划界面。",
  },
  feature1Name: { en: "Inspectable", zh: "可审查" },
  feature1Desc: {
    en: "Workflow, privacy mode, and input digest are visible without revealing sealed inputs.",
    zh: "可查看工作流、隐私模式和输入摘要，同时不暴露加密封装输入。",
  },
  feature2Name: { en: "Deterministic", zh: "确定性" },
  feature2Desc: {
    en: "The same request produces the same local digest.",
    zh: "同一请求会产生相同的本地摘要。",
  },
  feature3Name: { en: "Dispatch Aware", zh: "分发感知" },
  feature3Desc: {
    en: "Copy this package into your Morpheus dispatch call (e.g. submitMiniAppRequest); the digest lets you confirm the bound on-chain request matches this preview. Dispatching requires a Morpheus runtime token — it does not happen here.",
    zh: "把此包复制到你的 Morpheus 分发调用（例如 submitMiniAppRequest）；摘要可用于确认绑定的链上请求与此预览一致。分发需要 Morpheus 运行时令牌——不会在此处发生。",
  },
} as const;

export const messages = mergeMessages(appMessages);
