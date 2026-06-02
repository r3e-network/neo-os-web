import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-compute-lab";

export const appMeta = {
  networkLabel: "Morpheus Testnet",
  endpointLabel: "Compute workflow",
};

export const manifest: MiniAppManifest = {
  name: "Oracle Compute Lab",
  description: "Build Morpheus compute previews that keep sealed inputs redacted.",
  icon: "brain",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#22d3ee", density: "comfortable" },
  tabs: [{ key: "compute", labelKey: "tabCompute", icon: "brain", default: true }],
  stats: [
    { labelKey: "statNetwork", valueKey: "networkLabel", format: "text", icon: "globe" },
    { labelKey: "statEndpoint", valueKey: "endpointLabel", format: "text", icon: "tools" },
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
  permissions: { compute: true, confidential: true, datafeed: true, oracle: true },
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
      defaultValue: "{\"asset\":\"GAS\",\"window\":\"24h\"}",
    },
  ],
  buildResult(values, t) {
    const workflow = clean(values.workflow, "risk-score");
    const selectedPrivacy = clean(values.privacy, "sealed");
    const privacy = selectedPrivacy === "public" ? "public" : "sealed";
    const input = clean(values.input, "{}");
    const inputDigest = previewId(input);
    const digest = previewId(`${workflow}|${privacy}|${inputDigest}`);
    const basePayload = {
      kind: "oracle.compute.request",
      workflow,
      privacy,
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
      status: t("computeReady"),
      summary: t("computeSummary", { workflow, privacy }),
      rows: [
        { label: t("workflow"), value: workflow },
        { label: t("privacy"), value: privacy },
        { label: t("inputDigest"), value: inputDigest },
        { label: t("statDigest"), value: digest },
      ],
      payload,
    };
  },
};

const appMessages = {
  appName: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  title: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  tabCompute: { en: "Compute", zh: "计算" },
  panelEyebrow: { en: "Morpheus compute", zh: "Morpheus 计算" },
  panelTitle: { en: "Compute Preview Builder", zh: "计算预览构建器" },
  panelDescription: {
    en: "Shape compute work into a deterministic preview. Sealed mode keeps raw input out of visible payloads.",
    zh: "把计算任务整理为确定性预览；加密封装模式不会在可见载荷中暴露原始输入。",
  },
  runAction: { en: "Build Preview", zh: "生成预览" },
  workflow: { en: "Workflow", zh: "工作流" },
  workflowRisk: { en: "Risk score", zh: "风险评分" },
  workflowProof: { en: "Proof check", zh: "证明校验" },
  workflowBatch: { en: "Batch transform", zh: "批量转换" },
  privacy: { en: "Privacy", zh: "隐私模式" },
  privacySealed: { en: "Sealed", zh: "加密封装" },
  privacyPublic: { en: "Public", zh: "公开" },
  input: { en: "Input Payload", zh: "输入载荷" },
  inputPlaceholder: { en: "{\"asset\":\"GAS\"}", zh: "{\"asset\":\"GAS\"}" },
  inputDigest: { en: "Input Digest", zh: "输入摘要" },
  computeReady: { en: "Compute preview ready", zh: "计算预览已准备" },
  computeSummary: { en: "{workflow} {privacy} preview prepared", zh: "{workflow} {privacy} 预览已准备" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
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
  feature1Desc: { en: "Workflow, privacy mode, and input digest are visible without revealing sealed inputs.", zh: "可查看工作流、隐私模式和输入摘要，同时不暴露加密封装输入。" },
  feature2Name: { en: "Deterministic", zh: "确定性" },
  feature2Desc: { en: "The same request produces the same local digest.", zh: "同一请求会产生相同的本地摘要。" },
  feature3Name: { en: "Dispatch Aware", zh: "分发感知" },
  feature3Desc: { en: "The preview package is ready for a later Morpheus dispatch flow.", zh: "预览包可用于后续 Morpheus 分发流程。" },
} as const;

export const messages = mergeMessages(appMessages);
