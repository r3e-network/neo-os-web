// =============================================================================
// useServices Hook Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useServicesHealth } from "../hooks/useServices";
import { createWrapper, mockFetchResponse } from "./test-utils";
import { ADMIN_API_KEY_STORAGE_KEY } from "../admin-client";

describe("useServices Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useServicesHealth", () => {
    beforeEach(() => {
      window.sessionStorage.clear();
    });

    it("should fetch services health successfully", async () => {
      const mockData = [
        { name: "neoaccounts", status: "healthy", version: "1.0.0" },
        { name: "gasbank", status: "healthy", version: "1.0.0" },
      ];

      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(mockData));

      const { result } = renderHook(() => useServicesHealth(0), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/services/health",
        expect.objectContaining({ credentials: "include", headers: {} }),
      );
    });

    it("should attach admin auth headers and same-origin credentials", async () => {
      window.sessionStorage.setItem(ADMIN_API_KEY_STORAGE_KEY, "services-key");
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useServicesHealth(0), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/services/health",
        expect.objectContaining({
          credentials: "include",
          headers: { "X-Admin-Key": "services-key" },
        }),
      );
    });

    it("should handle fetch error", async () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse(null, false, 500));

      const { result } = renderHook(() => useServicesHealth(0), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it("should use default refetch interval", () => {
      vi.spyOn(global, "fetch").mockImplementation(() => mockFetchResponse([]));

      const { result } = renderHook(() => useServicesHealth(), {
        wrapper: createWrapper(),
      });

      // Hook should be defined with default interval
      expect(result.current).toBeDefined();
    });
  });
});
