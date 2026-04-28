import { createHmac } from "crypto";
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

function mockSupabaseInvalidUser() {
  (getServerSupabaseClient as jest.Mock).mockReturnValue({
    auth: {
      getUser: jest.fn(async () => ({ data: { user: null }, error: new Error("invalid") })),
    },
  });
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const encodedHeader = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

describe("requireWalletAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.NEXTAUTH_SECRET;
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

  it("returns wallet address from a locally signed wallet JWT when Supabase Auth rejects it", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockSupabaseInvalidUser();
    const token = signHs256Jwt({
      aud: "authenticated",
      role: "authenticated",
      sub: "wallet-user-id",
      address: VALID_ADDRESS,
      exp: Math.floor(Date.now() / 1000) + 60,
    }, "test-secret");
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${token}` },
    });

    const wallet = await requireWalletAuth(req, res);

    expect(wallet).toBe(VALID_ADDRESS);
  });

  it("rejects locally signed wallet JWTs with invalid signatures", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockSupabaseInvalidUser();
    const token = signHs256Jwt({
      aud: "authenticated",
      role: "authenticated",
      sub: "wallet-user-id",
      address: VALID_ADDRESS,
      exp: Math.floor(Date.now() / 1000) + 60,
    }, "wrong-secret");
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${token}` },
    });

    const wallet = await requireWalletAuth(req, res);

    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects locally signed wallet JWTs without required expiry", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockSupabaseInvalidUser();
    const token = signHs256Jwt({
      aud: "authenticated",
      role: "authenticated",
      sub: "wallet-user-id",
      address: VALID_ADDRESS,
    }, "test-secret");
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${token}` },
    });

    const wallet = await requireWalletAuth(req, res);

    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects locally signed wallet JWTs with unexpected audience", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    mockSupabaseInvalidUser();
    const token = signHs256Jwt({
      aud: "anon",
      role: "authenticated",
      sub: "wallet-user-id",
      address: VALID_ADDRESS,
      exp: Math.floor(Date.now() / 1000) + 60,
    }, "test-secret");
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      headers: { authorization: `Bearer ${token}` },
    });

    const wallet = await requireWalletAuth(req, res);

    expect(wallet).toBeNull();
    expect(res._getStatusCode()).toBe(401);
  });
});
