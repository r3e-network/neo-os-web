/**
 * framework/actions-surface — app.actions registered handlers + app.operations
 * keyed state machines (RFC P0-1 residual index.ts split, moved verbatim from
 * index.ts).
 *
 * - `actions.register` / `run`: S1 toast-wrapped handlers with the RFC P1-3
 *   guestBlocked early-return guard and the RFC P0-2 drop-mode single-flight
 *   (re-entrant runs resolve `undefined`, dev-only warning on the drop).
 * - `actions.registerConnectWallet`: the standard connectWallet body (RFC
 *   P1-3) — ensureWallet → refresh fan-out → optional success toast.
 * - `operations.create`: busy/txid/error observable cells with stale-run
 *   protection and the S1/S2 toast policy on settle.
 */

import { createObservable } from "./reactive";
import { singleFlight } from "./utils/async-utils";
import { extractTxid } from "./utils/transaction";
import type { NotifyModule } from "./notify-surface";
import type {
  FrameworkActionOptions,
  FrameworkActionsSurface,
  FrameworkNotifySurface,
  FrameworkOperationRunOptions,
  FrameworkOperationState,
  FrameworkOperationsSurface,
  MiniAppFrameworkNotify,
} from "./types";

function errorMessage(error: unknown, fallback = "error"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Dev-only console warning (RFC P0-2): silent in production builds so the
 * drop-mode DX warnings never reach end users.
 */
function devWarn(message: string): void {
  const env = (import.meta as unknown as { env?: { PROD?: boolean } }).env;
  if (env?.PROD) return;
  console.warn(message);
}

export interface ActionsSurfaceDeps {
  /** app.mode guest check backing the guestBlocked early-return guard (RFC P1-3). */
  isGuest(): boolean;
  /** The app-facing `app.notify` surface — the guestBlocked warn-toast lane. */
  notify: FrameworkNotifySurface;
  /** S2 toast-policy wrapper from the notify module. */
  runWithNotify: NotifyModule["runWithNotify"];
  /** chain.ensureWallet, for the standard connectWallet body (RFC P1-3). */
  ensureWallet(): Promise<string>;
  /** Host action registrar (`ctx.registerAction`; a no-op when the host has none). */
  registerAction(key: string, handler: (...args: unknown[]) => Promise<unknown>): void;
}

/**
 * Build the `app.actions` surface (see module doc).
 *
 * @example
 * ```ts
 * const actions = createActionsSurface({ isGuest, notify, runWithNotify, ensureWallet, registerAction });
 * actions.register("claim", claimReward, { successKey: "claimed" });
 * await actions.run("claim");
 * ```
 */
export function createActionsSurface(deps: ActionsSurfaceDeps): FrameworkActionsSurface {
  const actionHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  // Drop-mode single-flight for actions.run (RFC P0-2): a re-entrant run of
  // the same key resolves `undefined` without running — exactly the previous
  // in-flight Set semantics — now with a dev-visible warning on the drop.
  const runActionFlight = singleFlight<
    [key: string, handler: (...args: unknown[]) => Promise<unknown>, args: readonly unknown[]],
    unknown
  >(
    (key) => key,
    async (_key, handler, args) => handler(...args),
    {
      mode: "drop",
      onDrop: (key) =>
        devWarn(`[framework] actions.run("${key}") dropped — this action is already running`),
    },
  );

  const actions: FrameworkActionsSurface = {
    register<TArgs extends unknown[], TResult>(
      key: string,
      handler: (...args: TArgs) => TResult | Promise<TResult>,
      actionOptions: FrameworkActionOptions<TResult> = {},
    ): void {
      const wrapped = async (...args: unknown[]) =>
        actions.run(key, ...(args as TArgs));
      actionHandlers.set(key, async (...args: unknown[]) => {
        // RFC P1-3 guestBlocked: the standard early-return guard — show the
        // status copy and resolve undefined (never throw), exactly the
        // hand-written `if (app.mode.isGuest()) { …; return; }` semantics.
        if (actionOptions.guestBlocked && deps.isGuest()) {
          const statusKey =
            typeof actionOptions.guestBlocked === "object"
              ? actionOptions.guestBlocked.statusKey
              : "guestModeBlocked";
          deps.notify.warn(statusKey);
          return undefined;
        }
        try {
          return await deps.runWithNotify(
            async () => handler(...(args as TArgs)),
            actionOptions,
          );
        } catch (error) {
          if (actionOptions.rethrow) throw error;
          return undefined;
        }
      });
      deps.registerAction(key, wrapped);
    },
    /**
     * The standard connectWallet body (RFC P1-3): ensureWallet →
     * `onAddress(addr)` mirror hook → refresh fan-out (each loader
     * error-isolated) → optional success toast. Re-entry collapses via the
     * run lane's drop-mode single-flight.
     *
     * `onAddress` runs BEFORE the refresh fan-out so apps holding a local
     * address mirror (`ensureWallet → setAddress(addr) → reload`) can seed
     * the mirror the loaders read. It is NOT error-isolated: a throwing
     * mirror setter is an app bug and surfaces through the action's normal
     * error-toast lane instead of silently proceeding with a stale mirror.
     */
    registerConnectWallet(connectOptions: {
      refresh?: Array<() => Promise<void>>;
      successKey?: string;
      onAddress?: (addr: string) => void;
    } = {}): void {
      actions.register(
        "connectWallet",
        async () => {
          const address = await deps.ensureWallet();
          connectOptions.onAddress?.(address);
          await Promise.all(
            (connectOptions.refresh ?? []).map((load) =>
              load().catch(() => undefined),
            ),
          );
          return address;
        },
        connectOptions.successKey ? { successKey: connectOptions.successKey } : {},
      );
    },
    /**
     * Run a registered action. DROP-mode single-flight per key (RFC P0-2):
     * a re-entrant run resolves `undefined` without running, and an unknown
     * key resolves `undefined` — both now emit a DEV-ONLY console warning
     * (production behavior unchanged) so the silent-undefined DX trap is
     * visible while developing.
     */
    async run<TResult = unknown>(key: string, ...args: unknown[]): Promise<TResult | undefined> {
      const handler = actionHandlers.get(key);
      if (!handler) {
        devWarn(`[framework] actions.run("${key}") — no action registered under this key`);
        return undefined;
      }
      return await runActionFlight(key, handler, args) as TResult | undefined;
    },
  };
  return actions;
}

export interface OperationsSurfaceDeps {
  /** Success toast (S1 params threading) from the notify module. */
  toastSuccess: NotifyModule["toastSuccess"];
  /** RAW injected notify service — the failure lane toasts errors on it directly. */
  notify: Pick<MiniAppFrameworkNotify, "error">;
}

/**
 * Build the `app.operations` surface (see module doc).
 *
 * @example
 * ```ts
 * const operations = createOperationsSurface({ toastSuccess, notify });
 * const claim = operations.create<string>("claim");
 * await claim.run(() => app.chain.write({ operation: "claim" }), { successKey: "claimed" });
 * ```
 */
export function createOperationsSurface(deps: OperationsSurfaceDeps): FrameworkOperationsSurface {
  const { toastSuccess, notify } = deps;

  const operationState = <TResult>(key: string): FrameworkOperationState<TResult> => ({
    key,
    status: "idle",
    txid: "",
    error: "",
    value: null,
    startedAt: 0,
    finishedAt: 0,
    runId: 0,
  });

  return {
    create<TResult = unknown>(key: string) {
      const state = createObservable<FrameworkOperationState<TResult>>(operationState<TResult>(key));
      let runId = 0;
      return {
        state,
        reset(): void {
          state.set(operationState<TResult>(key));
        },
        async run<TValue extends TResult = TResult>(
          work: () => Promise<TValue>,
          runOptions: FrameworkOperationRunOptions<TValue> = {},
        ): Promise<TValue | undefined> {
          const nextRunId = runId + 1;
          runId = nextRunId;
          state.set({
            ...state.get(),
            status: "running",
            txid: "",
            error: "",
            startedAt: Date.now(),
            finishedAt: 0,
            runId: nextRunId,
          });
          try {
            const value = await work();
            if (runId !== nextRunId) return value;
            const txid = extractTxid(value);
            state.set({
              ...state.get(),
              status: "succeeded",
              txid,
              error: "",
              value,
              finishedAt: Date.now(),
            });
            toastSuccess(runOptions.successKey, runOptions.successParams, value);
            return value;
          } catch (error) {
            if (runId !== nextRunId) {
              if (runOptions.rethrow) throw error;
              return undefined;
            }
            state.set({
              ...state.get(),
              status: "failed",
              error: errorMessage(error, runOptions.errorKey),
              finishedAt: Date.now(),
            });
            notify.error?.(error, runOptions.errorKey);
            if (runOptions.rethrow) throw error;
            return undefined;
          }
        },
      };
    },
  };
}
