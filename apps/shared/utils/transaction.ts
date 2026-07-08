/**
 * Transaction-result helpers — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/transaction.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/transaction`
 * imports working with the SAME function identities.
 */

export { extractTxid, pollForTxEvent } from "../../../framework/utils/transaction";
export type { PollForTxEventParams } from "../../../framework/utils/transaction";
