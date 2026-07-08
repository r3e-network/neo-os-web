/**
 * AA account derivation helpers — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/aa-account.ts (S10 app.aa
 * extraction); this file keeps existing `@shared/utils/aa-account` imports
 * working with the SAME function identities, so derivations performed by
 * apps and by framework code stay byte-identical.
 */

export {
  AA_REGISTRATION_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MIN_ESCAPE_TIMELOCK_SECONDS,
  AA_REGISTRATION_MAX_ESCAPE_TIMELOCK_SECONDS,
  deriveAAAccountIdHash,
  deriveRegistrationAccountIdHash,
  buildAnchorAgentVerifierParam,
  deriveAnchorAgentAccounts,
  generateAASessionKeyPair,
} from "../../../framework/utils/aa-account";

export type {
  RegistrationAccountOptions,
  AnchorAgentDerivationOptions,
  AnchorAgentAccount,
} from "../../../framework/utils/aa-account";
