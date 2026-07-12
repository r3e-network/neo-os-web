/**
 * framework/notify-surface — app.notify + the S1/S2 toast wrappers
 * (RFC P0-1 §2 step 3, moved verbatim from index.ts).
 *
 * app.notify is the single toast surface for miniapps. It delegates to the
 * injected notify service; standalone hosts without one fall back to
 * `ctx.setStatus` with the same localized copy (chain errors mapped through
 * utils/chain-errors so wallet/VM/RPC strings never reach a toast verbatim).
 *
 * `runWithNotify` is the S2 policy wrapper every framework write lane
 * composes (guest guard → permission gate → notify wrap → reload-on-success).
 */

import { mapChainError } from "./utils/chain-errors";
import type {
  FrameworkActionOptions,
  FrameworkNotifyPolicy,
  FrameworkNotifySurface,
  FrameworkSuccessParams,
  MiniAppFrameworkNotify,
} from "./types";

export interface NotifySurfaceDeps {
  /** Injected host notify service (may be empty — setStatus fallback). */
  notify: MiniAppFrameworkNotify;
  /** App i18n translator. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Live setStatus fallback lane (standalone hosts without a notify service). */
  setStatus?: (message: string, type: "success" | "error" | "warning" | "info") => void;
}

/** Options accepted by {@link NotifyModule.runWithNotify}. */
export interface RunWithNotifyOptions<T> {
  successKey?: string;
  successParams?: FrameworkSuccessParams<T>;
  errorKey?: string;
  notify?: FrameworkNotifyPolicy;
}

export interface NotifyModule {
  /** The app-facing `app.notify` surface. */
  appNotify: FrameworkNotifySurface;
  /** Success toast on the injected notify service, threading params (S1). */
  toastSuccess<T>(
    successKey: string | undefined,
    successParams: FrameworkSuccessParams<T> | undefined,
    result: T,
  ): void;
  /** S2 policy wrapper — toasts per policy, errors always rethrow (typed). */
  runWithNotify<T>(work: () => Promise<T>, runOptions?: RunWithNotifyOptions<T>): Promise<T>;
}

/** Resolve a success-params record or `(result) => params` builder. */
function resolveSuccessParams<T>(
  params: FrameworkSuccessParams<T> | undefined,
  result: T,
): Record<string, unknown> | undefined {
  return typeof params === "function" ? params(result) : params;
}

/**
 * Build the notify module (see module doc).
 *
 * @example
 * ```ts
 * const { appNotify, runWithNotify } = createNotifyModule({ notify, t, setStatus });
 * await runWithNotify(() => chain.invoke("mint", args), { successKey: "minted" });
 * ```
 */
export function createNotifyModule(deps: NotifySurfaceDeps): NotifyModule {
  const { notify, t } = deps;
  const setStatus = (
    message: string,
    type: "success" | "error" | "warning" | "info",
  ): void => deps.setStatus?.(message, type);

  const toastSuccess = <T>(
    successKey: string | undefined,
    successParams: FrameworkSuccessParams<T> | undefined,
    result: T,
  ): void => {
    if (!successKey) return;
    const params = resolveSuccessParams(successParams, result);
    if (params === undefined) notify.success?.(successKey);
    else notify.success?.(successKey, params as Record<string, string | number>);
  };

  const runWithNotify = async <T>(
    work: () => Promise<T>,
    runOptions: RunWithNotifyOptions<T> = {},
  ): Promise<T> => {
    const policy = runOptions.notify ?? "all";
    // 'silent' bypasses the notify service entirely — errors still throw
    // (typed) so multi-step composables own their own messaging (S2).
    if (policy === "silent") return work();
    const successKey = policy === "all" ? runOptions.successKey : undefined;
    const successParams = policy === "all" ? runOptions.successParams : undefined;
    if (notify.guardResult) {
      // The host guardResult cannot thread toast params — when params are
      // present, suppress its success toast and emit our own with them.
      const result = await notify.guardResult(
        work,
        successParams === undefined ? successKey : undefined,
        runOptions.errorKey,
      );
      if (result.ok) {
        if (successParams !== undefined) toastSuccess(successKey, successParams, result.value);
        return result.value;
      }
      throw result.error;
    }
    try {
      const value = await work();
      toastSuccess(successKey, successParams, value);
      return value;
    } catch (error) {
      notify.error?.(error, runOptions.errorKey);
      throw error;
    }
  };

  const appNotify: FrameworkNotifySurface = {
    /** Success toast — t-key + params interpolation ("withdrew {amount}"). */
    success(key: string, params?: Record<string, unknown>): void {
      const coerced = params as Record<string, string | number> | undefined;
      if (notify.success) notify.success(key, coerced);
      else setStatus(t(key, coerced), "success");
    },
    info(key: string, params?: Record<string, unknown>): void {
      const coerced = params as Record<string, string | number> | undefined;
      if (notify.info) notify.info(key, coerced);
      else setStatus(t(key, coerced), "info");
    },
    warn(key: string, params?: Record<string, unknown>): void {
      const coerced = params as Record<string, string | number> | undefined;
      if (notify.warn) notify.warn(key, coerced);
      else setStatus(t(key, coerced), "warning");
    },
    /** Error toast — chain/RPC failures map to localized family copy. */
    error(error: unknown, fallbackKey?: string): void {
      if (notify.error) {
        notify.error(error, fallbackKey);
        return;
      }
      const message =
        mapChainError(error, t) ??
        (error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : t(fallbackKey ?? "error"));
      setStatus(message, "error");
    },
    /**
     * Wrap an async operation with automatic toasts, returning an explicit
     * `{ok}` discriminator so callers can gate post-success steps without
     * re-implementing try/catch. `successParams` may be a `(result) => params`
     * builder so post-write values drive the toast copy.
     */
    async guardResult<T>(
      fn: () => Promise<T>,
      guardOptions: FrameworkActionOptions<T> = {},
    ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
      try {
        const value = await fn();
        if (guardOptions.successKey) {
          const params = resolveSuccessParams(guardOptions.successParams, value);
          if (params === undefined) appNotify.success(guardOptions.successKey);
          else appNotify.success(guardOptions.successKey, params);
        }
        return { ok: true, value };
      } catch (error) {
        appNotify.error(error, guardOptions.errorKey);
        return { ok: false, error };
      }
    },
    /**
     * Like {@link FrameworkNotifySurface.guardResult} but resolves with the
     * value or `undefined` (or rethrows with `rethrow: true`) — the
     * per-action toast wrapper ~40 apps hand-roll around every registered
     * action.
     */
    async guard<T>(
      fn: () => Promise<T>,
      guardOptions: FrameworkActionOptions<T> = {},
    ): Promise<T | undefined> {
      const result = await appNotify.guardResult(fn, guardOptions);
      if (result.ok) return result.value;
      if (guardOptions.rethrow) throw result.error;
      return undefined;
    },
  };

  return { appNotify, toastSuccess, runWithNotify };
}
