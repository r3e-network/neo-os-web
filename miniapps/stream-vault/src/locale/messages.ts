import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Stream Vault", zh: "流式金库" },
  createTab: { en: "Create", zh: "创建" },
  vaultsTab: { en: "Vaults", zh: "金库" },

  vaultName: { en: "Vault name", zh: "金库名称" },
  vaultNamePlaceholder: { en: "Monthly payroll stream", zh: "每月工资流" },
  beneficiary: { en: "Beneficiary address", zh: "受益人地址" },
  beneficiaryPlaceholder: { en: "Enter Neo N3 address", zh: "输入 Neo N3 地址" },
  assetType: { en: "Asset (GAS only)", zh: "资产（仅 GAS）" },
  assetNeo: { en: "NEO", zh: "NEO" },
  assetGas: { en: "GAS", zh: "GAS" },
  totalAmount: { en: "Total amount", zh: "总金额" },
  totalAmountHint: { en: "Funds are locked in the vault", zh: "资金将锁定在金库中" },
  rateAmount: { en: "Release per interval", zh: "每期释放" },
  intervalDays: { en: "Interval (days)", zh: "周期（天）" },
  intervalHint: { en: "Minimum 1 day, maximum 365 days", zh: "最少 1 天，最多 365 天" },
  notes: { en: "Notes (optional)", zh: "备注（可选）" },
  notesPlaceholder: { en: "Add context for the recipient", zh: "补充说明" },

  createVault: { en: "Create Vault", zh: "创建金库" },
  vaultCreated: { en: "Vault created", zh: "金库已创建" },

  contractMissing: { en: "Contract address not configured", zh: "合约地址未配置" },

  invalidAddress: { en: "Invalid beneficiary address", zh: "受益人地址无效" },
  invalidAmount: { en: "Enter a valid amount", zh: "请输入有效金额" },
  rateTooHigh: { en: "Release amount exceeds total", zh: "释放金额超过总金额" },
  intervalInvalid: { en: "Interval out of range", zh: "周期超出范围" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },

  myCreated: { en: "Created by you", zh: "我创建的" },
  beneficiaryVaults: { en: "For you", zh: "我受益的" },
  emptyVaults: { en: "No vaults yet", zh: "暂无金库" },
  refresh: { en: "Refresh", zh: "刷新" },
  sidebarCreatedStreams: { en: "Created Streams", zh: "已创建流" },
  sidebarBeneficiaryStreams: { en: "Beneficiary Streams", zh: "受益流" },
  sidebarTotalStreams: { en: "Total Streams", zh: "总流数量" },

  statusActive: { en: "Active", zh: "活跃" },
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
    en: "Scheduled releases for payrolls and subscriptions",
    zh: "用于工资与订阅的定期释放",
  },
  docDescription: {
    en: "Stream Vault locks GAS and stores a release schedule on-chain. Claimable amounts accrue per interval, letting beneficiaries claim over time while creators can cancel and recover unvested funds.",
    zh: "流式金库锁定 GAS，并将释放计划上链。可领取金额按周期累积，受益人按期领取，创建者可取消并收回未释放的余额。",
  },
  step1: {
    en: "Create a vault with beneficiary, asset, total, and interval.",
    zh: "填写受益人、资产、总金额与周期创建金库。",
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
