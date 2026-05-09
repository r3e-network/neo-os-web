import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/onegate-vault/status";
import { createSupabaseOneGateVaultRepository } from "@/lib/onegate-vault";

jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })),
}));

jest.mock("@/lib/onegate-vault", () => {
  const actual = jest.requireActual("@/lib/onegate-vault");
  return {
    ...actual,
    createSupabaseOneGateVaultRepository: jest.fn(),
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

describe("/api/onegate-vault/status", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ONEGATE_VAULT_KEY_PEPPER = "test-pepper";
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: { blockhash: "0xblock", confirmations: 12 },
        }),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          result: {
            executions: [
              {
                trigger: "Application",
                vmstate: "HALT",
                stack: [{ type: "Boolean", value: false }],
                notifications: [],
              },
            ],
          },
        }),
      }) as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("marks an included tx as failed when GAS transfer returned false", async () => {
    const markFailed = jest.fn().mockResolvedValue(undefined);
    (createSupabaseOneGateVaultRepository as jest.Mock).mockReturnValue({
      getClaimStatus: jest.fn().mockResolvedValue({
        keyHash: "hash",
        campaignId: "pool-001",
        network: "testnet",
        status: "submitted",
        walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        amountFixed8: "100000000",
        txHash:
          "0x03ccf25f24885badb04486b00b7ba21f557e44f81f9404a9514d86eae5a87c03",
        requestId: "req-1",
      }),
      markPaid: jest.fn(),
      markFailed,
    });

    const req = {
      method: "GET",
      query: {
        claimKey: "ogv_test_key_1234567890",
        address: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        network: "testnet",
        pool: "pool-001",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      url: "/api/onegate-vault/status",
    } as unknown as NextApiRequest;
    const res = mockResponse();

    await handler(req, res);

    expect(markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "testnet",
        requestId: "req-1",
        errorMessage: "GAS transfer returned false",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("revalidates an existing paid row and fails it when the chain log disproves payment", async () => {
    const markFailed = jest.fn().mockResolvedValue(undefined);
    (createSupabaseOneGateVaultRepository as jest.Mock).mockReturnValue({
      getClaimStatus: jest.fn().mockResolvedValue({
        keyHash: "hash",
        campaignId: "pool-001",
        network: "testnet",
        status: "paid",
        walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        amountFixed8: "100000000",
        txHash:
          "0x03ccf25f24885badb04486b00b7ba21f557e44f81f9404a9514d86eae5a87c03",
        requestId: "req-1",
      }),
      markPaid: jest.fn(),
      markFailed,
    });

    const req = {
      method: "GET",
      query: {
        claimKey: "ogv_test_key_1234567890",
        address: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        network: "testnet",
        pool: "pool-001",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      url: "/api/onegate-vault/status",
    } as unknown as NextApiRequest;
    const res = mockResponse();

    await handler(req, res);

    expect(markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "testnet",
        requestId: "req-1",
        errorMessage: "GAS transfer returned false",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
