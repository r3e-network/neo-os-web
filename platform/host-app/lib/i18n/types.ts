/**
 * Type definitions for i18n translations
 */

export interface CommonTranslations {
  // Navigation
  home: string;
  dashboard: string;
  apps: string;
  miniapps: string;
  settings: string;
  account: string;
  docs: string;
  developer: string;
  analytics: string;
  services: string;
  users: string;
  contracts: string;

  // Actions
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

  // Status
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

  // Common labels
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

  // Wallet
  wallet: string;
  connectWallet: string;
  disconnectWallet: string;
  walletConnected: string;
  walletNotConnected: string;
  insufficientBalance: string;

  // Errors
  errorOccurred: string;
  networkError: string;
  unauthorized: string;
  notFound: string;
  invalidInput: string;
  tryAgain: string;

  // Time
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

  // Language
  language: string;
  switchLanguage: string;
}

export interface HostAppTranslations {
  // Hero section
  heroTitle: string;
  heroSubtitle: string;
  exploreApps: string;
  launchApp: string;

  // Features
  features: string;
  secureCompute: string;
  secureComputeDesc: string;
  verifiableRandom: string;
  verifiableRandomDesc: string;
  realTimeData: string;
  realTimeDataDesc: string;
  automatedTasks: string;
  automatedTasksDesc: string;

  // Stats
  totalApps: string;
  totalUsers: string;
  totalTransactions: string;
  totalVolume: string;

  // MiniApp categories
  gaming: string;
  defi: string;
  social: string;
  utility: string;
  nft: string;
  governance: string;

  // Activity
  recentActivity: string;
  noActivity: string;
  viewAll: string;
}

export interface AdminTranslations {
  // Dashboard
  adminDashboard: string;
  overview: string;
  systemHealth: string;
  serviceStatus: string;

  // Services
  allServices: string;
  runningServices: string;
  stoppedServices: string;
  restartService: string;
  viewLogs: string;

  // Users
  totalUsers: string;
  activeUsers: string;
  newUsers: string;
  userManagement: string;

  // Analytics
  pageViews: string;
  uniqueVisitors: string;
  avgSessionDuration: string;
  bounceRate: string;

  // MiniApps management
  registeredApps: string;
  pendingApps: string;
  approveApp: string;
  rejectApp: string;
}

export interface MiniAppTranslations {
  // Common MiniApp UI
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
  waitingForResult: string;
  gameOver: string;
  newGame: string;
  rules: string;
  howToPlay: string;

  // Specific games
  coinFlip: string;
  heads: string;
  tails: string;
  diceGame: string;
  rollDice: string;
  lottery: string;
  buyTicket: string;
  ticketNumber: string;
  drawTime: string;
  scratchCard: string;
  scratch: string;
  reveal: string;

  // DeFi
  flashLoan: string;
  borrow: string;
  repay: string;
  collateral: string;
  liquidation: string;
  apy: string;
  tvl: string;
  predictionMarket: string;
  yes: string;
  no: string;
  marketClosed: string;
  marketOpen: string;
  resolution: string;

  // Social
  tip: string;
  tipAmount: string;
  message: string;
  tipperName: string;
  anonymous: string;
  topTippers: string;
  totalTips: string;
  sendTip: string;
}

export interface Translations {
  common: CommonTranslations;
  hostApp: HostAppTranslations;
  admin: AdminTranslations;
  miniApp: MiniAppTranslations;
}
