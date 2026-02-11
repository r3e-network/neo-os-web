/**
 * Unit tests for wallet-based authentication module.
 *
 * Mocks neon-js crypto primitives so tests run without real key material.
 */

import type { NextApiRequest, NextApiResponse } from "next";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVerify = jest.fn();
const mockGetScriptHashFromPublicKey = jest.fn();
const mockGetScriptHashFromAddress = jest.fn();
const mockStr2hexstring = jest.fn();

jest.mock("@cityofzion/neon-js", () => ({
  wallet: {
    verify: (...args: unknown[]) => mockVerify(...args),
    getScriptHashFromPublicKey: (...args: unknown[]) => mockGetScriptHashFromPublicKey(...args),
    getScriptHashFromAddress: (...args: unknown[]) => mockGetScriptHashFromAddress(...args),
  },
  u: {
    str2hexstring: (...args: unknown[]) => mockStr2hexstring(...args),
  },
}));

jest.mock("@/lib/security/validation", () => ({
  isValidNeoAddress: jest.fn(),
}));

import { requireWalletAuth, withWalletAuth } from "@/lib/security/wallet-auth";
import { isValidNeoAddress } from "@/lib/security/validation";

const mockIsValidNeoAddress = isValidNeoAddress as jest.MockedFunction<typeof isValidNeoAddress>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const FAKE_PUBKEY = "03b209fd4f53a7170ea4444e0cb0a6bb6a53c2bd016926989cf85f9b0fba17a70c";
const FAKE_SIGNATURE = "a".repeat(128);
const FAKE_SCRIPT_HASH = "abcdef1234567890abcdef1234567890abcdef12";

function validMessage(overrides?: Partial<{ address: string; timestamp: number }>): string {
  return JSON.stringify({
    address: overrides?.address ?? FAKE_ADDRESS,
    timestamp: overrides?.timestamp ?? Date.now(),
  });
}

function makeHeaders(overrides?: Partial<Record<string, string | undefined>>): Record<string, string | undefined> {
  return {
    "x-wallet-address": FAKE_ADDRESS,
    "x-wallet-publickey": FAKE_PUBKEY,
    "x-wallet-signature": FAKE_SIGNATURE,
    "x-wallet-message": validMessage(),
    ...overrides,
  };
}

