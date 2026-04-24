/**
 * Action Registration Utility
 *
 * Reduces the repetitive try/catch + status messaging boilerplate
 * that every miniapp's setup function needs when calling registerAction().
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
 * Register multiple actions on the miniapp context with standardized
 * try/catch, status messaging, and error handling.
 */
export function registerActions(
  ctx: MiniAppContext,
  actions: Record<string, ActionDef>,
): void {
  for (const [key, def] of Object.entries(actions)) {
    ctx.registerAction(key, async (...args: unknown[]) => {
      try {
        await def.handler(...args);
        if (def.successKey) {
          ctx.setStatus(ctx.t(def.successKey), "success");
        }
      } catch (e) {
        ctx.setStatus(
          e instanceof Error ? e.message : ctx.t(def.errorKey ?? "error"),
          "error",
        );
      }
    });
  }
}
