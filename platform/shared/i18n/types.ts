/**
 * Type definitions for i18n translations
 */

export interface CommonTranslations {
  navigation: {
    home: string;
    dashboard: string;
    apps: string;
    miniapps: string;
    settings: string;
    account: string;
    docs: string;
    developer: string;
    analytics: string;
    stats: string;
    services: string;
    users: string;
    contracts: string;
  };
  actions: {
    connect: string;
    disconnect: string;
    submit: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    create: string;
    refresh: string;
    loading: string;
    search: string;
    filter: string;
    sort: string;
    copy: string;
    copied: string;
    viewAll: string;
    tryAgain: string;
    back: string;
    next: string;
    close: string;
  };
  status: {
    active: string;
    inactive: string;
    pending: string;
    success: string;
    error: string;
    warning: string;
    online: string;
    offline: string;
    healthy: string;
    unhealthy: string;
    deployed: string;
    running: string;
    stopped: string;
  };
  labels: {
    name: string;
    description: string;
    status: string;
    date: string;
    time: string;
    amount: string;
    balance: string;
    address: string;
    transaction: string;
    hash: string;
    block: string;
    fee: string;
    total: string;
    price: string;
    quantity: string;
    type: string;
    category: string;
    version: string;
    id: string;
  };
  wallet: {
    wallet: string;
    connect: string;
    disconnect: string;
    connected: string;
    notConnected: string;
    insufficientBalance: string;
    pleaseConnect: string;
  };
  errors: {
    occurred: string;
    network: string;
    unauthorized: string;
    notFound: string;
    invalidInput: string;
    transactionFailed: string;
    walletRejected: string;
  };
  time: {
    now: string;
    today: string;
    yesterday: string;
    thisWeek: string;
    thisMonth: string;
    ago: string;
    seconds: string;
    minutes: string;
    hours: string;
    days: string;
    weeks: string;
    months: string;
  };
  language: {
    language: string;
    switch: string;
    en: string;
    zh: string;
    ja?: string;
    ko?: string;
  };
}

export interface HostAppTranslations {
  hero: {
    title: string;
    subtitle: string;
    exploreApps: string;
    launchApp: string;
  };
  features: {
    title: string;
    secureCompute: string;
    secureComputeDesc: string;
    verifiableRandom: string;
    verifiableRandomDesc: string;
    realTimeData: string;
    realTimeDataDesc: string;
    automatedTasks: string;
    automatedTasksDesc: string;
  };
  stats: {
    totalApps: string;
    totalUsers: string;
    totalTransactions: string;
    totalVolume: string;
  };
  categories: {
    all: string;
    gaming: string;
    defi: string;
    social: string;
    utility: string;
    nft: string;
    governance: string;
  };
  activity: {
    recent: string;
    noActivity: string;
    viewAll: string;
  };
  account: {
    title: string;
    profile: string;
    transactions: string;
    favorites: string;
  };
}

export interface AdminTranslations {
  dashboard: {
    title: string;
    overview: string;
    systemHealth: string;
    serviceStatus: string;
  };
  services: {
    title: string;
    all: string;
    running: string;
    stopped: string;
    restart: string;
    viewLogs: string;
    lastCheck: string;
  };
  users: {
    title: string;
    total: string;
    active: string;
    new: string;
    manage: string;
  };
  analytics: {
    title: string;
    pageViews: string;
    uniqueVisitors: string;
    avgSession: string;
    bounceRate: string;
  };
  miniapps: {
    title: string;
    registered: string;
    pending: string;
    approve: string;
    reject: string;
  };
}

export interface MiniAppTranslations {
  common: {
    play: string;
    bet: string;
    stake: string;
    unstake: string;
    claim: string;
    withdraw: string;
    deposit: string;
    win: string;
    lose: string;
    draw: string;
    jackpot: string;
    prize: string;
    pool: string;
    odds: string;
    multiplier: string;
    round: string;
    history: string;
    leaderboard: string;
    rank: string;
    player: string;
    reward: string;
    yourBet: string;
    potentialWin: string;
    placeBet: string;
    cashOut: string;
    waiting: string;
    gameOver: string;
    newGame: string;
    rules: string;
    howToPlay: string;
  };
  coinFlip: {
    title: string;
    heads: string;
    tails: string;
    flip: string;
    result: string;
  };
  diceGame: {
    title: string;
    roll: string;
    rollOver: string;
    rollUnder: string;
    target: string;
  };
  lottery: {
    title: string;
    buyTicket: string;
    ticketNumber: string;
    drawTime: string;
    nextDraw: string;
    prizePool: string;
  };
  scratchCard: {
    title: string;
    scratch: string;
    reveal: string;
    buyCard: string;
  };
  tipping: {
    title: string;
    tip: string;
    tipAmount: string;
    message: string;
    tipperName: string;
    anonymous: string;
    topTippers: string;
    totalTips: string;
    sendTip: string;
    thankYou: string;
  };
}

export interface Translations {
  common: CommonTranslations;
  host: HostAppTranslations;
  admin: AdminTranslations;
  miniapp: MiniAppTranslations;
}

export type TranslationNamespace = keyof Translations;
