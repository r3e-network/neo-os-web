/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

jest.mock("@cityofzion/neon-js", () => ({
  wallet: {
    isAddress: jest.fn((addr: string) => addr.startsWith("N") && addr.length > 10),
    getScriptHashFromPublicKey: jest.fn(() => "abc123hash"),
    getAddressFromScriptHash: jest.fn(() => "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs"),
  },
}));

const mockGetChain = jest.fn();
const mockGetActiveChains = jest.fn();
const mockGetChainsByType = jest.fn();
jest.mock("@/lib/chains/registry", () => ({
  getChainRegistry: () => ({
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
    getChainsByType: mockGetChainsByType,
  }),
  chainRegistry: {
    getChain: mockGetChain,
    getActiveChains: mockGetActiveChains,
    getChainsByType: mockGetChainsByType,
  },
}));

jest.mock("@/lib/chains/rpc-functions", () => ({
  rpcCall: jest.fn().mockResolvedValue(["03pubkey1", "03pubkey2"]),
  getChainRpcUrl: jest.fn(() => "https://mock-rpc.example.com"),
}));

import handler from "@/pages/api/neo/council-members";

const MOCK_CHAIN = {
  id: "neo-n3-mainnet",
  type: "neo-n3",
  status: "active",
  isTestnet: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetChain.mockImplementation((id: string) => (id === "neo-n3-mainnet" ? MOCK_CHAIN : undefined));
  mockGetActiveChains.mockReturnValue([MOCK_CHAIN]);
  mockGetChainsByType.mockReturnValue([MOCK_CHAIN]);
});

describe("GET /api/neo/council-members", () => {
  it("rejects non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when address is missing", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/address/);
  });

  it("returns 400 for invalid address format", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { chain_id: "neo-n3-mainnet", address: "bad" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toMatch(/invalid address/);
  });

  it("returns 400 for missing chain_id", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.availableChains).toBeDefined();
  });

  it("returns council membership result", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: {
        chain_id: "neo-n3-mainnet",
        address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
      },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.chainId).toBe("neo-n3-mainnet");
    expect(typeof body.isCouncilMember).toBe("boolean");
  });
});
