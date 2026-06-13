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
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  currentVerifier: { en: "Current Verifier", zh: "当前 Verifier" },
  currentHook: { en: "Current Hook", zh: "当前 Hook" },
  currentBackupOwner: { en: "Current Backup Owner", zh: "当前 Backup Owner" },
  successVerifier: {
    en: "Verifier update proposed — confirm after the timelock",
    zh: "Verifier 更新已提议 —— 锁定期结束后确认",
  },
  successHook: {
    en: "Hook update proposed — confirm after the timelock",
    zh: "Hook 更新已提议 —— 锁定期结束后确认",
  },
  confirmVerifierSuccess: {
    en: "Verifier rotation confirmed",
    zh: "Verifier 轮换已确认",
  },
  cancelVerifierSuccess: {
    en: "Pending verifier update cancelled",
    zh: "已取消待处理的 Verifier 更新",
  },
  confirmHookSuccess: { en: "Hook rotation confirmed", zh: "Hook 轮换已确认" },
  cancelHookSuccess: {
    en: "Pending hook update cancelled",
    zh: "已取消待处理的 Hook 更新",
  },
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
  walletConnected: { en: "Wallet connected", zh: "钱包已连接" },
  connectFailed: { en: "Wallet connection failed", zh: "钱包连接失败" },
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
  inspectBlocked: {
    en: "Enter an AccountId hash before reading live permission state.",
    zh: "请先填写 AccountId hash，再读取实时权限状态。",
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
  permissionsStateEmpty: {
    en: "Inspect an account to load its permissions",
    zh: "检查账户以加载其权限",
  },
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
  invalidHash: {
    en: "Enter a valid 20-byte script hash (40 hex characters, optional 0x prefix).",
    zh: "请输入有效的 20 字节脚本哈希（40 位十六进制，可选 0x 前缀）。",
  },
  invalidParams: {
    en: "Verifier params must be an even-length hex string (optional 0x prefix).",
    zh: "Verifier 参数必须是偶数长度的十六进制字符串（可选 0x 前缀）。",
  },
  notInspected: { en: "not inspected", zh: "未检查" },
  notBackupOwner: {
    en: "Connect the backup-owner wallet to rotate this account's bindings.",
    zh: "请连接备份所有者钱包，才能轮换该账户的绑定。",
  },
  pendingVerifierTitle: {
    en: "Pending verifier rotation",
    zh: "待确认的 Verifier 轮换",
  },
  pendingHookTitle: { en: "Pending hook rotation", zh: "待确认的 Hook 轮换" },
  pendingUnlockReady: {
    en: "Timelock elapsed — confirm to finalize.",
    zh: "锁定期已过 —— 确认以完成。",
  },
  pendingUnlockAt: {
    en: "Unlocks at {time}.",
    zh: "{time} 解锁。",
  },
  confirmUpdate: { en: "Confirm", zh: "确认" },
  cancelUpdate: { en: "Cancel", zh: "取消" },
} as const;

export const messages = mergeMessages(appMessages);
