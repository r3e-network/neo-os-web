import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

// A valid Neo N3 address (passes Base58Check)
const VALID_ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
// Looks like Neo address (passes regex) but fails checksum
const INVALID_CHECKSUM_ADDRESS = "NZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";

jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: jest.fn(),
}));

import { getServerSupabaseClient } from "@/lib/server-supabase";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

function mockSupabaseUser(address: string | undefined, email?: string) {
  (getServerSupabaseClient as jest.Mock).mockReturnValue({
    auth: {
      getUser: jest.fn(async () => ({
        data: {
          user: {
            user_metadata: address !== undefined ? { address } : {},
            email: email ?? null,
          },
        },
        error: null,
      })),
    },
  });
}

describe("requireWalletAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns valid Neo address from user metadata", async () => {
    mockSupabaseUser(VALID_ADDRESS);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: "Bearer valid-token" },
    });

    const wallet = await requireWalletAuth(req, res);
    expect(wallet).toBe(VALID_ADDRESS);
  });

  it("rejects authenticated users whose wallet string fails checksum validation", async () => {
    mockSupabaseUser(INVALID_CHECKSUM_ADDRESS);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: "Bearer valid-token" },
    });

    const wallet = await requireWalletAuth(req, res);
    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects requests without authorization header", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({});

    const wallet = await requireWalletAuth(req, res);
    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects when supabase is unavailable", async () => {
    (getServerSupabaseClient as jest.Mock).mockReturnValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: "Bearer valid-token" },
    });

    const wallet = await requireWalletAuth(req, res);
    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects email-based wallet with invalid checksum", async () => {
    mockSupabaseUser(undefined, `${INVALID_CHECKSUM_ADDRESS}@wallet.neo`);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: "Bearer valid-token" },
    });

    const wallet = await requireWalletAuth(req, res);
    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });
});
