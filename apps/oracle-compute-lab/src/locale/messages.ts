import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "Oracle Compute Lab", zh: "预言机计算实验室" },
  scriptName: { en: "Script Name", zh: "脚本名" },
  scriptNamePlaceholder: { en: "registered-script-name", zh: "registered-script-name" },
  inputJson: { en: "Input JSON", zh: "输入 JSON" },
  execute: { en: "Execute", zh: "执行" },
  latestJob: { en: "Latest Job", zh: "最近任务" },
  docsSubtitle: { en: "Run registered Morpheus compute jobs", zh: "运行注册好的 Morpheus 计算任务" },
  feature1Name: { en: "Registered Script", zh: "注册脚本" },
  feature1Desc: { en: "Runs named compute scripts through the shared edge route.", zh: "通过共享 edge 路由运行命名计算脚本。" },
  feature2Name: { en: "Attestation", zh: "证明" },
  feature2Desc: { en: "Shows compute attestation and raw output.", zh: "展示计算证明与原始输出。" },
  feature3Name: { en: "Operator Tool", zh: "运维工具" },
  feature3Desc: { en: "Fast validation surface for compute workflows.", zh: "面向计算工作流的快速验证界面。" }
} as const;
export const messages = mergeMessages(appMessages);
