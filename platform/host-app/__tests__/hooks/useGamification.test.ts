import { renderHook, waitFor, act } from "@testing-library/react";
import { useGamification } from "@/hooks/useGamification";

// Mock fetch
global.fetch = jest.fn();

const mockStats = {
  level: 2,
  xp: 150,
  totalGames: 10,
  wins: 5,
  badges: ["first_win", "streak_3"],
};

describe("useGamification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null stats when no wallet provided", () => {
    const { result } = renderHook(() => useGamification());
    expect(result.current.stats).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches stats when wallet is provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockStats }),
    });

    const { result } = renderHook(() => useGamification("NeoWallet123"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    const { result } = renderHook(() => useGamification("NeoWallet123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch stats");
    expect(result.current.stats).toBeNull();
  });

  it("handles network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useGamification("NeoWallet123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });

  it("calculates levelInfo correctly", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stats: mockStats }),
    });

    const { result } = renderHook(() => useGamification("NeoWallet123"));

    await waitFor(() => {
      expect(result.current.levelInfo).not.toBeNull();
    });

    expect(result.current.levelInfo?.name).toBeDefined();
    expect(result.current.levelInfo?.progress).toBeGreaterThanOrEqual(0);
    expect(result.current.levelInfo?.progress).toBeLessThanOrEqual(100);
  });

  it("refresh function refetches data", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stats: mockStats }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stats: { ...mockStats, xp: 200 } }),
      });

    const { result } = renderHook(() => useGamification("NeoWallet123"));

    await waitFor(() => {
      expect(result.current.stats?.xp).toBe(150);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.stats?.xp).toBe(200);
  });
});
