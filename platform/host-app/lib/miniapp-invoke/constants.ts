/**
 * Per-app fee and memo constants for host-side miniapp invoke recipes.
 *
 * Every deposit-then-act contract identifies credit by an exact transfer memo,
 * so the values below must stay in sync with the deployed contract conventions
 * (see deploy/scripts/live_validate_*.mjs for the on-chain harnesses).
 */

export const DAILY_CHECKIN_APP_ID = "miniapp-dailycheckin";
export const DAILY_CHECKIN_FEE_FIXED8 = "100000";
export const DAILY_CHECKIN_MEMO = "miniapp-dailycheckin:checkin";

export const GRAVEYARD_APP_ID = "miniapp-graveyard";
export const GRAVEYARD_DEFAULT_BURY_FEE_FIXED8 = "10000000";
export const GRAVEYARD_DEFAULT_FORGET_FEE_FIXED8 = "100000000";
export const GRAVEYARD_BURY_MEMO = "miniapp-graveyard:memory";
export const GRAVEYARD_FORGET_MEMO = "miniapp-graveyard:forget";

export const RED_ENVELOPE_APP_ID = "miniapp-redenvelope";
export const RED_ENVELOPE_CREATE_MEMO = "miniapp-redenvelope:create";

export const NEO_PAY_APP_ID = "miniapp-neo-pay";

export const SELF_LOAN_APP_ID = "miniapp-self-loan";
export const SELF_LOAN_COLLATERAL_MEMO = "miniapp-self-loan:collateral";
export const SELF_LOAN_POOL_MEMO = "miniapp-self-loan:pool";
export const SELF_LOAN_REPAY_MEMO = "miniapp-self-loan:repay";

export const DEV_TIPPING_APP_ID = "miniapp-dev-tipping";
export const DEV_TIPPING_TIP_MEMO = "miniapp-dev-tipping:tip";
export const DEV_TIPPING_MIN_TIP_FIXED8 = 100000n;

export const MEMORIAL_SHRINE_APP_ID = "miniapp-memorial-shrine";
export const MEMORIAL_SHRINE_TRIBUTE_MEMO = "miniapp-memorial-shrine:tribute";
export const MEMORIAL_SHRINE_OFFERING_COSTS_FIXED8: Record<string, string> = {
  "1": "1000000",
  "2": "2000000",
  "3": "3000000",
  "4": "5000000",
  "5": "10000000",
  "6": "50000000",
};

export const RECOVERY_GUARDIAN_APP_ID = "miniapp-recovery-guardian";
export const RECOVERY_DEFAULT_PROVIDER = "web3auth";
export const RECOVERY_DEFAULT_ENCRYPTED_PARAMS = "{}";

export const TIME_CAPSULE_APP_ID = "miniapp-time-capsule";
export const TIME_CAPSULE_DEFAULT_SEAL_FEE_FIXED8 = "20000000";
export const TIME_CAPSULE_SEAL_MEMO = "miniapp-time-capsule:bury";

export const UNBREAKABLE_VAULT_APP_ID = "miniapp-unbreakablevault";
export const UNBREAKABLE_VAULT_CREATE_MEMO = "miniapp-unbreakablevault:create";
export const UNBREAKABLE_VAULT_ATTEMPT_MEMO = "miniapp-unbreakablevault:attempt";
export const UNBREAKABLE_VAULT_INCREASE_MEMO = "miniapp-unbreakablevault:increase";
export const UNBREAKABLE_VAULT_MIN_BOUNTY_FIXED8 = 100000000n;
export const UNBREAKABLE_VAULT_DEFAULT_ATTEMPT_FEE_FIXED8 = "10000000";

export const FUND_GAME_CREDIT_MEMO_BY_APP: Record<string, string> = {
  "miniapp-fogplay": "miniapp-fogplay:bet",
};
