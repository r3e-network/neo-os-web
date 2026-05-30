import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "AA Account Lab", zh: "AA 注册实验室" },
  accountHeroEyebrow: { en: "Account Abstraction", zh: "账户抽象" },
  accountHeroTitle: {
    en: "Account control center for Neo AA shells",
    zh: "Neo AA 账户壳的控制中心",
  },
  accountHeroCopy: {
    en: "Inspect the live verifier, hook, and recovery owner before registering a new account shell with an explicit escape window.",
    zh: "注册新的账户壳前，先查询链上 verifier、hook 与恢复 owner，再用明确的逃生窗口提交。",
  },
  accountMetricsLabel: {
    en: "AA account environment summary",
    zh: "AA 账户环境摘要",
  },
  accountMetricAccount: { en: "Account Shell", zh: "账户壳" },
  accountInspectorTitle: { en: "Account Readiness", zh: "账户就绪检查" },
  accountId: { en: "AccountId Hash", zh: "AccountId Hash" },
  accountIdHint: {
    en: "Use a 20-byte hash, public key, or deterministic seed text.",
    zh: "可输入 20 字节哈希、公钥，或可重复派生的 seed 文本。",
  },
  accountIdPlaceholder: {
    en: "20-byte hash, pubkey, or seed text",
    zh: "20 字节哈希、公钥或 seed 文本",
  },
  verifier: { en: "Verifier Hash", zh: "Verifier Hash" },
  verifierHint: {
    en: "Required. Defaults to the shared Web3Auth verifier.",
    zh: "必填，默认使用共享 Web3Auth verifier。",
  },
  verifierPlaceholder: { en: "0x...", zh: "0x..." },
  verifierParams: { en: "Verifier Params Hex", zh: "Verifier 参数 Hex" },
  verifierParamsHint: {
    en: "Optional constructor payload, encoded as hex without spaces.",
    zh: "可选构造负载，使用无空格 hex 编码。",
  },
  verifierParamsPlaceholder: { en: "hex payload", zh: "hex 负载" },
  hook: { en: "Hook Hash", zh: "Hook Hash" },
  hookHint: {
    en: "Optional guard hook. Leave empty to register the zero hook.",
    zh: "可选守卫 hook；留空时注册 zero hook。",
  },
  hookPlaceholder: { en: "0x... or empty", zh: "0x... 或空" },
  backupOwner: { en: "Backup Owner", zh: "Backup Owner" },
  backupOwnerHint: {
    en: "Required recovery owner as a Neo address or script hash.",
    zh: "必填恢复 owner，可使用 Neo 地址或脚本哈希。",
  },
  backupOwnerPlaceholder: { en: "N... or 0x...", zh: "N... 或 0x..." },
  timelock: { en: "Escape Timelock", zh: "逃生锁定期" },
  timelockHint: {
    en: "Required timelock in seconds before backup recovery can execute.",
    zh: "必填秒数，表示 backup recovery 可执行前的锁定时间。",
  },
  timelockPlaceholder: { en: "2592000", zh: "2592000" },
  inspect: { en: "Inspect Account", zh: "查询账户" },
  register: { en: "Register Account", zh: "注册账户" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  inspectorTitle: { en: "AA Core Inspector", zh: "AA Core 查询器" },
  registerTitle: { en: "Register New Account", zh: "注册新账户" },
  accountFlowLabel: { en: "AA account workflow", zh: "AA 账户流程" },
  accountFlowInspect: { en: "Read live state", zh: "读取链上状态" },
  accountFlowInspectDesc: {
    en: "Resolve the account id and load verifier, hook, and owner from AA Core.",
    zh: "解析 accountId，并从 AA Core 读取 verifier、hook 和 owner。",
  },
  accountFlowRegister: { en: "Register shell", zh: "注册账户壳" },
  accountFlowRegisterDesc: {
    en: "Submit only after account id, verifier, backup owner, and timelock are ready.",
    zh: "仅在 accountId、verifier、backup owner 与 timelock 就绪后提交。",
  },
  accountFlowRecovery: { en: "Keep recovery clear", zh: "保持恢复路径清晰" },
  accountFlowRecoveryDesc: {
    en: "Pin the backup owner and escape window so operators know the fallback route.",
    zh: "固定 backup owner 与逃生窗口，让操作者明确兜底路径。",
  },
  accountStateLabel: { en: "Live AA Core", zh: "实时 AA Core" },
  accountStateTitle: { en: "Account state", zh: "账户状态" },
  accountRiskTitle: { en: "Registration guardrails", zh: "注册防护栏" },
  accountRiskCopy: {
    en: "This lab keeps optional hook and verifier params flexible, but blocks empty required fields before a write transaction.",
    zh: "本实验室保留 hook 与 verifier 参数的可选性，但会在写交易前拦截空的必填字段。",
  },
  accountShellLabel: { en: "Draft Shell", zh: "草稿账户壳" },
  inspectBlocked: {
    en: "Enter an account id before reading AA Core state.",
    zh: "输入 accountId 后才能读取 AA Core 状态。",
  },
  registerBlocked: {
    en: "Complete account id, verifier, backup owner, and timelock before submitting.",
    zh: "提交前需补齐 accountId、verifier、backup owner 与 timelock。",
  },
  currentVerifier: { en: "Current Verifier", zh: "当前 Verifier" },
  currentHook: { en: "Current Hook", zh: "当前 Hook" },
  currentBackupOwner: { en: "Current Backup Owner", zh: "当前 Backup Owner" },
  registerSuccess: {
    en: "Register transaction submitted",
    zh: "注册交易已提交",
  },
  inspectSuccess: { en: "Account state loaded", zh: "账户状态已加载" },
  invalidAccountId: {
    en: "Invalid accountId hash or seed input",
    zh: "无效的 accountId 哈希或 seed 输入",
  },
  invalidHash: {
    en: "Expected a Neo hash or empty value",
    zh: "请输入 Neo 哈希或留空",
  },
  invalidBackupOwner: {
    en: "Backup owner must be a Neo address or hash",
    zh: "Backup owner 必须是 Neo 地址或哈希",
  },
  docsSubtitle: {
    en: "Register and inspect Neo AA accounts",
    zh: "注册并查询 Neo AA 账户",
  },
  feature1Name: { en: "Register", zh: "注册" },
  feature1Desc: {
    en: "Submit registerAccount against the shared AA core.",
    zh: "对共享 AA Core 提交 registerAccount。",
  },
  feature2Name: { en: "Inspect", zh: "查询" },
  feature2Desc: {
    en: "Read verifier, hook, and backup owner state.",
    zh: "读取 verifier、hook 和 backup owner 状态。",
  },
  feature3Name: { en: "Testnet First", zh: "测试网优先" },
  feature3Desc: {
    en: "Uses the canonical shared AA testnet anchors.",
    zh: "使用当前共享的 AA 测试网锚点。",
  },
  network: { en: "Network", zh: "网络" },
  testnet: { en: "Testnet", zh: "测试网" },
  notConnected: { en: "not connected", zh: "未连接" },
  defaultVerifier: { en: "Default Verifier", zh: "默认 Verifier" },
  aaCore: { en: "AA Core", zh: "AA Core" },
  walletConnected: { en: "Wallet connected", zh: "钱包已连接" },
  connectFailed: { en: "Connect failed", zh: "连接失败" },
} as const;

export const messages = mergeMessages(appMessages);
