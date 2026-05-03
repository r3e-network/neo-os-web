/**
 * Shared constants for miniapps
 *
 * This file centralizes magic numbers and configuration values
 * that were previously hardcoded throughout the codebase.
 */

/**
 * Retry configuration for async operations
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts for event polling */
  MAX_EVENT_RETRIES: 20,

  /** Delay between retry attempts in milliseconds */
  RETRY_DELAY_MS: 1500,

  /** Maximum number of events to fetch per page */
  MAX_EVENTS_PER_PAGE: 50,

  /** Maximum number of events to display */
  MAX_EVENTS_DISPLAY: 20,
} as const;

/**
 * Time constants
 */
export const TIME_CONSTANTS = {
  /** One second in milliseconds */
  SECOND_MS: 1000,

  /** One minute in milliseconds */
  MINUTE_MS: 60 * 1000,

  /** One hour in milliseconds */
  HOUR_MS: 60 * 60 * 1000,

  /** One day in milliseconds */
  DAY_MS: 24 * 60 * 60 * 1000,

  /** Seconds in a day */
  SECONDS_PER_DAY: 86400,

  /** Days in a standard year */
  DAYS_PER_YEAR: 365,

  /** Countdown update intervals */
  COUNTDOWN_UPDATE_INTERVAL_MS: 1000,

  /** Default timeout for async operations */
  DEFAULT_TIMEOUT_MS: 30000,

  /** Celebration/fireworks overlay duration */
  CELEBRATION_DURATION_MS: 3000,
} as const;

/**
 * Gas/Token constants
 */
export const TOKEN_CONSTANTS = {
  /** Gas decimals (1 GAS = 10^8 base units) */
  GAS_DECIMALS: 8,

  /** NEO decimals (indivisible) */
  NEO_DECIMALS: 0,

  /** Gas multiplier for converting to base units */
  GAS_MULTIPLIER: 100000000,

  /** Minimum bet amount for games */
  MIN_BET_AMOUNT: 0.05,

  /** Maximum bet amount for games (can be overridden per app) */
  MAX_BET_AMOUNT: 100,

  /** Default precision for token display */
  DEFAULT_TOKEN_PRECISION: 2,

  /** Gas precision for display */
  GAS_DISPLAY_PRECISION: 4,
} as const;

/**
 * Blockchain constants
 */
export const BLOCKCHAIN_CONSTANTS = {
  /** NEO token script hash (N3 mainnet/testnet) */
  NEO_HASH: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",

  /** GAS token script hash (N3 mainnet/testnet) */
  GAS_HASH: "0xd2a4cff31913016155e38e474a2c06d08be276cf",

  /** Minimum loan duration in seconds (1 day) */
  MIN_LOAN_DURATION_SECONDS: 86400,

  /** Default platform fee in basis points (0.5%) */
  DEFAULT_PLATFORM_FEE_BPS: 50,

  /** Basis points to percentage (divide by 100) */
  BPS_TO_PERCENTAGE_DIVISOR: 100,

  /** Loan tier multipliers for LTV calculation */
  LTV_TIER_MULTIPLIERS: {
    TIER_1_BPS: 2000, // 20%
    TIER_2_BPS: 3000, // 30%
    TIER_3_BPS: 4000, // 40%
  },
} as const;

/**
 * UI constants
 */
export const UI_CONSTANTS = {
  /** Default animation duration for transitions */
  DEFAULT_ANIMATION_DURATION_MS: 300,

  /** Fireworks display duration */
  FIREWORKS_DURATION_MS: 3000,

  /** Toast notification duration */
  TOAST_DURATION_MS: 5000,

  /** Clear error timeout duration */
  ERROR_CLEAR_TIMEOUT_MS: 5000,

  /** Debounce delay for search inputs */
  SEARCH_DEBOUNCE_MS: 300,

  /** Throttle delay for scroll events */
  SCROLL_THROTTLE_MS: 100,
} as const;

/**
 * Validation constants
 */
export const VALIDATION_CONSTANTS = {
  /** Maximum file name length */
  MAX_FILENAME_LENGTH: 255,

  /** Maximum path length */
  MAX_PATH_LENGTH: 4096,

  /** Maximum transaction memo length */
  MAX_TX_MEMO_LENGTH: 100,

  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 8,

  /** Minimum address/username length */
  MIN_ADDRESS_LENGTH: 2,
} as const;

/**
 * Responsive breakpoints (px)
 */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
  LARGE_DESKTOP: 1440,
} as const;

/**
 * Contract limits
 */
