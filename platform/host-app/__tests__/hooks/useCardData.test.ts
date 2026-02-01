import { renderHook, waitFor } from "@testing-library/react";
import { useCardData, getCardData, getCardDataBatch } from "@/hooks/useCardData";

// Test chain ID
const TEST_CHAIN_ID = "neo-n3-testnet" as const;

// Mock the card-data module
jest.mock("@/lib/card-data", () => ({
  getCountdownData: jest.fn().mockResolvedValue({
    type: "live_countdown",
    endTime: Date.now() + 3600000,
    jackpot: "100 GAS",
    participants: 50,
  }),
  getMultiplierData: jest.fn().mockResolvedValue({
    type: "live_multiplier",
    multiplier: 2.5,
    players: 10,
  }),
  getStatsData: jest.fn().mockResolvedValue({
    type: "live_stats",
    tvl: "1000 GAS",
    volume24h: "500 GAS",
    users: 100,
  }),
  getVotingData: jest.fn().mockResolvedValue({
    type: "live_voting",
    title: "Test Proposal",
    options: [
      { label: "Yes", percentage: 60 },
      { label: "No", percentage: 40 },
    ],
    totalVotes: 100,
  }),
  getAppCardType: jest.fn((appId: string) => {
    const types: Record<string, string> = {
      "miniapp-lottery": "live_countdown",
      "miniapp-neo-crash": "live_multiplier",
      "miniapp-redenvelope": "live_stats",
      "miniapp-govbooster": "live_voting",
    };
    return types[appId] || null;
  }),
  hasCardData: jest.fn((appId: string) => {
    const apps = ["miniapp-lottery", "miniapp-neo-crash", "miniapp-redenvelope", "miniapp-govbooster"];
    return apps.includes(appId);
  }),
  getAppsWithCardData: jest.fn(() => [
    "miniapp-lottery",
    "miniapp-neo-crash",
    "miniapp-redenvelope",
    "miniapp-govbooster",
  ]),
  getCardData: jest.fn((appId: string, cardType: string, _chainId: string) => {
    const dataMap: Record<string, object> = {
      live_countdown: { type: "live_countdown", endTime: Date.now() + 3600000, jackpot: "100 GAS", participants: 50 },
      live_multiplier: { type: "live_multiplier", multiplier: 2.5, players: 10 },
      live_stats: { type: "live_stats", tvl: "1000 GAS", volume24h: "500 GAS", users: 100 },
      live_voting: { type: "live_voting", title: "Test Proposal", options: [{ label: "Yes", percentage: 60 }, { label: "No", percentage: 40 }], totalVotes: 100 },
    };
    return Promise.resolve(dataMap[cardType] || null);
  }),
  getContractAddress: jest.fn(),
  CONTRACTS: {},
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
    const data = getCardData("miniapp-neo-crash");
    expect(data).toBeDefined();
    expect(data?.type).toBe("live_multiplier");
  });
});

describe("getCardDataBatch", () => {
  it("returns empty object for empty array", () => {
    expect(getCardDataBatch([])).toEqual({});
  });

  it("returns data for multiple apps", () => {
    const result = getCardDataBatch(["miniapp-lottery", "miniapp-neo-crash"]);
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
    const { result } = renderHook(() => useCardData("unknown-app", TEST_CHAIN_ID));
    expect(result.current.data).toBeUndefined();
  });

  it("fetches countdown data for lottery app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-lottery", TEST_CHAIN_ID));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_countdown");
  });

  it("fetches multiplier data for crash app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-neo-crash", TEST_CHAIN_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_multiplier");
  });

  it("fetches stats data for red envelope app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-redenvelope", TEST_CHAIN_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_stats");
  });

  it("fetches voting data for governance app", async () => {
    const { result } = renderHook(() => useCardData("miniapp-govbooster", TEST_CHAIN_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.type).toBe("live_voting");
  });
});
