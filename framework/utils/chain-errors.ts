/**
 * Pure chain/RPC error classification and localization mapping.
 *
 * Canonical home of the `classifyChainError` / `mapChainError` helpers that
 * previously lived inside apps/shared/services/NotificationService.ts. The
 * NotificationService still delegates to these; the framework notify surface
 * uses them directly so wallet/VM/RPC strings never reach a toast verbatim.
 */

/**
 * i18n keys (all defined in `@shared/locale/base-messages`) that the known
 * chain/RPC failure families map to.
 */
export type ChainErrorKey =
  | "userRejected"
  | "contractUnavailable"
  | "insufficientGas"
  | "networkTimeout"
  | "transactionFailed";

/**
 * Known failure families, most specific first. A family only needs to match
 * the raw text once — order matters because a VM FAULT message often embeds a
 * more specific assert (e.g. `FAULT: insufficient prepaid gas` must classify
 * as `insufficientGas`, not the generic `transactionFailed`).
 */
const CHAIN_ERROR_FAMILIES: ReadonlyArray<{
  key: ChainErrorKey;
  patterns: readonly RegExp[];
}> = [
  {
    key: "userRejected",
    patterns: [
      /user\s+(rejected|denied|cancel\w*)/i,
      /(rejected|denied|cancel(?:l?ed))\s+by\s+(the\s+)?user/i,
      /\bUSER_REJECT(?:ED)?\b/,
    ],
  },
  {
    key: "contractUnavailable",
    patterns: [
      /contract\s+(?:is\s+)?not\s+(?:configured|deployed|available)/i,
      /no\s+contract\s+(?:hash|address)/i,
      /contract\s+(?:hash|address)\s+(?:is\s+)?(?:not\s+configured|missing)/i,
    ],
  },
  {
    key: "insufficientGas",
    patterns: [
      /insufficient\s+(?:prepaid\s+)?gas/i,
      /insufficient\s+(?:funds|network\s+fee)/i,
      /not\s+enough\s+gas/i,
    ],
  },
  {
    key: "networkTimeout",
    patterns: [
      /\btimed?\s*out\b/i,
      /\btimeout\b/i,
      /failed\s+to\s+fetch/i,
      /fetch\s+failed/i,
      /network\s*error/i,
      /\bECONN(?:REFUSED|RESET)\b|\bETIMEDOUT\b|\bENOTFOUND\b/,
      /aborted\s+due\s+to\s+timeout/i,
    ],
  },
  {
    key: "transactionFailed",
    patterns: [
      /\bFAULT\b/,
      /System\.Contract\.Call/i,
      /vm\s+exited/i,
      /smart\s+contract\s+execution/i,
    ],
  },
];

function rawErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/**
 * Classify an error into a known chain/RPC failure family.
 *
 * Returns the matching i18n key, or `null` when the error does not belong to
 * a known family — callers should then keep their existing handling (the raw
 * message may already be a localized, app-authored string).
 */
export function classifyChainError(error: unknown): ChainErrorKey | null {
  if (error instanceof Error && error.name === "TimeoutError") {
    return "networkTimeout";
  }
  const raw = rawErrorText(error);
  if (!raw) return null;
  for (const family of CHAIN_ERROR_FAMILIES) {
    if (family.patterns.some((pattern) => pattern.test(raw))) {
      return family.key;
    }
  }
  return null;
}

/**
 * Map a chain/RPC error to a localized, user-readable message.
 *
 * Pattern-matches the known failure families (user rejected, contract not
 * configured, insufficient GAS / prepaid gas, RPC timeout / network failure,
 * VM FAULT) against the raw error text and translates the family's i18n key.
 * Unrecognized errors return `null` so callers can fall back to their own
 * handling without losing meaningful app-level messages.
 *
 * @param error - The caught error (Error, string, or anything)
 * @param t     - i18n translate function (keys live in base-messages)
 * @returns Translated message for a known family, otherwise `null`
 */
export function mapChainError(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const key = classifyChainError(error);
  return key ? t(key) : null;
}
