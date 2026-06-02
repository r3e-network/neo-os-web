import { afterEach, describe, expect, it } from "vitest";

import { api } from "../../neo-multisig/src/services/api";

afterEach(() => {
  localStorage.clear();
});

describe("Neo Multisig request store", () => {
  it("creates, loads, signs, and marks a multisig request ready", async () => {
    const created = await api.create({
      chainId: "neo-n3-testnet",
      scriptHash: "0x1111111111111111111111111111111111111111",
      threshold: 2,
      signers: ["02aa", "03bb"],
      transactionHex: "00aabb",
      memo: "team payout",
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("pending");
    expect(created.memo).toBe("team payout");

    const firstSignature = await api.addSignature(
      created.id,
      "02aa",
      "signature-a",
    );
    expect(firstSignature.status).toBe("pending");

    const ready = await api.addSignature(created.id, "03bb", "signature-b");
    expect(ready.status).toBe("ready");
    expect(Object.keys(ready.signatures)).toEqual(["02aa", "03bb"]);

    const loaded = await api.get(created.id);
    expect(loaded.status).toBe("ready");
    expect(loaded.transaction_hex).toBe("00aabb");
  });

  it("persists broadcast state with a txid receipt", async () => {
    const created = await api.create({
      chainId: "neo-n3-testnet",
      scriptHash: "0x2222222222222222222222222222222222222222",
      threshold: 1,
      signers: ["02aa"],
      transactionHex: "00ccdd",
    });

    const broadcasted = await api.updateStatus(
      created.id,
      "broadcasted",
      "0xabc123",
    );

    expect(broadcasted.status).toBe("broadcasted");
    expect(broadcasted.broadcast_txid).toBe("0xabc123");
    await expect(api.get(created.id)).resolves.toMatchObject({
      status: "broadcasted",
      broadcast_txid: "0xabc123",
    });
  });
});
