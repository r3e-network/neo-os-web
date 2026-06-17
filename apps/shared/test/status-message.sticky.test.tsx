/**
 * Sticky status-message behavior.
 *
 * error/danger statuses must persist until replaced or manually dismissed,
 * while success/info/warning/loading auto-clear after the timeout. Both the
 * observable composable and the React hook consume the shared core, so the
 * policy is asserted across all three layers.
 */

import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_TIMEOUT_MS,
  createStatusTimer,
  isStickyStatus,
} from "../composables/statusMessageCore";
import { useStatusMessage as useStatusObservable } from "../composables/useStatusMessage";
import { useStatusMessage as useStatusReact } from "../react/hooks/useStatusMessage";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

describe("status-message sticky policy (core)", () => {
  it("classifies error/danger as sticky and others as transient", () => {
    expect(isStickyStatus("error")).toBe(true);
    expect(isStickyStatus("danger")).toBe(true);
    expect(isStickyStatus("success")).toBe(false);
    expect(isStickyStatus("info")).toBe(false);
    expect(isStickyStatus("warning")).toBe(false);
    expect(isStickyStatus("loading")).toBe(false);
  });

  describe("createStatusTimer", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("does not schedule a clear for sticky (error/danger) statuses", () => {
      const clear = vi.fn();
      const timer = createStatusTimer(() => "boom", clear, 1000);

      timer.schedule("boom", "error");
      vi.advanceTimersByTime(10_000);
      expect(clear).not.toHaveBeenCalled();

      timer.schedule("kaboom", "danger");
      vi.advanceTimersByTime(10_000);
      expect(clear).not.toHaveBeenCalled();
    });

    it("auto-clears transient statuses after the timeout", () => {
      let current: string | null = "saved";
      const clear = vi.fn(() => {
        current = null;
      });
      const timer = createStatusTimer(() => current, clear, 1000);

      timer.schedule("saved", "success");
      expect(clear).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(clear).toHaveBeenCalledTimes(1);
    });

    it("does not clear a transient status that was replaced before the timeout", () => {
      let current: string | null = "second";
      const clear = vi.fn(() => {
        current = null;
      });
      const timer = createStatusTimer(() => current, clear, 1000);

      // "first" scheduled, but the displayed message is now "second"
      timer.schedule("first", "success");
      vi.advanceTimersByTime(1000);
      expect(clear).not.toHaveBeenCalled();
    });

    it("resolves a timeout getter at fire time", () => {
      let current: string | null = "saved";
      const clear = vi.fn(() => {
        current = null;
      });
      let timeout = 5000;
      const timer = createStatusTimer(() => current, clear, () => timeout);

      timeout = 1000;
      timer.schedule("saved", "info");
      vi.advanceTimersByTime(1000);
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });
});

describe("useStatusMessage (observable composable) sticky policy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps error statuses until replaced or cleared", () => {
    const { status, setStatus, clearStatus, dispose } = useStatusObservable(1000);

    setStatus("Transaction failed", "error");
    vi.advanceTimersByTime(60_000);
    expect(status.get()).toEqual({ msg: "Transaction failed", type: "error" });

    // Replacing with a success status auto-clears later.
    setStatus("Done", "success");
    expect(status.get()).toEqual({ msg: "Done", type: "success" });
    vi.advanceTimersByTime(1000);
    expect(status.get()).toBeNull();

    setStatus("Boom again", "danger");
    vi.advanceTimersByTime(60_000);
    expect(status.get()).toEqual({ msg: "Boom again", type: "danger" });
    clearStatus();
    expect(status.get()).toBeNull();

    dispose();
  });

  it("auto-clears success/info/warning/loading after the timeout", () => {
    for (const type of ["success", "info", "warning", "loading"] as const) {
      const { status, setStatus, dispose } = useStatusObservable(1000);
      setStatus(`msg-${type}`, type);
      expect(status.get()).toEqual({ msg: `msg-${type}`, type });
      vi.advanceTimersByTime(1000);
      expect(status.get()).toBeNull();
      dispose();
    }
  });
});

describe("useStatusMessage (React hook) sticky policy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps error/danger statuses while auto-clearing success", () => {
    const { result } = renderHook(() => useStatusReact(1000));

    act(() => result.current.setStatus("Transaction failed", "error"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.status).toEqual({
      msg: "Transaction failed",
      type: "error",
    });

    act(() => result.current.setStatus("Saved", "success"));
    expect(result.current.status).toEqual({ msg: "Saved", type: "success" });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.status).toBeNull();

    act(() => result.current.setStatus("Danger zone", "danger"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.status).toEqual({
      msg: "Danger zone",
      type: "danger",
    });

    act(() => result.current.clearStatus());
    expect(result.current.status).toBeNull();
  });

  it("uses DEFAULT_TIMEOUT_MS when no timeout is provided", () => {
    const { result } = renderHook(() => useStatusReact());

    act(() => result.current.setStatus("Saved", "success"));
    act(() => vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS - 1));
    expect(result.current.status).toEqual({ msg: "Saved", type: "success" });
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBeNull();
  });
});
