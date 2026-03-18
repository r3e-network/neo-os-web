export type FlamingoProductDefinition = {
  slug: string;
  appId: string;
  titleEn: string;
  titleZh: string;
  categoryValueEn: string;
  categoryValueZh: string;
  heroBlurbEn: string;
  heroBlurbZh: string;
  summaryEn: string;
  summaryZh: string;
  notePrimaryEn: string;
  notePrimaryZh: string;
  noteSecondaryEn: string;
  noteSecondaryZh: string;
  officialUrl: string;
  docsUrl: string;
  protocolUrl: string;
};

export const FLAMINGO_PROTOCOL_HOME = "https://flamingo.finance/";
export const FLAMINGO_GETTING_STARTED = "https://flamingo.finance/getting-started";

export const flamingoProducts: Record<string, FlamingoProductDefinition> = {
  swap: {
    slug: "flamingo-swap",
    appId: "miniapp-flamingo-swap",
    titleEn: "Flamingo Swap",
    titleZh: "Flamingo 兑换",
    categoryValueEn: "Swap",
    categoryValueZh: "兑换",
    heroBlurbEn: "Launch the official Flamingo trading interface for Neo N3 spot swaps and routing.",
    heroBlurbZh: "打开官方 Flamingo 交易界面，使用 Neo N3 现货兑换和路由。",
    summaryEn: "Official Flamingo spot trading entry for Neo N3 users.",
    summaryZh: "面向 Neo N3 用户的官方 Flamingo 现货交易入口。",
    notePrimaryEn: "Pairs, routing, slippage, and execution are owned by the official Flamingo UI.",
    notePrimaryZh: "交易对、路由、滑点和执行逻辑都由官方 Flamingo 界面负责。",
    noteSecondaryEn: "This miniapp is only a launcher and guide layer, not a custom AMM frontend.",
    noteSecondaryZh: "这个小程序只是入口和引导层，不是自定义 AMM 前端。",
    officialUrl: "https://flamingo.finance/trade/BNEO_GAS",
    docsUrl: FLAMINGO_GETTING_STARTED,
    protocolUrl: FLAMINGO_PROTOCOL_HOME,
  },
  lend: {
    slug: "flamingo-lend",
    appId: "miniapp-flamingo-lend",
    titleEn: "Flamingo Lend",
    titleZh: "Flamingo 借贷",
    categoryValueEn: "Lending",
    categoryValueZh: "借贷",
    heroBlurbEn: "Open the official Flamingo lending market for collateral and borrowing flows.",
    heroBlurbZh: "打开官方 Flamingo 借贷市场，处理抵押和借款流程。",
    summaryEn: "Official Flamingo lending interface for collateral management and borrowing.",
    summaryZh: "官方 Flamingo 借贷界面，用于管理抵押品与借款。",
    notePrimaryEn: "Collateral, rates, borrow limits, and health-factor logic are controlled by Flamingo.",
    notePrimaryZh: "抵押率、利率、借款限额和健康度逻辑都由 Flamingo 协议控制。",
    noteSecondaryEn: "Use the official market screen instead of reproducing risk logic locally.",
    noteSecondaryZh: "直接使用官方市场页面，不要在本地重复实现风险逻辑。",
    officialUrl: "https://flamingo.finance/lend",
    docsUrl: FLAMINGO_GETTING_STARTED,
    protocolUrl: FLAMINGO_PROTOCOL_HOME,
  },
  earn: {
    slug: "flamingo-earn",
    appId: "miniapp-flamingo-earn",
    titleEn: "Flamingo Earn",
    titleZh: "Flamingo 收益",
    categoryValueEn: "Yield",
    categoryValueZh: "收益",
    heroBlurbEn: "Use the official Flamingo earn surfaces for staking and yield opportunities.",
    heroBlurbZh: "使用官方 Flamingo 收益页面参与质押和收益机会。",
    summaryEn: "Official Flamingo yield launcher for staking and incentive positions.",
    summaryZh: "官方 Flamingo 收益入口，用于质押和激励头寸。",
    notePrimaryEn: "APR, rewards, lock terms, and claim flows are governed by the official protocol UI.",
    notePrimaryZh: "APR、奖励、锁仓期限和领取流程以官方协议界面为准。",
    noteSecondaryEn: "This wrapper keeps discovery inside the miniapp platform while execution stays official.",
    noteSecondaryZh: "这个包装层让发现入口留在小程序平台里，而执行仍然走官方页面。",
    officialUrl: "https://flamingo.finance/earn",
    docsUrl: FLAMINGO_GETTING_STARTED,
    protocolUrl: FLAMINGO_PROTOCOL_HOME,
  },
  analytics: {
    slug: "flamingo-analytics",
    appId: "miniapp-flamingo-analytics",
    titleEn: "Flamingo Analytics",
    titleZh: "Flamingo 分析",
    categoryValueEn: "Analytics",
    categoryValueZh: "分析",
    heroBlurbEn: "Jump into the official Flamingo analytics dashboards for protocol and market data.",
    heroBlurbZh: "进入官方 Flamingo 分析面板，查看协议和市场数据。",
    summaryEn: "Official Flamingo analytics entry for market and protocol monitoring.",
    summaryZh: "官方 Flamingo 分析入口，用于市场和协议监控。",
    notePrimaryEn: "Dashboards, charting, and data freshness are owned by Flamingo's official analytics stack.",
    notePrimaryZh: "看板、图表和数据新鲜度都由 Flamingo 官方分析栈负责。",
    noteSecondaryEn: "This miniapp keeps users on a curated path without rebuilding analytics locally.",
    noteSecondaryZh: "这个小程序提供精选入口，不在本地重建分析系统。",
    officialUrl: "https://flamingo.finance/analytics",
    docsUrl: FLAMINGO_GETTING_STARTED,
    protocolUrl: FLAMINGO_PROTOCOL_HOME,
  },
  actionCenter: {
    slug: "flamingo-action-center",
    appId: "miniapp-flamingo-action-center",
    titleEn: "Flamingo Action Center",
    titleZh: "Flamingo 操作中心",
    categoryValueEn: "Action Center",
    categoryValueZh: "操作中心",
    heroBlurbEn: "Use the official Flamingo action center to review pending claims and protocol actions.",
    heroBlurbZh: "使用官方 Flamingo 操作中心查看待处理领取和协议操作。",
    summaryEn: "Official Flamingo action center entry for user task and claim flows.",
    summaryZh: "官方 Flamingo 操作中心入口，用于用户任务和领取流程。",
    notePrimaryEn: "Pending actions, reward claims, and account-specific tasks are resolved by Flamingo's official backend and contracts.",
    notePrimaryZh: "待处理操作、奖励领取和账户任务都由 Flamingo 官方后端与合约解析。",
    noteSecondaryEn: "This wrapper should stay thin and avoid reproducing account state off-platform.",
    noteSecondaryZh: "这个包装层应该保持轻量，不要在平台内重复实现账户状态逻辑。",
    officialUrl: "https://flamingo.finance/action-center",
    docsUrl: FLAMINGO_GETTING_STARTED,
    protocolUrl: FLAMINGO_PROTOCOL_HOME,
  },
};
