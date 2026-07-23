import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "aa-session-key-lab", zh: "aa-session-key-lab" },
  appName: { en: "AA Session Key Lab", zh: "AA Session Key 实验室" },
  latestState: { en: "Latest Configuration", zh: "最近配置" },
  configureSession: { en: "Configure Session Key", zh: "配置 Session Key" },
  accountSeed: { en: "Registered AccountId", zh: "已注册 AccountId" },
  accountSeedPlaceholder: {
    en: "exact 20-byte AccountId or N-address",
    zh: "精确 20 字节 AccountId 或 N 地址",
  },
  accountIdHash: { en: "Account ID Hash", zh: "账户 ID 哈希" },
  sessionPublicKey: { en: "Session Public Key", zh: "Session 公钥" },
  sessionPublicKeyPlaceholder: {
    en: "33-byte compressed public key",
    zh: "33 字节压缩公钥",
  },
  targetContract: { en: "Target Contract", zh: "目标合约" },
  targetContractPlaceholder: { en: "0x... or N...", zh: "0x... 或 N..." },
  allowedMethod: { en: "Allowed Method", zh: "允许方法" },
  allowedMethodPlaceholder: { en: "symbol", zh: "symbol" },
  expiresAt: { en: "Expiry Timestamp", zh: "过期时间戳" },
  expiresAtPlaceholder: { en: "unix seconds", zh: "Unix 秒级时间戳" },
  generatedPrivateKey: { en: "Generated Private Key", zh: "生成的私钥" },
  sessionPrivateKey: { en: "Session Private Key", zh: "Session 私钥" },
  privateKeyReady: { en: "Ready for one-time copy", zh: "可一次性复制" },
  privateKeyCaution: {
    en: "This private key can authorize transactions for the account within the scope you set below, until it expires or you revoke it. It is shown once and never stored — copy it somewhere safe and share it only with the automation you trust.",
    zh: "此私钥可在你下方设置的作用域内为账户授权交易，直到它过期或被你撤销为止。它仅显示一次且永不被存储——请妥善保存，并仅与你信任的自动化程序共享。",
  },
  copyPrivateKey: { en: "Copy Private Key", zh: "复制私钥" },
  copiedPrivateKey: { en: "Copied", zh: "已复制" },
  showPrivateKey: { en: "Show", zh: "显示" },
  hidePrivateKey: { en: "Hide", zh: "隐藏" },
  copyPrivateKeyFailed: {
    en: "Copy failed — select and copy the key manually.",
    zh: "复制失败 — 请手动选择并复制密钥。",
  },
  generateKey: { en: "Generate Key", zh: "生成密钥" },
  checkSponsor: { en: "Check Sponsorship", zh: "检查赞助资格" },
  requestSponsor: { en: "Request Sponsorship", zh: "请求赞助" },
  dappId: { en: "Paymaster dApp ID", zh: "Paymaster dApp ID" },
  dappIdPlaceholder: {
    en: "miniapp-aa-session-key-lab",
    zh: "miniapp-aa-session-key-lab",
  },
  sponsorAmount: { en: "Sponsor Amount", zh: "赞助金额" },
  sponsorAmountPlaceholder: { en: "0.1", zh: "0.1" },
  invalidSponsorAmount: {
    en: "Sponsor amount must be a positive number.",
    zh: "赞助金额必须是正数。",
  },
  sponsorApproved: { en: "Approved", zh: "已批准" },
  sponsorNotApproved: { en: "Not approved", zh: "未批准" },
  sponsorEligible: { en: "Eligible", zh: "符合资格" },
  sponsorNotEligible: { en: "Not eligible", zh: "不符合资格" },
  sponsorNotChecked: { en: "Not checked", zh: "未检查" },
  sponsorRequestId: { en: "Sponsor Request ID", zh: "赞助请求 ID" },
  sponsorship: { en: "Sponsorship", zh: "赞助状态" },
  lastTx: { en: "Last Transaction", zh: "最近交易" },
  docsSubtitle: {
    en: "Configure SessionKeyVerifier directly on-chain",
    zh: "直接在链上配置 SessionKeyVerifier",
  },
  feature1Name: { en: "Verifier Config", zh: "Verifier 配置" },
  feature1Desc: {
    en: "Calls aaCore.callVerifier(setSessionKey) with real chain params.",
    zh: "通过真实链上参数调用 aaCore.callVerifier(setSessionKey)。",
  },
  feature2Name: { en: "Key Generation", zh: "密钥生成" },
  feature2Desc: {
    en: "Generate a compressed P-256 session key locally in the browser.",
    zh: "在浏览器本地生成压缩 P-256 session key。",
  },
  feature3Name: { en: "Sponsor State", zh: "赞助状态" },
  feature3Desc: {
    en: "Check and request gas sponsorship before relay flows.",
    zh: "在 relay 流程前检查并请求 gas 赞助。",
  },
  invalidTargetContract: {
    en: "Target contract must be a Neo address or script hash.",
    zh: "目标合约必须是 Neo 地址或脚本哈希。",
  },
  invalidSessionPublicKey: {
    en: "Session public key must be a 33-byte compressed hex key.",
    zh: "Session 公钥必须是 33 字节压缩十六进制公钥。",
  },
  invalidSessionAccountId: {
    en: "Enter an existing registered AccountId as an exact 20-byte hash or N-address.",
    zh: "请输入已注册账户的精确 20 字节 AccountId 或 N 地址。",
  },
  invalidExpiry: {
    en: "Expiry must be a future Unix timestamp.",
    zh: "过期时间必须是未来的 Unix 时间戳。",
  },
  invalidSpendingLimit: {
    en: "Spending limit must be a non-negative number.",
    zh: "支出上限必须是非负数。",
  },
  sessionHeroEyebrow: { en: "Session Keys", zh: "会话密钥" },
  spendingLimit: { en: "Spending Limit (GAS)", zh: "支出上限（GAS）" },
  spendingLimitPlaceholder: { en: "0 = unlimited", zh: "0 = 不限" },
  spendingLimitHint: {
    en: "Mainnet only. 0 leaves the session key without a GAS cap.",
    zh: "仅主网。0 表示该 session key 不设 GAS 上限。",
  },
  sessionDescription: { en: "Description", zh: "描述" },
  sessionDescriptionPlaceholder: {
    en: "e.g. rewards bot",
    zh: "例如：奖励机器人",
  },
  sessionNotConfirmed: {
    en: "Configuration broadcast but not yet confirmed on-chain — the session key was not stored.",
    zh: "配置已广播但链上尚未确认 —— session key 未被存储。",
  },
  sessionTransactionFaulted: {
    en: "The saved session-key transaction faulted on chain. Review the account and scope before trying again.",
    zh: "已保存的 session-key 交易在链上执行失败；请检查账户与权限范围后再试。",
  },
  sessionVerifierMissing: {
    en: "No session-key verifier is configured for this network.",
    zh: "当前网络未配置 session-key 校验器。",
  },
  inspectSession: { en: "Inspect Session Key", zh: "查询 Session Key" },
  sessionInspected: {
    en: "Session key state loaded.",
    zh: "已加载 Session key 状态。",
  },
  sessionInspectFailed: {
    en: "Failed to read the session key.",
    zh: "读取 Session key 失败。",
  },
  revokeSession: { en: "Revoke Session Key", zh: "撤销 Session Key" },
  revokeConfirmPrompt: {
    en: "Revoke this on-chain session key?",
    zh: "撤销此链上 Session Key？",
  },
  revokeConfirm: { en: "Confirm Revoke", zh: "确认撤销" },
  revokeCancel: { en: "Cancel", zh: "取消" },
  sessionRevoked: { en: "Session key revoked.", zh: "Session key 已撤销。" },
  sessionRevokeFailed: {
    en: "Failed to revoke the session key.",
    zh: "撤销 Session key 失败。",
  },
  onChainSessionTitle: { en: "On-chain session key", zh: "链上 Session Key" },
  noOnChainSession: {
    en: "No session key is active for this account.",
    zh: "该账户当前没有激活的 session key。",
  },
  expiryQuick1h: { en: "+1h", zh: "+1 小时" },
  expiryQuick24h: { en: "+24h", zh: "+24 小时" },
  expiryQuick7d: { en: "+7d", zh: "+7 天" },
  expiryPreview: { en: "Expires {date}", zh: "{date} 过期" },
  sessionKeyGenerated: {
    en: "Session key generated locally.",
    zh: "已在本地生成 Session key。",
  },
  sessionKeyGenerateFailed: {
    en: "Failed to generate session key.",
    zh: "Session key 生成失败。",
  },
  sessionConfigured: {
    en: "Session key configuration submitted.",
    zh: "Session key 配置已提交。",
  },
  sessionConfigureFailed: {
    en: "Session key configuration failed.",
    zh: "Session key 配置失败。",
  },
  sponsorCheckComplete: { en: "Sponsor check complete.", zh: "赞助检查完成。" },
  sponsorRequestComplete: {
    en: "Sponsor request submitted.",
    zh: "赞助请求已提交。",
  },
  sponsorCheckFailed: { en: "Sponsor check failed.", zh: "赞助检查失败。" },
  sponsorRequestFailed: { en: "Sponsor request failed.", zh: "赞助请求失败。" },
  sponsorRequestUnavailable: {
    en: "Sponsorship is unavailable in this environment.",
    zh: "当前环境暂不可用赞助服务。",
  },
  // UI display strings
  sessionLabel: { en: "Session", zh: "Session" },
  verifierLabel: { en: "Verifier", zh: "Verifier" },
  configured: { en: "configured", zh: "已配置" },
  pending: { en: "pending", zh: "待处理" },
  unset: { en: "unset", zh: "未设置" },
  notConnected: { en: "not connected", zh: "未连接" },
  checked: { en: "checked", zh: "已检查" },
  idle: { en: "idle", zh: "空闲" },
  sessionVerifier: { en: "Session Verifier", zh: "Session Verifier" },
  aaCore: { en: "AA Core", zh: "AA Core" },
  labelAA: { en: "AA Core", zh: "AA Core" },
  derivedAccountId: { en: "Account ID Hash", zh: "账户 ID 哈希" },
  wallet: { en: "Wallet", zh: "钱包" },
  sponsor: { en: "Sponsor", zh: "赞助商" },
  anyMethod: { en: "Any method", zh: "任意方法" },
  anyMethodCaution: {
    en: "Allowed Method is blank — this session key will be allowed to call ANY method on the target contract. Specify a single method to narrow the scope.",
    zh: "“允许方法”为空——此 session key 将被允许调用目标合约上的任意方法。请填写单个方法以收窄作用域。",
  },
  onChainScopeLabel: { en: "Allowed Method", zh: "允许方法" },
  onChainExpiryLabel: { en: "Expires", zh: "过期" },
  onChainSpendLabel: { en: "Spent / Limit", zh: "已花费 / 上限" },
  spendUnlimited: { en: "unlimited", zh: "不限" },
  spendValue: { en: "{spent} / {limit} GAS", zh: "{spent} / {limit} GAS" },
  spendValueUnlimited: {
    en: "{spent} GAS spent (no limit)",
    zh: "已花费 {spent} GAS（无上限）",
  },
  sessionHeroTitle: {
    en: "Scoped session keys for safer AA actions",
    zh: "为 AA 操作配置更安全的作用域 Session Key",
  },
  sessionHeroCopy: {
    en: "Generate a local session key, bind it to one contract and method, then submit the scoped verifier update through the connected wallet.",
    zh: "先在本地生成 session key，再绑定到指定合约和方法，最后通过已连接钱包提交受限 verifier 更新。",
  },
  sessionHeroVisualAlt: {
    en: "Smart wallet session key linked to scoped contract and method permissions",
    zh: "智能钱包 session key 连接到受限合约和方法权限",
  },
  sessionHeroVisualBadge: {
    en: "Scoped until expiry",
    zh: "到期前受限授权",
  },
  sessionPassAria: {
    en: "Session pass authorization preview",
    zh: "Session Pass 授权预览",
  },
  sessionPassKicker: { en: "Live session pass", zh: "实时 Session Pass" },
  sessionPassTitle: {
    en: "Scope before you sign",
    zh: "签名前确认作用域",
  },
  sessionPassReady: { en: "Ready to configure", zh: "可以配置" },
  sessionPassDraft: { en: "Draft needs fields", zh: "草稿待补全" },
  sessionStageNeedKey: {
    en: "Generate a session key first",
    zh: "先生成会话密钥",
  },
  sessionStageNeedTarget: {
    en: "Set a target contract in details",
    zh: "在详情里设置目标合约",
  },
  sessionStageNeedExpiry: {
    en: "Choose a future expiry window",
    zh: "选择未来的过期窗口",
  },
  sessionPresetRewards: { en: "Rewards bot", zh: "奖励机器人" },
  sessionPresetRewardsCopy: {
    en: "One-hour claimRewards pass with a small GAS cap.",
    zh: "1 小时 claimRewards 通行证，较小 GAS 上限。",
  },
  sessionPresetMint: { en: "Mint window", zh: "铸造窗口" },
  sessionPresetMintCopy: {
    en: "Day-long mint permission for a single target contract.",
    zh: "面向单个目标合约的 24 小时 mint 权限。",
  },
  sessionPresetOps: { en: "Ops delegate", zh: "运维代理" },
  sessionPresetOpsCopy: {
    en: "Seven-day execute scope; review the target carefully.",
    zh: "7 天 execute 作用域；请认真核对目标合约。",
  },
  sessionTargetMissing: { en: "Set target in details", zh: "在详情里设置目标" },
  sessionTargetHint: {
    en: "Target stays off the main surface because it is the highest-risk raw contract field.",
    zh: "目标合约是最高风险的原始字段，因此放在详情里编辑。",
  },
  sessionAdvancedTitle: { en: "Advanced session fields", zh: "高级 Session 字段" },
  sessionAdvancedHint: {
    en: "Use this drawer for raw account, public key, target contract, sponsorship, and manual expiry edits.",
    zh: "在这里编辑原始账户、公钥、目标合约、赞助和手动过期时间。",
  },
  permissionRailTitle: { en: "Authorization path", zh: "授权路径" },
  permissionRailReady: {
    en: "Wallet review ready",
    zh: "钱包复核已就绪",
  },
  permissionRailDraft: {
    en: "Complete the missing permission pieces",
    zh: "补全缺失的权限要素",
  },
  permissionRailAccount: { en: "Account", zh: "账户" },
  permissionRailKey: { en: "Session key", zh: "会话密钥" },
  permissionRailScope: { en: "Scope", zh: "作用域" },
  permissionRailExpiry: { en: "Expiry", zh: "过期" },
  sessionMetricsLabel: {
    en: "Session key readiness",
    zh: "Session key 就绪状态",
  },
  sessionMetricStatus: { en: "Session", zh: "Session" },
  sessionMetricSponsor: { en: "Sponsor", zh: "赞助" },
  sessionMetricScope: { en: "Scope", zh: "作用域" },
  sessionCommandTitle: { en: "Key & sponsorship", zh: "密钥与赞助" },
  sessionKeyReady: { en: "ready", zh: "已就绪" },
  /**
   * Exception text, not display text: thrown from main.tsx when a copy is
   * attempted with no local key. That is a real failure of an action the
   * visitor took, so failure voice belongs here — but it used to double as the
   * SESSION PUBLIC KEY card's value, printing a bare lowercase "missing" on
   * every first paint. Display sites use `sessionKeyIdle` instead.
   */
  sessionKeyMissing: { en: "Session key not generated.", zh: "尚未生成 Session Key。" },
  /**
   * Zero-state copy for the permission-draft tiles (see `PhaseValue`). Each
   * replaces a literal "—" with the piece that is still outstanding, so a cold
   * open reads as a checklist to work through rather than a grid of blanks.
   */
  sessionAccountIdle: { en: "Inspect an account", zh: "待检视账户" },
  sessionOwnerIdle: { en: "Connect owner wallet", zh: "待连接所有者钱包" },
  sessionKeyIdle: { en: "Not generated yet", zh: "尚未生成" },
  sessionExpiryIdle: { en: "Pick a window", zh: "待选择有效期" },
  sessionAllowanceIdle: { en: "Pick a limit", zh: "待选择额度" },
  sessionVerifierIdle: { en: "Not resolved yet", zh: "尚未解析" },
  bindingIdle: { en: "Inspect to load", zh: "检视后加载" },
  networkIdle: { en: "Resolving network", zh: "正在解析网络" },
  sessionFlowLabel: { en: "Session setup workflow", zh: "Session 设置流程" },
  sessionFlowKey: { en: "Generate key", zh: "生成密钥" },
  sessionFlowKeyDesc: {
    en: "Create a browser-local key before assigning scope.",
    zh: "先生成仅保存在浏览器本地的密钥，再设置权限范围。",
  },
  sessionFlowSponsor: { en: "Check sponsor", zh: "检查赞助" },
  sessionFlowSponsorDesc: {
    en: "Confirm GAS sponsorship before relay-style actions.",
    zh: "在 relay 类操作前确认 GAS 赞助状态。",
  },
  sessionFlowConfigure: { en: "Configure scope", zh: "配置作用域" },
  sessionFlowConfigureDesc: {
    en: "Submit only after account, key, target, and expiry are present.",
    zh: "账户、密钥、目标合约和过期时间齐全后再提交。",
  },
  sessionNextStepTitle: { en: "Next action", zh: "下一步操作" },
  sessionNextGenerate: {
    en: "Generate a local key",
    zh: "生成本地密钥",
  },
  sessionNextGenerateCopy: {
    en: "Create the browser-local session key first, then keep the private key somewhere safe.",
    zh: "先创建仅保存在浏览器本地的 session key，再把私钥妥善保存。",
  },
  sessionNextScope: {
    en: "Complete the scope",
    zh: "补全作用域",
  },
  sessionNextScopeCopy: {
    en: "Add account, target contract, and expiry so the session pass is reviewable before signing.",
    zh: "填写账户、目标合约和过期时间，让 Session Pass 在签名前可被清楚核对。",
  },
  sessionNextSponsor: {
    en: "Check sponsorship",
    zh: "检查赞助",
  },
  sessionNextSponsorCopy: {
    en: "Confirm or request GAS sponsorship before relay-style submission.",
    zh: "在 relay 类提交前确认或请求 GAS 赞助。",
  },
  sessionNextSubmit: {
    en: "Review and submit",
    zh: "核对并提交",
  },
  sessionNextSubmitCopy: {
    en: "The pass is ready. Submit only if the scoped account, contract, method, and expiry match your intent.",
    zh: "Session Pass 已就绪。请确认账户、合约、方法和过期时间符合预期后再提交。",
  },
  sessionReadinessChecks: {
    en: "Session readiness checks",
    zh: "Session 就绪检查",
  },
  sessionStateLabel: { en: "Live state", zh: "实时状态" },
  sessionEmptyCopy: {
    en: "Generate a key or submit a configuration to populate this board.",
    zh: "生成密钥或提交配置后，这里会显示最新状态。",
  },
  sessionScopeTitle: { en: "Target scope", zh: "目标作用域" },
  scopeGroupLabel: { en: "Scope", zh: "作用域" },
  limitsGroupLabel: {
    en: "Limits & label (optional)",
    zh: "上限与标签（可选）",
  },
  privateKeyCardTitle: { en: "Generated private key", zh: "已生成的私钥" },
  configureSessionBlocked: {
    en: "Verify the AA account owner and verifier, then complete the key, target, method, and expiry.",
    zh: "请先核对 AA 账户所有者与 Verifier，再补全密钥、目标、方法和过期时间。",
  },
  network: { en: "Network", zh: "网络" },
  mainnet: { en: "Mainnet", zh: "主网" },
  testnet: { en: "Testnet", zh: "测试网" },
  accountOwner: { en: "Backup owner", zh: "备份所有者" },
  sessionActive: { en: "Active on chain", zh: "链上生效中" },
  sessionExpired: { en: "Expired on chain", zh: "链上已过期" },
  sessionAbsent: { en: "No session on chain", zh: "链上无 Session" },
  sessionUnavailable: { en: "Live state unavailable", zh: "实时状态不可用" },
  sessionNotInspected: { en: "Not inspected", zh: "尚未核对" },
  sessionAccountLoading: { en: "Inspecting account", zh: "正在核对账户" },
  sessionAccountReady: { en: "AA account verified", zh: "AA 账户已核对" },
  sessionAccountMissing: { en: "AA account not found", zh: "未找到 AA 账户" },
  sessionAccountUnavailable: { en: "Account state unavailable", zh: "账户状态不可用" },
  inspectAAAccount: { en: "Inspect AA account", zh: "核对 AA 账户" },
  inspectingAAAccount: { en: "Inspecting account…", zh: "正在核对账户…" },
  retryAAAccount: { en: "Retry account check", zh: "重新核对账户" },
  accountMissingHint: {
    en: "This ID is not registered in the selected AA Core. Open details to enter another account ID or hash.",
    zh: "此 ID 尚未在所选 AA Core 注册。请在详情中输入其他账户 ID 或哈希。",
  },
  connectOwnerWallet: { en: "Connect owner wallet", zh: "连接所有者钱包" },
  ownerWalletMismatch: { en: "Wrong owner wallet", zh: "所有者钱包不匹配" },
  ownerWalletMismatchHint: {
    en: "Switch to the account's on-chain backup-owner wallet before signing.",
    zh: "请先切换到该账户链上记录的备份所有者钱包，再进行签名。",
  },
  ownerVerified: { en: "Owner verified", zh: "所有者已核对" },
  ownerMismatch: { en: "Wallet mismatch", zh: "钱包不匹配" },
  ownerNotVerified: { en: "Not verified", zh: "尚未核对" },
  bindingVerified: { en: "Session verifier bound", zh: "Session Verifier 已绑定" },
  bindingMismatch: { en: "Different verifier is bound", zh: "账户绑定了其他 Verifier" },
  walletNetworkVerified: { en: "Wallet network verified", zh: "钱包网络已核对" },
  walletNetworkReadOnly: { en: "Read-only network", zh: "只读网络上下文" },
  sessionPermissionObject: { en: "Live permission object", zh: "实时权限对象" },
  sessionDraft: { en: "Permission draft", zh: "权限草稿" },
  sessionObjectAccount: { en: "AA account", zh: "AA 账户" },
  sessionObjectOwner: { en: "Owner authority", zh: "所有者权限" },
  sessionObjectKey: { en: "Session key", zh: "Session Key" },
  sessionObjectScope: { en: "Contract · method", zh: "合约 · 方法" },
  sessionObjectExpiry: { en: "Expiry", zh: "过期时间" },
  sessionObjectAllowance: { en: "Allowance", zh: "额度" },
  sessionReadbackRequired: {
    en: "A wallet broadcast is never shown as complete until this exact object is read back from chain.",
    zh: "钱包广播后，只有从链上读回完全一致的权限对象，才会显示为完成。",
  },
  sessionDraftHonest: {
    en: "This is a local draft. It is not an active permission until on-chain readback succeeds.",
    zh: "这是本地草稿；链上回读成功前，它不是已生效权限。",
  },
  allowanceUnavailableTestnet: {
    en: "The frozen testnet verifier has no spending-limit field. No allowance is claimed or enforced here.",
    zh: "测试网冻结版 Verifier 不含支出上限字段；这里不会声称或执行任何额度。",
  },
  allowanceUnavailableShort: { en: "No allowance", zh: "无额度功能" },
  explicitMethodHint: {
    en: "Use one exact contract method. Blank or wildcard scope is not submitted.",
    zh: "请填写一个明确的合约方法；空值或通配作用域不会被提交。",
  },
  replaceLocalKey: { en: "Generate another local key", zh: "重新生成本地密钥" },
  revokeLifecycleHint: {
    en: "Revocation requires a second confirmation and an on-chain absence readback.",
    zh: "撤销需要二次确认，并以链上回读确认 Session 已不存在。",
  },
  recoverSessionWrite: { en: "Recover pending update", zh: "恢复待确认更新" },
  recoveringSessionWrite: { en: "Checking pending update…", zh: "正在核对待确认更新…" },
  recoverSessionWriteHint: {
    en: "Recovery only reads the exact account and contracts recorded with the transaction; it never resubmits.",
    zh: "恢复只读取交易记录中的精确账户和合约，绝不会自动重新提交。",
  },
  sessionWritePending: {
    en: "{kind} was broadcast and is waiting for exact on-chain readback.",
    zh: "{kind} 已广播，正在等待精确链上回读。",
  },
  sessionWriteConfirmed: {
    en: "The latest update was confirmed by exact on-chain readback.",
    zh: "最近一次更新已通过精确链上回读确认。",
  },
  invalidAllowedMethod: {
    en: "Allowed method must be one explicit contract method name.",
    zh: "允许方法必须是一个明确的合约方法名。",
  },
  sessionCanonicalContextMismatch: {
    en: "The configured AA Core or session verifier does not match the canonical network registry.",
    zh: "当前 AA Core 或 Session Verifier 与规范网络注册表不一致。",
  },
  sessionWalletNetworkMismatch: {
    en: "The connected wallet network does not match this session-key workspace.",
    zh: "已连接钱包的网络与当前 Session Key 工作区不一致。",
  },
  sessionWalletNetworkUnverified: {
    en: "The wallet network could not be verified. No write was submitted.",
    zh: "无法核对钱包网络，因此未提交任何写入。",
  },
  sessionAccountReadUnavailable: {
    en: "The live AA account or session record could not be read. Previous state is not reused.",
    zh: "无法读取实时 AA 账户或 Session 记录；不会复用旧状态。",
  },
  sessionVerifierBindingMismatch: {
    en: "This AA account is bound to a different verifier. Bind the canonical session verifier before using this app.",
    zh: "该 AA 账户绑定了其他 Verifier；请先绑定规范 Session Verifier。",
  },
  sessionOwnerWalletRequired: {
    en: "Connect the account's on-chain backup-owner wallet.",
    zh: "请连接该账户链上记录的备份所有者钱包。",
  },
  sessionOwnerConnectFailed: {
    en: "The owner wallet could not be connected or verified.",
    zh: "无法连接或核对所有者钱包。",
  },
  sessionExistingMustRevoke: {
    en: "A session record already exists. Revoke and confirm it before creating another.",
    zh: "已有 Session 记录；请先撤销并确认，再创建新的权限。",
  },
  sessionRevokeRequiresLiveRecord: {
    en: "No live or expired session record is available to revoke.",
    zh: "当前没有可撤销的生效或已过期 Session 记录。",
  },
  sessionPendingBlocksWrites: {
    en: "Recover the pending transaction before submitting another update.",
    zh: "请先恢复待确认交易，再提交新的更新。",
  },
  sessionTransactionIdMissing: {
    en: "The wallet returned no transaction ID, so the update was not treated as submitted.",
    zh: "钱包未返回交易 ID，因此不会把本次更新视为已提交。",
  },
  sessionConfirmationPending: {
    en: "The transaction was broadcast, but exact on-chain readback is still pending. Use recovery; do not resubmit.",
    zh: "交易已广播，但精确链上回读仍在等待。请使用恢复功能，不要重复提交。",
  },
  sessionPendingContextMismatch: {
    en: "This pending transaction belongs to another account, network, or canonical contract context.",
    zh: "该待确认交易属于其他账户、网络或规范合约上下文。",
  },
  sessionUnsignedDraftCleared: {
    en: "An unsigned local write draft was cleared; no transaction ID had been recorded.",
    zh: "未记录交易 ID 的本地写入草稿已清除。",
  },
  sessionRecoveryFailed: {
    en: "The pending update could not be recovered from chain.",
    zh: "无法从链上恢复待确认更新。",
  },
} as const;

export const messages = mergeMessages(appMessages);
