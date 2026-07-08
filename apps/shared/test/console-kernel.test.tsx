/**
 * Shared console preview kernel (extraction plan §S14).
 *
 * Proves that createConsolePreviewKernel reproduces the preview-builder wiring
 * currently copy-pasted across the 4 oracle consoles + oracle-compute-lab +
 * neo-x-bridge, using oracle-http-console as the reference: its real
 * consoleConfig.buildResult drives both the kernel and a verbatim replica of
 * the app's current main.tsx handler, and every observable transition + toast
 * must match step for step. Wave 1 is additive — the consoles migrate onto the
 * kernel in Wave 2B — so a source snapshot also pins the reference wiring the
 * kernel mirrors, flagging any drift before the migration lands.
 */

import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { StatusType } from "../composables/useStatusMessage";
import {
  CONSOLE_INPUT_REQUIRED,
  createConsolePreviewKernel,
  isConsoleInputRequired,
  useTransientFlag,
} from "../components-react/console-kernel";
import type { ConsoleResult } from "../components-react/ConsoleToolPanel";
import { consoleConfig as httpConsoleConfig } from "../../oracle-http-console/src/appConfig";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

// ----------------------------------------------------------------------------
// Shared fixtures
// ----------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  statusReady: "Ready",
  digestPlaceholder: "No digest",
  notAvailable: "N/A",
  httpReady: "HTTP request ready",
  httpInvalidUrl: "Enter a valid http(s) URL",
  httpInvalidPath: "Enter a valid JSON path",
  httpSummary: "{method} request prepared",
  method: "Method",
  url: "URL",
  urlValid: "URL valid",
  jsonPath: "JSON Path",
  pathValid: "Path valid",
  statDigest: "Digest",
  yes: "Yes",
  no: "No",
};

