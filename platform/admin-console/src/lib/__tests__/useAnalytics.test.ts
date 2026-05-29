// =============================================================================
// useAnalytics Hook Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  useAnalytics,
  useMiniAppUsage,
  useUsageByApp,
} from "../hooks/useAnalytics";
import { ADMIN_API_KEY_STORAGE_KEY } from "../admin-client";
import { createWrapper, mockFetchResponse } from "./test-utils";

describe("useAnalytics Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useAnalytics", () => {
    it("should fetch analytics data successfully", async () => {
      const mockData = {
        totalUsers: 100,
        activeMiniApps: 5,
        totalGasUsed: "1000.00",
        transactionsToday: 50,
      };

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useAnalytics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          credentials: "include",
          headers: {},
        }),
      );
    });

    it("attaches admin auth and same-origin credentials", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockImplementation(() =>
          mockFetchResponse({
            totalUsers: 100,
            totalMiniApps: 5,
            totalTransactions: 50,
            gasUsageToday: 12,
            usageByApp: [],
            usageOverTime: [],
          }),
        );

      renderHook(() => useAnalytics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "ui-admin-key" },
        }),
      );
    });

    it("should handle analytics fetch error", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(null, false, 500));

      const { result } = renderHook(() => useAnalytics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  describe("useMiniAppUsage", () => {
    it("attaches admin auth and same-origin credentials when fetching daily usage", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockImplementation(() => mockFetchResponse([]));

      renderHook(() => useMiniAppUsage(14), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics/usage?days=14",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "ui-admin-key" },
        }),
      );
    });
  });

  describe("useUsageByApp", () => {
    it("should fetch usage by app successfully", async () => {
      const mockData = [
        { appId: "app1", totalUsage: 100 },
        { appId: "app2", totalUsage: 200 },
      ];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useUsageByApp(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/analytics/by-app",
        expect.objectContaining({
          credentials: "include",
          headers: {},
        }),
      );
    });

    it("attaches admin auth and same-origin credentials", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "ui-admin-key");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockImplementation(() => mockFetchResponse([]));

      renderHook(() => useUsageByApp(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/analytics/by-app",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "ui-admin-key" },
        }),
      );
    });

    it("should handle usage by app fetch error", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(null, false, 500));

      const { result } = renderHook(() => useUsageByApp(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
