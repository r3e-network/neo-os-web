import { afterEach, describe, expect, it, vi } from "vitest";
import { readLastSurvivorTransactionOutcome } from "./last-survivor-rpc";

const CONTRACT = `0x${"ab".repeat(20)}`;
const TXID = `0x${"cd".repeat(32)}`;

afterEach(() => vi.restoreAllMocks());

describe("Last Survivor application-log recovery", () => {
  it("accepts only the exact HALT event from the bound contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: CONTRACT,
            eventname: "KeysBought",
            state: { type: "Array", value: [{ type: "Integer", value: "7" }] },
          }],
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(readLastSurvivorTransactionOutcome(
      "testnet",
      TXID,
      "KeysBought",
      CONTRACT,
    )).resolves.toMatchObject({ state: "halt", event: expect.any(Object) });
  });

  it("keeps FAULT distinct from unknown transport state", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(readLastSurvivorTransactionOutcome(
      "testnet",
      TXID,
      "KeysBought",
      CONTRACT,
    )).resolves.toEqual({ state: "fault", event: null });

    await expect(readLastSurvivorTransactionOutcome(
      "testnet",
      "0xshort",
      "KeysBought",
      CONTRACT,
    )).resolves.toEqual({ state: "unknown", event: null });
  });
});
