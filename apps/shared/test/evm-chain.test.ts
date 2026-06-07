import { describe, it, expect, afterEach, vi } from "vitest";
import {
  gasToWei,
  isEvmNetwork,
  detectEvmNetwork,
  evmInvoke,
  NEO_X_CONFIG,
} from "../utils/evm-chain";

type Handler = (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
function mockEthereum(handler: Handler) {
  (globalThis as unknown as { ethereum?: { request: Handler } }).ethereum = { request: handler };
}
afterEach(() => {
  delete (globalThis as unknown as { ethereum?: unknown }).ethereum;
});

describe("gasToWei", () => {
  it("converts decimal GAS to 18-decimal wei", () => {
    expect(gasToWei("1").toString()).toBe("1000000000000000000");
    expect(gasToWei("0.1").toString()).toBe("100000000000000000");
    expect(gasToWei("0.05").toString()).toBe("50000000000000000");
    expect(gasToWei("20").toString()).toBe("20000000000000000000");
    expect(gasToWei(0.5).toString()).toBe("500000000000000000");
  });
});

describe("isEvmNetwork", () => {
  it("recognizes Neo X networks only", () => {
    expect(isEvmNetwork("neo-x-mainnet")).toBe(true);
    expect(isEvmNetwork("neo-x-testnet")).toBe(true);
    expect(isEvmNetwork("neo-n3-mainnet")).toBe(false);
    expect(isEvmNetwork(null)).toBe(false);
  });
});

describe("detectEvmNetwork", () => {
  it("maps Neo X chainIds; null otherwise", async () => {
    mockEthereum(async ({ method }) => (method === "eth_chainId" ? "0xba93" : null));
    expect(await detectEvmNetwork()).toBe("neo-x-mainnet");
    mockEthereum(async ({ method }) => (method === "eth_chainId" ? "0xba9304" : null));
    expect(await detectEvmNetwork()).toBe("neo-x-testnet");
    mockEthereum(async ({ method }) => (method === "eth_chainId" ? "0x1" : null)); // Ethereum mainnet
    expect(await detectEvmNetwork()).toBeNull();
  });
  it("returns null with no injected wallet", async () => {
    expect(await detectEvmNetwork()).toBeNull();
  });
});

describe("evmInvoke", () => {
  it("encodes selector+uint args, sends value, and extracts the event id", async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    mockEthereum(async ({ method, params }) => {
      calls.push({ method, params });
      if (method === "eth_accounts") return ["0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C"];
      if (method === "eth_sendTransaction") return "0xtxhash";
      if (method === "eth_getTransactionReceipt") {
        return {
          status: "0x1",
          logs: [{ topics: ["0xevttopic", "0x000000000000000000000000000000000000000000000000000000000000002a"] }],
        };
      }
      return null;
    });

    const res = await evmInvoke({
      address: "0xFA795F814d38F218153d21838360096f3F5cb774",
      selector: "0x43046844",
      uintArgs: [6],
      valueWei: gasToWei("0.1").toString(),
      eventTopic: "0xEVTTOPIC",
    });

    expect(res.txid).toBe("0xtxhash");
    expect(res.eventId).toBe("42"); // 0x2a

    const sent = calls.find((c) => c.method === "eth_sendTransaction")!;
    const tx = (sent.params as Array<Record<string, string>>)[0];
    expect(tx.to).toBe("0xFA795F814d38F218153d21838360096f3F5cb774");
    // selector + uint8(6) padded to 32 bytes
    expect(tx.data).toBe("0x43046844" + "6".padStart(64, "0"));
    expect(tx.value).toBe("0x16345785d8a0000"); // 0.1e18 wei
  });

  it("throws on a reverted receipt", async () => {
    mockEthereum(async ({ method }) => {
      if (method === "eth_accounts") return ["0xabc"];
      if (method === "eth_sendTransaction") return "0xtx";
      if (method === "eth_getTransactionReceipt") return { status: "0x0", logs: [] };
      return null;
    });
    await expect(
      evmInvoke({ address: "0xdice", selector: "0x43046844", uintArgs: [3] }),
    ).rejects.toThrow(/reverted/i);
  });
});

describe("NEO_X_CONFIG", () => {
  it("has correct mainnet chain id + rpc", () => {
    expect(NEO_X_CONFIG["neo-x-mainnet"].chainId).toBe(47763);
    expect(NEO_X_CONFIG["neo-x-mainnet"].rpc).toContain("banelabs");
  });
});
