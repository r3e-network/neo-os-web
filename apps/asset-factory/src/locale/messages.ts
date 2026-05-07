import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "Asset Factory", zh: "资产工厂" },
  subtitle: {
    en: "Create NEP-17 tokens from audited on-chain templates. Configure supply, owner, treasury, and minting policy without uploading contract artifacts.",
    zh: "基于已审计链上模板创建 NEP-17 资产。配置供应量、Owner、金库和增发策略，不上传合约 artifact。",
  },
  factoryOverview: { en: "Asset factory", zh: "资产工厂" },
  activeTemplate: { en: "Asset template", zh: "资产模板" },
  docWhatItIsBody: {
    en: "Asset Factory is a focused OneGate-loadable dApp for launching NEP-17 assets through the platform Factory contract. The user supplies only initialization parameters.",
    zh: "资产工厂是可被 OneGate 加载的专注型 dApp，用于通过平台 Factory 合约发行 NEP-17 资产。用户只提交初始化参数。",
  },
  docSupportedTemplatesBody: {
    en: "The initial template is a governed NEP-17 asset template with fixed decimals, treasury, mintability, and standard transfer policy parameters.",
    zh: "当前模板是受治理的 NEP-17 资产模板，支持精度、金库、是否可增发和标准转账策略参数。",
  },
} as const;

export const messages = mergeMessages(appMessages);