function t(key: string, params: Record<string, string | number> = {}): string {
  let text = MESSAGES[key] ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

function httpValues(overrides: Partial<Record<string, string>> = {}) {
  const defaults = Object.fromEntries(
    httpConsoleConfig.fields.map((field) => [field.key, String(field.defaultValue ?? "")]),
  );
  return { ...defaults, ...overrides };
}

type ToastLog = Array<{ msg: string; type: StatusType }>;

function toastRecorder(log: ToastLog) {
  return (msg: string, type: StatusType) => {
    log.push({ msg, type });
  };
}

/**
 * Verbatim replica of oracle-http-console/src/main.tsx's current buildRequest
 * handler (the wiring the kernel extracts), operating on its own observable
 * trio. Kept byte-faithful — the parity spec below drives it side by side with
 * the kernel and asserts identical transitions.
 */
function createHttpConsoleReference(setStatus: (msg: string, type: StatusType) => void) {
  const lastStatus = createObservable(t("statusReady"));
  const lastDigest = createObservable(t("digestPlaceholder"));
  const requestCount = createObservable(0);

  async function buildRequest(...args: unknown[]) {
    const values = (args[0] ?? {}) as Record<string, string>;
    const result = httpConsoleConfig.buildResult(values, t);
    const payload = result.payload as { status?: string; digest?: string };
    const ok = payload.status !== "input_required";

    lastStatus.set(result.status);
    if (ok) {
      lastDigest.set(String(payload.digest ?? t("digestPlaceholder")));
      requestCount.set(requestCount.get() + 1);
    } else {
      lastDigest.set(t("digestPlaceholder"));
    }
    setStatus(result.status, ok ? "success" : "warning");
    return result;
  }

  return { lastStatus, lastDigest, requestCount, buildRequest };
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

// ----------------------------------------------------------------------------
// Reference parity: oracle-http-console
// ----------------------------------------------------------------------------

describe("console preview kernel — oracle-http-console parity", () => {
  it("reproduces the console's preview wiring step for step (valid → input_required → valid)", async () => {
    const kernelToasts: ToastLog = [];
    const referenceToasts: ToastLog = [];
    const kernel = createConsolePreviewKernel({
      t,
      setStatus: toastRecorder(kernelToasts),
      networkLabel: "Morpheus Mainnet",
      endpointLabel: "Request builder (preview)",
      buildResult: httpConsoleConfig.buildResult,
    });
    const reference = createHttpConsoleReference(toastRecorder(referenceToasts));

    const snapshot = () => ({
      kernel: {
        lastStatus: kernel.state.lastStatus.get(),
        lastDigest: kernel.state.lastDigest.get(),
        requestCount: kernel.state.requestCount.get(),
      },
      reference: {
        lastStatus: reference.lastStatus.get(),
        lastDigest: reference.lastDigest.get(),
        requestCount: reference.requestCount.get(),
      },
    });

    // Seeds match the app's createObservable(ctx.t(...)) wiring.
    let { kernel: k, reference: r } = snapshot();
    expect(k).toEqual(r);
    expect(k).toEqual({ lastStatus: "Ready", lastDigest: "No digest", requestCount: 0 });

    // 1. Valid preview (console field defaults): digest set, tally bumped,
    //    success toast with the built status text.
    const valid = httpValues();
    const kernelResult = await kernel.buildRequest(valid);
    const referenceResult = await reference.buildRequest(valid);
    expect(kernelResult).toEqual(referenceResult);
    ({ kernel: k, reference: r } = snapshot());
    expect(k).toEqual(r);
    expect(k.lastStatus).toBe("HTTP request ready");
    expect(k.lastDigest).toMatch(/^0x[0-9a-f]{8}$/);
    expect(k.requestCount).toBe(1);
    expect(kernelToasts).toEqual(referenceToasts);
    expect(kernelToasts).toEqual([{ msg: "HTTP request ready", type: "success" }]);

    // 2. Validation failure: buildResult flags input_required (and still
    //    computes a digest in its payload) — the wiring must restore the
    //    placeholder, keep the tally, and toast a warning, never the digest.
    const invalid = httpValues({ url: "ftp://example.test/feed" });
    const kernelInvalid = await kernel.buildRequest(invalid);
    const referenceInvalid = await reference.buildRequest(invalid);
    expect(kernelInvalid).toEqual(referenceInvalid);
    expect(isConsoleInputRequired(kernelInvalid)).toBe(true);
    expect(kernelInvalid.payload.digest).toMatch(/^0x[0-9a-f]{8}$/);
    ({ kernel: k, reference: r } = snapshot());
    expect(k).toEqual(r);
    expect(k.lastStatus).toBe("Enter a valid http(s) URL");
    expect(k.lastDigest).toBe("No digest");
    expect(k.requestCount).toBe(1);
    expect(kernelToasts).toEqual(referenceToasts);
    expect(kernelToasts[1]).toEqual({ msg: "Enter a valid http(s) URL", type: "warning" });

    // 3. Recovery: the next valid preview counts again.
    const recovered = httpValues({ method: "POST", body: '{"symbol":"GAS"}' });
    expect((await kernel.buildRequest(recovered))).toEqual(await reference.buildRequest(recovered));
    ({ kernel: k, reference: r } = snapshot());
    expect(k).toEqual(r);
    expect(k.requestCount).toBe(2);
    expect(kernelToasts).toEqual(referenceToasts);
  });

  it("pins the reference console wiring the kernel replicates (drift guard until Wave 2B)", () => {
    const source = readFileSync(
      path.join(appsRoot(), "oracle-http-console", "src", "main.tsx"),
      "utf8",
    );
    // If any of these move, the console's semantics changed after the kernel
    // snapshot — reconcile console-kernel.ts before migrating the app onto it.
    expect(source).toContain('payload.status !== "input_required"');
    expect(source).toContain("lastStatus.set(result.status)");
    expect(source).toContain('lastDigest.set(String(payload.digest ?? ctx.t("digestPlaceholder")))');
    expect(source).toContain("requestCount.set(requestCount.get() + 1)");
    expect(source).toContain('lastDigest.set(ctx.t("digestPlaceholder"))');
    expect(source).toContain('ctx.setStatus(result.status, ok ? "success" : "warning")');
  });
});

// ----------------------------------------------------------------------------
// Variant coverage: vrf digest fallback, seal silence, bridge recorder
// ----------------------------------------------------------------------------

describe("console preview kernel — console variants", () => {
  function fixedResult(payload: Record<string, unknown>, status = "Prepared"): ConsoleResult {
    return { status, summary: status, rows: [], payload };
  }

  it("falls back to payload.requestId for the digest (oracle-vrf-console semantics)", () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
    });
    kernel.applyResult(fixedResult({ requestId: "VRF-REQ-1234" }));
    expect(kernel.state.lastDigest.get()).toBe("VRF-REQ-1234");
    expect(kernel.state.requestCount.get()).toBe(1);
  });

  it("restores the placeholder when an ok payload carries neither digest nor requestId", () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
    });
    kernel.applyResult(fixedResult({ kind: "preview" }));
    expect(kernel.state.lastDigest.get()).toBe("No digest");
    expect(kernel.state.requestCount.get()).toBe(1);
  });

  it('never toasts under notify: "silent" but still updates the stats (oracle-seal-console semantics)', () => {
    const toasts: ToastLog = [];
    const kernel = createConsolePreviewKernel({
      t,
      setStatus: toastRecorder(toasts),
      networkLabel: "net",
      endpointLabel: "endpoint",
      notify: "silent",
    });
    kernel.applyResult(fixedResult({ digest: "0xseal" }));
    kernel.applyResult(fixedResult({ status: CONSOLE_INPUT_REQUIRED }, "Fill the form"));
    expect(toasts).toEqual([]);
    expect(kernel.state.lastStatus.get()).toBe("Fill the form");
    expect(kernel.state.lastDigest.get()).toBe("No digest");
    expect(kernel.state.requestCount.get()).toBe(1);
  });

  it("degrades gracefully when the host provides no setStatus", () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
    });
    expect(() => kernel.applyResult(fixedResult({ digest: "0xok" }))).not.toThrow();
    expect(kernel.state.requestCount.get()).toBe(1);
  });

  it("supports a custom digest placeholder key (neo-x-bridge seeds notAvailable)", () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
      digestPlaceholderKey: "notAvailable",
    });
    expect(kernel.state.lastDigest.get()).toBe("N/A");
    kernel.applyResult(fixedResult({ status: CONSOLE_INPUT_REQUIRED }, "Needs input"));
    expect(kernel.state.lastDigest.get()).toBe("N/A");
  });

  it("recordRequest tallies bespoke intents without toasting (neo-x-bridge recordIntent core)", () => {
    const toasts: ToastLog = [];
    const kernel = createConsolePreviewKernel({
      t,
      setStatus: toastRecorder(toasts),
      networkLabel: "net",
      endpointLabel: "endpoint",
      digestPlaceholderKey: "notAvailable",
    });
    kernel.recordRequest({ status: "Asset intent ready", digest: "0xbridge01" });
    expect(kernel.state.lastStatus.get()).toBe("Asset intent ready");
    expect(kernel.state.lastDigest.get()).toBe("0xbridge01");
    expect(kernel.state.requestCount.get()).toBe(1);
    // Missing/empty digests keep the current value instead of blanking it.
    kernel.recordRequest({ status: "Tracking", digest: "" });
    kernel.recordRequest({ status: "Tracking again" });
    expect(kernel.state.lastDigest.get()).toBe("0xbridge01");
    expect(kernel.state.requestCount.get()).toBe(3);
    expect(toasts).toEqual([]);
  });

  it("reset restores the seeded placeholders and zeroes the session tally", () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
    });
    kernel.applyResult(fixedResult({ digest: "0xabc" }, "Built"));
    expect(kernel.state.requestCount.get()).toBe(1);
    kernel.reset();
    expect(kernel.state.lastStatus.get()).toBe("Ready");
    expect(kernel.state.lastDigest.get()).toBe("No digest");
    expect(kernel.state.requestCount.get()).toBe(0);
  });

  it("buildRequest without a buildResult fails loudly with an actionable message", async () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
    });
    await expect(kernel.buildRequest({})).rejects.toThrow(/buildResult/);
    // A misconfigured console must not move the tally.
    expect(kernel.state.requestCount.get()).toBe(0);
  });

  it("buildRequest tolerates a missing values argument like the hand-rolled handlers", async () => {
    const kernel = createConsolePreviewKernel({
      t,
      networkLabel: "net",
      endpointLabel: "endpoint",
      buildResult: httpConsoleConfig.buildResult,
    });
    // (args[0] ?? {}) — dispatch with no payload previews the field fallbacks.
    const result = await kernel.buildRequest();
    expect(result.payload.method).toBe("GET");
    expect(kernel.state.requestCount.get()).toBe(1);
  });
});

