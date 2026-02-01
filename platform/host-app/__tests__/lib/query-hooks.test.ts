/**
 * Query Hooks Tests
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";

// Mock fetch
global.fetch = jest.fn();

// Import after mock
import { useMiniAppStats } from "@/lib/query/useMiniAppStats";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe("Query Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useMiniAppStats", () => {
    it("should call fetch with correct URL", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stats: [{ app_id: "test-app", total_transactions: 100 }] }),
      });

      const wrapper = createWrapper();
      renderHook(() => useMiniAppStats("test-app"), { wrapper });

      // Wait for the fetch to be called
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/miniapp-stats?app_id=test-app"));
      });
    });

    it("should return data on success", async () => {
      const mockStats = { app_id: "test-app", total_transactions: 100 };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stats: [mockStats] }),
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useMiniAppStats("test-app"), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockStats);
      });
    });

    it("should handle fetch error gracefully", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useMiniAppStats("test-app"), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });
});
