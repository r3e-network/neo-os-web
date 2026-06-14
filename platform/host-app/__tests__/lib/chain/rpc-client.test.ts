import { invokeRead } from "@/lib/chain/rpc-client";

const CONTRACT = "0x68ef0ead081d2263acc51ce82f5c70c46440cca4";

function mockRpcResult(result: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  }) as unknown as typeof fetch;
}

describe("invokeRead state handling (B2)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("returns the result for a HALTed execution", async () => {
    const halt = {
      script: "",
      state: "HALT",
      gasconsumed: "0",
      stack: [{ type: "Integer", value: "42" }],
    };
    mockRpcResult(halt);
    await expect(invokeRead(CONTRACT, "total", [], "testnet")).resolves.toEqual(
      halt,
    );
  });

  it("throws on a FAULTed execution instead of decoding garbage to zeros", async () => {
    mockRpcResult({ script: "", state: "FAULT", gasconsumed: "0", stack: [] });
    await expect(invokeRead(CONTRACT, "total", [], "testnet")).rejects.toThrow(
      /FAULT/,
    );
  });
});
