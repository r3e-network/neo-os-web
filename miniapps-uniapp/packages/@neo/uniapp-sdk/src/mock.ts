/**
 * Mock SDK for standalone development
 */
import type {
  MiniAppSDK,
  PayGASResponse,
  VoteBNEOResponse,
  RNGResponse,
  PriceResponse,
  CandidatesResponse,
} from "./types";

const generateId = () => `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const mockSDK: MiniAppSDK = {
  wallet: {
    async getAddress() {
      console.log("[MockSDK] getAddress called");
      return "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";
    },
    async invokeIntent(requestId: string) {
      console.log("[MockSDK] invokeIntent:", requestId);
      return { txid: generateId() };
    },
  },
  payments: {
    async payGAS(appId, amount, memo): Promise<PayGASResponse> {
      console.log("[MockSDK] payGAS:", { appId, amount, memo });
      await new Promise((r) => setTimeout(r, 800));
      return {
        request_id: generateId(),
        user_id: "mock-user",
        intent: "payments",
        constraints: { settlement: "GAS_ONLY" },
        invocation: {
          contract: "0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193",
          method: "transfer",
          args: [amount, memo],
        },
      };
    },
  },
  governance: {
    async vote(appId, proposalId, amount, support): Promise<VoteBNEOResponse> {
      console.log("[MockSDK] vote:", { appId, proposalId, amount, support });
      await new Promise((r) => setTimeout(r, 800));
      return {
        request_id: generateId(),
        user_id: "mock-user",
        intent: "governance",
        constraints: { governance: "BNEO_ONLY" },
        invocation: {
          contract: "0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05",
          method: "vote",
          args: [proposalId, amount, support],
        },
      };
    },
    async getCandidates(): Promise<CandidatesResponse> {
      console.log("[MockSDK] getCandidates called");
      await new Promise((r) => setTimeout(r, 500));
      return {
        candidates: [
          {
            address: "NNShaEBGVBfmGWzGs6W5sCneKPBwmCA3Br",
            publicKey: "02a1",
            name: "NeoEconoLabs",
            votes: "5000000",
            active: true,
          },
          {
            address: "NdUL5oDPD159KeFpD5A9zw5xNF1xLX6nLT",
            publicKey: "03b2",
            name: "COZ",
            votes: "4500000",
            active: true,
          },
          {
            address: "NKuyBkoGdZZSLyPbJEetheRhMjeznFZszf",
            publicKey: "02c3",
            name: "AxLabs",
            votes: "3200000",
            active: true,
          },
        ],
        totalVotes: "12700000",
        blockHeight: 1234567,
      };
    },
  },
  rng: {
    async requestRandom(appId): Promise<RNGResponse> {
      console.log("[MockSDK] requestRandom:", appId);
      await new Promise((r) => setTimeout(r, 500));
      const randomBytes = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, "0"),
      ).join("");
      return {
        request_id: generateId(),
        app_id: appId,
        randomness: randomBytes,
      };
    },
  },
  datafeed: {
    async getPrice(symbol): Promise<PriceResponse> {
      console.log("[MockSDK] getPrice:", symbol);
      const prices: Record<string, string> = {
        "NEO-USD": "12.45",
        "GAS-USD": "4.32",
        "BTC-USD": "43250.00",
        "ETH-USD": "2280.50",
      };
      return {
        feed_id: generateId(),
        pair: symbol,
        price: prices[symbol] || "100.00",
        decimals: 8,
        timestamp: new Date().toISOString(),
        sources: ["mock"],
      };
    },
  },
};

export function installMockSDK(): void {
  if (typeof window !== "undefined") {
    (window as any).MiniAppSDK = mockSDK;
    console.log("[MockSDK] Installed on window.MiniAppSDK");
    window.dispatchEvent(new Event("miniapp-sdk-ready"));
  }
}