// ----------------------------------------------------------------------------
// Transient flag helper (PlayArea previewing/copied pulse)
// ----------------------------------------------------------------------------

describe("useTransientFlag", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("raises on trigger and clears itself after the duration (default 1200ms)", () => {
    const { result } = renderHook(() => useTransientFlag());
    expect(result.current.active).toBe(false);

    act(() => result.current.trigger());
    expect(result.current.active).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1199);
    });
    expect(result.current.active).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.active).toBe(false);
  });

  it("re-triggering restarts the countdown instead of stacking timeouts", () => {
    const { result } = renderHook(() => useTransientFlag(900));

    act(() => result.current.trigger());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => result.current.trigger());
    // The original timeout would have fired at 900ms total; the pulse must
    // survive because the retrigger reset it.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.active).toBe(true);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.active).toBe(false);
  });

  it("clear() lowers the flag immediately and cancels the pending timeout", () => {
    const { result } = renderHook(() => useTransientFlag(900));

    act(() => result.current.trigger());
    act(() => result.current.clear());
    expect(result.current.active).toBe(false);
    // No stale timeout flips anything later.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.active).toBe(false);
  });

  it("cancels the pending timeout on unmount (no setState after unmount)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result, unmount } = renderHook(() => useTransientFlag(500));
      act(() => result.current.trigger());
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
