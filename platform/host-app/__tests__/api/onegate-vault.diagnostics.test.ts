import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/onegate-vault/diagnostics";

const fromMock = jest.fn();

jest.mock("@/lib/server-supabase", () => ({
  getServerSupabaseClient: jest.fn(() => ({ from: fromMock })),
}));

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

describe("/api/onegate-vault/diagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const single = jest
      .fn()
      .mockResolvedValue({ data: { id: "diag_1" }, error: null });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    fromMock.mockReturnValue({ insert });
  });

  it("stores sanitized OneGate scan diagnostics without QR keys or wallet addresses", async () => {
    const req = {
      method: "POST",
      body: {
        eventType: "missing_address",
        network: "mainnet",
        source: "onegate",
        operation: "claimOneGateVault",
        poolId: "pool-001",
        oneGateAppId: "23",
        appId: "miniapp-gas-lucky-pool",
        message:
          "key=ogv_live_key_1234567890 address=NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
        diagnostic:
          "ogvdiag provider=none bridge=invoke callback=function key=ogv_live_key_1234567890",
      },
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
      url: "/api/onegate-vault/diagnostics",
    } as unknown as NextApiRequest;
    const res = mockResponse();

    await handler(req, res);

    expect(fromMock).toHaveBeenCalledWith("onegate_vault_diagnostics");
    const inserted = fromMock.mock.results[0].value.insert.mock.calls[0][0];
    expect(JSON.stringify(inserted)).not.toContain("ogv_live_key_1234567890");
    expect(JSON.stringify(inserted)).not.toContain(
      "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
    );
    expect(inserted).toEqual(
      expect.objectContaining({
        event_type: "missing_address",
        network: "mainnet",
        source: "onegate",
        operation: "claimOneGateVault",
        pool_id: "pool-001",
        onegate_app_id: "23",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ stored: true, id: "diag_1" }),
    );
  });
});
