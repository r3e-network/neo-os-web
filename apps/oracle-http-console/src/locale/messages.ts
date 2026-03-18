import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "Oracle HTTP Console", zh: "预言机 HTTP 控制台" },
  url: { en: "URL", zh: "URL" },
  method: { en: "Method", zh: "方法" },
  body: { en: "Body", zh: "Body" },
  secretName: { en: "Secret Name", zh: "Secret Name" },
  secretAsKey: { en: "Secret As Key", zh: "Secret As Key" },
  runQuery: { en: "Run Oracle Query", zh: "执行预言机查询" },
  latestResponse: { en: "Latest Response", zh: "最近响应" },
  docsSubtitle: { en: "Query allowlisted HTTP sources through Morpheus Oracle", zh: "通过 Morpheus Oracle 查询 allowlisted HTTP 数据源" },
  feature1Name: { en: "Allowlisted HTTP", zh: "Allowlisted HTTP" },
  feature1Desc: { en: "Runs host-routed HTTP Oracle queries.", zh: "执行 host 路由的 HTTP 预言机查询。" },
  feature2Name: { en: "Secrets", zh: "Secrets" },
  feature2Desc: { en: "Supports optional secret injection by name.", zh: "支持按名称注入可选 secret。" },
  feature3Name: { en: "Operator Console", zh: "运维控制台" },
  feature3Desc: { en: "Fast inspection tool for Oracle responses.", zh: "面向预言机响应的快速检查工具。" }
} as const;
export const messages = mergeMessages(appMessages);
