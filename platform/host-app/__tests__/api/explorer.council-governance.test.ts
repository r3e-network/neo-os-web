import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/explorer/council-governance", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.NEO_EXPLORER_API_URL;
    delete process.env.NEO_EXPLORER_API_MAINNET;
    delete process.env.NEO_EXPLORER_API_TESTNET;
    delete process.env.NEO_COUNCIL_PROFILE_RPC_URL;
    delete process.env.NEO_COUNCIL_PROFILE_RPC_MAINNET;
    delete process.env.NEO_COUNCIL_PROFILE_RPC_TESTNET;
    delete process.env.NEO_RPC_URL;
    delete process.env.NEO_RPC_MAINNET;
    delete process.env.NEO_RPC_TESTNET;
  });

  it("answers public read CORS preflight without touching upstream services", async () => {
    const handler = require("@/pages/api/explorer/council-governance")
      .default as (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "OPTIONS",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(204);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Access-Control-Allow-Methods")).toBe("GET,OPTIONS");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("normalizes Neo Explorer candidate governance data", async () => {
    process.env.NEO_EXPLORER_API_TESTNET = "https://explorer-api.example.test/";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            totalCount: 2,
            result: [
              {
                _id: "candidate-a",
                candidate: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                isCommittee: true,
                state: true,
                votesOfCandidate: "3000000",
              },
              {
                _id: "candidate-b",
                candidate: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                isCommittee: false,
                state: true,
                votesOfCandidate: "1000000",
              },
            ],
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { totalvotes: 4000000 }, error: null }),
      });

    const handler = require("@/pages/api/explorer/council-governance")
      .default as (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet", limit: "2", page: "1" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://explorer-api.example.test",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"method\":\"GetCandidate\""),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://explorer-api.example.test",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"method\":\"GetTotalVotes\""),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
    expect(res.getHeader("Cache-Control")).toBe(
      "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
    );
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        source: "neo-explorer-ui",
        network: "testnet",
        limit: 2,
        skip: 0,
        totalCount: 2,
        totalVotes: 4000000,
        candidates: [
          expect.objectContaining({
            id: "candidate-a",
            candidate: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            displayName: "Council node #1",
            profileSource: "unverified",
            rank: 1,
            status: "consensus",
            isCommittee: true,
            votes: 3000000,
            supplySharePercent: 3,
          }),
          expect.objectContaining({
            id: "candidate-b",
            rank: 2,
            status: "candidate",
            isCommittee: false,
            votes: 1000000,
            supplySharePercent: 1,
          }),
        ],
      }),
    );
  });

  it("enriches mainnet candidates with Neo governance profile names and logos", async () => {
    process.env.NEO_EXPLORER_API_MAINNET = "https://explorer-api.example.mainnet/";
    process.env.NEO_COUNCIL_PROFILE_RPC_MAINNET = "https://profile-rpc.example.mainnet/";
    const profileHash = Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
      .reverse()
      .toString("base64");
    const text = (value: string) => Buffer.from(value, "utf8").toString("base64");

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            totalCount: 1,
            result: [
              {
                _id: "candidate-a",
                candidate: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                isCommittee: true,
                state: true,
                votesOfCandidate: "3000000",
              },
            ],
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { totalvotes: 3000000 }, error: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            state: "HALT",
            stack: [
              {
                type: "Array",
                value: [
                  {
                    type: "Array",
                    value: [
                      { type: "ByteString", value: profileHash },
                      { type: "ByteString", value: text("Neo Council Lab") },
                      { type: "ByteString", value: text("Singapore") },
                      { type: "ByteString", value: text("https://neo.org") },
                      { type: "ByteString", value: text("") },
                      { type: "ByteString", value: text("") },
                      { type: "ByteString", value: text("") },
                      { type: "ByteString", value: text("") },
                      { type: "ByteString", value: text("Council identity profile") },
                      { type: "ByteString", value: text("logo-hash") },
                    ],
                  },
                ],
              },
            ],
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            proposal_id: "proposal-1",
            proposal_number: 7,
            title: "Improve oracle response policy",
            status: "active",
            proposal_type: "governance",
            created_at: "2026-02-03T19:13:23.003000",
            end_time: "2026-03-27T23:59:59",
            proposer_username: "neo-council",
            proposer_org_id: "org-1",
            council_vote_counts: { for: 2, against: 0, neutral: 1 },
            community_vote_counts: { for: 161, against: 0, neutral: 0 },
            message_count: 4,
          },
        ],
      });

    const handler = require("@/pages/api/explorer/council-governance")
      .default as (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "mainnet", limit: "1" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "https://profile-rpc.example.mainnet",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"method\":\"invokefunction\""),
      }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        source: "neo-explorer-ui+neo-community",
        candidates: [
          expect.objectContaining({
            candidate: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            displayName: "Neo Council Lab",
            location: "Singapore",
            website: "https://neo.org",
            description: "Council identity profile",
            logoUrl:
              "https://filesend.ngd.network/gate/get/CeeroywT8ppGE4HGjhpzocJkdb2yu3wD5qCGFTjkw1Cc/logo-hash",
            profileSource: "neo-community",
          }),
        ],
        proposals: [
          expect.objectContaining({
            id: "proposal-1",
            number: 7,
            title: "Improve oracle response policy",
            status: "active",
            councilVotes: { for: 2, against: 0, neutral: 1 },
          }),
        ],
      }),
    );
  });

  it("returns a gateway error when the shared backend is unavailable", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    const handler = require("@/pages/api/explorer/council-governance")
      .default as (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "mainnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(502);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "GATEWAY_ERROR",
        message: "Failed to fetch council governance data",
      },
    });
  });

  it("rejects missing or unknown networks instead of silently using testnet", async () => {
    const handler = require("@/pages/api/explorer/council-governance")
      .default as (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "preview" },
    });

    await handler(req, res);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "network must be mainnet or testnet",
      },
    });
  });

  it("does not mix mainnet proposal governance into testnet responses", async () => {
    process.env.NEO_EXPLORER_API_TESTNET = "https://explorer-api.example.test/";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: { totalCount: 0, result: [] },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { totalvotes: 0 }, error: null }),
      });

    const handler = require("@/pages/api/explorer/council-governance")
      .default as (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        network: "testnet",
        proposals: [],
      }),
    );
  });
});
