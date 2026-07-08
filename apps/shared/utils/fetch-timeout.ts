/**
 * Fetch-with-timeout helper — re-exported from the framework canonical.
 *
 * The implementation moved to framework/utils/fetch-timeout.ts (S0 utils
 * consolidation); this file keeps existing `@shared/utils/fetch-timeout`
 * imports working with the SAME class identities, so
 * `instanceof FetchTimeoutError` / `HttpResponseError` checks keep matching
 * errors thrown from framework code.
 */

export {
  DEFAULT_FETCH_TIMEOUT_MS,
  FetchTimeoutError,
  HttpResponseError,
  isTransientFetchError,
  fetchWithTimeout,
} from "../../../framework/utils/fetch-timeout";
export type { FetchWithTimeoutInit } from "../../../framework/utils/fetch-timeout";
