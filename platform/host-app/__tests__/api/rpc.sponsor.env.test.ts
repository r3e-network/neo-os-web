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

    jest.doMock("@cityofzion/neon-js", () => {
      const fakeTx = {
        signers: [{ account: "user-script-hash" }],
        serialize: serializeMock,
        sign: signMock,
        witnesses: [{ serialize: () => "witness-1" }],
      };

      return {
        tx: {
          Transaction: { deserialize: jest.fn(() => fakeTx) },
          Signer: function Signer(init: unknown) { return init; },
          Witness: function Witness(init: Record<string, unknown>) {
            return { ...init, serialize: () => "00" };
          },
          WitnessScope: { None: "None" },
        },
        wallet: {
          Account: jest.fn(() => ({ scriptHash: "sponsor-script-hash", publicKey: "03abc" })),
          getAddressFromScriptHash: jest.fn((hash: string) => hash),
        },
        rpc: {},
        u: {
          BigInteger: {
            fromNumber: (value: number) => value,
          },
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
    expect(signMock).toHaveBeenCalledWith(
      expect.objectContaining({ scriptHash: "sponsor-script-hash" }),
      123,
    );
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ success: true, sponsoredTxBase64: "deadbeef" }),
    );
  });
});
