import { describe, expect, it, vi } from "vitest";

import { GAS_HASH } from "../constants/rpc";
import {
  inspectTimestampProofAnchor,
  normalizeTimestampProofTxid,
} from "../../timestamp-proof/src/timestamp-proof-rpc";

const TXID = `0x${"a".repeat(64)}`;
const DIGEST = "b".repeat(64);
const HASH_BYTES = btoa(String.fromCharCode(...Array.from({ length: 20 }, (_, index) => index + 1)));
const KNOWN_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const OTHER_ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const KNOWN_HASH_BYTES = "ODf0EwY4dOXBDMmxnUaR3fZWBm0=";

function response(result?: unknown, error?: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => ({ result, error })),
  } as unknown as Response;
}

function confirmedFetcher(
  scriptDigest = DIGEST,
  blocktime = 1_700_000_000,
  hashBytes = HASH_BYTES,
) {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const method = JSON.parse(String(init?.body ?? "{}"))?.method;
    if (method === "getapplicationlog") {
      return response({
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: GAS_HASH,
            eventname: "Transfer",
            state: {
              type: "Array",
              value: [
                { type: "ByteString", value: hashBytes },
                { type: "ByteString", value: hashBytes },
                { type: "Integer", value: "0" },
              ],
            },
          }],
        }],
      });
    }
    return response({
      script: btoa(`prefix timestamp-proof:${scriptDigest} suffix`),
      blocktime,
      confirmations: 3,
    });
  });
}

describe("timestamp-proof RPC receipt inspection", () => {
  it("accepts only exact 0x-prefixed 64-byte transaction ids", () => {
    expect(normalizeTimestampProofTxid(TXID.toUpperCase())).toBe(TXID);
    expect(normalizeTimestampProofTxid("a".repeat(64))).toBe("");
    expect(normalizeTimestampProofTxid(`0x${"a".repeat(63)}`)).toBe("");
    expect(normalizeTimestampProofTxid(`0x${"a".repeat(65)}`)).toBe("");
  });

  it("confirms only a HALT receipt with the exact zero-GAS self-transfer and digest marker", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, confirmedFetcher() as typeof fetch);

    expect(receipt).toEqual({
      status: "confirmed",
      digest: DIGEST,
      blockTime: 1_700_000_000_000,
      reason: "confirmed",
    });
  });

  it("rejects a transaction whose raw-script marker belongs to another digest", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-testnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, confirmedFetcher("c".repeat(64)) as typeof fetch);

    expect(receipt.status).toBe("mismatch");
    expect(receipt.digest).toBe("c".repeat(64));
  });

  it("rejects an ambiguous transaction that carries more than one proof marker", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, confirmedFetcher(`${DIGEST} timestamp-proof:${"c".repeat(64)}`) as typeof fetch);

    expect(receipt).toMatchObject({ status: "mismatch", reason: "anchor-binding-mismatch" });
  });

  it("preserves Neo RPC millisecond block times instead of multiplying them again", async () => {
    const blockTimeMs = 1_783_763_910_269;
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-testnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, confirmedFetcher(DIGEST, blockTimeMs) as typeof fetch);

    expect(receipt.blockTime).toBe(blockTimeMs);
  });

  it("binds the Transfer event to the wallet address recorded before broadcast", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
      expectedAddress: KNOWN_ADDRESS,
    }, confirmedFetcher(DIGEST, 1_700_000_000, KNOWN_HASH_BYTES) as typeof fetch);

    expect(receipt.status).toBe("confirmed");
  });

  it("rejects a valid-looking self-transfer from a different wallet", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
      expectedAddress: OTHER_ADDRESS,
    }, confirmedFetcher(DIGEST, 1_700_000_000, KNOWN_HASH_BYTES) as typeof fetch);

    expect(receipt.status).toBe("mismatch");
  });

  it("rejects an invalid expected wallet instead of silently dropping account binding", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
      expectedAddress: "not-a-neo-address",
    }, confirmedFetcher() as typeof fetch);

    expect(receipt).toMatchObject({ status: "mismatch", reason: "anchor-binding-mismatch" });
  });

  it("rejects malformed self-transfer hash slots even when both malformed values match", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, confirmedFetcher(DIGEST, 1_700_000_000, btoa("not-a-hash")) as typeof fetch);

    expect(receipt).toMatchObject({ status: "mismatch", reason: "anchor-binding-mismatch" });
  });

  it("keeps an unknown application log pending rather than treating the txid as proof", async () => {
    const fetcher = vi.fn(async () => response(undefined, { code: -100, message: "Unknown transaction" }));
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, fetcher as typeof fetch);

    expect(receipt.status).toBe("pending");
  });

  it("reports RPC failures as unavailable instead of mislabeling them pending", async () => {
    const fetcher = vi.fn(async () => response(undefined, { code: -32603, message: "Internal error" }));
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, fetcher as typeof fetch);

    expect(receipt).toMatchObject({ status: "unreachable", reason: "receipt-unavailable" });
  });

  it("does not invent a public proof time when the raw transaction has no block time", async () => {
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, confirmedFetcher(DIGEST, 0) as typeof fetch);

    expect(receipt).toMatchObject({ status: "unreachable", reason: "block-time-unavailable", blockTime: 0 });
  });

  it("surfaces a VM FAULT and never fetches or accepts the raw marker", async () => {
    const fetcher = vi.fn(async () => response({
      executions: [{ vmstate: "FAULT", exception: "ASSERT failed", notifications: [] }],
    }));
    const receipt = await inspectTimestampProofAnchor({
      network: "neo-n3-mainnet",
      txid: TXID,
      expectedDigest: DIGEST,
    }, fetcher as typeof fetch);

    expect(receipt).toMatchObject({ status: "fault", reason: "ASSERT failed" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
