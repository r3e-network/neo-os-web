import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "aa-account-lab", zh: "aa-account-lab" },
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
  accountHeroVisualAlt: {
    en: "Smart account shell with verifier key and backup owner route",
    zh: "带 verifier 密钥与 backup owner 路径的智能账户壳",
  },
  accountHeroVisualBadge: {
    en: "Verifier route preview",
    zh: "Verifier 路径预览",
  },
  accountMetricsLabel: {
    en: "AA account environment summary",
    zh: "AA 账户环境摘要",
  },
  accountMetricAccount: { en: "Account Shell", zh: "账户壳" },
  accountInspectorTitle: { en: "Account Readiness", zh: "账户就绪检查" },
  accountId: { en: "AccountId Hash", zh: "AccountId Hash" },
  accountIdHint: {
    en: "Use the exact registered 20-byte AccountId hash.",
    zh: "请输入已注册的精确 20 字节 AccountId 哈希。",
  },
  accountIdPlaceholder: {
    en: "20-byte AccountId hash",
    zh: "20 字节 AccountId 哈希",
  },
  accountIdSharedHint: {
    en: "Shared with the inspector above — editing either field updates both.",
    zh: "与上方查询器共享 —— 编辑任一字段会同时更新两者。",
  },
  verifier: { en: "Verifier Hash", zh: "Verifier Hash" },
  verifierHint: {
    en: "Required. The verifier contract decides who can authorize transactions for this account. Defaults to the shared Web3Auth verifier.",
    zh: "必填。verifier 合约决定谁可以为此账户授权交易。默认使用共享 Web3Auth verifier。",
  },
  verifierPlaceholder: { en: "0x...", zh: "0x..." },
  verifierParams: { en: "Verifier Params Hex", zh: "Verifier 参数 Hex" },
  verifierParamsHint: {
    en: "Optional verifier setup bytes for a custom verifier, encoded as even-length hex.",
    zh: "自定义 verifier 的可选初始化字节，使用偶数长度 hex 编码。",
  },
  verifierParamsPlaceholder: { en: "04… uncompressed key or custom hex", zh: "04… 未压缩公钥或自定义 hex" },
  web3AuthPublicKeyHint: {
    en: "The canonical Web3Auth verifier requires the complete 65-byte uncompressed secp256k1 public key (130 hex characters beginning with 04).",
    zh: "规范 Web3Auth verifier 必须使用完整的 65 字节 secp256k1 未压缩公钥（以 04 开头，共 130 个 hex 字符）。",
  },
  identityKeyRequired: { en: "Identity key required", zh: "需要身份公钥" },
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
  timelockExplainer: {
    en: "If you lose the primary key, the backup owner can take over the account after this delay. Shorter = faster recovery but less protection if the backup owner is compromised; longer = safer but slower lockout recovery.",
    zh: "若你丢失主密钥，备份所有者可在此延迟后接管账户。延迟越短=恢复越快，但备份所有者被攻破时保护越弱；延迟越长=越安全，但锁定恢复越慢。",
  },
  escapeStatusExplainer: {
    en: "Escape active = a backup recovery is currently in progress for this account (the account is being seized via the recovery path).",
    zh: "逃生进行中 = 该账户当前正在进行备份恢复（账户正通过恢复路径被接管）。",
  },
  inspect: { en: "Inspect Account", zh: "查询账户" },
  register: { en: "Register Account", zh: "注册账户" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  inspectorTitle: { en: "AA Core Inspector", zh: "AA Core 查询器" },
  registerTitle: { en: "Register New Account", zh: "注册新账户" },
  registerPermanentNote: {
    en: "Registering creates a real, permanent AA account at the derived id — not a throwaway sandbox object. It will hold value and carry the recovery posture you set here forever.",
    zh: "注册会在派生 id 上创建一个真实、永久的 AA 账户——而非一次性沙盒对象。它将持有资产，并永久保留你在此设置的恢复策略。",
  },
  accountFlowLabel: { en: "AA account workflow", zh: "AA 账户流程" },
  accountStageEyebrow: { en: "AA shell assembly", zh: "AA 账户壳组装" },
  accountStageIdle: {
    en: "Connect, inspect, then assemble the account shell",
    zh: "连接、查询，然后组装账户壳",
  },
  accountStageNeedVerifier: {
    en: "Verifier needed",
    zh: "需要 Verifier",
  },
  accountStageNeedOwner: {
    en: "Set a backup owner",
    zh: "设置 Backup Owner",
  },
  accountStageNeedTimelock: {
    en: "Set a recovery window",
    zh: "设置恢复窗口",
  },
  accountStageReady: {
    en: "Account shell ready for registration",
    zh: "账户壳已可注册",
  },
  accountStageInspecting: {
    en: "Reading AA Core account state...",
    zh: "正在读取 AA Core 账户状态...",
  },
  accountStageRegistering: {
    en: "Registering AA account shell...",
    zh: "正在注册 AA 账户壳...",
  },
  accountStageConnecting: {
    en: "Connecting wallet identity...",
    zh: "正在连接钱包身份...",
  },
  accountStageCopy: {
    en: "Verifier, backup owner, and escape window assemble into the deterministic AccountId accepted by AA Core.",
    zh: "Verifier、backup owner 与逃生窗口会组装为 AA Core 接受的确定性 AccountId。",
  },
  accountPlanTitle: { en: "Account strategy", zh: "账户策略" },
  accountPlanDaily: { en: "Everyday shell", zh: "日常账户壳" },
  accountPlanDailyCopy: {
    en: "Balanced recovery for normal wallet use.",
    zh: "适合日常钱包使用的均衡恢复策略。",
  },
  accountPlanFast: { en: "Fast recovery", zh: "快速恢复" },
  accountPlanFastCopy: {
    en: "Shorter escape window when fast lockout recovery matters.",
    zh: "需要更快找回时使用较短逃生窗口。",
  },
  accountPlanCold: { en: "Cold vault", zh: "冷钱包策略" },
  accountPlanColdCopy: {
    en: "Longer delay for accounts expected to hold more value.",
    zh: "面向更高价值账户，使用更长恢复延迟。",
  },
  recoveryWindow: { en: "Recovery window", zh: "恢复窗口" },
  useConnectedWallet: { en: "Use connected wallet", zh: "使用已连接钱包" },
  ownerNotSet: { en: "Connect or set owner", zh: "连接或设置 owner" },
  noHook: { en: "No hook", zh: "无 hook" },
  accountShellProgress: { en: "{count}/3 ready", zh: "{count}/3 就绪" },
  advancedAccountFields: { en: "Advanced account fields", zh: "高级账户字段" },
  advancedAccountFieldsHint: {
    en: "Only edit raw hashes when you are using a custom verifier, hook, or account inspector target.",
    zh: "仅在使用自定义 verifier、hook 或查询目标时编辑原始哈希。",
  },
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
    en: "Complete the verifier identity, backup owner, and recovery window before submitting.",
    zh: "提交前需补齐 verifier 身份、backup owner 与恢复窗口。",
  },
  mainnetCaution: {
    en: "You are on mainnet — Register Account is a real write against mainnet AA Core and spends GAS.",
    zh: "当前为主网 —— 注册账户是对主网 AA Core 的真实写交易，会消耗 GAS。",
  },
  networkWriteCaution: {
    en: "Registration is a real write to the {network} AA Core, spends GAS, and creates a permanent account shell.",
    zh: "注册会真实写入 {network} AA Core、消耗 GAS，并创建永久账户壳。",
  },
  mainnetCautionLead: {
    en: "You are on mainnet — Register Account is a ",
    zh: "当前为主网 —— 注册账户是对主网 AA Core 的",
  },
  mainnetCautionEmphasis: {
    en: "real write against mainnet AA Core and spends GAS",
    zh: "真实写交易，会消耗 GAS",
  },
  mainnetCautionTail: {
    en: ".",
    zh: "。",
  },
  optionalFieldsSummary: {
    en: "Advanced verifier data (params, hook)",
    zh: "高级 verifier 数据（参数、hook）",
  },
  alreadyRegisteredCaution: {
    en: "This account already has a verifier registered. A re-register will revert on-chain.",
    zh: "该账户已注册 verifier，重复注册会在链上回滚。",
  },
  currentVerifier: { en: "Current Verifier", zh: "当前 Verifier" },
  currentHook: { en: "Current Hook", zh: "当前 Hook" },
  currentBackupOwner: { en: "Current Backup Owner", zh: "当前 Backup Owner" },
  currentEscapeTimelock: { en: "Escape Timelock", zh: "逃生锁定期" },
  currentEscapeStatus: { en: "Escape Status", zh: "逃生状态" },
  escapeActive: { en: "Escape active", zh: "逃生进行中" },
  escapeInactive: { en: "Inactive", zh: "未触发" },
  timelockDays: { en: "{days} days", zh: "{days} 天" },
  derivedAccountIdLabel: {
    en: "Derived AccountId",
    zh: "派生 AccountId",
  },
  derivedAccountIdHint: {
    en: "The contract only accepts this id derived from the parameters above.",
    zh: "合约仅接受由上方参数派生出的此 id。",
  },
  backupOwnerMustSign: {
    en: "The backup owner must sign this transaction — connect that wallet or use your own address.",
    zh: "备份所有者必须签名此交易 —— 请连接该钱包或改用你自己的地址。",
  },
  registerSuccess: {
    en: "Register transaction submitted",
    zh: "注册交易已提交",
  },
  statusReady: { en: "Account control center ready", zh: "账户控制中心已就绪" },
  derivedAccountPending: { en: "Complete the shell to derive its AccountId", zh: "补全账户壳后生成 AccountId" },
  derivedAccountAwait: { en: "Not derived yet", zh: "尚未生成" },
  registrationPending: { en: "Registration broadcast — confirmation pending", zh: "注册已广播，等待链上确认" },
  registrationPendingHint: {
    en: "Check the saved transaction instead of broadcasting another registration.",
    zh: "请检查已保存的交易，不要重复广播注册。",
  },
  registrationRecovering: { en: "Checking registration evidence…", zh: "正在检查注册证据…" },
  checkConfirmation: { en: "Check confirmation", zh: "检查确认状态" },
  connectToRecover: { en: "Connect owner to recover", zh: "连接 owner 后恢复" },
  registrationConfirmed: { en: "AA account registration confirmed on chain", zh: "AA 账户注册已在链上确认" },
  registrationFaulted: { en: "Registration transaction faulted", zh: "注册交易执行失败" },
  registrationEvidenceMismatch: {
    en: "The transaction halted without the exact AccountRegistered evidence. Keep it for review.",
    zh: "交易虽为 HALT，但缺少精确的 AccountRegistered 证据；请保留记录复核。",
  },
  pendingContextMismatch: {
    en: "Reconnect the original backup-owner wallet on the transaction network to continue.",
    zh: "请在原交易网络连接原 backup owner 钱包后继续。",
  },
  pendingStorageUnavailable: {
    en: "This device could not verify durable recovery storage. Do not close the app until confirmation finishes.",
    zh: "本设备无法验证持久恢复存储；确认完成前请勿关闭应用。",
  },
  pendingBlocksRegistration: {
    en: "Resolve the saved registration transaction before creating another account.",
    zh: "创建另一个账户前，请先处理已保存的注册交易。",
  },
  registrationNotTracked: {
    en: "The wallet did not return a valid transaction ID, so registration cannot be tracked.",
    zh: "钱包未返回有效交易 ID，无法跟踪注册。",
  },
  registrationFailed: { en: "Registration failed before broadcast", zh: "注册在广播前失败" },
  accountAlreadyRegistered: {
    en: "This deterministic AccountId is already registered.",
    zh: "此确定性 AccountId 已经注册。",
  },
  accountReadUnavailable: {
    en: "AA Core {field} read is unavailable.",
    zh: "AA Core 的 {field} 读取不可用。",
  },
  accountReadFailed: { en: "AA Core account state is unavailable", zh: "AA Core 账户状态不可用" },
  networkMismatch: {
    en: "Wallet, launch network, and canonical AA Core do not match.",
    zh: "钱包、启动网络与规范 AA Core 不匹配。",
  },
  inspectSuccess: { en: "Account state loaded", zh: "账户状态已加载" },
  invalidAccountId: {
    en: "Enter an exact 20-byte AccountId hash",
    zh: "请输入精确的 20 字节 AccountId 哈希",
  },
  invalidHash: {
    en: "Expected a Neo hash or empty value",
    zh: "请输入 Neo 哈希或留空",
  },
  invalidBackupOwner: {
    en: "Backup owner must be a Neo address or hash",
    zh: "Backup owner 必须是 Neo 地址或哈希",
  },
  invalidTimelock: {
    en: "Escape timelock must be a whole number of seconds between 7 and 90 days",
    zh: "逃生锁定期必须是 7 至 90 天之间的整数秒数",
  },
  invalidVerifierParams: {
    en: "Verifier params must be valid even-length hex",
    zh: "Verifier 参数必须是有效的偶数长度 hex",
  },
  invalidWeb3AuthPublicKey: {
    en: "The canonical Web3Auth verifier requires a 65-byte uncompressed public key beginning with 04.",
    zh: "规范 Web3Auth verifier 需要一个以 04 开头的 65 字节未压缩公钥。",
  },
  noVerifierRegistered: {
    en: "Read succeeded, but no verifier is registered for this account.",
    zh: "读取成功，但该账户尚未注册 verifier。",
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
  feature3Name: { en: "Network Aware", zh: "网络自适应" },
  feature3Desc: {
    en: "Follows the host or ?network param; warns before a mainnet write.",
    zh: "跟随宿主或 ?network 参数；主网写入前会给出提示。",
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
