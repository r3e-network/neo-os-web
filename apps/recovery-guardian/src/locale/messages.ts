import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Recovery Guardian", zh: "恢复守护者" },
  guardianHeroTitle: {
    en: "Social recovery workspace",
    zh: "社交恢复工作台",
  },
  guardianHeroCopy: {
    en: "Read guardian state first, then prepare recovery preview and credential links only after the account, new owner, and expiry window are ready.",
    zh: "先读取 guardian 状态，再在账户、新 owner 与过期窗口就绪后准备恢复预览和凭证链接。",
  },
  guardianHeroVisualAlt: {
    en: "Protected account vault connected to trusted recovery guardians",
    zh: "受保护账户金库与可信恢复守护人连接",
  },
  guardianHeroVisualBadge: {
    en: "Guardian route armed",
    zh: "守护路径已就绪",
  },
  guardianMetricsLabel: {
    en: "Recovery preparation summary",
    zh: "恢复准备摘要",
  },
  guardianMetricAccount: { en: "Account", zh: "账户" },
  guardianMetricOwner: { en: "New Owner", zh: "新 Owner" },
  guardianMetricExpiry: { en: "Expiry Minutes", zh: "过期分钟" },
  guardianCommandTitle: { en: "Guardian Preflight", zh: "Guardian 预检" },
  accountAddressHint: {
    en: "Use a Neo address or Hash160 before querying guardian state.",
    zh: "查询 guardian 状态前，请输入 Neo 地址或 Hash160。",
  },
  queryBlocked: {
    en: "Enter a valid account address or Hash160 before querying state.",
    zh: "输入有效账户地址或 Hash160 后才能查询状态。",
  },
  guardianFlowLabel: { en: "Recovery workflow", zh: "恢复流程" },
  guardianFlowRead: { en: "Read state", zh: "读取状态" },
  guardianFlowReadDesc: {
    en: "Inspect verifier, backup owner, recovery timelock, and escape status before preparing recovery.",
    zh: "准备恢复前先检查 verifier、备份 owner、恢复锁定期与逃生状态。",
  },
  guardianFlowPrepare: { en: "Prepare recovery", zh: "准备恢复" },
  guardianFlowPrepareDesc: {
    en: "Require the account, new owner, and expiry window before generating links.",
    zh: "生成链接前必须补齐账户、新 owner 与过期窗口。",
  },
  guardianFlowCredential: {
    en: "Continue in AA workspace",
    zh: "在 AA 工作区继续",
  },
  guardianFlowCredentialDesc: {
    en: "Open, copy, or share the prepared links, then open them in the AA identity workspace to sign the recovery — it is not executed here.",
    zh: "打开、复制或分享准备好的链接，然后在 AA 身份工作区中打开它们以签署恢复——此处不执行恢复。",
  },
  guardianLinkHandoffNote: {
    en: "Open this link in the AA identity workspace to sign the recovery. The recovery transaction is not executed here.",
    zh: "在 AA 身份工作区中打开此链接以签署恢复。恢复交易不会在此处执行。",
  },
  guardianStateLabel: { en: "Guardian Runtime", zh: "Guardian 运行态" },
  guardianStateTitle: { en: "Recovery state", zh: "恢复状态" },
  guardianRiskTitle: { en: "Recovery guardrails", zh: "恢复防护栏" },
  guardianRiskCopy: {
    en: "Recovery links stay disabled until the account, new owner, expiry window, and optional verifier override are valid.",
    zh: "账户、新 owner、过期窗口和可选 verifier override 有效前，恢复链接会保持禁用。",
  },
  guardianPrepareTitle: { en: "Prepare Recovery", zh: "准备恢复" },
  guardianDraftLabel: { en: "Draft Account", zh: "草稿账户" },
  newOwnerHint: {
    en: "Required recovery owner as a Neo address or Hash160.",
    zh: "必填恢复 owner，可使用 Neo 地址或 Hash160。",
  },
  recoveryExpiryHint: {
    en: "Required, 5 to 1440 minutes.",
    zh: "必填，范围 5 到 1440 分钟。",
  },
  verifierHashHint: {
    en: "Optional Hash160. When set it is compared to the bound verifier (match / mismatch is shown after Query State) and carried into the recovery links.",
    zh: "可选 Hash160。设置后会与绑定的 verifier 比较（查询状态后显示匹配/不匹配），并带入恢复链接。",
  },
  verifierOverrideMatch: {
    en: "Override matches bound verifier",
    zh: "覆盖值与绑定 verifier 匹配",
  },
  verifierOverrideMismatch: {
    en: "Override differs from bound verifier",
    zh: "覆盖值与绑定 verifier 不一致",
  },
  recoveryTemplateIdHint: {
    en: "Optional credential template identifier (letters, digits, . _ -).",
    zh: "可选凭证模板 ID（字母、数字、. _ -）。",
  },
  recoveryLinkBlocked: {
    en: "Complete a valid account, new owner, expiry window, and optional verifier override before using recovery links.",
    zh: "使用恢复链接前，请补齐有效账户、新 owner、过期窗口和可选 verifier override。",
  },
  preparePreReadHint: {
    en: "Read the guardian state first. Run Query State, then prepare recovery links here.",
    zh: "请先读取 guardian 状态。运行“查询状态”后再在此准备恢复链接。",
  },
  advancedOptional: {
    en: "Advanced (verifier override, template id)",
    zh: "高级（verifier 覆盖、模板 ID）",
  },
  latestState: { en: "Latest State", zh: "最新状态" },
  accountAddress: {
    en: "Account Address / Script Hash",
    zh: "账户地址 / Script Hash",
  },
  accountAddressPlaceholder: { en: "N... or 0x...", zh: "N... 或 0x..." },
  verifierHash: { en: "Verifier Hash Override", zh: "Verifier Hash 覆盖" },
  verifierHashPlaceholder: { en: "0x... (optional)", zh: "0x...（可选）" },
  queryState: { en: "Query State", zh: "查询状态" },
  newOwner: { en: "New Owner", zh: "新所有者" },
  newOwnerPlaceholder: { en: "N... or 0x...", zh: "N... 或 0x..." },
  recoveryExpiry: {
    en: "Recovery Expiry (minutes)",
    zh: "恢复过期时间（分钟）",
  },
  recoveryExpiryPlaceholder: { en: "30", zh: "30" },
  recoveryTemplateId: { en: "Recovery Template ID", zh: "恢复模板 ID" },
  recoveryTemplateIdPlaceholder: {
    en: "Optional certificate template id",
    zh: "可选的证书模板 ID",
  },
  recoveryPreviewGroup: { en: "Recovery preview", zh: "恢复预览" },
  recoveryCredentialGroup: { en: "Recovery credential", zh: "恢复凭证" },
  linkActionOpen: { en: "Open", zh: "打开" },
  linkActionCopy: { en: "Copy", zh: "复制" },
  linkActionShare: { en: "Share", zh: "分享" },
  openRecoveryPreview: { en: "Open Recovery Preview", zh: "打开恢复预览" },
  copyRecoveryLink: { en: "Copy Recovery Link", zh: "复制恢复链接" },
  shareRecoveryLink: { en: "Share Recovery Link", zh: "分享恢复链接" },
  openRecoveryCredential: {
    en: "Open Recovery Credential",
    zh: "打开恢复凭证",
  },
  copyRecoveryCredential: {
    en: "Copy Recovery Credential Link",
    zh: "复制恢复凭证链接",
  },
  shareRecoveryCredential: {
    en: "Share Recovery Credential Link",
    zh: "分享恢复凭证链接",
  },
  openIdentityWorkspace: {
    en: "Open Identity Workspace",
    zh: "打开身份工作区",
  },
  openAaWorkspace: { en: "Open AA Workspace", zh: "打开 AA 工作区" },
  openRecoveryDocs: { en: "Open Recovery Docs", zh: "打开恢复文档" },
  currentVerifier: { en: "Verifier", zh: "Verifier" },
  accountId: { en: "Account ID", zh: "Account ID" },
  backupOwner: { en: "Backup Owner", zh: "备份 Owner" },
  escapeStatusLabel: { en: "Recovery Escape", zh: "恢复逃生" },
  escapeActive: { en: "Active", zh: "进行中" },
  escapeInactive: { en: "Inactive", zh: "未触发" },
  escapeTriggeredAtLabel: { en: "Escape Triggered", zh: "逃生触发时间" },
  networkDefaultVerifierLabel: {
    en: "Network Default Verifier",
    zh: "网络默认 Verifier",
  },
  verifierNotConfigured: { en: "Not configured", zh: "未配置" },
  timelockLabel: { en: "Recovery Timelock", zh: "恢复锁定期" },
  timelockSeconds: { en: "{seconds}s", zh: "{seconds} 秒" },
  digestPlaceholder: { en: "—", zh: "—" },
  checkedAt: { en: "Checked At", zh: "检查时间" },
  queryLoaded: { en: "Recovery state loaded", zh: "恢复状态已加载" },
  queryFailed: { en: "Failed to load recovery state", zh: "加载恢复状态失败" },
  clipboardFailed: {
    en: "Could not copy or share the link",
    zh: "无法复制或分享链接",
  },
  previewLinkCopied: {
    en: "Recovery preview link copied",
    zh: "恢复预览链接已复制",
  },
  previewLinkShared: {
    en: "Recovery preview link shared",
    zh: "恢复预览链接已分享",
  },
  credentialLinkCopied: {
    en: "Recovery credential link copied",
    zh: "恢复凭证链接已复制",
  },
  credentialLinkShared: {
    en: "Recovery credential link shared",
    zh: "恢复凭证链接已分享",
  },
  noStateYet: { en: "No recovery state loaded yet.", zh: "尚未加载恢复状态。" },
  noStateHint: {
    en: "Run Query State above to inspect verifier, backup owner, recovery timelock, and escape status here.",
    zh: "在上方运行“查询状态”，即可在此查看 verifier、备份 owner、恢复锁定期与逃生状态。",
  },
  awaitingQuery: { en: "Awaiting query", zh: "等待查询" },
  // Real documentation content for the manifest docs section (these keys were
  // previously undefined, so the platform rendered generic base-message
  // boilerplate for a recovery operator).
  docSubtitle: {
    en: "A read-first recovery console for AA accounts: inspect the bound verifier, backup owner, recovery timelock, and escape status before preparing any recovery.",
    zh: "面向 AA 账户的“先读后写”恢复控制台：在准备任何恢复前，先检查绑定的 verifier、备份 owner、恢复锁定期与逃生状态。",
  },
  docDescription: { en: "Recovery preflight", zh: "恢复预检" },
  step2: {
    en: "1. Enter the account address or script hash and Query State to read its verifier and backup owner from the AA core. 2. The recovery timelock (seconds) is the delay before a backup owner can finalize an escape; escape status shows whether a recovery is already in progress. 3. Prepare and share preview/credential links only after the account, new owner, and expiry window are valid. The AA identity and app workspaces handle the on-chain recovery execution.",
    zh: "1. 输入账户地址或 script hash 并点击“查询状态”，从 AA core 读取其 verifier 与备份 owner。2. 恢复锁定期（秒）是备份 owner 在逃生完成前必须等待的延迟；逃生状态显示是否已有恢复在进行。3. 仅在账户、新 owner 与过期窗口有效后，再准备并分享预览/凭证链接。AA 身份与 app 工作区负责链上恢复执行。",
  },
  feature1Name: { en: "Read First", zh: "先读后写" },
  feature1Desc: {
    en: "Inspect recovery and timelock state before sending any ownership-changing transaction.",
    zh: "在发送任何变更所有权的交易前，先检查 recovery 与 timelock 状态。",
  },
  feature2Name: { en: "Verifier-Aware", zh: "感知 Verifier" },
  feature2Desc: {
    en: "Auto-resolve the bound verifier from AA core or override it explicitly for diagnostics.",
    zh: "可从 AA core 自动解析绑定 verifier，也可以手动覆盖用于诊断。",
  },
  feature3Name: { en: "Session Visibility", zh: "会话可见性" },
  feature3Desc: {
    en: "Recovery and private-session state are inspected together because they share the same verifier boundary.",
    zh: "Recovery 与 private-session 状态一并检查，因为它们共享同一 verifier 边界。",
  },
} as const;

export const messages = mergeMessages(appMessages);
