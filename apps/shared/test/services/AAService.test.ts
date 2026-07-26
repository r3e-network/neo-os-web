import { beforeEach, describe, expect, it, vi } from "vitest";

import { AAService } from "../../services/AAService";
import { useAbstractAccount } from "../../composables/useAbstractAccount";
import type { EventBus } from "../../services/EventBus";

vi.mock("../../composables/useAbstractAccount", () => ({
  useAbstractAccount: vi.fn(),
}));

describe("AAService", () => {
  const submitRelayTransaction = vi.fn();
  const aaClient = {
    submitRelayTransaction,
    checkGasSponsorship: vi.fn(),
    requestGasSponsorship: vi.fn(),
    setAAAddress: vi.fn(),
    aaAddress: { get: vi.fn(), set: vi.fn(), subscribe: vi.fn() },
    isCheckingSponsorship: { get: vi.fn(), set: vi.fn(), subscribe: vi.fn() },
    isRelaying: { get: vi.fn(), set: vi.fn(), subscribe: vi.fn() },
    error: { get: vi.fn(), set: vi.fn(), subscribe: vi.fn() },
  };
  const events = { emit: vi.fn() } as unknown as EventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAbstractAccount).mockReturnValue(aaClient as never);
  });

  it("returns relay transaction ids when the relay submitted on-chain", async () => {
    submitRelayTransaction.mockResolvedValue({
      txid: "0xrelaytx",
      networkFee: "0.001",
      systemFee: "0.002",
    });
    const service = new AAService("miniapp-aa-relay-console", events);

    await expect(service.submitRelay({ simulate: false })).resolves.toEqual(
      expect.objectContaining({
        txid: "0xrelaytx",
        networkFee: "0.001",
        systemFee: "0.002",
      }),
    );
  });

  it("accepts explicit pending relay statuses without pretending there is a txid", async () => {
    submitRelayTransaction.mockResolvedValue({
      status: "pending",
      request_id: "relay-42",
    });
    const service = new AAService("miniapp-aa-relay-console", events);

    await expect(service.submitRelay({ simulate: false })).resolves.toEqual(
      expect.objectContaining({
        txid: "",
        status: "pending",
        requestId: "relay-42",
      }),
    );
  });

  it("rejects relay responses that have no txid or accepted status", async () => {
    submitRelayTransaction.mockResolvedValue({
      status: "unavailable",
      reason: "AA relay URL is not configured",
    });
    const service = new AAService("miniapp-aa-relay-console", events);

    await expect(service.submitRelay({ simulate: false })).rejects.toThrow(
      "AA relay not submitted: AA relay URL is not configured",
    );
  });

  it("does not advertise session-key writes before a shared verifier adapter exists", () => {
    const service = new AAService("miniapp-aa-session-key-lab", events);

    expect(service).not.toHaveProperty("createSessionKey");
  });
});
