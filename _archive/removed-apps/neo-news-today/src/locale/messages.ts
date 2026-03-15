import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Neo News Today", zh: "Neo今日新闻" },
  tagline: { en: "Latest Neo Ecosystem News", zh: "Neo生态最新资讯" },
  loading: { en: "Loading articles...", zh: "加载文章中..." },
  noArticles: { en: "No articles available", zh: "暂无文章" },
  loadFailed: { en: "Unable to load articles", zh: "文章加载失败" },
  readMore: { en: "Read Report", zh: "阅读报告" },
  news: { en: "News", zh: "新闻" },
  docSubtitle: { en: "Daily digest for the Neo ecosystem", zh: "Neo 生态每日快讯" },
  docDescription: {
    en: "Neo News Today (NNT) delivers curated news, interviews, and events from the Neo ecosystem. Track releases, dApp launches, and community initiatives in one place without leaving your wallet.",
    zh: "Neo News Today (NNT) 汇总 Neo 生态的新闻、访谈与活动，帮助你在钱包内追踪版本发布、dApp 上线与社区动态。",
  },
  step1: { en: "Read the latest community news", zh: "阅读最新社区新闻" },
  step2: { en: "Tap on any article to read the full report", zh: "点击任意文章阅读完整报告" },
  step3: { en: "Stay updated with ecosystem developments", zh: "随时了解生态系统发展" },
  step4: { en: "Share interesting news with the community", zh: "与社区分享有趣的新闻" },
  feature1Name: { en: "Ecosystem Coverage", zh: "生态系统覆盖" },
  feature1Desc: { en: "Comprehensive news on Neo N3 and legacy.", zh: "全面报道 Neo N3 和传统链。" },
  feature2Name: { en: "Community Focus", zh: "社区聚焦" },
  feature2Desc: { en: "Highlighting developers and projects.", zh: "聚焦开发者和项目。" },
  feature3Name: { en: "Curated Feed", zh: "精选信息流" },
  feature3Desc: { en: "Daily highlights in a streamlined view.", zh: "每日重点内容一页查看。" },
  articles: { en: "Articles", zh: "文章" },
  latest: { en: "Latest", zh: "最新" },
  status: { en: "Status", zh: "状态" },
  ready: { en: "Ready", zh: "就绪" },
  articleImage: { en: "Article image", zh: "文章图片" },
  articleDetail: { en: "Article Detail", zh: "文章详情" },
  feedStatus: { en: "Feed Status", zh: "信息流状态" },
  refreshFeed: { en: "Refresh Feed", zh: "刷新信息流" },
} as const;

export const messages = mergeMessages(appMessages);
