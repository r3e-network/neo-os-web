import { describe, it, expect, afterEach, vi } from "vitest";
import {
  EVM_ACCOUNT_CHANGED_ERROR,
  gasToWei,
  isEvmNetwork,
  detectEvmNetwork,
  evmInvoke,
  evmPersonalSign,
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

  it("rejects malformed amounts instead of mis-scaling them", () => {
    // "-0.5" previously lost its sign (BigInt("-0") is 0n) and became +5e17
    expect(() => gasToWei("-0.5")).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei("-1")).toThrow(/Invalid GAS amount/);
    // multi-dot input previously dropped everything after the second dot
    expect(() => gasToWei("1.2.3")).toThrow(/Invalid GAS amount/);
    // scientific notation (a String(number) artifact) previously threw a raw
    // BigInt SyntaxError; now it is a descriptive validation error
    expect(() => gasToWei("1e-7")).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei(1e-7)).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei(".5")).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei("+1")).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei("")).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei("abc")).toThrow(/Invalid GAS amount/);
    expect(() => gasToWei("1 000")).toThrow(/Invalid GAS amount/);
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
    const order: string[] = [];
    mockEthereum(async ({ method, params }) => {
      calls.push({ method, params });
      if (method === "eth_accounts") return ["0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C"];
      if (method === "eth_sendTransaction") {
        order.push("broadcast");
        return "0xtxhash";
      }
      if (method === "eth_getTransactionReceipt") {
        order.push("receipt");
        return {
          status: "0x1",
          logs: [{
            address: "0xFA795F814d38F218153d21838360096f3F5cb774",
            topics: ["0xevttopic", "0x000000000000000000000000000000000000000000000000000000000000002a"],
          }],
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
      onTransactionSent: (txid) => order.push(`persist:${txid}`),
    });

    expect(res.txid).toBe("0xtxhash");
    expect(res.eventId).toBe("42"); // 0x2a
    expect(order).toEqual(["broadcast", "persist:0xtxhash", "receipt"]);

    const sent = calls.find((c) => c.method === "eth_sendTransaction")!;
    const tx = (sent.params as Array<Record<string, string>>)[0];
    expect(tx.to).toBe("0xFA795F814d38F218153d21838360096f3F5cb774");
    // selector + uint8(6) padded to 32 bytes
    expect(tx.data).toBe("0x43046844" + "6".padStart(64, "0"));
    expect(tx.value).toBe("0x16345785d8a0000"); // 0.1e18 wei
  });

  it("does not accept an ambiguous or foreign-contract event as confirmation", async () => {
    const target = "0x1111111111111111111111111111111111111111";
    const topic = `0x${"aa".repeat(32)}`;
    const indexed = `0x${(7n).toString(16).padStart(64, "0")}`;
    let duplicate = false;
    mockEthereum(async ({ method }) => {
      if (method === "eth_accounts") return ["0x2222222222222222222222222222222222222222"];
      if (method === "eth_sendTransaction") return `0x${"33".repeat(32)}`;
      if (method === "eth_getTransactionReceipt") {
        return {
          status: "0x1",
          logs: duplicate
            ? [
                { address: target, topics: [topic, indexed] },
                { address: target, topics: [topic, indexed] },
              ]
            : [{ address: "0x4444444444444444444444444444444444444444", topics: [topic, indexed] }],
        };
      }
      return null;
    });

    await expect(evmInvoke({ address: target, selector: "0x12345678", eventTopic: topic }))
      .resolves.toMatchObject({ eventId: undefined });
    duplicate = true;
    await expect(evmInvoke({ address: target, selector: "0x12345678", eventTopic: topic }))
      .resolves.toMatchObject({ eventId: undefined });
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

  it("stops before broadcast when the active account changed", async () => {
    const send = vi.fn();
    mockEthereum(async ({ method, params }) => {
      if (method === "eth_accounts") return ["0x2222222222222222222222222222222222222222"];
      if (method === "eth_sendTransaction") {
        send(params);
        return "0xtx";
      }
      return null;
    });

    await expect(evmInvoke({
      address: "0xdice",
      selector: "0x43046844",
      uintArgs: [3],
      expectedFrom: "0x1111111111111111111111111111111111111111",
    })).rejects.toThrow(EVM_ACCOUNT_CHANGED_ERROR);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("evmPersonalSign", () => {
  it("stops before personal_sign when the expected account is no longer active", async () => {
    const sign = vi.fn();
    mockEthereum(async ({ method, params }) => {
      if (method === "eth_accounts") return ["0x2222222222222222222222222222222222222222"];
      if (method === "personal_sign") {
        sign(params);
        return `0x${"ab".repeat(65)}`;
      }
      return null;
    });

    await expect(evmPersonalSign(
      "Open this sealed note",
      "0x1111111111111111111111111111111111111111",
    )).rejects.toThrow(EVM_ACCOUNT_CHANGED_ERROR);
    expect(sign).not.toHaveBeenCalled();
  });
});

describe("NEO_X_CONFIG", () => {
  it("has correct mainnet chain id + rpc", () => {
    expect(NEO_X_CONFIG["neo-x-mainnet"].chainId).toBe(47763);
    expect(NEO_X_CONFIG["neo-x-mainnet"].rpc).toContain("banelabs");
  });
});
