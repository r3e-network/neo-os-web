import { renderHook, waitFor } from "@testing-library/react";
import { useCardData, getCardData, getCardDataBatch } from "@/hooks/useCardData";

// Mock the card-data module
jest.mock("@/lib/card-data", () => ({
  getCountdownData: jest.fn().mockResolvedValue({
    endTime: Date.now() + 3600000,
    jackpot: "100 GAS",
    participants: 50,
  }),
  getMultiplierData: jest.fn().mockResolvedValue({
    multiplier: 2.5,
    players: 10,
  }),
  getStatsData: jest.fn().mockResolvedValue({
    tvl: "1000 GAS",
    volume24h: "500 GAS",
    users: 100,
  }),
  getVotingData: jest.fn().mockResolvedValue({
    title: "Test Proposal",
    options: [
      { label: "Yes", percentage: 60 },
      { label: "No", percentage: 40 },
    ],
    totalVotes: 100,
  }),
}));

describe("getCardData", () => {
  it("returns undefined for unknown app", () => {
    expect(getCardData("unknown-app")).toBeUndefined();
  });

  it("returns card data for lottery app", () => {
    const data = getCardData("miniapp-lottery");
    expect(data).toBeDefined();
    expect(data?.type).toBe("live_countdown");
  });

  it("returns card data for crash game app", () => {
    const data = getCardData("miniapp-neocrash");
    expect(data).toBeDefined();
    expect(data?.type).toBe("live_multiplier");
  });
});

describe("getCardDataBatch", () => {
  it("returns empty object for empty array", () => {
    expect(getCardDataBatch([])).toEqual({});
  });

  it("returns data for multiple apps", () => {
    const result = getCardDataBatch(["miniapp-lottery", "miniapp-neocrash"]);
    expect(Object.keys(result).length).toBe(2);
  });

  it("skips unknown apps", () => {
    const result = getCardDataBatch(["miniapp-lottery", "unknown"]);
    expect(Object.keys(result).length).toBe(1);
  });
});

describe("useCardData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns undefined for unknown app", () => {
    const { result } = renderHook(() => useCardData("unknown-app"));
    expect(result.current.data).toBeUndefined();
  });

  it("fetches countdown data for lottery app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-lottery"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_countdown");
  });

  it("fetches multiplier data for crash app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-neocrash"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_multiplier");
  });

  it("fetches stats data for red envelope app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-redenvelope"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_stats");
  });

  it("fetches voting data for governance app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-govbooster"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_voting");
  });
});
