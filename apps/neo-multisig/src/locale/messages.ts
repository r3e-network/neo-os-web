import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "App", zh: "应用" },
  appTitle: {
    en: "Neo Multisig",
    zh: "Neo 多重签名",
  },
  appSubtitle: {
    en: "Shared on-chain custody, released at the configured approval threshold.",
    zh: "链上共管金库，达到设定批准阈值后放行。",
  },
  tabHome: { en: "Home", zh: "首页" },
  tabDocs: { en: "Docs", zh: "文档" },
  walletRequired: { en: "Connect a wallet to continue.", zh: "请先连接钱包。" },

  homeTitle: {
    en: "On-chain custody without the chaos.",
    zh: "链上托管，告别混乱。",
  },
  homeSubtitle: {
    en: "Create a custody vault, deposit funds, propose a spend, and release it once enough signers approve.",
    zh: "创建共管金库，存入资金，发起支出，达到签名阈值后由合约放行。",
  },
  multisigHeroEyebrow: { en: "On-chain custody", zh: "链上托管" },
  multisigHeroTitle: { en: "Multisig Custody Vault", zh: "多签托管金库" },
  multisigHeroSubtitle: {
    en: "Deposit GAS or NEO into a shared vault, propose a spend, and let the contract release funds once the approval threshold is met.",
    zh: "将 GAS 或 NEO 存入共管金库，发起支出请求，达到批准阈值后由合约自动放行。",
  },
  multisigHeroSnapshot: { en: "Vault snapshot", zh: "金库快照" },
  multisigBoardTitle: { en: "Signer board", zh: "签名人看板" },
  multisigSignerApproved: { en: "Approved", zh: "已批准" },
  multisigSignerWaiting: { en: "Waiting", zh: "待签署" },
  multisigSignerMember: { en: "Member", zh: "成员" },
  multisigSignerDraft: { en: "Ready", zh: "已填写" },
  multisigProposalPreview: { en: "Proposal docket", zh: "提案单" },
  multisigVaultStageAlt: {
    en: "Bright shared-custody vault with three signer keys",
    zh: "带有三把签名人钥匙的明亮共管金库",
  },
  multisigProposalStageAlt: {
    en: "Spend proposal card with a payment route and approval seals",
    zh: "带支付路径和批准印章的支出提案卡",
  },
  multisigApprovalBoard: { en: "Approval board", zh: "批准看板" },
  multisigAmountPreview: { en: "Amount to release", zh: "待放行金额" },
  multisigRecipientPreview: { en: "Recipient pending", zh: "待填写接收方" },
  // Docket zero-state. `multisigAmountPreview` above is a field label and still
  // labels that field in the propose-spend form; these two are the docket's
  // honest first-run *values*, for when no vault (and so no proposal) exists.
  multisigProposalNone: { en: "No proposal yet", zh: "暂无提案" },
  multisigProposalNoneHint: {
    en: "Create a vault, then propose a spend to open a docket.",
    zh: "先创建金库，再发起支出提案即可开单。",
  },

  multisigVaultTitle: { en: "Custody vault", zh: "共管金库" },
  multisigVaultCopy: {
    en: "Enter 2–16 signer addresses and a threshold to deploy a shared custody vault on-chain.",
    zh: "输入 2–16 个签名人地址和阈值，在链上创建共管金库。",
  },
  multisigStepCreate: { en: "Step 1", zh: "步骤 1" },
  multisigStepDeposit: { en: "Step 2", zh: "步骤 2" },
  multisigStepPropose: { en: "Step 3", zh: "步骤 3" },
  multisigDepositTitle: { en: "Deposit funds", zh: "存入资金" },
  multisigDepositCopy: {
    en: "Send GAS or NEO into the vault. The transfer credits the vault balance directly.",
    zh: "向金库转入 GAS 或 NEO，转账金额会直接计入金库余额。",
  },
  multisigProposeTitle: { en: "Propose a spend", zh: "发起支出" },
  multisigProposeCopy: {
    en: "Create a spend request from the vault. Signers approve it until the threshold releases the funds.",
    zh: "从金库发起支出请求，签名人逐一批准，达到阈值后释放资金。",
  },

  multisigDraftState: { en: "—", zh: "—" },
  multisigRouteTitle: { en: "Execution route", zh: "执行路径" },
  multisigRouteCopy: {
    en: "Create a vault, deposit funds, propose a spend, then collect approvals until the contract releases it.",
    zh: "创建金库、存入资金、发起支出，收集批准直至合约自动放行。",
  },
  multisigSignerTitle: { en: "Vault overview", zh: "金库概览" },
  multisigSignerCopy: {
    en: "Only listed signer addresses can approve a spend. The contract releases funds at the threshold.",
    zh: "只有列表中的签名人地址可批准支出，合约在达到阈值时放行资金。",
  },
  multisigSignerList: { en: "Signers", zh: "签名人" },
  multisigQuorumTitle: { en: "Threshold", zh: "签名阈值" },
  multisigBalanceTitle: { en: "Vault balance", zh: "金库余额" },
  multisigRequestStatusTitle: { en: "Request", zh: "支出请求" },
  multisigNetworkValue: { en: "Neo N3", zh: "Neo N3" },
  multisigRouteCreate: { en: "Create vault", zh: "创建金库" },
  multisigRouteSign: { en: "Propose spend", zh: "发起支出" },
  multisigRouteBroadcast: { en: "Approve & release", zh: "批准放行" },

  // The full instruction, for the signer-summary chip.
  multisigNeedSigners: {
    en: "Add at least two signer addresses before creating a vault.",
    zh: "至少添加两个签名人地址后才能创建金库。",
  },
  // The roster's own empty state. It sits ~40px under the chip above, so it
  // describes the empty list rather than repeating that instruction verbatim.
  multisigNoSignersYet: {
    en: "No signer addresses yet",
    zh: "尚未添加签名人地址",
  },
  // Zero-state for the vault balance tiles before a vault is loaded. Replaces a
  // bare em-dash, which read as broken data instead of "nothing to read yet".
  multisigBalanceIdle: {
    en: "Load a vault",
    zh: "加载金库",
  },
  multisigTooManySigners: {
    en: "A vault supports at most 16 signer addresses.",
    zh: "金库最多支持 16 个签名人地址。",
  },
  multisigInvalidSignerAddress: {
    en: "Each signer must be a valid Neo N3 address.",
    zh: "每个签名人必须是有效的 Neo N3 地址。",
  },
  multisigDuplicateSigners: {
    en: "Signer addresses must be distinct.",
    zh: "签名人地址不能重复。",
  },
  multisigThresholdBlocked: {
    en: "Threshold cannot be greater than the number of signers.",
    zh: "签名阈值不能大于签名人数量。",
  },
  multisigCreateReady: {
    en: "Ready to deploy an on-chain custody vault.",
    zh: "已准备好在链上创建共管金库。",
  },
  multisigInsufficientBalance: {
    en: "Amount exceeds the vault balance ({balance} {asset} available).",
    zh: "金额超出金库余额（可用 {balance} {asset}）。",
  },
  multisigVaultIdLabel: { en: "Vault ID", zh: "金库 ID" },
  multisigVaultReceiptCopy: {
    en: "Share this vault ID so signers can deposit and approve spend requests.",
    zh: "分享此金库 ID，签名人可据此存入资金并批准支出请求。",
  },
  multisigVaultBadge: { en: "Vault", zh: "金库" },

  statPending: { en: "Pending", zh: "待批准" },
  statCompleted: { en: "Executed", zh: "已执行" },
  multisigLoadTitle: { en: "Load vault or request", zh: "加载金库或请求" },
  multisigLoadCopy: {
    en: "Have a vault or request ID? Load it to deposit, propose, or approve.",
    zh: "已有金库或请求 ID？加载后即可存入、发起或批准。",
  },
  loadVaultTitle: { en: "Load vault", zh: "加载金库" },
  loadVaultPlaceholder: { en: "Vault ID", zh: "金库 ID" },
  loadRequestTitle: { en: "Load request", zh: "加载请求" },
  loadRequestPlaceholder: { en: "Request ID", zh: "请求 ID" },
  loadButton: { en: "Load", zh: "加载" },
  recentTitle: { en: "Recent Activity", zh: "最近记录" },
  recentEmpty: { en: "No vaults or requests yet.", zh: "暂无金库或请求。" },

  signerLabel: { en: "Signer Address", zh: "签名人地址" },
  signerPlaceholder: { en: "Neo N3 address (N...)", zh: "Neo N3 地址（N...）" },
  thresholdLabel: { en: "Approval Threshold", zh: "批准阈值" },
  assetLabel: { en: "Asset", zh: "资产" },
  assetGas: { en: "GAS", zh: "GAS" },
  assetNeo: { en: "NEO", zh: "NEO" },
  multisigGasAssetHint: { en: "Fee token, 8 decimals", zh: "手续费资产，8 位小数" },
  multisigNeoAssetHint: { en: "Whole-token custody", zh: "整数单位托管" },
  multisigDepositVaultTarget: { en: "Deposit target", zh: "存入目标" },
  multisigRecipientTicket: { en: "Recipient", zh: "接收方" },
  multisigDepositAmountControl: { en: "Deposit amount", zh: "存入数量" },
  multisigSpendAmountControl: { en: "Spend amount", zh: "支出数量" },
  multisigDecreaseAmount: { en: "Decrease amount", zh: "减少数量" },
  multisigIncreaseAmount: { en: "Increase amount", zh: "增加数量" },
  multisigQuickAmount: { en: "Quick amounts", zh: "快捷数量" },
  multisigUseVaultBalance: { en: "Max", zh: "最大" },
  multisigDepositAmountHint: {
    en: "Paid from the connected wallet into this vault.",
    zh: "从已连接钱包存入此金库。",
  },
  multisigSpendAmountHint: {
    en: "{balance} {asset} in this vault before pending requests.",
    zh: "此金库当前有 {balance} {asset}，不含待处理请求预留。",
  },
  toAddressLabel: { en: "Recipient Address", zh: "接收地址" },
  toAddressPlaceholder: { en: "N3 address", zh: "N3 地址" },
  amountLabel: { en: "Amount", zh: "数量" },
  amountPlaceholder: { en: "0.00", zh: "0.00" },
  multisigMemoDetails: { en: "Signer note / memo", zh: "签名人备注 / Memo" },
  memoLabel: { en: "Memo (optional)", zh: "备注（可选）" },
  memoPlaceholder: { en: "Short note for signers", zh: "给签名人的备注" },

  reviewTo: { en: "To", zh: "目标" },
  reviewAmount: { en: "Amount", zh: "数量" },
  reviewSigners: { en: "Signers", zh: "签名人" },

  buttonCreateVault: { en: "Create Vault", zh: "创建金库" },
  buttonDeposit: { en: "Deposit", zh: "存入" },
  buttonPropose: { en: "Propose Spend", zh: "发起支出" },
  buttonApprove: { en: "Approve", zh: "批准" },
  buttonApproving: { en: "Approving...", zh: "批准中..." },
  buttonCancel: { en: "Cancel", zh: "取消" },
  buttonCancelling: { en: "Cancelling...", zh: "取消中..." },

  statusLabel: { en: "Status", zh: "状态" },
  statusPending: { en: "Pending", zh: "待批准" },
  statusExecuted: { en: "Executed", zh: "已执行" },
  statusCancelled: { en: "Cancelled", zh: "已取消" },
  statusUnknown: { en: "Unknown", zh: "未知" },
  approvalProgress: {
    en: "{count} / {total} approvals collected",
    zh: "已收集 {count} / {total} 个批准",
  },

  vaultHistoryLabel: {
    en: "Vault #{id} · {threshold}/{signers}",
    zh: "金库 #{id} · {threshold}/{signers}",
  },
  requestHistoryLabel: {
    en: "#{id} · {amount} {asset}",
    zh: "#{id} · {amount} {asset}",
  },

  // ── Signer roster + request-id surfaces ──────────────────────────────────
  multisigSignerRoster: { en: "Signer roster", zh: "签名人名单" },
  multisigYouBadge: { en: "You", zh: "你" },
  multisigRequestIdLabel: { en: "Request ID", zh: "请求 ID" },
  multisigCopy: { en: "Copy", zh: "复制" },
  multisigCopied: { en: "Copied", zh: "已复制" },
  multisigShareRequestId: {
    en: "Share this request ID with the other signers so they can load and approve it.",
    zh: "把此请求 ID 分享给其他签名人，便于他们加载并批准。",
  },
  // ── Approve / cancel membership gating ───────────────────────────────────
  multisigNotSignerHint: {
    en: "Only the vault's signer addresses can approve or cancel this request.",
    zh: "只有金库的签名人地址才能批准或取消此请求。",
  },
  multisigAlreadyApprovedHint: {
    en: "You have already approved this request.",
    zh: "你已批准此请求。",
  },
  multisigApprovalUnavailable: {
    en: "Approval state could not be verified. Approving stays disabled until the chain read recovers.",
    zh: "暂时无法验证批准状态，链上读取恢复前不会启用批准操作。",
  },
  // ── Connected wallet + dynamic signer slots ──────────────────────────────
  multisigConnectedAs: { en: "Connected as", zh: "已连接" },
  multisigNotConnected: { en: "Connect a wallet to create or sign", zh: "连接钱包以创建或签名" },
  multisigAddSigner: { en: "+ Add signer", zh: "+ 添加签名人" },
  multisigRemoveSigner: { en: "Remove signer", zh: "移除签名人" },
  multisigApprovalPolicy: { en: "approval policy", zh: "批准策略" },
  multisigContractCustody: { en: "Contract custody", zh: "合约托管" },
  multisigOpenSpendTools: { en: "Open spend tools", zh: "打开支出工具" },
  multisigVaultTools: { en: "Vault tools", zh: "金库工具" },
  multisigLowThresholdWarning: {
    en: "A 1-of-N policy gives any one signer full release authority. Use it only when that is intentional.",
    zh: "1-of-N 允许任一签名人独立放行资金，仅在明确需要时使用。",
  },
  multisigCustodyBoundary: {
    en: "This is a contract-custody vault, not a native Neo multisig address. All vaults use the canonical contract address and are separated by vault ID.",
    zh: "这是合约托管金库，不是 Neo 原生多签地址。所有金库共用规范合约地址，并由金库 ID 隔离。",
  },
  multisigDataUnavailable: {
    en: "Some chain state could not be verified. Writes stay disabled until the relevant reads recover.",
    zh: "部分链上状态暂时无法验证，相关读取恢复前不会开放写操作。",
  },
  multisigRecoveryTitle: { en: "Transaction confirmation", zh: "交易确认" },
  multisigTransactionPending: {
    en: "Broadcast received. Waiting for the exact contract event and readback before reporting success.",
    zh: "交易已广播，确认精确合约事件并回读链上状态后才会报告成功。",
  },
  multisigRecover: { en: "Check transaction", zh: "检查交易" },
  multisigRecovering: { en: "Checking…", zh: "检查中…" },

  toastInvalidSigners: { en: "Invalid signer set.", zh: "签名人列表无效。" },
  toastInvalidAddress: { en: "Invalid address.", zh: "地址无效。" },
  toastInvalidAmount: { en: "Invalid amount.", zh: "数量无效。" },
  toastNoVault: { en: "Enter or load a vault first.", zh: "请先输入或加载金库。" },
  toastNoRequest: { en: "Missing request ID.", zh: "缺少请求 ID。" },
  toastVaultCreated: { en: "Vault #{id} created.", zh: "金库 #{id} 已创建。" },
  toastVaultFailed: { en: "Failed to create vault.", zh: "创建金库失败。" },
  toastVaultLoaded: { en: "Vault #{id} loaded.", zh: "金库 #{id} 已加载。" },
  toastVaultNotFound: { en: "Vault #{id} not found.", zh: "未找到金库 #{id}。" },
  toastDeposited: { en: "Deposited {amount} {asset}.", zh: "已存入 {amount} {asset}。" },
  toastDepositFailed: { en: "Deposit failed.", zh: "存入失败。" },
  toastRequestCreated: { en: "Request #{id} created.", zh: "请求 #{id} 已创建。" },
  toastCreateFailed: { en: "Failed to create request.", zh: "创建请求失败。" },
  toastRequestLoaded: { en: "Request #{id} loaded.", zh: "请求 #{id} 已加载。" },
  toastRequestNotFound: { en: "Request #{id} not found.", zh: "未找到请求 #{id}。" },
  toastApproved: { en: "Approval submitted.", zh: "批准已提交。" },
  toastApproveFailed: { en: "Approval failed.", zh: "批准失败。" },
  toastRequestExecuted: { en: "Threshold met — funds released.", zh: "达到阈值，资金已放行。" },
  toastCancelled: { en: "Request cancelled.", zh: "请求已取消。" },
  toastCancelFailed: { en: "Cancel failed.", zh: "取消失败。" },
  // v2: a threshold approval that finds the vault underfunded AUTO-CANCELS the
  // request (RequestUnfunded event) — explain it instead of a generic cancel.
  toastRequestUnfunded: {
    en: "Vault underfunded — request auto-cancelled (needs {required} {asset}, vault holds {available}).",
    zh: "金库余额不足 —— 请求已自动取消（需要 {required} {asset}，金库仅有 {available}）。",
  },
  toastRequestUnfundedShort: {
    en: "Request auto-cancelled — the vault balance no longer covers it.",
    zh: "请求已自动取消 —— 金库余额已不足以支付。",
  },
  multisigUnfundedNotice: {
    en: "Auto-cancelled at threshold: the vault was underfunded (needed {required} {asset}, held {available}). Deposit again, then propose a new request.",
    zh: "达到阈值时金库余额不足，已自动取消（需要 {required} {asset}，仅有 {available}）。请先补充存入，再重新发起请求。",
  },
  // Pooled-balance disclosure: proposing does NOT escrow/earmark funds — the
  // vault balance is shared across all pending requests until one reaches its
  // threshold and debits, so two pending proposals can collide.
  multisigPooledBalanceNote: {
    en: "Vault balance is shared across all pending requests — funds aren't reserved until a request reaches its threshold, so an approved request can still auto-cancel if another spent the balance first.",
    zh: "金库余额由所有待处理请求共享——在请求达到阈值前不会预留资金，因此若另一请求先行支出，已批准的请求仍可能自动取消。",
  },
  toastLoadFailed: { en: "Failed to load.", zh: "加载失败。" },

  multisigChainContextMismatch: {
    en: "Wallet network or contract address does not match this miniapp's canonical deployment.",
    zh: "钱包网络或合约地址与此小程序的规范部署不匹配。",
  },
  multisigPendingBlocksWrites: {
    en: "Resolve the pending transaction before starting another write.",
    zh: "请先确认当前待处理交易，再发起新的写操作。",
  },
  multisigEventMismatch: {
    en: "The confirmed contract event does not match the requested operation.",
    zh: "已确认的合约事件与本次操作不匹配。",
  },
  multisigReadbackMismatch: {
    en: "The chain readback does not match the confirmed event.",
    zh: "链上回读状态与已确认事件不匹配。",
  },
  multisigCreatorMustBeSigner: {
    en: "The connected wallet must be included in the signer set.",
    zh: "已连接钱包必须包含在签名人列表中。",
  },
  multisigRequestNotPending: {
    en: "This request is no longer pending and cannot be changed.",
    zh: "该请求已不再处于待处理状态，无法继续修改。",
  },
  multisigPendingInvalid: {
    en: "The saved pending transaction was invalid and has been cleared.",
    zh: "保存的待处理交易无效，已清除。",
  },
  multisigPendingContextMismatch: {
    en: "Reconnect the same wallet and network used to submit this transaction.",
    zh: "请连接提交该交易时使用的同一钱包和网络。",
  },
  multisigTransactionFault: {
    en: "The transaction faulted on-chain. No success state was recorded.",
    zh: "交易在链上执行失败，未记录成功状态。",
  },
  multisigTransactionRecovered: {
    en: "Transaction confirmed from the exact contract event and chain readback.",
    zh: "已通过精确合约事件和链上回读确认交易。",
  },

  docTitle: { en: "Neo Multisig", zh: "Neo 多重签名" },
  docSubtitle: { en: "On-chain custody vault", zh: "链上共管金库" },
  docDescription: {
    en: "Neo Multisig is a contract-custody vault, not a native Neo multisig address. Create a vault from signer addresses, deposit GAS or NEO, and release a spend when its approval threshold is reached.",
    zh: "Neo 多重签名是合约托管金库，并非 Neo 原生多签地址。用签名人地址创建金库、存入 GAS 或 NEO，并在支出请求达到批准阈值时由合约放行。",
  },
  docStep1: { en: "Create a vault from 2–16 signer addresses and a threshold.", zh: "用 2–16 个签名人地址和阈值创建金库。" },
  docStep2: { en: "Deposit GAS or NEO into the vault.", zh: "向金库存入 GAS 或 NEO。" },
  docStep3: { en: "Propose a spend and share the request ID with signers.", zh: "发起支出请求并把请求 ID 分享给签名人。" },
  docStep4: { en: "Each signer approves; the contract releases at the threshold.", zh: "签名人逐一批准，合约在达到阈值时放行。" },
  docFeature1Name: { en: "On-chain custody", zh: "链上托管" },
  docFeature1Desc: {
    en: "Funds are held by the vault contract and released only by signer approval.",
    zh: "资金由金库合约托管，仅在签名人批准后放行。",
  },
  docFeature2Name: { en: "Signer control", zh: "签名人控制" },
  docFeature2Desc: {
    en: "Only listed signer addresses can approve a spend request.",
    zh: "仅列表中的签名人地址可批准支出请求。",
  },
  docFeature3Name: { en: "Unified Workflow", zh: "统一流程" },
  docFeature3Desc: {
    en: "Track vault balance, request status, and approval progress in one flow.",
    zh: "统一追踪金库余额、请求状态与批准进度。",
  },
  sidebarTotalTxs: { en: "Vaults", zh: "金库数" },
  sidebarNoActivity: { en: "No Activity Yet", zh: "暂无活动" },
  ariaSigners: { en: "Signers", zh: "签名人" },
  sidebarTotalTxsLabel: { en: "Vaults", zh: "金库数" },
} as const;

export const messages = mergeMessages(appMessages);
