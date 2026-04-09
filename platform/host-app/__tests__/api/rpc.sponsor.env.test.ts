import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/rpc/sponsor env access", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.SPONSORED_WIF;
    delete process.env.NEXT_PUBLIC_NETWORK_MAGIC;
    delete process.env.NEXT_PUBLIC_RPC_URL;
  });

  it("reads sponsor config lazily at request time", async () => {
    const signMock = jest.fn();
    const serializeMock = jest.fn(() => "deadbeef");
    const deserializeMock = jest.fn();
    const fakePrimaryTx = {
      signers: [{ account: "user-script-hash" }],
      serialize: serializeMock,
      sign: signMock,
      witnesses: [{ invocationScript: "0c40" + "00".repeat(64), verificationScript: "abc", toJSON: () => ({ invocation: "witness-1", verification: "witness-2" }) }],
    };
    const fakeSizingTx = {
      signers: [],
      witnesses: [],
      serialize: jest.fn(() => "00".repeat(120)),
    };
    deserializeMock.mockImplementationOnce(() => fakePrimaryTx).mockImplementationOnce(() => fakeSizingTx);

    jest.doMock("@/lib/require-wallet-auth", () => ({
      requireWalletAuth: jest.fn(async () => "user-script-hash"),
    }));

    jest.doMock("@r3e/neo-js-sdk/browser", () => {
      return {
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
      };
    });

    const handler = require("@/pages/api/rpc/sponsor").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.SPONSORED_WIF = "updated-wif";
    process.env.NEXT_PUBLIC_NETWORK_MAGIC = "123";

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
      body: {
        txBase64: "ignored",
        userAddress: "user-script-hash",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(signMock).toHaveBeenCalledWith("updated-wif", 123);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ success: true, sponsoredTxBase64: "deadbeef" }),
    );
  });
});
