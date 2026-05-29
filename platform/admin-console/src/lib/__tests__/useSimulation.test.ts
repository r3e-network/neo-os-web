import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useSimulationStatus,
  useStartSimulation,
  useStopSimulation,
} from "../hooks/useSimulation";
import { ADMIN_API_KEY_STORAGE_KEY } from "../admin-client";
import { createWrapper, mockFetchResponse } from "./test-utils";

describe("useSimulationStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
  });

  it("should not fetch simulation status when explicitly disabled", () => {
    vi.spyOn(global, "fetch").mockImplementation(() =>
      mockFetchResponse({ running: false, active_miniapps: [], workers_per_app: 0 }),
    );

    const { result } = renderHook(() => useSimulationStatus(false), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("attaches admin auth and same-origin credentials when fetching status", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
      mockFetchResponse({
        running: false,
        active_miniapps: [],
        workers_per_app: 0,
      }),
    );

    renderHook(() => useSimulationStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/simulations",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-Admin-Key": "ui-admin-key" },
      }),
    );
  });

  it("attaches admin auth and same-origin credentials when starting simulations", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
      mockFetchResponse({ success: true }),
    );
    const { result } = renderHook(() => useStartSimulation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      min_interval_ms: 1000,
      max_interval_ms: 5000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/simulations",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Admin-Key": "ui-admin-key",
        }),
      }),
    );
  });

  it("attaches admin auth and same-origin credentials when stopping simulations", async () => {
    window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(() =>
      mockFetchResponse({ success: true }),
    );
    const { result } = renderHook(() => useStopSimulation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/simulations",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Admin-Key": "ui-admin-key",
        }),
      }),
    );
  });
});