/** Configure all mocks for a happy-path scenario. */
function setupHappyPath(): void {
  mockIsValidNeoAddress.mockReturnValue(true);
  mockGetScriptHashFromPublicKey.mockReturnValue(FAKE_SCRIPT_HASH);
  mockGetScriptHashFromAddress.mockReturnValue(FAKE_SCRIPT_HASH);
  mockStr2hexstring.mockReturnValue("deadbeef");
  mockVerify.mockReturnValue(true);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("requireWalletAuth", () => {
  describe("presence checks", () => {
    it("returns 401 when all headers are missing", () => {
      const result = requireWalletAuth({});
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 401, error: expect.stringContaining("Missing") }),
      );
    });

    it.each(["x-wallet-address", "x-wallet-publickey", "x-wallet-signature", "x-wallet-message"])(
      "returns 401 when %s is missing",
      (header) => {
        const headers = makeHeaders({ [header]: undefined });
        const result = requireWalletAuth(headers);
        expect(result).toEqual(expect.objectContaining({ ok: false, status: 401 }));
      },
    );
  });

  describe("address format", () => {
    it("returns 400 for invalid Neo N3 address", () => {
      mockIsValidNeoAddress.mockReturnValue(false);
      const result = requireWalletAuth(makeHeaders());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400, error: expect.stringContaining("address format") }),
      );
    });
  });

  describe("publicKey ↔ address binding", () => {
    it("returns 400 when derived script hash does not match", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockReturnValue("aaaa");
      mockGetScriptHashFromAddress.mockReturnValue("bbbb");

      const result = requireWalletAuth(makeHeaders());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400, error: expect.stringContaining("does not match address") }),
      );
    });

    it("returns 400 when getScriptHashFromPublicKey throws", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockImplementation(() => {
        throw new Error("bad key");
      });

      const result = requireWalletAuth(makeHeaders());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400, error: expect.stringContaining("Invalid public key") }),
      );
    });
  });

  describe("message structure", () => {
    it("returns 400 for non-JSON message", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockReturnValue(FAKE_SCRIPT_HASH);
      mockGetScriptHashFromAddress.mockReturnValue(FAKE_SCRIPT_HASH);

      const headers = makeHeaders({ "x-wallet-message": "not-json" });
      const result = requireWalletAuth(headers);
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400, error: expect.stringContaining("Malformed") }),
      );
    });

    it("returns 400 when message lacks required fields", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockReturnValue(FAKE_SCRIPT_HASH);
      mockGetScriptHashFromAddress.mockReturnValue(FAKE_SCRIPT_HASH);

      const headers = makeHeaders({ "x-wallet-message": JSON.stringify({ foo: "bar" }) });
      const result = requireWalletAuth(headers);
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400, error: expect.stringContaining("Malformed") }),
      );
    });
  });

  describe("address consistency", () => {
    it("returns 400 when message address differs from header", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockReturnValue(FAKE_SCRIPT_HASH);
      mockGetScriptHashFromAddress.mockReturnValue(FAKE_SCRIPT_HASH);

      const headers = makeHeaders({
        "x-wallet-message": validMessage({ address: "NdifferentAddress1234567890123456" }),
      });
      const result = requireWalletAuth(headers);
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 400, error: expect.stringContaining("does not match header") }),
      );
    });
  });

  describe("timestamp freshness", () => {
    it("returns 401 for expired timestamp (>5 min old)", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockReturnValue(FAKE_SCRIPT_HASH);
      mockGetScriptHashFromAddress.mockReturnValue(FAKE_SCRIPT_HASH);

      const headers = makeHeaders({
        "x-wallet-message": validMessage({ timestamp: Date.now() - 6 * 60 * 1000 }),
      });
      const result = requireWalletAuth(headers);
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 401, error: expect.stringContaining("expired") }),
      );
    });

    it("returns 401 for future timestamp (clock skew)", () => {
      mockIsValidNeoAddress.mockReturnValue(true);
      mockGetScriptHashFromPublicKey.mockReturnValue(FAKE_SCRIPT_HASH);
      mockGetScriptHashFromAddress.mockReturnValue(FAKE_SCRIPT_HASH);

      const headers = makeHeaders({
        "x-wallet-message": validMessage({ timestamp: Date.now() + 60_000 }),
      });
      const result = requireWalletAuth(headers);
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 401, error: expect.stringContaining("expired") }),
      );
    });
  });

  describe("signature verification", () => {
    it("returns 401 when wallet.verify returns false", () => {
      setupHappyPath();
      mockVerify.mockReturnValue(false);

      const result = requireWalletAuth(makeHeaders());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 401, error: expect.stringContaining("Invalid signature") }),
      );
    });

    it("returns 401 when wallet.verify throws", () => {
      setupHappyPath();
      mockVerify.mockImplementation(() => {
        throw new Error("crypto error");
      });

      const result = requireWalletAuth(makeHeaders());
      expect(result).toEqual(
        expect.objectContaining({ ok: false, status: 401, error: expect.stringContaining("verification failed") }),
      );
    });
  });

  describe("happy path", () => {
    it("returns ok:true with verified address", () => {
      setupHappyPath();
      const result = requireWalletAuth(makeHeaders());
      expect(result).toEqual({ ok: true, address: FAKE_ADDRESS });
    });

    it("handles array-valued headers (first element used)", () => {
      setupHappyPath();
      const headers = {
        "x-wallet-address": [FAKE_ADDRESS, "ignored"],
        "x-wallet-publickey": [FAKE_PUBKEY],
        "x-wallet-signature": [FAKE_SIGNATURE],
        "x-wallet-message": [validMessage()],
      };
      const result = requireWalletAuth(headers);
      expect(result).toEqual({ ok: true, address: FAKE_ADDRESS });
    });
  });
});

describe("withWalletAuth", () => {
  const createMockRes = () => {
    const res: Partial<NextApiResponse> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as NextApiResponse;
  };

  it("returns 401 when auth fails", async () => {
    const handler = jest.fn();
    const wrapped = withWalletAuth(handler);

    const req = { headers: {} } as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Missing") }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with walletAddress on success", async () => {
    setupHappyPath();
    const handler = jest.fn();
    const wrapped = withWalletAuth(handler);

    const req = { headers: makeHeaders() } as unknown as NextApiRequest;
    const res = createMockRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledTimes(1);
    const passedReq = handler.mock.calls[0][0];
    expect(passedReq.walletAddress).toBe(FAKE_ADDRESS);
  });
});
