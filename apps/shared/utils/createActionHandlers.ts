/**
 * Action Registration Utility
 *
 * Compatibility helper for older miniapps that register several actions at
 * once. Internally it now delegates to the shared MiniApp framework so action
 * execution, notifications, and single-flight handling stay standardized.
 *
 * @deprecated Register actions directly on the framework instead:
 * `ctx.framework.actions.register(key, handler, { successKey, successParams,
 * errorKey })` — the direct surface also supports `successParams`
 * interpolation, which this bulk helper cannot express (framework-extraction
 * plan, Wave 6). Remaining consumers (do not add more): neo-convert,
 * explorer, wallet-health, time-capsule entrypoints.
 *
 * @example
 * ```ts
 * registerActions(ctx, {
 *   doSomething: {
 *     handler: () => composable.doSomething(),
 *     successKey: "doSomething.success",
 *   },
 *   transfer: {
 *     handler: (amount) => composable.transfer(amount),
 *     successKey: "transfer.success",
 *     errorKey: "transfer.error",
 *   },
 * });
 * ```
 */

import type { MiniAppContext } from "@shared/types/miniapp-context";

export interface ActionDef {
  /** The function to execute when the action is triggered */
  handler: (...args: unknown[]) => unknown | Promise<unknown>;
  /** i18n key for the success status message (if omitted, no success toast) */
  successKey?: string;
  /** i18n key for the fallback error message (defaults to "error") */
  errorKey?: string;
}

/**
 * Register multiple actions on the miniapp framework.
 */
export function registerActions(
  ctx: MiniAppContext,
  actions: Record<string, ActionDef>,
): void {
  for (const [key, def] of Object.entries(actions)) {
    ctx.framework.actions.register(key, async (...args: unknown[]) => {
      await def.handler(...args);
    }, {
      successKey: def.successKey,
      errorKey: def.errorKey,
    });
  }
}
