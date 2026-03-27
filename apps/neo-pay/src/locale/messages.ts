import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "NeoPay", zh: "流式支付" },
  createTab: { en: "Create", zh: "创建" },
  vaultsTab: { en: "Streams", zh: "资金流" },

  vaultName: { en: "Stream name", zh: "资金流名称" },
  vaultNamePlaceholder: { en: "Monthly payroll stream", zh: "每月工资流" },
  beneficiary: { en: "Beneficiary address", zh: "受益人地址" },
  beneficiaryPlaceholder: { en: "Enter Neo N3 address", zh: "输入 Neo N3 地址" },
  assetType: { en: "Asset", zh: "资产" },
  assetNeo: { en: "NEO", zh: "NEO" },
  assetGas: { en: "GAS", zh: "GAS" },
  totalAmount: { en: "Total amount", zh: "总金额" },
  totalAmountPlaceholder: { en: "20", zh: "20" },
  totalAmountHint: { en: "Funds are locked in the stream", zh: "资金将锁定在该资金流中" },
  rateAmount: { en: "Release per interval", zh: "每期释放" },
  rateAmountPlaceholder: { en: "1.5", zh: "1.5" },
  intervalDays: { en: "Interval (days)", zh: "周期（天）" },
  intervalDaysPlaceholder: { en: "30", zh: "30" },
  intervalHint: { en: "Minimum 1 day, maximum 365 days", zh: "最少 1 天，最多 365 天" },
  notes: { en: "Notes (optional)", zh: "备注（可选）" },
  notesPlaceholder: { en: "Add context for the recipient", zh: "补充说明" },

  createVault: { en: "Create Stream", zh: "创建资金流" },
  vaultCreated: { en: "Stream created", zh: "资金流已创建" },

  contractMissing: { en: "Contract address not configured", zh: "合约地址未配置" },

  invalidAddress: { en: "Invalid beneficiary address", zh: "受益人地址无效" },
  invalidAmount: { en: "Enter a valid amount", zh: "请输入有效金额" },
  rateTooHigh: { en: "Release amount exceeds total", zh: "释放金额超过总金额" },
  intervalInvalid: { en: "Interval out of range", zh: "周期超出范围" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },

  myCreated: { en: "Created by you", zh: "我创建的" },
  beneficiaryVaults: { en: "For you", zh: "受益给我的资金流" },
  emptyVaults: { en: "No streams yet", zh: "暂无资金流" },
  refresh: { en: "Refresh", zh: "刷新" },
  sidebarCreatedStreams: { en: "Created Streams", zh: "已创建流" },
  sidebarBeneficiaryStreams: { en: "Beneficiary Streams", zh: "受益流" },
  sidebarTotalStreams: { en: "Total Streams", zh: "总流数量" },

  statusActive: { en: "Active", zh: "活跃" },
  streamSingular: { en: "Stream", zh: "流" },
  streamPlural: { en: "Streams", zh: "流" },
  statusCompleted: { en: "Completed", zh: "已完成" },
  statusCancelled: { en: "Cancelled", zh: "已取消" },
  totalLocked: { en: "Total locked", zh: "总锁定" },
  released: { en: "Released", zh: "已释放" },
  remaining: { en: "Remaining", zh: "剩余" },
  claimable: { en: "Claimable", zh: "可领取" },
  intervalLabel: { en: "Interval", zh: "周期" },
  rateLabel: { en: "Release", zh: "释放" },

  claim: { en: "Claim", zh: "领取" },
  claiming: { en: "Claiming...", zh: "领取中..." },
  cancelling: { en: "Cancelling...", zh: "取消中..." },

  docSubtitle: {
    en: "Scheduled releases for payrolls, subscriptions, and allowances",
    zh: "用于工资、订阅与津贴的定期释放",
  },
  docDescription: {
    en: "A payment stream locks GAS or NEO and stores a release schedule on-chain. Claimable amounts accrue per interval, letting beneficiaries claim over time while creators can cancel and recover unvested funds.",
    zh: "资金流会锁定 GAS 或 NEO，并将释放计划记录在链上。可领取金额按周期累积，受益人按期领取，创建者可取消并收回未释放的余额。",
  },
  step1: {
    en: "Create a stream with beneficiary, asset, total amount, and interval.",
    zh: "填写受益人、资产、总金额与周期来创建资金流。",
  },
  step2: { en: "Funds lock immediately and begin the release schedule.", zh: "资金立即锁定并开始按周期释放。" },
  step3: { en: "Beneficiary claims accumulated amounts each period.", zh: "受益人按期领取累积的可领取金额。" },
  step4: { en: "Creator can cancel and reclaim remaining balance.", zh: "创建者可取消并取回剩余余额。" },
  feature1Name: { en: "Time-based Vesting", zh: "时间释放" },
  feature1Desc: { en: "Release amount is tied to a fixed interval.", zh: "释放金额与固定周期绑定。" },
  feature2Name: { en: "Claim Tracking", zh: "领取跟踪" },
  feature2Desc: { en: "On-chain tracking of released vs remaining funds.", zh: "链上记录已释放与剩余金额。" },
  ariaStreams: { en: "Streams", zh: "流" },
  feature3Name: { en: "Cancelable", zh: "可取消" },
  feature3Desc: { en: "Creators can reclaim unvested funds at any time.", zh: "创建者可随时取回未释放余额。" },
} as const;

export const messages = mergeMessages(appMessages);
