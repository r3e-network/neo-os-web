/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockDb = { from: mockFrom, rpc: mockRpc };
jest.mock("@/lib/supabase", () => ({
  supabase: mockDb,
  supabaseAdmin: mockDb,
  isSupabaseConfigured: true,
}));

jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: jest.fn(() => ({
    ok: true,
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
  })),
}));

import handler from "@/pages/api/dev-tipping/developers";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Dev Tipping Developers API", () => {
  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  describe("GET", () => {
    it("returns developer list", async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ id: 1, name: "Alice", role: "Core Dev", wallet_address: "Nxxx", total_tips: 100, tip_count: 5 }],
          error: null,
        }),
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.developers).toHaveLength(1);
      expect(body.developers[0].name).toBe("Alice");
      expect(body.developers[0].wallet).toBe("Nxxx");
    });

    it("returns 500 on database error when cache is cold", async () => {
      // Expire the in-memory cache by advancing time past TTL (60s)
      jest.useFakeTimers();
      jest.advanceTimersByTime(61_000);

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "DB error" },
        }),
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(500);

      jest.useRealTimers();
    });
  });

  describe("POST", () => {
    it("returns 400 when required fields missing", async () => {
      const { req, res } = createMocks({
        method: "POST",
        body: { developer_id: 1 },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("records tip successfully", async () => {
      mockFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      mockRpc.mockResolvedValue({ error: null });

      const { req, res } = createMocks({
        method: "POST",
        body: {
          developer_id: 1,
          amount: 5,
          message: "Great work!",
          tx_hash: "0xabc",
        },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(201);
      const body = JSON.parse(res._getData());
      expect(body.success).toBe(true);
    });

    it("returns 500 when tip insert fails", async () => {
      mockFrom.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: { message: "Insert failed" },
        }),
      });

      const { req, res } = createMocks({
        method: "POST",
        body: { developer_id: 1, amount: 5 },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(500);
    });
  });
});
