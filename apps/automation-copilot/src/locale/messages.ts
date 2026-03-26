import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Automation Copilot", zh: "自动化副驾驶" },
  subtitle: { en: "User-facing launcher for pricefeed, AA automation, and private runbooks", zh: "面向用户的 pricefeed、AA 自动化与私密 runbook 入口" },
  heroKicker: { en: "Automation", zh: "自动化" },
  heroBlurb: {
    en: "Start with trigger recipes, keep pricefeed isolated, and route the actual execution to AA or Morpheus only when an automation job fires.",
    zh: "先从触发器配方开始，保持 pricefeed 隔离，并只在自动化任务触发时把实际执行路由到 AA 或 Morpheus。",
  },
  tabRecipes: { en: "Recipes", zh: "配方" },
  tabRoutes: { en: "Routes", zh: "路由" },
  docsSubtitle: { en: "Automation launcher", zh: "自动化入口" },
  triggerLabel: { en: "Primary Trigger", zh: "主要触发器" },
  triggerValue: { en: "Price / schedule / callback", zh: "价格 / 调度 / 回调" },
  executionLabel: { en: "Execution Surface", zh: "执行面" },
  executionValue: { en: "AA + Morpheus", zh: "AA + Morpheus" },
  feedPriority: { en: "Feed Priority", zh: "Feed 优先级" },
  feedPriorityValue: { en: "Isolated highest priority", zh: "独立最高优先级" },
  controlMode: { en: "Control Mode", zh: "控制模式" },
  controlModeValue: { en: "Serverless orchestration", zh: "Serverless 编排" },
  openRunbookDocs: { en: "Open Runbook Docs", zh: "打开 Runbook 文档" },
  openFeedDocs: { en: "Open Datafeed Docs", zh: "打开 Datafeed 文档" },
  openExplorer: { en: "Open Runtime Explorer", zh: "打开运行时浏览器" },
  openAaWorkspace: { en: "Open AA Workspace", zh: "打开 AA 工作区" },
  recipeTitle: { en: "Recipe System", zh: "配方系统" },
  recipeText: {
    en: "Model automation as reusable recipes: trigger, validation, execution surface, and replay/recovery path. This keeps TEE usage narrow and explicit.",
    zh: "把自动化建模成可复用的 recipes：触发器、校验、执行面和重放/恢复路径，从而把 TEE 使用范围压窄并保持显式。",
  },
  feedTitle: { en: "Pricefeed Separation", zh: "Pricefeed 隔离" },
  feedText: {
    en: "Pricefeed is the highest-priority data path and should remain isolated from slower request-response workloads and user-triggered automation spikes.",
    zh: "Pricefeed 是最高优先级数据路径，应与较慢的 request-response 工作负载和用户触发的自动化高峰保持隔离。",
  },
  routeDatafeed: { en: "Datafeed route", zh: "数据馈送路由" },
  routeOracle: { en: "Oracle route", zh: "预言机路由" },
  routeAa: { en: "AA route", zh: "AA 路由" },
  feature1Name: { en: "Recipe-Driven", zh: "配方驱动" },
  feature1Desc: { en: "Define reusable automation recipes instead of hardcoding each workflow separately.", zh: "用可复用 recipe 定义自动化，而不是为每个流程硬编码。" },
  feature2Name: { en: "Execution On Demand", zh: "按需执行" },
  feature2Desc: { en: "Only send execution into AA or TEE runtimes when a validated trigger fires.", zh: "仅在校验过的触发器命中时，把执行下发到 AA 或 TEE 运行时。" },
  feature3Name: { en: "Feed Isolation", zh: "Feed 隔离" },
  feature3Desc: { en: "Keep market data and user-triggered automation on separate operational paths.", zh: "让市场数据和用户触发的自动化走不同运维路径。" },
} as const;

export const messages = mergeMessages(appMessages);
