/**
 * console-kernel.ts — shared preview-builder wiring for console miniapps.
 *
 * The four oracle consoles (http / neodid / seal / vrf), oracle-compute-lab,
 * and neo-x-bridge each hand-roll the same setup()-side plumbing around the
 * ConsoleToolConfig kit:
 *
 *   - a `lastStatus` / `lastDigest` / `requestCount` observable trio (plus the
 *     static `networkLabel` / `endpointLabel` hero-meta observables),
 *   - a `buildRequest` action that runs `ConsoleToolConfig.buildResult` and
 *     branches on the `payload.status === "input_required"` validation
 *     sentinel (warning toast, digest placeholder restored, tally untouched),
 *   - a PlayArea "previewing" flag driven by a self-clearing timeout.
 *
 * This module is the single copy of that wiring (extraction plan §S14). It
 * stays in apps/shared — not framework/ — by the boundary rule: this is UI
 * glue over the shared console kit, not chain/business plumbing. Wave 1 is
 * additive; the console apps adopt the kernel in Wave 2B.
 *
 * Semantics are snapshotted from oracle-http-console/src/main.tsx (the
 * reference console) with the two proven variants folded in as options:
 * oracle-vrf-console's `payload.requestId` digest fallback (a no-op for
 * payloads that carry `digest`, mirroring ConsoleToolPanel.applyResult) and
 * oracle-seal-console's toast-free wiring (`notify: "silent"`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createObservable } from "../react/context";
import type { Observable } from "../react/context";
import type { StatusType } from "../composables/useStatusMessage";
import type { ConsoleResult, ConsoleToolConfig } from "./ConsoleToolPanel";

// ============================================================================
// input_required sentinel
// ============================================================================

/**
 * Payload status sentinel a buildResult sets to mark a preview as a validation
 * failure: no digest was really produced, the request tally must not move, and
 * the host toast must be a warning — never a green success.
 */
export const CONSOLE_INPUT_REQUIRED = "input_required";

/** True when a built ConsoleResult flagged its payload as input_required. */
export function isConsoleInputRequired(result: ConsoleResult): boolean {
  return result.payload.status === CONSOLE_INPUT_REQUIRED;
}

// ============================================================================
// Preview kernel (setup()-side wiring)
// ============================================================================

/** Toast notification policy for kernel-applied results. */
export type ConsoleNotifyPolicy = "all" | "silent";

export interface ConsolePreviewKernelOptions {
  /** Translation function (usually `ctx.t`). */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Toast dispatcher (usually `ctx.setStatus`). Optional so the kernel
   * degrades gracefully in headless/standalone hosts without a toast surface.
   */
  setStatus?: (msg: string, type: StatusType) => void;
  /** Seed for the hero-meta network label observable. */
  networkLabel: string;
  /** Seed for the hero-meta endpoint label observable. */
  endpointLabel: string;
  /**
   * The console's preview builder (usually `consoleConfig.buildResult`).
   * Optional because bespoke consoles (neo-x-bridge) register their own
   * actions and only use the kernel's observables via `recordRequest`.
   */
  buildResult?: ConsoleToolConfig["buildResult"];
  /**
   * i18n key for the digest placeholder seeded into `lastDigest` and restored
   * on input_required. Defaults to "digestPlaceholder" (the oracle consoles);
   * neo-x-bridge seeds "notAvailable". Resolved through `t` at call time so a
   * locale switch never freezes a stale placeholder into the stats.
   */
  digestPlaceholderKey?: string;
  /** i18n key seeding `lastStatus`. Defaults to "statusReady". */
  readyStatusKey?: string;
  /**
   * Toast policy. "all" (default) reproduces the http/neodid/vrf/compute-lab
   * consoles: success toast on a real preview, warning on input_required.
   * "silent" reproduces oracle-seal-console, which updates the stats but never
   * toasts from the buildRequest action.
   */
  notify?: ConsoleNotifyPolicy;
}

/** The observable trio + hero-meta labels every console spreads into state. */
export interface ConsolePreviewKernelState {
  networkLabel: Observable<string>;
  endpointLabel: Observable<string>;
  lastStatus: Observable<string>;
  lastDigest: Observable<string>;
  requestCount: Observable<number>;
}

export interface ConsoleRequestRecord {
  /** Already-localized status line to show in the stats strip. */
  status: string;
  /** Digest/operation id; empty or missing values keep the current digest. */
  digest?: string | null;
}

