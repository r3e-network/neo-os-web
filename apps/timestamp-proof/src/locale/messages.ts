import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Timestamp Proof", zh: "时间戳证明" },
  proofs: { en: "Proofs", zh: "证明" },
  verify: { en: "Verify", zh: "验证" },

  createProof: { en: "Create Proof", zh: "创建证明" },
  proofWorkspace: { en: "Timestamp proof workspace", zh: "时间戳证明工作台" },
  proofWorkflow: { en: "Proof workflow", zh: "证明流程" },
  proofPrivacy: {
    en: "Your source and certificate stay on this device; only the digest can be published when you anchor.",
    zh: "原文和证书保留在当前设备；只有选择锚定时，摘要才会公开上链。",
  },
  proofStageKicker: { en: "Proof desk", zh: "证明工作台" },
  proofStageTitle: {
    en: "Timestamp proof press",
    zh: "时间戳证明压印台",
  },
  createPanelKicker: { en: "Create", zh: "创建" },
  createPanelTitle: {
    en: "Prepare a timestamp certificate",
    zh: "准备时间戳证书",
  },
  createPanelBody: {
    en: "Place source material on the proof sheet, then seal a local certificate when it looks right.",
    zh: "把原始材料放到证明纸上，确认无误后封存为本地证书。",
  },
  enterContent: { en: "Enter content to timestamp", zh: "输入要时间戳的内容" },
  contentTooLong: { en: "Keep source material under {max} characters or paste its SHA-256 digest instead.", zh: "原始材料请控制在 {max} 个字符以内，或改为粘贴其 SHA-256 摘要。" },
  proofIdExhausted: { en: "The local proof counter reached its safe limit. Export the journal before starting a new one.", zh: "本地证明编号已达到安全上限。请先导出记录，再开始新的记录。" },
  operationInProgress: { en: "Finish the current receipt check or anchor action before changing the proof journal.", zh: "请先完成当前回执检查或锚定操作，再修改证明记录。" },
  createDisabledHint: {
    en: "Add source material when you are ready.",
    zh: "准备好后添加原始材料。",
  },
  contentPlaceholder: {
    en: "Paste your text, document hash, or idea...",
    zh: "粘贴您的文本、文档哈希或想法...",
  },
  documentPreviewLabel: { en: "Certificate preview", zh: "证书预览" },
  proofSheetLabel: { en: "Proof sheet", zh: "证明纸" },
  documentPreviewEmptyTitle: { en: "Ready for content", zh: "等待内容" },
  documentPreviewEmpty: {
    en: "Your proof preview will appear here as soon as you add content.",
    zh: "输入内容后，这里会实时显示证明预览。",
  },
  proofPressLabel: { en: "Animated proof press", zh: "动态证明压印台" },
  proofPressKicker: { en: "Document fingerprint", zh: "文档指纹" },
  proofPressEmptyTitle: {
    en: "Proof press standing by.",
    zh: "证明压印台待命中。",
  },
  proofPressEmptyBody: {
    en: "Nothing leaves this device. The sheet becomes a local certificate only when you seal it.",
    zh: "内容不会离开本设备。只有封存后，纸张才会成为本地证书。",
  },
  proofPressReadyTitle: {
    en: "Fingerprint queued. Review the sheet, then seal the proof.",
    zh: "指纹已排队。核对文档卡片后即可封存证明。",
  },
  proofPressReadyBody: {
    en: "One tap hashes the content on this device and saves a timestamp certificate.",
    zh: "点击后将在本设备计算哈希，并保存一张时间戳证书。",
  },
  proofPressStampingTitle: {
    en: "Stamping the local certificate.",
    zh: "正在压印本地证书。",
  },
  proofPressStampingBody: {
    en: "The source stays private while the digest is sealed into your local journal.",
    zh: "原文保持私密，仅将摘要封存进本地证明记录。",
  },
  proofPressRailLabel: { en: "Proof press status", zh: "证明压印状态" },
  proofDeskAlt: { en: "Timestamp proof desk with a sealed certificate", zh: "带有封存证书的时间戳证明工作台" },
  proofPressAnchorLocal: { en: "Local rail", zh: "本地轨道" },
  proofPressAnchorAnchoring: { en: "Anchoring", zh: "锚定中" },
  proofPressAnchorAnchored: { en: "On-chain", zh: "已上链" },
  documentTypeHash: { en: "SHA-256 digest", zh: "SHA-256 摘要" },
  documentTypeText: { en: "Source content", zh: "原始内容" },
  digestPassThrough: {
    en: "Use this digest directly",
    zh: "直接使用该摘要",
  },
  localHashPending: {
    en: "Will hash locally on save",
    zh: "保存时本地计算哈希",
  },
  contentChars: { en: "Characters", zh: "字符数" },
  pendingDigest: { en: "After save", zh: "保存后生成" },
  proofRouteLabel: { en: "Proof route", zh: "证明路径" },
  proofRouteHash: { en: "Local hash", zh: "本地哈希" },
  proofRouteSave: { en: "Device proof", zh: "设备证明" },
  proofRouteAnchor: { en: "Public anchor", zh: "公开锚定" },
  proofRouteReady: { en: "Ready", zh: "就绪" },
  proofRouteWaiting: { en: "Waiting", zh: "等待内容" },
  proofTemplatesLabel: { en: "Proof templates", zh: "证明模板" },
  proofTemplateRelease: { en: "Release note", zh: "发布记录" },
  proofTemplateReleaseBody: {
    en: "Version or artifact note",
    zh: "版本或产物说明",
  },
  proofTemplateAudit: { en: "Audit seal", zh: "审计封存" },
  proofTemplateAuditBody: {
    en: "Review result or report",
    zh: "评审结果或报告",
  },
  proofTemplateDigest: { en: "Known digest", zh: "已有摘要" },
  proofTemplateDigestBody: {
    en: "Paste a SHA-256 hash",
    zh: "粘贴 SHA-256 哈希",
  },
  createSuccess: {
    en: "Proof saved to this device.",
    zh: "证明已保存到当前设备。",
  },
  localSaveFailed: {
    en: "This device could not save the proof. Your draft is still here; free storage or allow local storage, then try again.",
    zh: "当前设备无法保存证明。草稿仍在，请释放存储空间或允许本地存储后重试。",
  },
  journalUnavailableTitle: { en: "Proof journal unavailable", zh: "证明记录暂不可用" },
  journalUnavailableShort: { en: "Journal unavailable — records are not shown as empty", zh: "记录不可用，不会显示为 0 条" },
  journalUnavailable: {
    en: "The browser could not read and write the proof journal. Existing records are hidden, not deleted; restore local storage access and retry.",
    zh: "浏览器无法读写证明记录。已有记录只是暂时隐藏，并未删除；请恢复本地存储访问后重试。",
  },
  journalCorruptTitle: { en: "Proof journal needs recovery", zh: "证明记录需要恢复" },
  journalCorrupt: {
    en: "The saved journal is not a valid proof list. It has not been overwritten. Export or repair browser storage before creating another proof.",
    zh: "已保存的记录不是有效证明列表，应用没有覆盖它。请先导出或修复浏览器存储，再创建新证明。",
  },
  retryJournal: { en: "Retry journal", zh: "重试读取" },
  proofId: { en: "Proof ID", zh: "证明ID" },
  timestamp: { en: "Timestamp", zh: "时间戳" },

  // On-chain anchoring — publish the digest + time so a third party can verify.
  anchorStatus: { en: "Status", zh: "状态" },
  anchorOnChain: { en: "Anchor on-chain", zh: "上链锚定" },
  anchorShort: { en: "Anchor", zh: "锚定" },
  anchoredOnChain: { en: "Anchored on-chain", zh: "已上链锚定" },
  localOnly: { en: "Local only", zh: "仅本地" },
  anchorTxid: { en: "Anchor transaction", zh: "锚定交易" },
  viewOnExplorer: { en: "View on explorer", zh: "在区块浏览器查看" },
  proofAnchored: { en: "Proof anchored on-chain", zh: "证明已上链锚定" },
  anchorFailed: { en: "Anchoring failed", zh: "锚定失败" },
  alreadyAnchored: { en: "Proof is already anchored", zh: "证明已锚定" },
  broadcastPending: { en: "Broadcast pending", zh: "已广播，待确认" },
  anchorBroadcastPendingTitle: { en: "Receipt saved. Waiting for chain confirmation.", zh: "交易回执已保存，正在等待链上确认。" },
  anchorBroadcastPending: {
    en: "Transaction broadcast. It is saved as pending until the exact HALT receipt, zero-GAS self-transfer, and digest marker are verified.",
    zh: "交易已广播。确认精确的 HALT 回执、0 GAS 自转账和摘要标记前，将保持待确认状态。",
  },
  anchorStillPending: { en: "The anchor is still pending", zh: "锚定仍待确认" },
  noPendingAnchors: { en: "There are no pending anchor receipts to check", zh: "当前没有待检查的锚定回执" },
  anchorRecovered: { en: "Pending anchor confirmed on-chain", zh: "待确认锚定已完成链上核验" },
  anchorPendingGuidance: {
    en: "Do not submit it again. Check the saved receipt after the next block; a txid alone is not confirmation.",
    zh: "请勿重复提交。下一个区块后检查已保存回执；仅有交易 ID 不代表确认成功。",
  },
  anchorFault: { en: "The anchor transaction FAULTed and was not accepted as proof", zh: "锚定交易执行 FAULT，未被认定为链上证明" },
  anchorFaultTitle: { en: "Anchor failed on-chain.", zh: "锚定在链上执行失败。" },
  anchorFaultShort: { en: "Chain fault", zh: "链上失败" },
  anchorMismatch: { en: "The transaction does not match this proof, network, wallet, or digest", zh: "交易与该证明、网络、钱包或摘要不匹配" },
  anchorRpcUnavailable: { en: "The chain receipt is temporarily unavailable. The transaction is not marked confirmed.", zh: "链上回执暂时不可用，该交易不会被标记为已确认。" },
  anchorNoReceipt: { en: "The wallet call finished without a valid transaction ID. Submission is locked; review wallet history before clearing the retry lock.", zh: "钱包调用结束但未返回有效交易 ID。提交已锁定；请先检查钱包历史，再清除重试锁。" },
  anchorReceiptNotSaved: {
    en: "Transaction {txid} was broadcast, but this device could not save its recovery receipt. Copy the txid before leaving.",
    zh: "交易 {txid} 已广播，但当前设备无法保存恢复回执。离开前请复制交易 ID。",
  },
  anchorReceiptMemoryOnly: {
    en: "Receipt {txid} is available only in this open session. Copy it now; do not submit again.",
    zh: "回执 {txid} 仅保存在当前打开的会话中。请立即复制，且不要重复提交。",
  },
  copyReceipt: { en: "Copy receipt", zh: "复制回执" },
  receiptCopied: { en: "Transaction receipt copied", zh: "交易回执已复制" },
  anchorPreparationTitle: { en: "Wallet submission needs review.", zh: "钱包提交需要核对。" },
  anchorPreparationInterrupted: {
    en: "A previous wallet submission ended before a transaction ID was safely recorded. Review wallet history before clearing the retry lock.",
    zh: "上一次钱包提交在安全记录交易 ID 前中断。请先检查钱包历史，再清除重试锁。",
  },
  anchorPreparationGuidance: {
    en: "Do not submit again yet. Check wallet history for a matching transaction; clear the retry lock only when no transaction was sent.",
    zh: "请暂勿重复提交。先在钱包历史中检查匹配交易；只有确认没有发出交易时，才能清除重试锁。",
  },
  submissionInterrupted: { en: "Submission interrupted", zh: "提交已中断" },
  clearRetryLock: { en: "Clear retry lock", zh: "清除重试锁" },
  anchorRetryLockCleared: { en: "Retry lock cleared. You can submit a new anchor.", zh: "重试锁已清除，现在可以重新提交锚定。" },
  unsupportedAnchorNetwork: {
    en: "Switch the wallet to Neo N3 Mainnet or Testnet before anchoring.",
    zh: "锚定前请将钱包切换至 Neo N3 主网或测试网。",
  },
  connectWalletToAnchor: {
    en: "Connect a wallet to anchor on-chain",
    zh: "连接钱包以上链锚定",
  },
  walletChangedBeforeAnchor: {
    en: "The wallet account changed while the anchor was being prepared. Review the account and try again.",
    zh: "准备锚定时钱包账户发生变化，请核对账户后重试。",
  },
  anchorCostNote: {
    en: "Anchoring writes the digest into a public Neo transaction (small network fee). Local proofs stay private and free.",
    zh: "锚定会将摘要写入一笔公开的 Neo 交易（仅需少量网络费）。本地证明则保持私密且免费。",
  },
  checkReceipt: { en: "Check receipt", zh: "检查回执" },
  checkingReceipt: { en: "Checking…", zh: "检查中…" },
  optional: { en: "Optional", zh: "可选" },
  networkMainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  networkTestnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  networkNotConnected: { en: "Wallet network not connected", zh: "钱包网络未连接" },
  verificationNetwork: { en: "Receipt network", zh: "回执网络" },
  verificationNetworkRequired: { en: "Choose the Neo N3 network that contains this transaction", zh: "请选择包含该交易的 Neo N3 网络" },
  verificationTruth: {
    en: "ID, digest, and content search only this device. A txid or anchored JSON reference runs an independent chain receipt check.",
    zh: "编号、摘要和原文只查询当前设备；交易 ID 或已锚定的 JSON 引用会执行独立链上回执核验。",
  },
  howToVerifyTitle: { en: "How to verify on-chain", zh: "如何在链上核验" },
  howToVerifyBody: {
    en: "Verify the receipt on the recorded network. A valid anchor must HALT, emit the exact zero-GAS self-transfer, and contain timestamp-proof:<digest> in its raw transaction script. The confirmed block time is the public proof time.",
    zh: "请在记录的网络上核验回执。有效锚定必须以 HALT 执行、发出精确的 0 GAS 自转账，并在原始交易脚本中包含 timestamp-proof:<摘要>；确认区块时间即公开证明时间。",
  },

  verifyProof: { en: "Verify Proof", zh: "验证证明" },
  verifyPanelKicker: { en: "Verify", zh: "核验" },
  verifyPanelTitle: { en: "Inspect an existing proof", zh: "核验已有证明" },
  verifyPanelBody: {
    en: "Search by proof ID, SHA-256 digest, or original content to confirm the saved timestamp and anchor status.",
    zh: "通过证明编号、SHA-256 摘要或原文查询，确认保存时间与锚定状态。",
  },
  proofLookup: { en: "Proof lookup", zh: "证明查询" },
  verifyPlaceholder: {
    en: "Local ID, digest, original content, JSON reference, or txid",
    zh: "本机编号、摘要、原文、JSON 引用或交易 ID",
  },
  verifying: { en: "Verifying...", zh: "验证中..." },
  verifyEmpty: { en: "No proof selected", zh: "未选择证明" },
  validProof: { en: "Proof Found", zh: "已找到证明" },
  invalidProof: { en: "Invalid Proof", zh: "无效证明" },
  contentPreview: { en: "Content preview", zh: "内容预览" },
  proofDigest: { en: "SHA-256 digest", zh: "SHA-256 摘要" },
  verifyFailed: { en: "Verification failed", zh: "验证失败" },
  localProofFound: { en: "Device-local proof found", zh: "已找到本机证明记录" },
  chainProofVerified: { en: "On-chain anchor verified", zh: "链上锚定已核验" },
  deviceRecordOnly: { en: "Device record only", zh: "仅本机记录" },
  referenceOnly: { en: "Reference inspected", zh: "引用已检查" },
  referenceInspected: { en: "Local reference parsed; it is not public timestamp evidence", zh: "本地引用已解析，但它不是公开时间戳证据" },
  referenceInspectedTitle: { en: "Reference opened — local claim only.", zh: "引用已打开，仅代表本地声明。" },
  referenceBoundary: {
    en: "The JSON structure and digest are valid, but an unanchored reference cannot prove its claimed time outside the device that created it.",
    zh: "JSON 结构和摘要有效，但未锚定引用无法在创建它的设备之外证明其所声明的时间。",
  },
  chainVerified: { en: "Chain verified", zh: "链上已核验" },
  chainVerifiedBody: { en: "The exact network receipt, zero-GAS self-transfer, digest marker, and block time all match.", zh: "精确网络回执、0 GAS 自转账、摘要标记和区块时间均已匹配。" },
  chainReadUnavailable: { en: "Chain read unavailable", zh: "链上读取不可用" },
  chainReadUnavailableTitle: { en: "Receipt could not be read yet.", zh: "暂时无法读取回执。" },
  chainVerificationFailed: { en: "Chain verification failed", zh: "链上核验失败" },

  recentProofs: { en: "Recent Proofs", zh: "最近证明" },
  noProofs: { en: "No proofs yet", zh: "暂无证明" },
  noProofsHint: {
    en: "Saved proof entries will appear here.",
    zh: "已保存的证明记录会显示在这里。",
  },
  proofJournalSummary: {
    en: "{count} saved · {pending} pending receipts",
    zh: "已保存 {count} 条 · {pending} 条回执待确认",
  },

  copyDigest: { en: "Copy digest", zh: "复制摘要" },
  copyReference: { en: "Copy proof reference", zh: "复制证明引用" },
  deleteProof: { en: "Delete proof", zh: "删除证明" },
  clearAllProofs: { en: "Clear all", zh: "清除全部" },

  digestCopied: { en: "Digest copied", zh: "已复制摘要" },
  referenceCopied: { en: "Reference copied", zh: "已复制引用" },
  proofDeleted: { en: "Proof deleted", zh: "证明已删除" },
  proofsCleared: { en: "Proofs cleared", zh: "证明已清除" },
  pendingProofDeleteBlocked: { en: "Keep this proof until its wallet submission or receipt is resolved.", zh: "钱包提交或回执解决前，请保留这条证明。" },
  pendingProofsClearBlocked: { en: "Resolve every interrupted or pending anchor before clearing the journal.", zh: "清空记录前，请先解决所有中断或待确认的锚定。" },
  error: { en: "Something went wrong", zh: "出现错误" },

  docSubtitle: {
    en: "SHA-256 proof journal with optional on-chain anchor",
    zh: "SHA-256 证明记录，可选上链锚定",
  },
  docDescription: {
    en: "Create SHA-256 proof entries locally, then optionally anchor a proof on Neo N3 (a 0-GAS self-transfer that embeds the digest) so a third party can verify the digest and time on-chain.",
    zh: "在本地创建 SHA-256 证明记录，并可选择将证明锚定到 Neo N3（一笔携带摘要的 0 GAS 自转账），以便第三方在链上核验摘要与时间。",
  },
  step1: {
    en: "Enter your content or document hash",
    zh: "输入您的内容或文档哈希",
  },
  step2: { en: "Hash it locally in the browser", zh: "在浏览器本地计算哈希" },
  step3: {
    en: "Optionally anchor the proof on-chain for third-party verification",
    zh: "可选地将证明上链锚定，供第三方核验",
  },
  step4: {
    en: "Re-open and verify the proof by ID anytime",
    zh: "随时按编号重新验证该证明",
  },

  feature1Name: { en: "Local Certificates", zh: "本地证明条目" },
  feature1Desc: {
    en: "Each proof is saved in local browser storage with a deterministic SHA-256 hash",
    zh: "每条证明都会以确定性的 SHA-256 哈希保存在浏览器本地存储中",
  },
  feature2Name: { en: "Instant Verification", zh: "即时验证" },
  feature2Desc: {
    en: "Look up any saved proof by ID without waiting for a contract call",
    zh: "无需等待合约调用，直接按编号查询已保存证明",
  },
  feature3Name: { en: "Universal Hashing", zh: "通用哈希" },
  feature3Desc: {
    en: "Works with text, notes, hashes, drafts, and any other short-form content",
    zh: "适用于文本、备注、哈希、草稿及其他短内容",
  },

  proofStats: { en: "Proof Stats", zh: "证明统计" },
  totalProofs: { en: "Total Proofs", zh: "总证明数" },
  anchoredProofs: { en: "Anchored", zh: "已锚定" },
  latestId: { en: "Latest ID", zh: "最新编号" },
  // Honest zero-state for the LATEST ID chip before the first proof is saved.
  // This is a normal pre-data first paint, not an unavailable value, so it must
  // not borrow the shared "N/A" placeholder.
  latestIdNone: { en: "None yet", zh: "尚无" },
} as const;

export const messages = mergeMessages(appMessages);
