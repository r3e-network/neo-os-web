import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "AA Permissions Lab", zh: "AA 权限实验室" },
  accountId: { en: "AccountId Hash", zh: "AccountId Hash" },
  verifier: { en: "Verifier Hash", zh: "Verifier Hash" },
  verifierParams: { en: "Verifier Params Hex", zh: "Verifier 参数 Hex" },
  hook: { en: "Hook Hash", zh: "Hook Hash" },
  updateVerifier: { en: "Update Verifier", zh: "更新 Verifier" },
  updateHook: { en: "Update Hook", zh: "更新 Hook" },
  inspect: { en: "Refresh State", zh: "刷新状态" },
  currentVerifier: { en: "Current Verifier", zh: "当前 Verifier" },
  currentHook: { en: "Current Hook", zh: "当前 Hook" },
  currentBackupOwner: { en: "Current Backup Owner", zh: "当前 Backup Owner" },
  successVerifier: {
    en: "Verifier update submitted",
    zh: "Verifier 更新已提交",
  },
  successHook: { en: "Hook update submitted", zh: "Hook 更新已提交" },
  docsSubtitle: {
    en: "Update AA verifier and hook bindings",
    zh: "更新 AA verifier 与 hook 绑定",
  },
  feature1Name: { en: "Verifier", zh: "Verifier" },
  feature1Desc: {
    en: "Rotate account verification logic.",
    zh: "切换账户验证逻辑。",
  },
  feature2Name: { en: "Hook", zh: "Hook" },
  feature2Desc: {
    en: "Change hook policy bindings.",
    zh: "切换 hook 策略绑定。",
  },
  feature3Name: { en: "Direct Wallet", zh: "钱包直连" },
  feature3Desc: {
    en: "Writes go straight to the shared AA core.",
    zh: "写操作直接发往共享 AA Core。",
  },
  notConnected: { en: "not connected", zh: "未连接" },
  configured: { en: "configured", zh: "已配置" },
  inspectComplete: { en: "Refresh State complete", zh: "刷新状态完成" },
  inspectFailed: { en: "Inspect failed", zh: "查询失败" },
  updateVerifierFailed: {
    en: "Update verifier failed",
    zh: "更新 Verifier 失败",
  },
  updateHookFailed: { en: "Update hook failed", zh: "更新 Hook 失败" },
  accountIdHashPlaceholder: { en: "20-byte hash", zh: "20字节哈希" },
  verifierHashPlaceholder: { en: "0x...", zh: "0x..." },
  verifierParamsPlaceholder: { en: "hex payload", zh: "十六进制数据" },
  hookHashPlaceholder: { en: "0x...", zh: "0x..." },
  permissionsHeroTitle: {
    en: "Permission controls for AA accounts",
    zh: "AA 账户权限控制台",
  },
  permissionsHeroCopy: {
    en: "Inspect the current verifier, hook, and backup-owner state before rotating authentication or policy bindings on the shared AA core.",
    zh: "在共享 AA Core 上切换认证或策略绑定前，先检查当前 verifier、hook 与 backup-owner 状态。",
  },
  permissionsMetricsLabel: { en: "AA permission state", zh: "AA 权限状态" },
  permissionsMetricVerifier: { en: "Verifier", zh: "Verifier" },
  permissionsMetricHook: { en: "Hook", zh: "Hook" },
  permissionsMetricAccount: { en: "Account", zh: "账户" },
  permissionsCommandTitle: { en: "Account inspector", zh: "账户检查器" },
  accountIdHint: {
    en: "Required before reading or writing permission bindings.",
    zh: "读取或写入权限绑定前必须填写。",
  },
  permissionsFlowLabel: {
    en: "Permission update workflow",
    zh: "权限更新流程",
  },
  permissionsFlowInspect: { en: "Inspect account", zh: "检查账户" },
  permissionsFlowInspectDesc: {
    en: "Load the live verifier, hook, and backup owner first.",
    zh: "先加载链上的 verifier、hook 与 backup owner。",
  },
  permissionsFlowVerifier: { en: "Rotate verifier", zh: "切换 Verifier" },
  permissionsFlowVerifierDesc: {
    en: "Update authentication logic only after selecting the account.",
    zh: "选定账户后再更新认证逻辑。",
  },
  permissionsFlowHook: { en: "Update hook", zh: "更新 Hook" },
  permissionsFlowHookDesc: {
    en: "Change policy hooks with the same account guard.",
    zh: "在同一账户保护下切换策略 hook。",
  },
  permissionsStateLabel: { en: "Live state", zh: "实时状态" },
  permissionsStateTitle: { en: "Current permissions", zh: "当前权限" },
  permissionsRiskTitle: {
    en: "Writes change the account permission boundary",
    zh: "写操作会改变账户权限边界",
  },
  permissionsRiskCopy: {
    en: "Use a verified AccountId hash and confirm the target verifier or hook contract before signing.",
    zh: "签名前请确认 AccountId hash 与目标 verifier/hook 合约都正确。",
  },
  verifierParamsHint: {
    en: "Optional hex payload forwarded to the verifier.",
    zh: "可选，将传给 verifier 的十六进制参数。",
  },
  verifierUpdateBlocked: {
    en: "Enter an AccountId hash and verifier contract hash before submitting.",
    zh: "请先填写 AccountId hash 与 verifier 合约哈希，再提交。",
  },
  hookUpdateBlocked: {
    en: "Enter an AccountId hash and hook contract hash before submitting.",
    zh: "请先填写 AccountId hash 与 hook 合约哈希，再提交。",
  },
} as const;

export const messages = mergeMessages(appMessages);
