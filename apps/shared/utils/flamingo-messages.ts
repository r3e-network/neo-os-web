import { mergeMessages } from "@shared/locale/base-messages";
import type { FlamingoProductDefinition } from "./flamingo-products";

export function createFlamingoMessages(product: FlamingoProductDefinition) {
  return mergeMessages({
    title: { en: product.titleEn, zh: product.titleZh },
    subtitle: {
      en: `Official ${product.titleEn} launcher`,
      zh: `${product.titleZh} 官方入口`,
    },
    heroBlurb: { en: product.heroBlurbEn, zh: product.heroBlurbZh },
    tabOverview: { en: "Overview", zh: "概览" },
    tabDetails: { en: "Details", zh: "详情" },
    protocol: { en: "Protocol", zh: "协议" },
    protocolValue: { en: "Flamingo Finance", zh: "Flamingo Finance" },
    product: { en: "Product", zh: "产品" },
    category: { en: "Category", zh: "类别" },
    categoryValue: { en: product.categoryValueEn, zh: product.categoryValueZh },
    network: { en: "Network", zh: "网络" },
    networkValue: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
    integrationMode: { en: "Integration", zh: "接入方式" },
    integrationModeValue: { en: "Official web launcher", zh: "官方 Web 入口包装" },
    officialUrl: { en: "Official URL", zh: "官方地址" },
    docsUrl: { en: "Docs URL", zh: "文档地址" },
    openOfficial: { en: "Open Official Product", zh: "打开官方产品" },
    openProtocolHome: { en: "Open Flamingo Home", zh: "打开 Flamingo 首页" },
    openDocs: { en: "Open Getting Started", zh: "打开入门文档" },
    summaryTitle: { en: "Product Summary", zh: "产品说明" },
    summaryText: { en: product.summaryEn, zh: product.summaryZh },
    notesTitle: { en: "Usage Notes", zh: "使用说明" },
    notePrimary: { en: product.notePrimaryEn, zh: product.notePrimaryZh },
    noteSecondary: { en: product.noteSecondaryEn, zh: product.noteSecondaryZh },
    docsSubtitle: { en: `Official ${product.titleEn} access`, zh: `${product.titleZh} 官方入口` },
    feature1Name: { en: "Official Routing", zh: "官方路由" },
    feature1Desc: {
      en: "Launch the official Flamingo product page instead of reproducing protocol execution locally.",
      zh: "直接打开官方 Flamingo 产品页，而不是在本地重写协议执行逻辑。",
    },
    feature2Name: { en: "Clear Scope", zh: "边界清晰" },
    feature2Desc: {
      en: "This miniapp stays focused on discovery, launch, and context.",
      zh: "这个小程序只负责发现、启动和上下文说明。",
    },
    feature3Name: { en: "Protocol Native", zh: "协议原生" },
    feature3Desc: {
      en: "Liquidity, prices, claims, and account state remain under Flamingo's official UI and contracts.",
      zh: "流动性、价格、领取和账户状态都保持在 Flamingo 官方界面和合约体系内。",
    },
  });
}
