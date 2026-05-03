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
  description: "Build Morpheus off-chain compute requests with inspectable inputs.",
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
  permissions: { compute: true, datafeed: true },
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
    const privacy = clean(values.privacy, "sealed");
    const input = clean(values.input, "{}");
    const inputDigest = previewId(input);
    const digest = previewId(`${workflow}|${privacy}|${inputDigest}`);

    return {
      status: t("computeReady"),
      summary: t("computeSummary", { workflow, privacy }),
      rows: [
        { label: t("workflow"), value: workflow },
        { label: t("privacy"), value: privacy },
        { label: t("inputDigest"), value: inputDigest },
        { label: t("statDigest"), value: digest },
      ],
      payload: {
        kind: "oracle.compute.request",
        workflow,
        privacy,
        input,
        inputDigest,
        digest,
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  title: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  tabCompute: { en: "Compute", zh: "计算" },
  panelEyebrow: { en: "Morpheus compute", zh: "Morpheus 计算" },
  panelTitle: { en: "Compute Request Builder", zh: "计算请求构建器" },
  panelDescription: {
    en: "Shape off-chain compute work into a deterministic request preview before dispatch.",
    zh: "把链下计算任务整理为可审查的确定性请求预览。",
  },
  runAction: { en: "Build Request", zh: "生成请求" },
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
  computeReady: { en: "Compute request ready", zh: "计算请求已准备" },
  computeSummary: { en: "{workflow} using {privacy} input", zh: "{workflow} 使用 {privacy} 输入" },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Mode", zh: "模式" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Digest", zh: "摘要" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  docsSubtitle: {
    en: "A safer planning surface for Morpheus compute workflows.",
    zh: "面向 Morpheus 计算工作流的安全规划界面。",
  },
  docSubtitle: {
    en: "A safer planning surface for Morpheus compute workflows.",
    zh: "面向 Morpheus 计算工作流的安全规划界面。",
  },
  feature1Name: { en: "Inspectable", zh: "可审查" },
  feature1Desc: { en: "Workflow, privacy mode, and input digest are visible before execution.", zh: "执行前可看到工作流、隐私模式和输入摘要。" },
  feature2Name: { en: "Deterministic", zh: "确定性" },
  feature2Desc: { en: "The same request produces the same local digest.", zh: "同一请求会产生相同的本地摘要。" },
  feature3Name: { en: "Oracle Ready", zh: "预言机就绪" },
  feature3Desc: { en: "Payloads match the shape expected by Morpheus compute dispatchers.", zh: "载荷结构贴合 Morpheus 计算分发流程。" },
} as const;

export const messages = mergeMessages(appMessages);
