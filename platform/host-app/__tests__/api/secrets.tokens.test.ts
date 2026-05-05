import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import tokensHandler from "@/pages/api/secrets/tokens";
import tokenHandler from "@/pages/api/secrets/tokens/[id]";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { getServerSupabaseClient } from "@/lib/server-supabase";
import { resolveUserIdFromWallet } from "@/lib/wallet-user";
import { standardLimit } from "@/lib/rate-limit";

jest.mock("@/lib/require-wallet-auth", () => ({
  requireWalletAuth: jest.fn(),
}));

jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: jest.fn(),
}));

jest.mock("@/lib/wallet-user", () => ({
  resolveUserIdFromWallet: jest.fn(),
}));

jest.mock("@/lib/rate-limit", () => ({
  standardLimit: jest.fn(),
}));

const mockRequireWalletAuth = requireWalletAuth as jest.MockedFunction<typeof requireWalletAuth>;
const mockGetServerSupabaseClient = getServerSupabaseClient as jest.MockedFunction<typeof getServerSupabaseClient>;
const mockResolveUserIdFromWallet = resolveUserIdFromWallet as jest.MockedFunction<typeof resolveUserIdFromWallet>;
const mockStandardLimit = standardLimit as jest.MockedFunction<typeof standardLimit>;

function mockUnauthorized() {
  mockRequireWalletAuth.mockImplementation(async (_req, res) => {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization token" } });
    return null;
  });
}

describe("/api/secrets/tokens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStandardLimit.mockReturnValue(false);
    mockRequireWalletAuth.mockResolvedValue("Nwallet11111111111111111111111111111");
    mockResolveUserIdFromWallet.mockResolvedValue("user-1");
  });

  it("requires authenticated wallet ownership instead of trusting a wallet header", async () => {
    mockUnauthorized();
    const supabase = { from: jest.fn() };
    mockGetServerSupabaseClient.mockReturnValue(supabase as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { "x-wallet-address": "Nspoofed1111111111111111111111111111" },
    });

    await tokensHandler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(mockGetServerSupabaseClient).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("refuses to persist a raw secret value without encryptedToken", async () => {
    const upsert = jest.fn();
    mockGetServerSupabaseClient.mockReturnValue({ from: jest.fn(() => ({ upsert })) } as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        name: "Phala API",
        appId: "miniapp-oracle",
        secretType: "api_key",
        value: "plain-secret-must-not-be-stored",
      },
    });

    await tokensHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("/api/secrets/tokens/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStandardLimit.mockReturnValue(false);
    mockRequireWalletAuth.mockResolvedValue("Nwallet11111111111111111111111111111");
    mockResolveUserIdFromWallet.mockResolvedValue("user-1");
  });

  it("requires authenticated wallet ownership before revoking a token", async () => {
    mockUnauthorized();
    const update = jest.fn();
    mockGetServerSupabaseClient.mockReturnValue({ from: jest.fn(() => ({ update })) } as never);

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "DELETE",
      query: { id: "tok_1" },
      headers: { "x-wallet-address": "Nspoofed1111111111111111111111111111" },
    });

    await tokenHandler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(mockGetServerSupabaseClient).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
