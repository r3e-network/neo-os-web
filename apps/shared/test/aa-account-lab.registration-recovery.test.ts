import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPendingAARegistration,
  readAARegistrationOutcome,
  registrationEventMatches,
  type PendingAARegistration,
} from "../../aa-account-lab/src/registration-recovery";

const pending: PendingAARegistration = {
  version: 1,
  txid: `0x${"ab".repeat(32)}`,
  network: "mainnet",
  coreHash: "0x1111111111111111111111111111111111111111",
  accountId: "0x2222222222222222222222222222222222222222",
  verifier: "0x3333333333333333333333333333333333333333",
  hook: "0x0000000000000000000000000000000000000000",
  backupOwner: "0x4444444444444444444444444444444444444444",
  escapeTimelock: 2_592_000,
  createdAt: 1_700_000_000_000,
};

function hashStack(displayHash: string) {
  return {
    type: "ByteString",
    value: Buffer.from(displayHash.replace(/^0x/, ""), "hex").reverse().toString("base64"),
  };
}

function rpcResponse(vmstate: string, notifications: unknown[] = []) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { executions: [{ vmstate, notifications }] },
  }), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("AA Account Lab registration evidence", () => {
  it("accepts only a complete durable pending record while allowing an explicit zero hook", () => {
    expect(isPendingAARegistration(pending)).toBe(true);
    expect(isPendingAARegistration({ ...pending, txid: "not-a-txid" })).toBe(false);
    expect(isPendingAARegistration({ ...pending, backupOwner: "0x0000000000000000000000000000000000000000" })).toBe(false);
    expect(isPendingAARegistration({ ...pending, escapeTimelock: 604_799 })).toBe(false);
  });

  it("matches all four AccountRegistered fields and rejects a wrong owner", () => {
    const outcome = {
      state: "halt" as const,
      notifications: [{
        contract: pending.coreHash,
        eventName: "AccountRegistered",
        values: [
          hashStack(pending.accountId),
          hashStack(pending.backupOwner),
          hashStack(pending.verifier),
          hashStack(pending.hook),
        ],
      }],
    };

    expect(registrationEventMatches(pending, outcome)).toBe(true);
    expect(registrationEventMatches(
      { ...pending, backupOwner: "0x5555555555555555555555555555555555555555" },
      outcome,
    )).toBe(false);
  });

  it("parses the real getapplicationlog notification shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => rpcResponse("HALT", [{
      contract: pending.coreHash,
      eventname: "AccountRegistered",
      state: {
        type: "Array",
        value: [
          hashStack(pending.accountId),
          hashStack(pending.backupOwner),
          hashStack(pending.verifier),
          hashStack(pending.hook),
        ],
      },
    }])));

    const outcome = await readAARegistrationOutcome(pending);

    expect(outcome.state).toBe("halt");
    expect(registrationEventMatches(pending, outcome)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("preserves VM FAULT and unavailable RPC as distinct recovery states", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(rpcResponse("FAULT, BREAK"))
      .mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readAARegistrationOutcome(pending)).resolves.toEqual({ state: "fault", notifications: [] });
    await expect(readAARegistrationOutcome(pending)).resolves.toEqual({ state: "unknown", notifications: [] });
  });
});
