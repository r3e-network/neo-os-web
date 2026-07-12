/**
 * framework/errors-surface — app.errors (RFC P0-4).
 *
 * The one-liner error → user-copy lane for the `ctx.setStatus(…, "error")`
 * feedback path. `messageOf` routes through the SAME chain-error family
 * mapping `app.notify.error` uses, so the two feedback lanes (status strip
 * and toast) converge on identical copy for wallet/VM/RPC failures.
 *
 * Kills the fleet ternary (232 occurrences across 61 apps):
 *
 *   `error instanceof Error ? error.message : t("fallback")`
 *   → `app.errors.messageOf(error, t("fallback"))`
 */

import { mapChainError } from "./utils/chain-errors";
import { isMiniAppError } from "./utils/errors";

type Translator = (key: string, params?: Record<string, string | number>) => string;

export interface ErrorsSurfaceDeps {
  /** App i18n translator (en+zh) — used for chain-error family copy. */
  t: Translator;
}

/** app.errors — error→message extraction + typed code checks. */
export interface FrameworkErrorsSurface {
  /**
   * One-liner error → display string.
   *
   * Priority: `MiniAppError` user message (translated) > mapped chain-error
   * family copy (the localized wallet/VM/RPC strings `app.notify.error`
   * shows) > `Error.message` > string errors verbatim > `fallback` >
   * `t("error")`.
   *
   * `fallback` is an already-translated STRING, not a key — pass
   * `t("myFallbackKey")` so the copy stays en+zh aware.
   *
   * @example
   * ```ts
   * try {
   *   await app.chain.invoke("mint", args);
   * } catch (error) {
   *   ctx.setStatus(app.errors.messageOf(error, t("mintFailed")), "error");
   * }
   * ```
   */
  messageOf(error: unknown, fallback?: string): string;
  /**
   * Typed code check across every framework error class — matches
   * `MiniAppError` descendants (`code`) and the code-carrying non-MiniAppError
   * classes (e.g. `RewardGameError`) uniformly, so apps branch on stable
   * codes instead of message text.
   *
   * @example
   * ```ts
   * if (app.errors.is(error, "GUEST_MODE_BLOCKED")) showUpsell();
   * ```
   */
  is(error: unknown, code: string): boolean;
}

/** Build the `app.errors` surface (see {@link FrameworkErrorsSurface}). */
export function createErrorsSurface(deps: ErrorsSurfaceDeps): FrameworkErrorsSurface {
  const { t } = deps;
  return {
    messageOf(error: unknown, fallback?: string): string {
      if (isMiniAppError(error)) {
        const user = error.translatedUserMessage || error.userMessage;
        if (user) return user;
      }
      const mapped = mapChainError(error, t);
      if (mapped) return mapped;
      if (error instanceof Error && error.message) return error.message;
      if (typeof error === "string" && error) return error;
      return fallback ?? t("error");
    },
    is(error: unknown, code: string): boolean {
      if (!(error instanceof Error)) return false;
      const errorCode = (error as Error & { code?: unknown }).code;
      return typeof errorCode === "string" && errorCode === code;
    },
  };
}
