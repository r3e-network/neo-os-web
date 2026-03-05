/**
 * Shared Application Constants
 * 
 * Centralized constants to eliminate magic numbers across miniapps
 */

// Time constants
export const TIME = {
  MS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  SECONDS_PER_DAY: 86400,
  MS_PER_DAY: 86400000,
  DAYS_PER_YEAR: 365,
  DAYS_PER_LEAP_YEAR: 366,
  DEFAULT_TIMEOUT_MS: 30000,
  CELEBRATION_DURATION_MS: 3000,
  DEBOUNCE_DELAY_MS: 300,
  ANIMATION_DURATION_MS: 500,
} as const;

// Responsive breakpoints
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
  LARGE_DESKTOP: 1440,
} as const;

// Game/financial constants
export const GAME = {
  MAX_BET_GAS: 100,
  MIN_BET_GAS: 0.01,
  DEFAULT_FEE_BPS: 50, // 0.5% in basis points
  MAX_FEE_BPS: 1000, // 10% in basis points
  BASIS_POINTS_DIVISOR: 10000,
  GAS_DECIMALS: 8,
  NEO_DECIMALS: 0,
} as const;

// Validation limits
export const LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_MEMO_LENGTH: 140,
  MAX_PHOTOS_PER_UPLOAD: 5,
  MAX_FILE_SIZE_MB: 10,
  MAX_RETRIES: 3,
  MIN_PASSWORD_LENGTH: 8,
} as const;

// Contract/common values
export const CONTRACT = {
  MAX_LOCK_DAYS: 3650, // 10 years
  MAX_MILESTONES: 10,
  DEFAULT_GAS_PRICE: 0.0001,
} as const;

// Export all as unified CONSTANTS object
export const CONSTANTS = {
  TIME,
  BREAKPOINTS,
  GAME,
  LIMITS,
  CONTRACT,
} as const;

// Default values for common props
export const DEFAULTS = {
  DESKTOP_BREAKPOINT: BREAKPOINTS.TABLET, // 1024
  MOBILE_BREAKPOINT: BREAKPOINTS.MOBILE, // 768
  ANIMATION_DURATION: TIME.ANIMATION_DURATION_MS,
  TIMEOUT_MS: TIME.DEFAULT_TIMEOUT_MS,
} as const;