export interface ConsolePreviewKernel {
  /** Spread into the setup() result: `return { state: kernel.state, ... }`. */
  state: ConsolePreviewKernelState;
  /**
   * Apply a built ConsoleResult to the observables + toast, exactly like the
   * hand-rolled console handlers: always set `lastStatus`; on a real preview
   * set `lastDigest` (payload.digest ?? payload.requestId, else placeholder)
   * and bump `requestCount`; on input_required restore the placeholder and
   * leave the tally untouched. Returns the result for action chaining.
   */
  applyResult(result: ConsoleResult): ConsoleResult;
  /**
   * The canonical preview action. Wire it verbatim:
   * `ctx.framework.actions.register("buildRequest", kernel.buildRequest)`.
   */
  buildRequest(...args: unknown[]): Promise<ConsoleResult>;
  /**
   * Low-level tally for bespoke recorders (neo-x-bridge's recordIntent core):
   * set status/digest and bump the counter without a ConsoleResult and without
   * toasting — mid-flow messaging stays with the caller.
   */
  recordRequest(entry: ConsoleRequestRecord): void;
  /** Restore the seeded placeholders and zero the session request tally. */
  reset(): void;
}

/**
 * Create the shared preview-builder wiring for a console miniapp.
 *
 * @example
 * ```ts
 * setup(ctx) {
 *   const kernel = createConsolePreviewKernel({
 *     t: ctx.t,
 *     setStatus: ctx.setStatus,
 *     networkLabel: appMeta.networkLabel,
 *     endpointLabel: appMeta.endpointLabel,
 *     buildResult: consoleConfig.buildResult,
 *   });
 *   ctx.framework.actions.register("buildRequest", kernel.buildRequest);
 *   return { state: kernel.state, loadData: async () => {} };
 * }
 * ```
 */
export function createConsolePreviewKernel(
  options: ConsolePreviewKernelOptions,
): ConsolePreviewKernel {
  const {
    t,
    setStatus,
    buildResult,
    digestPlaceholderKey = "digestPlaceholder",
    readyStatusKey = "statusReady",
    notify = "all",
  } = options;

  const state: ConsolePreviewKernelState = {
    networkLabel: createObservable(options.networkLabel),
    endpointLabel: createObservable(options.endpointLabel),
    lastStatus: createObservable(t(readyStatusKey)),
    lastDigest: createObservable(t(digestPlaceholderKey)),
    requestCount: createObservable(0),
  };

  function applyResult(result: ConsoleResult): ConsoleResult {
    const payload = result.payload as {
      status?: unknown;
      digest?: unknown;
      requestId?: unknown;
    };
    const ok = payload.status !== CONSOLE_INPUT_REQUIRED;
    state.lastStatus.set(result.status);
    if (ok) {
      const digest = payload.digest ?? payload.requestId ?? t(digestPlaceholderKey);
      state.lastDigest.set(String(digest));
      state.requestCount.set(state.requestCount.get() + 1);
    } else {
      // Validation failure: no digest was produced — restore the placeholder
      // so the stats never show a digest for a request that never existed.
      state.lastDigest.set(t(digestPlaceholderKey));
    }
    if (notify !== "silent") {
      setStatus?.(result.status, ok ? "success" : "warning");
    }
    return result;
  }

  async function buildRequest(...args: unknown[]): Promise<ConsoleResult> {
    if (!buildResult) {
      throw new Error(
        "console-kernel: buildRequest requires `buildResult` in createConsolePreviewKernel options " +
          "(pass consoleConfig.buildResult, or register a bespoke action and use recordRequest instead)",
      );
    }
    const values = (args[0] ?? {}) as Record<string, string>;
    return applyResult(buildResult(values, t));
  }

  function recordRequest(entry: ConsoleRequestRecord): void {
    state.lastStatus.set(entry.status);
    if (entry.digest != null && entry.digest !== "") {
      state.lastDigest.set(String(entry.digest));
    }
    state.requestCount.set(state.requestCount.get() + 1);
  }

  function reset(): void {
    state.lastStatus.set(t(readyStatusKey));
    state.lastDigest.set(t(digestPlaceholderKey));
    state.requestCount.set(0);
  }

  return { state, applyResult, buildRequest, recordRequest, reset };
}

// ============================================================================
// Transient flag (PlayArea-side helper)
// ============================================================================

export interface TransientFlag {
  /** Whether the flag is currently raised. */
  active: boolean;
  /** Raise the flag and (re)start the self-clearing timeout. */
  trigger: () => void;
  /** Lower the flag immediately and cancel any pending timeout. */
  clear: () => void;
}

/**
 * A boolean that raises on `trigger()` and clears itself after `durationMs` —
 * the "previewing"/"building"/"copied" pulse every console PlayArea hand-rolls
 * with a useState + useRef<timeout> + unmount-cleanup trio. Re-triggering
 * restarts the countdown; the pending timeout is cancelled on unmount so a
 * late tick never sets state on an unmounted component.
 */
export function useTransientFlag(durationMs = 1200): TransientFlag {
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setActive(false);
  }, []);

  const trigger = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActive(true);
    timeoutRef.current = setTimeout(() => {
      setActive(false);
      timeoutRef.current = null;
    }, durationMs);
  }, [durationMs]);

  return { active, trigger, clear };
}
