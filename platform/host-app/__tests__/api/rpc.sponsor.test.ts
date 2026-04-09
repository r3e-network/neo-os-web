import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

const VALID_ADDRESS = "NactualWallet";

jest.mock("@/lib/require-wallet-auth", () => ({
  requireWalletAuth: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const signMock = jest.fn();
const serializeMock = jest.fn(() => "deadbeef");
const deserializeMock = jest.fn();

jest.mock("@r3e/neo-js-sdk/browser", () => ({
  tx: {
    Transaction: { deserialize: deserializeMock },
    Witness: function Witness(init: Record<string, unknown>) {
      return { ...init, toJSON: () => init };
    },
    WitnessScope: { None: "None" },
  },
  wallet: {
    Account: jest.fn(() => ({
      scriptHash: "sponsor-script-hash",
      publicKey: "03abc",
      contract: {
        script: Buffer.from("2103abcac", "hex").toString("base64"),
      },
    })),
    getAddressFromScriptHash: jest.fn((hash: string) => hash),
  },
}));

import { requireWalletAuth } from "@/lib/require-wallet-auth";

describe("/api/rpc/sponsor", () => {
  let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SPONSORED_WIF = "test-wif";
    process.env.NEXT_PUBLIC_NETWORK_MAGIC = "894710606";

    // Default: auth succeeds with VALID_ADDRESS
    (requireWalletAuth as jest.Mock).mockResolvedValue(VALID_ADDRESS);

    // Default transaction mock with signed witness
    deserializeMock.mockImplementation(() => ({
      signers: [{ account: VALID_ADDRESS }],
      witnesses: [{ invocationScript: "0c40" + "00".repeat(64), verificationScript: "abc" }],
      serialize: serializeMock,
      sign: signMock,
      networkFee: 0n,
    }));

    // Re-require to reset module-level state
    jest.resetModules();
    jest.doMock("@/lib/require-wallet-auth", () => ({
      requireWalletAuth: requireWalletAuth,
    }));
    jest.doMock("@/lib/logger", () => ({
      logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    }));
    jest.doMock("@r3e/neo-js-sdk/browser", () => ({
      tx: {
        Transaction: { deserialize: deserializeMock },
        Witness: function Witness(init: Record<string, unknown>) {
          return { ...init, toJSON: () => init };
        },
        WitnessScope: { None: "None" },
      },
      wallet: {
        Account: jest.fn(() => ({
          scriptHash: "sponsor-script-hash",
          publicKey: "03abc",
          contract: {
            script: Buffer.from("2103abcac", "hex").toString("base64"),
          },
        })),
        getAddressFromScriptHash: jest.fn((hash: string) => hash),
      },
    }));

    handler = require("@/pages/api/rpc/sponsor").default;
  });

  it("rejects non-POST requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("rejects when wallet auth fails", async () => {
    (requireWalletAuth as jest.Mock).mockImplementation(async (_req, res) => {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { txBase64: "ignored", userAddress: VALID_ADDRESS },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("rejects when authenticated wallet does not match userAddress", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { txBase64: "ignored", userAddress: "DifferentWallet" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    const body = JSON.parse(res._getData());
    expect(body.error.message).toContain("does not match");
  });

  it("rejects when the transaction lacks a signed user witness", async () => {
    deserializeMock.mockImplementation(() => ({
      signers: [{ account: VALID_ADDRESS }],
      witnesses: [{ invocationScript: "", verificationScript: "" }],
      serialize: serializeMock,
      sign: signMock,
      networkFee: 0n,
    }));

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: { txBase64: "ignored", userAddress: VALID_ADDRESS },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error.message).toContain("signed user witness");
  });
});
