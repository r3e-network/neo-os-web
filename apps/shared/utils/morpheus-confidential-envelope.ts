/**
 * Morpheus confidential-payload envelope — re-exported from the framework
 * canonical.
 *
 * The implementation moved to
 * framework/utils/morpheus-confidential-envelope.ts (S0 utils consolidation);
 * this file keeps existing `@shared/utils/morpheus-confidential-envelope`
 * imports working with the SAME function identities.
 */

export {
  encodeBytesToBase64,
  sha256Hex,
  encryptTextWithOraclePublicKey,
  encryptJsonWithOraclePublicKey,
  buildConfidentialTransferPackage,
} from "../../../framework/utils/morpheus-confidential-envelope";
export type {
  ConfidentialTransferInput,
  ConfidentialTransferPackage,
} from "../../../framework/utils/morpheus-confidential-envelope";
