import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Milestone Escrow", zh: "里程碑托管" },
  createTab: { en: "Create", zh: "创建" },
  escrowsTab: { en: "Escrows", zh: "托管" },

  escrowName: { en: "Escrow name", zh: "托管名称" },
  escrowNamePlaceholder: { en: "Website delivery escrow", zh: "项目交付托管" },
  beneficiary: { en: "Beneficiary address", zh: "受益人地址" },
  beneficiaryAddress: { en: "Beneficiary address", zh: "受益人地址" },
  beneficiaryPlaceholder: { en: "Enter Neo N3 address", zh: "输入 Neo N3 地址" },
  description: { en: "Description", zh: "描述" },
  descriptionPlaceholder: { en: "Milestone description...", zh: "里程碑描述..." },
  submit: { en: "Submit", zh: "提交" },
  assetType: { en: "Asset", zh: "资产" },
  assetNeo: { en: "NEO", zh: "NEO" },
  assetGas: { en: "GAS", zh: "GAS" },
  assetNeoHint: { en: "Whole-token milestone releases", zh: "按整数 NEO 分期释放" },
  assetGasHint: { en: "Precise GAS tranches", zh: "支持精确 GAS 分期" },
  milestones: { en: "Milestones", zh: "里程碑" },
  milestonesLabel: { en: "Milestone breakdown", zh: "里程碑明细" },
  milestoneNumber: { en: "M{n}", zh: "里程碑 {n}" },
  milestoneClaimedPill: { en: "Claimed", zh: "已领取" },
  milestoneApprovedPill: { en: "Approved", zh: "已批准" },
  milestonePendingPill: { en: "Pending", zh: "待批准" },
  approveMilestone: { en: "Approve M{n} — {amount}", zh: "批准里程碑 {n} —— {amount}" },
  claimMilestone: { en: "Claim M{n} — {amount}", zh: "领取里程碑 {n} —— {amount}" },
  confirmCancelRefund: { en: "Confirm cancel — refunds {amount}", zh: "确认取消 —— 退回 {amount}" },
  escrowsCompleted: { en: "Escrows completed", zh: "已完成托管" },
  milestoneAmount: { en: "Milestone amount", zh: "里程碑金额" },
  milestoneAmountPlaceholder: { en: "1.5", zh: "1.5" },
  milestoneLabel: { en: "Milestone {index}", zh: "里程碑 {index}" },
  milestonePayout: { en: "Payout tranche", zh: "释放批次" },
  addMilestone: { en: "Add milestone", zh: "新增里程碑" },
  remove: { en: "Remove", zh: "移除" },
  removeMilestone: { en: "Remove milestone {index}", zh: "移除里程碑 {index}" },
  totalAmount: { en: "Total amount", zh: "总金额" },
  totalHint: { en: "Sum of milestone amounts", zh: "为所有里程碑金额之和" },
  notes: { en: "Notes (optional)", zh: "备注（可选）" },
  notesPlaceholder: { en: "Describe delivery criteria", zh: "说明交付标准" },

  createEscrow: { en: "Create Escrow", zh: "创建托管" },
  releaseDesk: { en: "Release desk", zh: "释放工作台" },
  releaseDeskTitle: { en: "Build a staged payout plan", zh: "配置分期释放计划" },
  releaseDeskCopy: {
    en: "Turn a deal into funded gates: pick the asset, define each tranche, then sign the deposit and setup.",
    zh: "把项目款项拆成可验收的资金闸门：选择资产、配置每个批次，然后签名存入并创建托管。",
  },
  releaseWorkbench: { en: "Escrow workbench", zh: "托管工作台" },
  releaseWorkbenchTitle: { en: "Preview the release route while you configure it", zh: "边配置边预览资金释放路径" },
  twoStepSignBadge: { en: "2 wallet signatures", zh: "2 次钱包签名" },
  dealControls: { en: "Deal controls", zh: "交易配置" },
  dealControlsHint: {
    en: "Keep the beneficiary and every release gate visible before funds move.",
    zh: "资金转入前，清楚核对受益人和每个释放节点。",
  },
  // Action success toasts (notify.guard keys).
  escrowCreated: { en: "Escrow created", zh: "托管已创建" },
  approveSuccess: { en: "Milestone approved", zh: "里程碑已批准" },
  claimSuccess: { en: "Milestone claimed — funds released", zh: "里程碑已领取——资金已释放" },
  cancelSuccess: { en: "Escrow cancelled — remaining funds refunded", zh: "托管已取消——剩余资金已退回" },

  contractMissing: { en: "Contract address not configured", zh: "合约地址未配置" },
  deploymentPendingTitle: { en: "Not available on this network", zh: "此网络暂不可用" },
  deploymentPendingDesc: {
    en: "Milestone escrow isn't live on this network yet. Switch to a supported Neo N3 network to create or release staged payments.",
    zh: "里程碑托管尚未在此网络上线。请切换到受支持的 Neo N3 网络后再创建或释放分期付款。",
  },

  // --- Explanatory empty / disconnected state (marketing + how-it-works) ---
  // Shown before a wallet is connected (or when the contract is unconfigured)
  // so a first-time visitor understands the staged-release model and has a
  // clear next step instead of an inert "deployment pending" card.
  introHeadline: {
    en: "Pay in stages, release on approval",
    zh: "分期托管，验收后释放",
  },
  introLede: {
    en: "Lock NEO or GAS once, split it into up to 12 milestones, and release each tranche only after you approve the work. Unapproved funds stay locked and refundable.",
    zh: "一次性锁定 NEO 或 GAS，拆分为最多 12 个里程碑，验收通过后逐项释放。未批准的资金保持锁定且可退款。",
  },
  howItWorks: { en: "How it works", zh: "运作方式" },
  stepLabel: { en: "Step {n}", zh: "第 {n} 步" },
  previewLabel: { en: "Sample escrow", zh: "示例托管" },
  planPreview: { en: "Release plan", zh: "释放计划" },
  previewNetwork: { en: "Neo N3 - Milestone Escrow", zh: "Neo N3 · 里程碑托管" },
  connectToStart: { en: "Connect a wallet to create your first escrow", zh: "连接钱包以创建你的第一个托管" },
  // Hero stat sublabels — clarify exactly what each tile counts.
  statHintEscrows: { en: "Total you are party to", zh: "你参与的总数" },
  statHintActive: { en: "Funds still locked", zh: "仍处于锁定" },
  statHintCompleted: { en: "Fully released", zh: "已全部释放" },

  invalidAddress: { en: "Invalid beneficiary address", zh: "受益人地址无效" },
  invalidAmount: { en: "Enter a valid amount", zh: "请输入有效金额" },
  milestoneSumMismatch: { en: "Milestone sum must equal total", zh: "里程碑总和需等于总金额" },
  milestoneLimit: { en: "Milestones must be between 1 and 12", zh: "里程碑数量需在 1 到 12 之间" },
  minNeo: { en: "Minimum escrow is 1 NEO", zh: "最低托管金额为 1 NEO" },
  minGas: { en: "Minimum escrow is 0.1 GAS", zh: "最低托管金额为 0.1 GAS" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },
  depositPrepaidNoEscrow: {
    en: "Your funds were prepaid to the escrow contract, but the escrow was not created. Your credit is held under your address and the escrow can be created again (retry).",
    zh: "资金已预付至托管合约，但托管未创建。您的额度仍记在您的地址下，可重新发起创建（请重试）。",
  },
  // Two-signature disclosure — the standalone contract takes a deposit first,
  // then the createEscrow call (two wallet prompts), mirroring neo-pay.
  twoStepSignNotice: {
    en: "Creating an escrow needs two wallet signatures: first the {asset} deposit, then the escrow setup.",
    zh: "创建托管需要两次钱包签名：先存入 {asset}，再完成托管设置。",
  },
  // No-fee value prop — surfaced near the submit action and in the hero/docs.
  noFeeNotice: {
    en: "No platform fee — beneficiaries receive the full milestone amount; you only pay network gas.",
    zh: "无平台费用——受益人可领取完整的里程碑金额，您只需支付网络 gas。",
  },
  // Beneficiary-side note — payout depends on the creator approving each milestone.
  beneficiaryApprovalNote: {
    en: "Funds release only after the creator approves each milestone.",
    zh: "资金仅在创建者批准对应里程碑后才会释放。",
  },

  createdByYou: { en: "Created by you", zh: "我创建的" },
  forYou: { en: "For you", zh: "我受益的" },
  // Role-clear stat labels for the manifest stat tiles / sidebar.
  statCreated: { en: "Created", zh: "我创建的" },
  statForYou: { en: "For you", zh: "我受益的" },
  emptyEscrows: { en: "No escrows yet", zh: "暂无托管" },
  refresh: { en: "Refresh", zh: "刷新" },

  // Escrow card detail rows.
  locked: { en: "Locked", zh: "已锁定" },
  released: { en: "Released", zh: "已释放" },
  releasedOfTotal: { en: "{released} / {total} released", zh: "已释放 {released} / {total}" },
  milestoneProgress: { en: "{done} / {count} milestones", zh: "{done} / {count} 里程碑" },

  // Button gating helper text (tooltips on disabled actions).
  noMilestoneToApprove: { en: "All milestones approved", zh: "所有里程碑已批准" },
  noMilestoneToClaim: { en: "No approved milestone to claim", zh: "暂无可领取的已批准里程碑" },

  statusActive: { en: "Active", zh: "活跃" },
  statusCompleted: { en: "Completed", zh: "已完成" },
  statusCancelled: { en: "Cancelled", zh: "已取消" },
  approved: { en: "Approved", zh: "已批准" },
  pending: { en: "Pending", zh: "待批准" },
  claimed: { en: "Claimed", zh: "已领取" },

  approve: { en: "Approve", zh: "批准" },
  claim: { en: "Claim", zh: "领取" },
  approving: { en: "Approving...", zh: "批准中..." },
  claiming: { en: "Claiming...", zh: "领取中..." },
  cancelling: { en: "Cancelling...", zh: "取消中..." },

  docSubtitle: {
    en: "Approve milestones and release funds in stages",
    zh: "逐项批准里程碑并分期释放资金",
  },
  docDescription: {
    en: "Milestone Escrow locks NEO or GAS in a single escrow and tracks milestone amounts on-chain. Creators approve each milestone, and beneficiaries claim approved tranches while unapproved funds stay locked.",
    zh: "里程碑托管将 NEO 或 GAS 锁定在同一托管中，并在链上记录每个里程碑金额。创建者逐项批准，受益人领取已批准的分期资金，未批准部分持续锁定。",
  },
  step1: { en: "Define milestones and amounts; the total equals the deposit.", zh: "设置里程碑与金额，总额需等于锁定资金。" },
  step2: { en: "Creator approves milestones after deliverables are accepted.", zh: "交付验收通过后由创建者批准里程碑。" },
  step3: { en: "Beneficiary claims each approved tranche on-chain.", zh: "受益人领取已批准的分期资金。" },
  step4: { en: "Creator can cancel and reclaim remaining unapproved funds.", zh: "创建者可取消并取回未批准的剩余资金。" },
  feature1Name: { en: "Milestone Ledger", zh: "里程碑账本" },
  feature1Desc: { en: "On-chain approvals and claim status per milestone.", zh: "每个里程碑的批准与领取状态上链记录。" },
  feature2Name: { en: "Split Releases", zh: "分期释放" },
  feature2Desc: { en: "Funds are unlocked only when a milestone is approved.", zh: "仅在里程碑批准后释放对应资金。" },
  feature3Name: { en: "Refundable Escrow", zh: "可退款托管" },
  feature3Desc: { en: "Unapproved funds can be reclaimed by the creator.", zh: "未批准资金可由创建者取回。" },
  idPrefix: { en: "#", zh: "#" },
} as const;

export const messages = mergeMessages(appMessages);