export const CONTRACT_LIMITS = {
  /** Maximum lock duration in days (10 years) */
  MAX_LOCK_DAYS: 3650,

  /** Maximum milestones per escrow */
  MAX_MILESTONES: 10,

  /** Default GAS price for fee estimation */
  DEFAULT_GAS_PRICE: 0.0001,

  /** Basis points divisor (100% = 10000 bps) */
  BASIS_POINTS_DIVISOR: 10000,

  /** Maximum fee in basis points (10%) */
  MAX_FEE_BPS: 1000,
} as const;

/**
 * App ID constants
 */
export const APP_IDS = {
  /** Coin flip miniapp */
  COIN_FLIP: "miniapp-fogplay",

  /** GASBox miniapp */
  GASBOX: "miniapp-gasbox",

  /** Self-loan miniapp */
  SELF_LOAN: "miniapp-self-loan",

  /** Governance anchor miniapp */
  TRUST_ANCHOR: "miniapp-trustanchor",

  /** Profit-optimized voting anchor miniapp */
  PROFIT_ANCHOR: "miniapp-profitanchor",
} as const;

/**
 * Event name constants
 */
export const EVENT_NAMES = {
  /** GASBox pull requested */
  GACHA_PULL_REQUESTED: "GachaPullRequested",

  /** GASBox prize revealed */
  GACHA_PRIZE_REVEALED: "GachaPrizeRevealed",

  /** Loan created */
  LOAN_CREATED: "LoanCreated",

  /** Loan repaid */
  LOAN_REPAID: "LoanRepaid",

  /** Loan closed */
  LOAN_CLOSED: "LoanClosed",

  /** Coin flip bet initiated */
  BET_INITIATED: "BetInitiated",

  /** Coin flip bet resolved */
  BET_RESOLVED: "BetResolved",

  /** Round completed */
  ROUND_COMPLETED: "RoundCompleted",
} as const;

/**
 * Contract operation names
 */
export const CONTRACT_OPERATIONS = {
  /** Get platform statistics */
  GET_PLATFORM_STATS: "getPlatformStats",

  /** Get contract information */
  GET_INFO: "getInfo",

  /** Get user loan count */
  GET_USER_LOAN_COUNT: "getUserLoanCount",

  /** Get user loans */
  GET_USER_LOANS: "getUserLoans",

  /** Get loan details */
  GET_LOAN_DETAILS: "getLoanDetails",

  /** Create new loan */
  CREATE_LOAN: "createLoan",

  /** Initiate bet */
  INITIATE_BET: "initiateBet",

  /** Settle bet */
  SETTLE_BET: "settleBet",

  /** Reveal ticket */
  REVEAL_TICKET: "revealTicket",
} as const;

/**
 * Helper function to calculate percentage from basis points
 */
export function bpsToPercentage(bps: number): number {
  return bps / BLOCKCHAIN_CONSTANTS.BPS_TO_PERCENTAGE_DIVISOR;
}

/**
 * Helper function to convert basis points to decimal percentage
 */
export function bpsToDecimal(bps: number): number {
  return bps / 10000;
}

/**
 * Helper function to convert seconds to human-readable format
 */
export function secondsToHuman(seconds: number): {
  hours: number;
  minutes: number;
  remaining: number;
} {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  return { hours, minutes, remaining };
}

/**
 * Helper function to format a delay with jitter
 */
export function getRetryDelay(baseMs: number, jitterMs: number = 500): number {
  return baseMs + Math.random() * jitterMs;
}
// credential.ts — named re-exports for tree-shaking
export {
  CREDENTIAL_CATEGORIES,
  CREDENTIAL_TYPES,
  ISSUER_POLICIES,
  CREDENTIAL_REGISTRY,
} from "./credential";
export type {
  CredentialCategory,
  CredentialType,
  CredentialIssuerPolicy,
} from "./credential";

// rpc.ts — named re-exports for tree-shaking
export type { NeoNetwork, ExternalIntegrationConfig } from "./rpc";
export {
  N3INDEX_API,
  NEO_MAINNET_RPC,
  NEO_TESTNET_RPC,
  MAINNET_MAGIC,
  TESTNET_MAGIC,
  NEO_HASH,
  GAS_HASH,
  CONTRACT_MANAGEMENT,
  MINIAPP_CONTRACTS,
  EXTERNAL_INTEGRATIONS,
  AA_CONTRACT,
  AA_CONTRACT_TESTNET,
  ORACLE_CONTRACT_MAINNET,
  ORACLE_CONTRACT_TESTNET,
  DATA_FEED_CONTRACT,
  DATA_FEED_CONTRACT_MAINNET,
  DATA_FEED_CONTRACT_TESTNET,
  resolveNeoNetwork,
  getNetwork,
  getRpcUrl,
  getExternalIntegrationConfig,
  getMiniAppContractHash,
  getAAFrontendBaseUrl,
  getAAIdentityWorkspaceUrl,
  getAAAppWorkspaceUrl,
  getAADocsUrl,
} from "./rpc";
