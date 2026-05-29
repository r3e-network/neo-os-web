import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "AA Relay Console", zh: "AA Relay 控制台" },
  relayHeroTitle: {
    en: "Sponsored relay desk for AA payloads",
    zh: "AA Payload 的赞助 Relay 工作台",
  },
  relayHeroCopy: {
    en: "Check sponsorship, request paymaster support, and submit relay-ready payloads from one guarded operator surface.",
    zh: "在一个带防护的操作台里检查赞助、请求 paymaster 支持，并提交 relay-ready payload。",
  },
  relayMetricsLabel: {
    en: "Relay environment summary",
    zh: "Relay 环境摘要",
  },
  relayEndpointMetric: { en: "Relay Endpoint", zh: "Relay Endpoint" },
  relayCommandTitle: { en: "Sponsor Preflight", zh: "赞助预检" },
  aaCoreLabel: { en: "AA Core", zh: "AA Core" },
  aaAddress: { en: "AA Address", zh: "AA 地址" },
  aaAddressHint: {
    en: "Required before sponsorship checks or relay submission.",
    zh: "执行赞助检查或 relay 提交前必须填写。",
  },
  aaAddressPlaceholder: { en: "N...", zh: "N..." },
  dappId: { en: "Paymaster Dapp ID", zh: "Paymaster Dapp ID" },
  dappIdHint: {
    en: "Optional paymaster scope used by the relayer policy.",
    zh: "可选 paymaster 作用域，由 relayer 策略使用。",
  },
  dappIdPlaceholder: { en: "Optional dapp id", zh: "可选的 dapp id" },
  payloadJson: { en: "Relay Payload JSON", zh: "Relay Payload JSON" },
  payloadJsonHint: {
    en: "Must be valid JSON before Submit Relay Payload is enabled.",
    zh: "必须是有效 JSON，才会启用 Submit Relay Payload。",
  },
  payloadJsonPlaceholder: { en: "{}", zh: "{}" },
  payloadInvalid: {
    en: "Fix the JSON payload before submitting it to the relayer.",
    zh: "提交到 relayer 前，请先修正 JSON payload。",
  },
  submitRelay: { en: "Submit Relay Payload", zh: "提交 Relay Payload" },
  sponsorCheck: { en: "Check Sponsorship", zh: "检查赞助资格" },
  sponsorRequest: { en: "Request Sponsorship", zh: "请求赞助" },
  sponsorBlocked: {
    en: "Enter an AA address before checking or requesting sponsorship.",
    zh: "先填写 AA 地址，才能检查或请求赞助。",
  },
  relayBlocked: {
    en: "Enter an AA address and keep the payload JSON valid before submitting.",
    zh: "提交前需填写 AA 地址，并保持 payload JSON 有效。",
  },
  relayFlowLabel: { en: "AA relay workflow", zh: "AA relay 流程" },
  relayFlowSponsor: { en: "Check sponsorship", zh: "检查赞助" },
  relayFlowSponsorDesc: {
    en: "Resolve whether the AA account can use paymaster coverage.",
    zh: "确认该 AA 账户是否可使用 paymaster 覆盖。",
  },
  relayFlowRequest: { en: "Request paymaster", zh: "请求 Paymaster" },
  relayFlowRequestDesc: {
    en: "Ask for sponsorship only after the target AA account is known.",
    zh: "只有目标 AA 账户明确后才请求赞助。",
  },
  relayFlowSubmit: { en: "Submit relay", zh: "提交 Relay" },
  relayFlowSubmitDesc: {
    en: "Send validated JSON payloads through the shared relay endpoint.",
    zh: "通过共享 relay endpoint 发送已校验的 JSON payload。",
  },
  relayStateLabel: { en: "Relay Runtime", zh: "Relay 运行态" },
  relayStateTitle: { en: "Sponsorship state", zh: "赞助状态" },
  relayRiskTitle: { en: "Submission guardrails", zh: "提交防护栏" },
  relayRiskCopy: {
    en: "The console keeps dapp id optional, but blocks empty AA addresses and invalid JSON before a relayed write.",
    zh: "控制台保留 dapp id 可选，但会在 relay 写入前拦截空 AA 地址与无效 JSON。",
  },
  relaySubmitTitle: { en: "Relay Payload", zh: "Relay Payload" },
  relayDraftLabel: { en: "Draft AA", zh: "草稿 AA" },
  sponsorCheckComplete: { en: "Sponsor check complete.", zh: "赞助检查完成。" },
  sponsorRequestComplete: {
    en: "Sponsor request submitted.",
    zh: "赞助请求已提交。",
  },
  relaySubmitted: {
    en: "Relay submitted successfully.",
    zh: "Relay 已成功提交。",
  },
  latestRelay: { en: "Latest Relay Response", zh: "最近 Relay 响应" },
  docsSubtitle: {
    en: "Inspect AA relay and paymaster behavior",
    zh: "检查 AA relay 与 paymaster 行为",
  },
  feature1Name: { en: "Relay", zh: "Relay" },
  feature1Desc: {
    en: "Submit relay-ready payloads against the shared AA relay.",
    zh: "对共享 AA relay 提交 relay-ready payload。",
  },
  feature2Name: { en: "Paymaster", zh: "Paymaster" },
  feature2Desc: {
    en: "Check and request sponsorship state.",
    zh: "检查并请求赞助状态。",
  },
  feature3Name: { en: "Operator Lab", zh: "运维实验室" },
  feature3Desc: {
    en: "Focused debugging surface for AA submission flow.",
    zh: "面向 AA 提交流程的专用调试界面。",
  },
  network: { en: "Network", zh: "网络" },
  heroRelay: { en: "Relay", zh: "Relay" },
  paymasterLabel: { en: "Paymaster", zh: "Paymaster" },
  relayLabel: { en: "Relay", zh: "Relay" },
  labelAA: { en: "AA", zh: "AA" },
  labelSponsor: { en: "Sponsor", zh: "Sponsor" },
  unset: { en: "unset", zh: "未设置" },
  relayError: { en: "Relay transaction failed", zh: "Relay 交易失败" },
  sponsorCheckError: { en: "Sponsor check failed", zh: "赞助检查失败" },
  sponsorRequestError: { en: "Sponsor request failed", zh: "赞助请求失败" },
} as const;
export const messages = mergeMessages(appMessages);
