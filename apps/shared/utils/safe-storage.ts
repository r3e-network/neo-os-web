/**
 * SafeStorage — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/safe-storage.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/safe-storage`
 * imports working with the SAME function identities.
 */

export {
  localStorageAvailable,
  safeReadStorage,
  safeWriteStorage,
  safeRemoveStorage,
  safeReadJSON,
  safeWriteJSON,
} from "../../../framework/utils/safe-storage";
