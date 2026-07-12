import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  EVENT_TICKET_BINDINGS,
  attestEventTicketContract,
  findEventTicketNotification,
  normalizeEventTicketNetwork,
  readEventTicketTransactionOutcome,
} from "../../event-ticket-pass/src/event-ticket-rpc";

const TXID = `0x${"a".repeat(64)}`;

const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "..")
  : path.resolve(process.cwd(), "apps");
const contractManifest = JSON.parse(
  fs.readFileSync(
    path.resolve(appsRoot, "../contracts/build/MiniAppEventTicketPass.manifest.json"),
    "utf8",
  ),
);

function fetcherFor(manifest = contractManifest, checksum = EVENT_TICKET_BINDINGS.testnet.checksum) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      result: {
        hash: EVENT_TICKET_BINDINGS.testnet.contract,
        nef: { checksum },
        manifest,
      },
    }),
  }));
}

describe("Event Ticket Pass deployment attestation", () => {
  it("accepts only the exact published checksum, NEP-11 declaration, methods, and events", async () => {
    const fetcher = fetcherFor();
    await expect(
      attestEventTicketContract(
        "neo-n3-testnet",
        EVENT_TICKET_BINDINGS.testnet.contract,
        fetcher,
      ),
    ).resolves.toMatchObject({ compatible: true, reason: "ok", network: "testnet" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects an ABI drift even when the contract name and hash still match", async () => {
    const drifted = structuredClone(contractManifest);
    const transfer = drifted.abi.methods.find((method: { name?: string }) => method.name === "transfer");
    transfer.parameters[2].type = "ByteArray";

    await expect(
      attestEventTicketContract(
        "testnet",
        EVENT_TICKET_BINDINGS.testnet.contract,
        fetcherFor(drifted),
      ),
    ).resolves.toMatchObject({ compatible: false, reason: "abi" });
  });

  it("rejects a bytecode checksum drift", async () => {
    await expect(
      attestEventTicketContract(
        "mainnet",
        EVENT_TICKET_BINDINGS.mainnet.contract,
        fetcherFor(contractManifest, 1),
      ),
    ).resolves.toMatchObject({ compatible: false, reason: "checksum" });
  });

  it("does not guess mainnet when the wallet only reports generic Neo N3", async () => {
    expect(normalizeEventTicketNetwork("neo-n3")).toBeNull();
    const fetcher = fetcherFor();
    await expect(
      attestEventTicketContract(
        "neo-n3",
        EVENT_TICKET_BINDINGS.mainnet.contract,
        fetcher,
      ),
    ).resolves.toMatchObject({ compatible: false, reason: "network" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("parses a canonical HALT application log and finds only the exact ticket notification", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          executions: [
            {
              vmstate: "HALT",
              notifications: [
                {
                  contract: EVENT_TICKET_BINDINGS.testnet.contract,
                  eventname: "TicketIssued",
                  state: {
                    type: "Array",
                    value: [
                      { type: "ByteString", value: btoa("1-1") },
                      { type: "Integer", value: "1" },
                      { type: "Hash160", value: "0x1111111111111111111111111111111111111111" },
                    ],
                  },
                },
              ],
            },
          ],
        },
      }),
    }));

    const outcome = await readEventTicketTransactionOutcome(
      "testnet",
      TXID,
      EVENT_TICKET_BINDINGS.testnet.contract,
      fetcher,
    );
    expect(outcome.state).toBe("halt");
    expect(
      findEventTicketNotification(
        outcome,
        EVENT_TICKET_BINDINGS.testnet.contract,
        "TicketIssued",
      ),
    ).toMatchObject({
      eventName: "TicketIssued",
      state: ["1-1", 1, "0x1111111111111111111111111111111111111111"],
    });
    expect(
      findEventTicketNotification(
        outcome,
        "0x2222222222222222222222222222222222222222",
        "TicketIssued",
      ),
    ).toBeNull();
  });

  it("classifies VM FAULT as terminal and keeps missing or invalid logs unknown", async () => {
    const faultFetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: { executions: [{ vmstate: "FAULT", notifications: [] }] },
      }),
    }));
    await expect(
      readEventTicketTransactionOutcome(
        "neo-n3-mainnet",
        TXID,
        EVENT_TICKET_BINDINGS.mainnet.contract,
        faultFetcher,
      ),
    ).resolves.toEqual({ state: "fault", notifications: [] });

    const unusedFetcher = vi.fn();
    await expect(
      readEventTicketTransactionOutcome(
        "testnet",
        "0xshort",
        EVENT_TICKET_BINDINGS.testnet.contract,
        unusedFetcher,
      ),
    ).resolves.toEqual({ state: "unknown", notifications: [] });
    expect(unusedFetcher).not.toHaveBeenCalled();
  });
});
