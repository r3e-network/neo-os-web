import { describe, expect, it, vi } from "vitest";

import { useMemorialShrine } from "../../memorial-shrine/src/composables/useMemorialShrine";

const OWNER = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";

function t(key: string) {
  const messages: Record<string, string> = {
    receiptIdRequired: "Mainnet tribute requires a payment receipt ID.",
  };
  return messages[key] ?? key;
}

function createShrine(options: { launchNetwork?: "mainnet" | "testnet" | null } = {}) {
  const chain = {
    ensureWallet: vi.fn().mockResolvedValue(OWNER),
    invoke: vi.fn().mockResolvedValue({
      txid: "0xinvoke",
      success: true,
      event: { state: [{ value: "42" }, { value: OWNER }] },
    }),
    invokeWithPayment: vi.fn().mockResolvedValue({
      txid: "0xpaid",
      success: true,
      event: { state: [{ value: "42" }, { value: OWNER }, { value: "3" }] },
    }),
  };
  const storage = {
    list: vi.fn().mockResolvedValue({}),
  };
  const badge = {
    award: vi.fn().mockResolvedValue(undefined),
  };
  const events = {
    emit: vi.fn(),
  };
  const shrine = useMemorialShrine({
    chainService: chain as never,
    launchNetwork: options.launchNetwork ?? "testnet",
    storageService: storage as never,
    badgeService: badge as never,
    eventBus: events,
    t,
  });
  return { shrine, chain, storage, badge, events };
}

describe("Memorial Shrine logic", () => {
  it("creates memorials with the deployed createMemorial ABI", async () => {
    const { shrine, chain, events } = createShrine();

    await shrine.createMemorial({
      name: "Loved one",
      photoHash: "ipfs://portrait",
      relationship: "mentor",
      birthYear: 1950,
      deathYear: 2024,
      biography: "A generous builder",
      obituary: "Always remembered",
    });

    expect(chain.invoke).toHaveBeenCalledWith(
      "createMemorial",
      [
        { type: "Hash160", value: OWNER },
        { type: "String", value: "Loved one" },
        { type: "String", value: "ipfs://portrait" },
        { type: "String", value: "mentor" },
        { type: "Integer", value: "1950" },
        { type: "Integer", value: "2024" },
        { type: "String", value: "A generous builder" },
        { type: "String", value: "Always remembered" },
      ],
      { waitForEvent: "MemorialCreated", waitTimeoutMs: 30_000 },
    );
    expect(events.emit).toHaveBeenCalledWith(
      "memorial:created",
      expect.objectContaining({ memorialId: "42", txid: "0xinvoke" }),
    );
  });

  it("pays testnet tributes through direct prepaid GAS", async () => {
    const { shrine, chain, events } = createShrine({ launchNetwork: "testnet" });

    await shrine.payTribute(42, 3, "Always remembered");

    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "3000000",
      "miniapp-memorial-shrine:tribute:42:3",
      "payTribute",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "42" },
        { type: "Integer", value: "3" },
        { type: "String", value: "Always remembered" },
      ],
      { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
    );
    expect(events.emit).toHaveBeenCalledWith(
      "tribute:paid",
      expect.objectContaining({
        memorialId: 42,
        offeringType: 3,
        amountGas: "0.03",
        txid: "0xpaid",
      }),
    );
  });

  it("uses the mainnet receipt ABI for tributes", async () => {
    const { shrine, chain } = createShrine({ launchNetwork: "mainnet" });

    await shrine.payTribute(42, 1, "Mainnet remembrance", "77");

    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(chain.invoke).toHaveBeenCalledWith(
      "payTribute",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "42" },
        { type: "Integer", value: "1" },
        { type: "String", value: "Mainnet remembrance" },
        { type: "Integer", value: "77" },
      ],
      { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
    );
  });
});
