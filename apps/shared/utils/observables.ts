/**
 * Observable combinators shared by miniapp composables — re-exported from
 * the framework canonical.
 *
 * The implementation moved to framework/reactive.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/observables`
 * imports working with the SAME function identity. The framework Observable
 * shape is structurally identical to the shared react/context Observable.
 */

export { combineBusy } from "../../../framework/reactive";
