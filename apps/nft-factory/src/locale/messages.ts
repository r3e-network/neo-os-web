import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "NFT Factory", zh: "NFT 工厂" },
  subtitle: {
    en: "Create NEP-11 collections, passes, and soulbound assets from governed on-chain templates without uploading contract artifacts.",
    zh: "基于受治理链上模板创建 NEP-11 集合、通行证和灵魂绑定资产，不上传合约 artifact。",
  },
  factoryOverview: { en: "NFT factory", zh: "NFT 工厂" },
  activeTemplate: { en: "Collection template", zh: "集合模板" },
  docWhatItIsBody: {
    en: "NFT Factory is a focused OneGate-loadable dApp for launching NEP-11 collections through the platform Factory contract. It is for collections, tickets, badges, and creator drops.",
    zh: "NFT 工厂是可被 OneGate 加载的专注型 dApp，用于通过平台 Factory 合约发行 NEP-11 集合，适合集合、门票、徽章和创作者发行。",
  },
  docSupportedTemplatesBody: {
    en: "The initial template is a governed NEP-11 collection template with max supply, royalty, metadata base URI, and transfer policy parameters.",
    zh: "当前模板是受治理的 NEP-11 集合模板，支持最大供应量、版税、元数据基础 URI 和转让策略参数。",
  },
} as const;

export const messages = mergeMessages(appMessages);
