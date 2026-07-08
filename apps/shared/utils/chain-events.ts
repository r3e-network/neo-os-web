/**
 * Contract event state-slot helpers — re-exported from the framework
 * canonical.
 *
 * The implementation moved to framework/utils/chain-events.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/chain-events`
 * imports working with the SAME function identities.
 */

export { eventValue, eventStateValue } from "../../../framework/utils/chain-events";
