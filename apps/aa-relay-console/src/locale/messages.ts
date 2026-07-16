import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "aa-relay-console", zh: "aa-relay-console" },
  appName: { en: "AA Relay Console", zh: "AA Relay 控制台" },
  relayHeroTitle: {
    en: "Prepare an AA relay job you can actually verify",
    zh: "准备一份真正可验证的 AA Relay 任务",
  },
  relayStageKicker: { en: "AA job control", zh: "AA 任务控制" },
  relayStageTitle: {
    en: "Build the canonical V3 request, preview it on-chain, then import a bound receipt for recovery and tracking.",
    zh: "构建规范的 V3 请求，先进行链上预检，再导入绑定回执以恢复和追踪。",
  },
  relayHeroVisualAlt: {
    en: "A bright relay operations station routing reviewed account jobs.",
    zh: "明亮的 Relay 操作台正在路由已审核的账户任务。",
  },
  relayDeskEyebrow: { en: "Review station", zh: "审核工作站" },
  relayDeskTitle: { en: "One job. Four honest states.", zh: "一个任务，四个真实状态。" },
  relayDeskCopy: {
    en: "Preparation, authorized submission, receipt binding, and on-chain outcome remain visibly separate.",
    zh: "准备、授权提交、回执绑定与链上结果始终清晰分离。",
  },
  requestSummary: { en: "Current request", zh: "当前请求" },
  requestWaiting: { en: "Call data waiting", zh: "等待调用数据" },
  aaAccount: { en: "AA account", zh: "AA 账户" },
  targetContract: { en: "Target", zh: "目标合约" },
  targetMethod: { en: "Method", zh: "方法" },
  network: { en: "Network", zh: "网络" },
  currentState: { en: "Current state", zh: "当前状态" },
  jobId: { en: "Job ID", zh: "任务 ID" },
  confirmations: { en: "Confirmations", zh: "确认数" },
  relayLifecycle: { en: "Relay lifecycle", zh: "Relay 生命周期" },
  lifecycleTitle: { en: "Request to verified receipt", zh: "从请求到已验证回执" },
  stepPrepare: { en: "Prepare", zh: "准备" },
  stepPrepareStale: { en: "Draft changed", zh: "草稿已变更" },
  stepSubmit: { en: "Submit", zh: "提交" },
  stepSubmitExternal: { en: "Authorized relay", zh: "授权 Relay" },
  stepReceipt: { en: "Receipt", zh: "回执" },
  stepReceiptWaiting: { en: "Import required", zh: "等待导入" },
  stepTrack: { en: "Track", zh: "追踪" },
  reviewReady: { en: "Review ready", zh: "审核包已就绪" },
  reviewNeedsAuthorization: { en: "Authorization required", zh: "需要账户授权" },
  reviewNeedsPreview: { en: "Preview unavailable", zh: "预检不可用" },
  reviewBlocked: { en: "Core preview blocked", zh: "AA Core 预检已阻止" },
  reviewDraft: { en: "Draft", zh: "草稿" },
  chainConfirmed: { en: "Confirmed UserOp", zh: "UserOp 已确认" },
  chainFault: { en: "Execution fault", zh: "执行失败" },
  chainMismatch: { en: "Receipt mismatch", zh: "回执不匹配" },
  chainUnreachable: { en: "RPC unavailable", zh: "RPC 不可用" },
  chainPending: { en: "Broadcast pending", zh: "广播待确认" },
  chainNotTracked: { en: "Not tracked", zh: "尚未追踪" },
  receiptAccepted: { en: "Relay accepted only", zh: "仅 Relay 已接收" },
  requestLocallyValid: {
    en: "Canonical request shape is locally valid.",
    zh: "规范请求结构已通过本地校验。",
  },
  requestInvalid: { en: "Request needs attention.", zh: "请求仍需完善。" },
  /**
   * Shown instead of `requestInvalid` while the draft is untouched. The parser
   * rejects an empty form and a malformed one identically, so without this the
   * console opened on a warning nobody had earned. Invitation voice, not
   * failure voice — nothing is wrong yet.
   */
  requestPristine: {
    en: "Add the AA account, target, and call data to build a request.",
    zh: "填写 AA 账户、目标合约与调用数据即可生成请求。",
  },
  /**
   * Zero-state copy for the request-summary tiles (see `PhaseValue`). These
   * replace a literal "—": each says which field it is waiting for, so a first
   * paint reads as a form to fill in rather than a grid of blanks.
   */
  // Keep these short: the tiles are a two-column grid whose <dd> clips overflow,
  // so "Add target contract" truncated to "Add target cont…" at desktop width.
  aaAccountIdle: { en: "Add AA account", zh: "待填写 AA 账户" },
  targetContractIdle: { en: "Add target", zh: "待填写目标" },
  targetMethodIdle: { en: "Add method", zh: "待填写方法" },
  networkIdle: { en: "Resolving network", zh: "正在解析网络" },
  jobIdIdle: { en: "Not prepared yet", zh: "尚未生成" },
  reviewStale: {
    en: "The draft changed after preparation. Prepare a new package before importing a receipt.",
    zh: "草稿在准备后已变更。导入回执前请重新生成审核包。",
  },
  requestBuilder: { en: "Request", zh: "请求" },
  requestBuilderCopy: {
    en: "Keep route identity simple; advanced Neo call data stays inside this secondary workspace.",
    zh: "路由身份保持简单；高级 Neo 调用数据仅放在这个次级工作区。",
  },
  aaAccountPlaceholder: { en: "N... or 0x Hash160", zh: "N... 或 0x Hash160" },
  aaAccountHint: {
    en: "$AA_ACCOUNT in the template is replaced with this validated account id.",
    zh: "模板中的 $AA_ACCOUNT 会替换为已验证的账户 ID。",
  },
  dappId: { en: "Paymaster dApp ID", zh: "Paymaster dApp ID" },
  dappIdPlaceholder: { en: "optional policy scope", zh: "可选策略范围" },
  dappIdHint: {
    en: "Optional metadata for an external authorized paymaster decision.",
    zh: "供外部授权 Paymaster 决策使用的可选元数据。",
  },
  advancedCallData: { en: "Advanced call data", zh: "高级调用数据" },
  advancedCallDataHint: {
    en: "Canonical executeUserOp JSON only. Network, AA Core, nonce, deadline, and authorization remain explicit.",
    zh: "仅支持规范 executeUserOp JSON；网络、AA Core、nonce、deadline 与授权保持明确。",
  },
  payloadJsonPlaceholder: { en: "Paste a canonical V3 metaInvocation", zh: "粘贴规范 V3 metaInvocation" },
  requestNeedsWork: { en: "Complete the request", zh: "完善请求" },
  reviewPackage: { en: "Review package", zh: "审核包" },
  reviewPackageCopy: {
    en: "A digest-bound object for an authorized operator; it is not proof of submission.",
    zh: "供授权操作方使用的摘要绑定对象；它不是提交证明。",
  },
  previewState: { en: "Core preview", zh: "Core 预检" },
  packageDigest: { en: "Package digest", zh: "审核包摘要" },
  sponsorStatus: { en: "Sponsor evidence", zh: "赞助证据" },
  reviewPackageJson: { en: "Prepared review package JSON", zh: "已准备审核包 JSON" },
  authorizedSubmitRequired: { en: "Authorized submission stays external", zh: "授权提交保留在外部" },
  runtimeBoundaryCopy: {
    en: "This runtime has no authenticated relay capability or relay-status API. It never invents acceptance, sponsorship, a txid, or execution success.",
    zh: "当前运行时没有已认证 Relay 能力或 Relay 状态 API；不会虚构接收、赞助、交易 ID 或执行成功。",
  },
  reviewPackageEmpty: {
    en: "Complete the advanced call data and prepare the request first.",
    zh: "请先完善高级调用数据并准备请求。",
  },
  receiptRecovery: { en: "Receipt & recovery", zh: "回执与恢复" },
  receiptRecoveryCopy: {
    en: "Import only a network- and digest-bound operator receipt, then verify the UserOpExecuted event on-chain.",
    zh: "仅导入与网络及摘要绑定的操作方回执，再在链上验证 UserOpExecuted 事件。",
  },
  receiptJson: { en: "External relay receipt", zh: "外部 Relay 回执" },
  receiptJsonPlaceholder: {
    en: "{\"network\":\"mainnet\",\"packageDigest\":\"0x...\",\"txid\":\"0x...\"}",
    zh: "{\"network\":\"mainnet\",\"packageDigest\":\"0x...\",\"txid\":\"0x...\"}",
  },
  receiptJsonHint: {
    en: "A txid must be 32 bytes. Accepted-only receipts also need a durable requestId.",
    zh: "交易 ID 必须为 32 字节；仅接收回执还必须包含持久 requestId。",
  },
  importReceipt: { en: "Import bound receipt", zh: "导入绑定回执" },
  clearRecoveredJob: { en: "Clear local job", zh: "清除本地任务" },
  currentReceipt: { en: "Current normalized receipt", zh: "当前规范化回执" },
  workspaceSections: { en: "Job workspace sections", zh: "任务工作区分区" },
  openJobWorkspace: { en: "Open job workspace", zh: "打开任务工作区" },
  jobWorkspace: { en: "Relay job workspace", zh: "Relay 任务工作区" },
  prepareReview: { en: "Prepare review package", zh: "准备审核包" },
  preparingReview: { en: "Preparing review", zh: "正在准备审核" },
  refreshReview: { en: "Refresh review package", zh: "刷新审核包" },
  trackReceipt: { en: "Track on-chain receipt", zh: "追踪链上回执" },
  trackingReceipt: { en: "Tracking receipt", zh: "正在追踪回执" },
  checkSponsorEvidence: { en: "Check sponsor evidence", zh: "检查赞助证据" },
  checkingSponsor: { en: "Checking sponsor", zh: "正在检查赞助" },
  sponsorNotChecked: { en: "Not checked", zh: "未检查" },
  sponsorEligibleSummary: {
    en: "Eligible evidence: {remaining} of {dailyLimit} GAS remains.",
    zh: "符合资格：剩余 {remaining} / {dailyLimit} GAS。",
  },
  sponsorNotEligible: { en: "Current account is not eligible.", zh: "当前账户不符合资格。" },
  sponsorUnavailable: { en: "Sponsor evidence is unavailable.", zh: "赞助证据当前不可用。" },
  receiptNotTracked: { en: "No bound relay receipt has been imported.", zh: "尚未导入绑定的 Relay 回执。" },
  receiptPending: { en: "A valid txid is present; on-chain confirmation is pending.", zh: "已取得有效交易 ID；链上确认仍在等待。" },
  receiptAcceptedOnly: { en: "Relay acceptance is recorded, but no broadcast txid exists yet.", zh: "已记录 Relay 接收，但尚无广播交易 ID。" },
  reviewRequiredFirst: { en: "Prepare a current review package before importing a receipt.", zh: "导入回执前请先准备当前审核包。" },
  receiptRequiredFirst: { en: "Import a bound relay receipt before tracking.", zh: "追踪前请先导入绑定的 Relay 回执。" },
  notPublished: { en: "Not published", zh: "尚未发布" },
  reviewPrepared: { en: "Review package prepared. Check its preview and authorization state.", zh: "审核包已准备；请检查预检与授权状态。" },
  reviewPrepareError: { en: "Could not prepare the relay review package.", zh: "无法准备 Relay 审核包。" },
  sponsorCheckComplete: { en: "Sponsor evidence refreshed.", zh: "赞助证据已刷新。" },
  sponsorCheckError: { en: "Sponsor evidence is unavailable.", zh: "赞助证据不可用。" },
  receiptImported: { en: "Bound relay receipt imported.", zh: "已导入绑定的 Relay 回执。" },
  receiptImportError: { en: "Could not import this relay receipt.", zh: "无法导入该 Relay 回执。" },
  receiptRefreshed: { en: "On-chain receipt state refreshed.", zh: "链上回执状态已刷新。" },
  receiptTrackError: { en: "Could not refresh the on-chain receipt.", zh: "无法刷新链上回执。" },
  latestRelay: { en: "Relay job", zh: "Relay 任务" },
  labelAA: { en: "AA Core", zh: "AA Core" },
  relayLabel: { en: "Submission", zh: "提交" },
  paymasterLabel: { en: "Paymaster", zh: "Paymaster" },
  runtimeLabel: { en: "Runtime mode", zh: "运行模式" },
  chainStateLabel: { en: "Chain state", zh: "链上状态" },
  reviewStateLabel: { en: "Review state", zh: "审核状态" },
  txidLabel: { en: "Transaction ID", zh: "交易 ID" },
  // Shell chrome read-outs for the states where these values do not exist yet.
  // Manifest bindings are string-valued, so the chrome cannot render a
  // placeholder element — the honest phase has to reach it as words, or the
  // tile renders blank. See manifest.ts.
  jobIdPending: { en: "No job prepared", zh: "尚未准备任务" },
  txidPending: { en: "Not submitted", zh: "尚未提交" },
  docsSubtitle: {
    en: "Prepare, bind, recover, and verify AA relay jobs without pretending that an unavailable relay is live.",
    zh: "准备、绑定、恢复并验证 AA Relay 任务，不把不可用的 Relay 伪装成在线。",
  },
  feature1Name: { en: "Canonical request", zh: "规范请求" },
  feature1Desc: { en: "Builds current UnifiedSmartWalletV3 executeUserOp review packages.", zh: "构建当前 UnifiedSmartWalletV3 executeUserOp 审核包。" },
  feature2Name: { en: "Honest relay boundary", zh: "真实 Relay 边界" },
  feature2Desc: { en: "Stops at review when authenticated submission is not exposed.", zh: "未提供认证提交能力时明确停在审核阶段。" },
  feature3Name: { en: "Receipt recovery", zh: "回执恢复" },
  feature3Desc: { en: "Restores bound jobs and verifies UserOpExecuted against Neo RPC.", zh: "恢复绑定任务，并通过 Neo RPC 验证 UserOpExecuted。" },
} as const;

export const messages = mergeMessages(appMessages);
