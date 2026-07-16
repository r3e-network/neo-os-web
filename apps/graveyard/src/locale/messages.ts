import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  requestForget: { en: "requestForget", zh: "requestForget" },
  memoryText: { en: "memoryText", zh: "memoryText" },
  executeDestroy: { en: "executeDestroy", zh: "executeDestroy" },
  burialFeeDisplay: { en: "burialFeeDisplay", zh: "burialFeeDisplay" },
  // App translations
  title: { en: "Graveyard", zh: "数字墓地" },
  subtitle: { en: "Hash-based memory burial on-chain", zh: "基于哈希的链上记忆埋葬" },
  destructionStats: { en: "Burial Stats", zh: "埋葬统计" },
  rip: { en: "R.I.P", zh: "R.I.P" },
  itemsDestroyed: { en: "Buried", zh: "已埋葬" },
  gasReclaimed: { en: "Burial Fees", zh: "埋葬费用" },
  destroyAsset: { en: "Burial Chamber", zh: "埋葬室" },
  memoryVaultStage: { en: "Memory vault", zh: "记忆封存台" },
  memoryConsole: { en: "Memory console", zh: "记忆控制台" },
  sealReady: { en: "Seal ready", zh: "封存就绪" },
  sealEmpty: { en: "Awaiting memory", zh: "等待记忆" },
  assetHash: { en: "Content hash", zh: "内容哈希" },
  assetHashPlaceholder: { en: "Enter encrypted content hash...", zh: "输入加密内容哈希..." },
  assetHashHint: {
    en: "Use the encrypted content hash or token identifier you intend to bury.",
    zh: "请输入要埋葬的加密内容哈希或 Token 标识。",
  },
  assetHashTooShort: {
    en: "Enter at least 12 characters so the burial target is identifiable.",
    zh: "至少输入 12 个字符，确保埋葬目标可识别。",
  },
  invalidHash: {
    en: "Use a valid 64-character SHA-256 hash.",
    zh: "请输入有效的 64 位 SHA-256 哈希。",
  },
  invalidMemoryType: {
    en: "Choose one of the five memory types before burial.",
    zh: "埋葬前请选择五种记忆类型之一。",
  },
  actionBusy: {
    en: "Another action is still in progress. Please wait for it to finish.",
    zh: "另一项操作仍在进行中，请等待其完成。",
  },
  memoryRecordMissing: {
    en: "This memory record is unavailable. Refresh your garden and try again.",
    zh: "此记忆记录不可用，请刷新记忆花园后重试。",
  },
  memoryAlreadyForgotten: {
    en: "This memory is already marked forgotten. Refresh to see its latest state.",
    zh: "此记忆已标记为遗忘，请刷新查看最新状态。",
  },
  clearHash: { en: "Clear Hash", zh: "清空哈希" },
  warning: { en: "Permanent record", zh: "永久记录" },
  warningText: {
    en: "This writes the content hash on-chain permanently. Forgetting records an additional paid state change and cannot be reversed.",
    zh: "此操作会将内容哈希永久写入链上。遗忘会记录一次额外的付费状态变更且不可恢复。",
  },
  destroyForever: { en: "Review burial", zh: "检查埋葬" },
  destroying: { en: "Burying...", zh: "埋葬中..." },
  recentDestructions: { en: "Burial Records", zh: "埋葬记录" },
  enterAssetHash: { en: "Please enter content hash", zh: "请输入内容哈希" },
  memoryBuried: { en: "Memory has been buried on-chain", zh: "记忆已在链上埋葬" },
  destroy: { en: "Bury", zh: "埋葬" },
  records: { en: "records", zh: "条记录" },
  destroyed: { en: "Buried", zh: "已埋葬" },
  forgotten: { en: "Forgotten", zh: "已遗忘" },
  noDestructions: { en: "No burial records yet", zh: "暂无埋葬记录" },
  noDestructionsHint: {
    en: "Buried memories will appear here.",
    zh: "埋葬的记忆将显示在此处。",
  },
  tabStats: { en: "Stats", zh: "统计" },
  confirmTitle: { en: "Confirm Burial", zh: "确认埋葬" },
  confirmText: { en: "Are you absolutely sure? The hash will be permanent.", zh: "您确定吗？哈希将永久保留。" },
  confirmDestroy: { en: "Bury on-chain", zh: "上链埋葬" },
  cancel: { en: "Cancel", zh: "取消" },
  forgetConfirmTitle: { en: "Confirm Forgetting", zh: "确认遗忘" },
  forgetConfirmText: {
    en: "This will mark the memory as forgotten on-chain. Continue?",
    zh: "这会在链上将该记忆标记为已遗忘，是否继续？",
  },
  forgetAction: { en: "Forget", zh: "遗忘" },
  forgetSuccess: { en: "Memory forgotten successfully", zh: "记忆已成功遗忘" },
  buryPending: { en: "Burial confirmation pending", zh: "埋葬确认中" },
  docSubtitle: { en: "On-chain burial and right-to-forget flow", zh: "链上埋葬与遗忘流程" },
  docDescription: {
    en: "Graveyard anchors content hashes on-chain and supports paid forgetting records. Bury a memory with a small fee, then optionally mark it forgotten with an additional fee.",
    zh: "数字墓地将内容哈希锚定上链，并支持付费遗忘记录。支付小额费用埋葬记忆，之后可通过额外费用标记为已遗忘。",
  },
  step1: { en: "Enter the encrypted content hash", zh: "输入加密内容哈希" },
  step2: { en: "Pick a memory type and review the warning", zh: "选择记忆类型并阅读提示" },
  step3: { en: "Confirm burial to anchor the hash on-chain", zh: "确认埋葬并将哈希写入链上" },
  step4: { en: "Track your burials and optionally forget later.", zh: "在历史中查看埋葬记录并按需遗忘。" },
  feature1Name: { en: "On-Chain Burial", zh: "链上埋葬" },
  feature1Desc: { en: "Encrypted content hashes are anchored permanently.", zh: "加密内容哈希永久锚定上链。" },
  feature2Name: { en: "Paid Forgetting", zh: "付费遗忘" },
  feature2Desc: { en: "Forget memories with an extra fee when needed.", zh: "可通过额外费用执行遗忘。" },
  feature3Name: { en: "Audit Trail", zh: "审计轨迹" },
  feature3Desc: { en: "Burial and forgetting states remain inspectable in the record history.", zh: "埋葬与遗忘状态会保留在记录历史中，方便核查。" },
  memoryType: { en: "Memory Type", zh: "记忆类型" },
  memoryTypeLocal: { en: "Record tag", zh: "记录标签" },
  memoryTypeLocalHint: {
    en: "Categorises the memory; this tag is anchored on-chain alongside the content hash.",
    zh: "用于给记忆分类；该标签会与内容哈希一起锚定上链。",
  },
  memoryTypeSecret: { en: "Secret", zh: "秘密" },
  memoryTypeRegret: { en: "Regret", zh: "遗憾" },
  memoryTypeWish: { en: "Wish", zh: "愿望" },
  memoryTypeConfession: { en: "Confession", zh: "告白" },
  memoryTypeOther: { en: "Other", zh: "其他" },
  burialReview: { en: "Burial review", zh: "埋葬检查" },
  burialReviewSubtitle: {
    en: "Confirm target, wallet action, and fee model before signing.",
    zh: "签名前确认目标、钱包操作和费用模型。",
  },
  hashQuality: { en: "Hash quality", zh: "哈希质量" },
  hashMissing: { en: "Hash required", zh: "需要哈希" },
  hashMissingCopy: {
    en: "Enter the encrypted content hash before preparing the burial.",
    zh: "准备埋葬前，请先输入加密内容哈希。",
  },
  hashReady: { en: "Ready for review", zh: "可进入检查" },
  hashReadyCopy: {
    en: "The complete 64-character digest is ready for review.",
    zh: "完整的 64 位摘要已可进入检查。",
  },
  hashTooShort: { en: "Hash too short", zh: "哈希过短" },
  hashTooShortCopy: {
    en: "Short values are blocked so users do not bury an accidental fragment.",
    zh: "短值会被阻止，避免误把片段写入链上。",
  },
  hashPreview: { en: "Target", zh: "目标" },
  hashPending: { en: "Waiting for hash", zh: "等待哈希" },
  hashPreviewCopy: {
    en: "Only the hash is written; original encrypted content stays outside the app.",
    zh: "链上只写入哈希；原始加密内容不进入应用。",
  },
  walletAction: { en: "Wallet action", zh: "钱包操作" },
  buryWalletIntent: { en: "Bury memory", zh: "埋葬记忆" },
  walletActionCopy: {
    en: "The wallet deposits the burial fee in GAS, then anchors the content hash on-chain.",
    zh: "钱包会先存入 GAS 埋葬费用，再将内容哈希锚定上链。",
  },
  burialChecklist: { en: "Burial checklist", zh: "埋葬检查表" },
  checkHash: { en: "Target hash", zh: "目标哈希" },
  checkMemoryType: { en: "Memory type", zh: "记忆类型" },
  checkFees: { en: "Fees visible", zh: "费用可见" },
  checkPassed: { en: "Passed", zh: "通过" },
  checkNeedsAction: { en: "Needs action", zh: "需要处理" },
  refreshRecords: { en: "Refresh Records", zh: "刷新记录" },
  historyGuidance: {
    en: "Buried records remain inspectable here. Forgetting marks a paid follow-up state instead of deleting the audit trail.",
    zh: "已埋葬记录会在此保留可核查状态。遗忘是一次付费后续状态标记，并不会删除审计轨迹。",
  },
  transactionPath: { en: "Transaction path", zh: "交易路径" },
  selectedType: { en: "Selected type", zh: "已选类型" },
  selectedTypeLocal: { en: "Record tag (local)", zh: "记录标签（本地）" },
  burialFee: { en: "Burial fee", zh: "埋葬费用" },
  forgettingFee: { en: "Forgetting fee", zh: "遗忘费用" },
  totalDestroyed: { en: "Total Buried", zh: "总埋葬数" },
  hashEllipsis: { en: "...", zh: "..." },
  tokenGas: { en: "GAS", zh: "GAS" },
  error: { en: "Something went wrong", zh: "发生错误" },
  connectWallet: { en: "Please connect your wallet", zh: "请连接钱包" },
  // Shown by the shell chrome while the wallet-scoped burial read is in flight.
  // The chrome cannot show a skeleton (manifest bindings are string-valued), so
  // the pending phase has to reach it as words — see manifest.ts.
  graveyardReading: { en: "Reading…", zh: "读取中…" },

  memoryGarden: { en: "Memory Garden", zh: "记忆花园" },
  memorySource: { en: "Choose a memory source", zh: "选择记忆来源" },

  // Memory sources: private note, local file, or an existing SHA-256 digest.
  composeModeWrite: { en: "Private note", zh: "私密文字" },
  composeModeFile: { en: "Local file", zh: "本地文件" },
  composeModeHash: { en: "Existing hash", zh: "已有哈希" },
  composeModeWriteHint: {
    en: "Hash locally from a private note",
    zh: "从私密文字本地生成哈希",
  },
  composeModeHashHint: {
    en: "Use an existing encrypted target",
    zh: "使用已有加密目标",
  },
  memoryTextLabel: { en: "Your memory", zh: "你的记忆" },
  memoryTextPlaceholder: {
    en: "Write the memory to bury. It is hashed on your device — only the hash is written on-chain, never the text.",
    zh: "写下要埋葬的记忆。它会在你的设备上被哈希处理 — 链上只写入哈希，绝不写入原文。",
  },
  memoryTextPlaceholderShort: {
    en: "Write what you want to lay to rest…",
    zh: "写下你想安放的记忆…",
  },
  memoryTextHint: {
    en: "The text stays on this device. We bury its SHA-256 hash so the memory is committed without revealing it.",
    zh: "原文仅保留在本设备。我们埋葬其 SHA-256 哈希，从而在不泄露内容的情况下完成承诺。",
  },
  hashFromMemory: { en: "Hash (computed locally)", zh: "哈希（本地计算）" },
  hashing: { en: "Computing SHA-256…", zh: "正在计算 SHA-256…" },
  hashingInProgress: { en: "Wait for the local hash to finish.", zh: "请等待本地哈希计算完成。" },
  hashUnavailable: {
    en: "Secure SHA-256 is unavailable in this browser context.",
    zh: "当前浏览器环境无法使用安全的 SHA-256。",
  },
  sha256Placeholder: { en: "Paste 64 hexadecimal characters", zh: "粘贴 64 位十六进制字符" },
  sha256Hint: {
    en: "A leading 0x is accepted and removed locally before review.",
    zh: "可输入 0x 前缀；检查前会在本地自动移除。",
  },
  sha256InvalidHint: {
    en: "Enter exactly 64 hexadecimal characters (0-9, a-f).",
    zh: "请输入恰好 64 位十六进制字符（0-9、a-f）。",
  },
  chooseLocalFile: { en: "Choose a file from this device", zh: "从此设备选择文件" },
  localFile: { en: "Local file", zh: "本地文件" },
  hashingFile: { en: "Hashing file on this device…", zh: "正在本设备计算文件哈希…" },
  filePrivacyHint: {
    en: "Up to 25 MB. The file is never uploaded.",
    zh: "最大 25 MB，文件绝不会上传。",
  },
  fileRequired: { en: "Choose a local file first.", zh: "请先选择本地文件。" },
  fileEmpty: { en: "The selected file is empty.", zh: "所选文件为空。" },
  fileTooLarge: { en: "Choose a file no larger than 25 MB.", zh: "请选择不超过 25 MB 的文件。" },
  fileHashFailed: {
    en: "This file could not be hashed. Your file stayed on this device; choose it again to retry.",
    zh: "无法计算此文件的哈希。文件仍仅保留在本设备；请重新选择后重试。",
  },
  privacyFirst: { en: "Privacy first: SHA-256 is computed on this device.", zh: "隐私优先：SHA-256 在本设备计算。" },
  privacyBoundary: {
    en: "Only the 64-character digest is sent to Neo N3 — never the note or file.",
    zh: "只向 Neo N3 发送 64 位摘要，绝不发送原文或文件。",
  },
  networkAndFee: { en: "Network & fee", zh: "网络与费用" },
  feePending: { en: "Checking…", zh: "核验中…" },
  checkingLiveFees: { en: "Checking live contract fees", zh: "正在核验合约实时费用" },
  checkingLiveFeesHint: {
    en: "Reading the burial and forget fees from the contract.",
    zh: "正在从合约读取埋葬与遗忘费用。",
  },
  /**
   * Settled-but-empty fee state. This is the normal first paint (no wallet or
   * network bound yet), so it reads as a next step rather than a fault — the
   * old copy here was the amber "Live contract fees are unavailable. No GAS
   * will move until they are verified." warning, shown before the visitor had
   * done anything. `liveFeeUnavailable` keeps its failure voice for the write
   * guards in useGraveyard, which fire on an action the visitor really took.
   */
  feeNeedsConnection: { en: "Connect to load", zh: "连接后加载" },
  feeNeedsConnectionTitle: { en: "Fees load with your wallet", zh: "连接钱包后加载费用" },
  feeNeedsConnectionHint: {
    en: "Nothing is charged until a fee is read and you confirm.",
    zh: "在读取费用并确认之前，不会产生任何扣费。",
  },
  liveFeeUnavailable: {
    en: "Live contract fees are unavailable. No GAS will move until they are verified.",
    zh: "暂时无法核验合约实时费用；核验完成前不会转移 GAS。",
  },
  liveFeeUnavailableHint: {
    en: "Retry the contract read before reviewing a paid action.",
    zh: "请先重新读取合约费用，再检查付费操作。",
  },
  contractPaused: { en: "Memory Garden is temporarily paused", zh: "记忆花园暂时停用" },
  contractPausedHint: {
    en: "No paid action is available while the contract is paused. Refresh before trying again.",
    zh: "合约暂停期间不会开放付费操作，请稍后刷新重试。",
  },
  contractPausedAction: {
    en: "Memory Garden is paused. No GAS was requested.",
    zh: "记忆花园当前已暂停，未请求任何 GAS。",
  },
  retryFeeCheck: { en: "Retry", zh: "重试" },
  neoN3: { en: "NEO N3", zh: "NEO N3" },
  buryNow: { en: "Bury now", zh: "现在埋葬" },
  payOnce: { en: "Paid once for this burial", zh: "本次埋葬支付一次" },
  forgetLater: { en: "Forget later", zh: "日后遗忘" },
  futureAction: { en: "Separate future action", zh: "独立的后续操作" },
  walletReady: { en: "Wallet ready", zh: "钱包已就绪" },
  walletConnectOnConfirm: { en: "Wallet requested at confirmation", zh: "确认时请求连接钱包" },
  walletNotConnected: { en: "Not connected yet", zh: "尚未连接" },
  permanentHashWarning: {
    en: "Burying permanently anchors this hash. Forgetting later marks state; it does not erase the audit trail.",
    zh: "埋葬会永久锚定此哈希。日后“遗忘”只标记状态，不会删除审计轨迹。",
  },
  reviewBurialHint: { en: "Preview hash, wallet route & fee", zh: "预览哈希、钱包路径和费用" },
  safeRetryHint: {
    en: "Rejected or pre-broadcast attempts keep your source. If a transaction was broadcast but is still unverified, refresh records before retrying.",
    zh: "拒签或广播前失败会保留来源。若交易已广播但尚未验证，请先刷新记录再重试。",
  },
  historyAndEpitaphHint: { en: "Review burials, epitaphs and forgetting", zh: "查看埋葬、墓志铭与遗忘状态" },
  refresh: { en: "Refresh", zh: "刷新" },
  close: { en: "Close", zh: "收起" },
  open: { en: "Open", zh: "展开" },
  connectForRecords: { en: "Connect a wallet to see your garden", zh: "连接钱包查看你的记忆花园" },
  connectForRecordsHint: { en: "Records are scoped to the connected Neo N3 owner.", zh: "记录按已连接的 Neo N3 所有者筛选。" },
  connectAtWallet: { en: "Connect in wallet", zh: "在钱包中连接" },
  connectAndBury: { en: "Connect & bury", zh: "连接并埋葬" },
  routeDeposit: { en: "Deposit burial fee", zh: "存入埋葬费用" },
  routeUseCredit: { en: "Use existing prepaid credit", zh: "使用已有预付额度" },
  routeAnchor: { en: "Anchor SHA-256", zh: "锚定 SHA-256" },
  routeEvent: { en: "Confirm chain event", zh: "确认链上事件" },
  noSuccessBeforeEvent: {
    en: "Success is shown only after the contract emits MemoryBuried.",
    zh: "只有合约发出 MemoryBuried 事件后才显示成功。",
  },
  burialConfirmationRequired: {
    en: "Review the hash, memory type, fee, and permanence warning before signing.",
    zh: "签名前请先检查哈希、记忆类型、费用与永久记录提示。",
  },
  burialReviewChanged: {
    en: "The burial target, type, or fee changed. Review the updated details and confirm again.",
    zh: "埋葬目标、类型或费用已变化。请检查更新后的详情并再次确认。",
  },
  burialUnverified: {
    en: "The transaction was broadcast, but MemoryBuried is not verified yet. Your source is preserved; refresh records before submitting again.",
    zh: "交易已广播，但尚未验证 MemoryBuried。来源已保留；再次提交前请先刷新记录。",
  },
  burialRecoveryReady: { en: "A previous prepaid action needs recovery", zh: "上一次预付操作需要恢复" },
  burialRecoveryDepositHint: {
    en: "The deposit was broadcast before the burial completed. The next confirmed attempt reuses it without another GAS transfer.",
    zh: "押金已广播，但埋葬尚未完成。下一次确认会复用该额度，不再转移 GAS。",
  },
  burialRecoveryTargetHint: {
    en: "The burial transaction was broadcast but its event is unresolved. Refresh records; new payment and retry stay blocked until readback settles.",
    zh: "埋葬交易已广播，但事件仍未确认。请刷新记录；读取结果明确前会阻止新的付款和重试。",
  },
  burialPendingResolution: {
    en: "A burial transaction is already awaiting event readback. Refresh records before another attempt; no new GAS was requested.",
    zh: "已有埋葬交易正在等待事件回读。请刷新记录后再操作；本次未请求新的 GAS。",
  },
  burialPending: { en: "Awaiting burial readback", zh: "等待埋葬回读" },
  burialPendingHint: { en: "Refresh records; duplicate payment is blocked", zh: "请刷新记录；已阻止重复付款" },
  recoverBurial: { en: "Review recovery", zh: "检查并恢复" },
  recoverBurialHint: { en: "Reuse prepaid credit; no new GAS deposit", zh: "复用预付额度，不新增 GAS 押金" },
  prepaidCreditNoNewGas: { en: "Existing prepaid credit · no new deposit", zh: "使用已有预付额度 · 不新增押金" },
  prepaidBurialRecovery: {
    en: "The GAS deposit was broadcast, but burial did not finish. Your recovery is saved; confirm again to retry without another deposit.",
    zh: "GAS 押金已广播，但埋葬尚未完成。恢复状态已保存；再次确认可在不新增押金的情况下重试。",
  },
  prepaidBurialRetryFailed: {
    en: "The recovery attempt moved no new GAS and is still unresolved. Refresh records, then retry when the contract is available.",
    zh: "本次恢复未转移新的 GAS，状态仍未解决。请刷新记录，并在合约可用后重试。",
  },
  forgetUnverified: {
    en: "The transaction was broadcast, but MemoryForgotten is not verified yet. Refresh records before trying again.",
    zh: "交易已广播，但尚未验证 MemoryForgotten。再次尝试前请先刷新记录。",
  },
  forgetConfirmationRequired: {
    en: "Review the live forgetting fee before signing.",
    zh: "签名前请先检查实时遗忘费用。",
  },
  forgetReviewChanged: {
    en: "The forgetting fee changed. Review the updated amount and confirm again.",
    zh: "遗忘费用已变化。请检查更新后的金额并再次确认。",
  },
  forgetRecoveryConfirm: {
    en: "Use the existing prepaid forgetting credit. This retry will not add another GAS deposit.",
    zh: "使用已有的遗忘预付额度；本次重试不会新增 GAS 押金。",
  },
  forgetPendingResolution: {
    en: "A forgetting transaction is already awaiting event readback. Refresh records before another attempt.",
    zh: "已有遗忘交易正在等待事件回读，请刷新记录后再操作。",
  },
  recoverForgetAction: { en: "Recover forgetting", zh: "恢复遗忘" },
  forgetPending: { en: "Awaiting readback", zh: "等待回读" },
  prepaidForgetRecovery: {
    en: "The GAS deposit was broadcast, but forgetting did not finish. Recovery is saved; retry without another deposit.",
    zh: "GAS 押金已广播，但遗忘尚未完成。恢复状态已保存；重试不会新增押金。",
  },
  prepaidForgetRetryFailed: {
    en: "The recovery attempt moved no new GAS and is still unresolved. Refresh this record before retrying.",
    zh: "本次恢复未转移新的 GAS，状态仍未解决。请刷新此记录后再试。",
  },
  epitaphUnverified: {
    en: "The transaction was broadcast, but EpitaphAdded is not verified yet. Refresh records before trying again.",
    zh: "交易已广播，但尚未验证 EpitaphAdded。再次尝试前请先刷新记录。",
  },
  epitaphPendingResolution: {
    en: "An epitaph transaction is already awaiting contract readback. Check its status before signing again.",
    zh: "已有墓志铭交易正在等待合约回读，请先检查状态，不要重复签名。",
  },
  epitaphStillPending: {
    en: "The epitaph is not visible in contract state yet. Nothing new was submitted; check again shortly.",
    zh: "合约状态中尚未出现该墓志铭。本次未提交新交易，请稍后再检查。",
  },
  epitaphRecoveryMissing: {
    en: "No pending epitaph is available for this wallet.",
    zh: "当前钱包没有待恢复的墓志铭。",
  },
  epitaphRecoveryReady: {
    en: "Epitaph awaiting confirmation",
    zh: "墓志铭等待确认",
  },
  epitaphRecoveryHint: {
    en: "Memory #{id} was submitted. Read contract state before any new signature.",
    zh: "记忆 #{id} 已提交；再次签名前先读取合约状态。",
  },
  recoverEpitaphAction: { en: "Check status", zh: "检查状态" },
  epitaphPending: { en: "Awaiting epitaph", zh: "等待墓志铭确认" },
  epitaphRecovered: { en: "Epitaph confirmed on-chain", zh: "墓志铭已在链上确认" },
  recoveryStorageUnavailableTitle: { en: "Recovery temporarily unavailable", zh: "恢复记录暂不可用" },
  recoveryStorageUnavailable: {
    en: "Reliable transaction recovery is unavailable. Wallet writes stay disabled until local storage recovers.",
    zh: "可靠的交易恢复记录暂不可用；本地存储恢复前已禁用钱包写入。",
  },
  awaitingChain: { en: "Waiting for wallet and chain", zh: "等待钱包与链上确认" },
  awaitingChainHint: {
    en: "Keep this window open. If the transaction fails, your prepared memory remains available to retry.",
    zh: "请保持窗口开启。若交易失败，已准备的记忆仍会保留，可再次尝试。",
  },
  capsuleCharge: { en: "Memory seal charge", zh: "记忆封印进度" },
  gasReclaimedEstimate: { en: "GAS spent on burials (est.)", zh: "埋葬花费 GAS（估算）" },
  sunkFeeNote: {
    en: "This fee is spent (not refundable) — it pays for the permanent on-chain record. There is no payout or reclaim.",
    zh: "此费用为花费（不可退还）——用于支付永久的链上记录。没有任何回款或取回。",
  },

  // Forget confirmation (paid, 10× the burial fee).
  forgetConfirmFee: {
    en: "Forgetting costs {fee}. This records a paid state change on-chain and cannot be reversed.",
    zh: "遗忘需花费 {fee}。这会在链上记录一次付费状态变更且不可撤销。",
  },
  forgetRitualNote: {
    en: "Forgetting is a deliberate, paid act of letting go — it costs more than burying because the record stays as proof you chose to release it. The fee is spent, not refunded.",
    zh: "遗忘是一次刻意的、付费的放手行为——它的费用高于埋葬，因为记录会被保留，作为你选择释怀的证明。该费用为花费，不予退还。",
  },
  forgetConfirmAction: { en: "Confirm forget", zh: "确认遗忘" },

  // Epitaph uses no app deposit, but the wallet may still charge a Neo network fee.
  epitaph: { en: "Epitaph", zh: "墓志铭" },
  addEpitaph: { en: "Add epitaph", zh: "添加墓志铭" },
  editEpitaph: { en: "Edit epitaph", zh: "编辑墓志铭" },
  epitaphPlaceholder: { en: "A short on-chain note for this memory", zh: "为这段记忆写下简短的链上注记" },
  epitaphSave: { en: "Save epitaph", zh: "保存墓志铭" },
  epitaphSaved: { en: "Epitaph saved on-chain", zh: "墓志铭已上链保存" },
  epitaphRequired: { en: "Enter an epitaph before saving.", zh: "保存前请输入墓志铭。" },
  epitaphTooLong: { en: "Epitaph must be 120 characters or less.", zh: "墓志铭不超过 120 个字符。" },
  epitaphFree: { en: "No app deposit; network fee may apply", zh: "无需应用押金；可能产生网络费" },
  epitaphNetworkFee: {
    en: "No Graveyard deposit is charged. Your wallet may still show a Neo network fee.",
    zh: "Graveyard 不收取应用押金；钱包仍可能显示 Neo 网络费。",
  },

  // History pagination.
  showAllRecords: { en: "Show all records", zh: "显示全部记录" },
  showFewerRecords: { en: "Show fewer", zh: "收起记录" },
  historyTruncatedNote: {
    en: "Showing the most recent {shown} of {total} burials.",
    zh: "显示最近 {shown} 条，共 {total} 条埋葬记录。",
  },
} as const;

export const messages = mergeMessages(appMessages);
