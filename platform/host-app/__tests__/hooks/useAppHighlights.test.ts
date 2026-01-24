/**
 * useAppHighlights Hook Tests
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useAppHighlights } from "@/hooks/useAppHighlights";

// Mock fetch
global.fetch = jest.fn();

jest.mock("@/lib/app-highlights", () => ({
  getAppHighlights: jest.fn(() => [{ label: "Static", value: "100", icon: "📊" }]),
}));

describe("useAppHighlights", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return static highlights initially", () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ highlights: {} }),
    });

    const { result } = renderHook(() => useAppHighlights("miniapp-lottery"));
    expect(result.current.highlights).toBeDefined();
    expect(result.current.highlights?.[0].label).toBe("Static");
  });

  it("should fetch dynamic highlights", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          highlights: {
            "miniapp-neoburger": [{ label: "Dynamic", value: "200", icon: "🚀" }],
          },
        }),
    });

    const { result } = renderHook(() => useAppHighlights("miniapp-neoburger"));

    await waitFor(() => {
      expect(result.current.highlights?.[0].label).toBe("Dynamic");
    });
  });

  it("should handle fetch error gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAppHighlights("miniapp-lottery"));

    await waitFor(() => {
      expect(result.current.error).toBe("Network error");
    });

    // Should keep static fallback
    expect(result.current.highlights).toBeDefined();
  });
});
