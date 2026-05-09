import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/onegate-vault/claim";
import { claimOneGateVaultReward } from "@/lib/onegate-vault";

jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })),
}));

jest.mock("@/lib/onegate-vault", () => {
  const actual = jest.requireActual("@/lib/onegate-vault");
  return {
    ...actual,
    claimOneGateVaultReward: jest.fn(),
    createSupabaseOneGateVaultRepository: jest.fn(() => ({ kind: "repo" })),
    createTxProxyOneGateVaultPaymentService: jest.fn(() => ({ kind: "payment" })),
  };
});

function mockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  } as unknown as NextApiResponse & {
    status: jest.Mock;
    json: jest.Mock;
  };
  return res;
}

describe("/api/onegate-vault/claim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ONEGATE_VAULT_KEY_PEPPER = "test-pepper";
    (claimOneGateVaultReward as jest.Mock).mockResolvedValue({
      status: "paid",
      claimKey: "ogv_test_key_1234567890",
      address: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
      network: "testnet",
      amount: "3.5",
      amountFixed8: "350000000",
      luckPercent: "7.00",
      txHash: "0xreward",
      requestId: "ogv_req",
    });
  });

  it("claims a QR key through the server payout engine", async () => {
    const req = {
      method: "POST",
      body: {
        claimKey: "ogv_test_key_1234567890",
        address: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        network: "testnet",
        pool: "pool-001",
        oneGateAppId: "23",
        appId: "miniapp-gas-lucky-pool",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      url: "/api/onegate-vault/claim",
    } as unknown as NextApiRequest;
    const res = mockResponse();

    await handler(req, res);

    expect(claimOneGateVaultReward).toHaveBeenCalledWith(
      expect.objectContaining({
        claimKey: "ogv_test_key_1234567890",
        address: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        network: "testnet",
        poolId: "pool-001",
        oneGateAppId: "23",
        appId: "miniapp-gas-lucky-pool",
      }),
      expect.objectContaining({ keyPepper: "test-pepper" }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ txHash: "0xreward", luckPercent: "7.00" }));
  });
});
