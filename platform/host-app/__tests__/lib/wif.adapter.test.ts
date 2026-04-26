const mockAccountSign = jest.fn(() => "signed-message");
const mockFromWIF = jest.fn(() => ({
  address: "NDirectWifAddress",
  publicKey: { toString: () => "03directpub" },
  scriptHash: "user-script-hash",
  sign: mockAccountSign,
}));
const mockGetScriptHashFromAddress = jest.fn(() => "1234567890abcdef1234567890abcdef12345678");
const mockIsAddress = jest.fn(() => true);
const mockContractParamFromJson = jest.fn((value) => value);
const mockEmitContractCall = jest.fn(function emitContractCall() {
  return this;
});
const mockToBytes = jest.fn(() => new Uint8Array([1, 2, 3]));
const mockScriptBuilder = jest.fn(function ScriptBuilder() {
  return {
    emitContractCall: mockEmitContractCall,
    toBytes: mockToBytes,
  };
});
const mockTransactionInstances: Array<{
  init: Record<string, unknown>;
  sign: jest.Mock;
  serialize: jest.Mock;
  hash: jest.Mock;
}> = [];
const mockTransactionSign = jest.fn(function sign() {
  return this;
});
const mockTransaction = jest.fn(function Transaction(this: {
  init: Record<string, unknown>;
  sign: jest.Mock;
  serialize: jest.Mock;
  hash: jest.Mock;
}, init: Record<string, unknown>) {
  this.init = init;
  this.sign = mockTransactionSign;
  this.serialize = jest.fn(() => "deadbeef");
  this.hash = jest.fn(() => "a".repeat(64));
  mockTransactionInstances.push(this);
});
const mockHexToBytes = jest.fn(() => new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
const mockBytesToBase64 = jest.fn(() => "signed-tx-base64");

jest.mock("@r3e/neo-js-sdk/browser", () => ({
  Account: {
    fromWIF: mockFromWIF,
  },
  wallet: {
    isAddress: mockIsAddress,
    getScriptHashFromAddress: mockGetScriptHashFromAddress,
  },
  sc: {
    CallFlags: { All: 15 },
    ContractParam: { fromJson: mockContractParamFromJson },
    ScriptBuilder: mockScriptBuilder,
  },
  tx: {
    Transaction: mockTransaction,
    WitnessScope: { CalledByEntry: 1 },
  },
  testNetworkId: jest.fn(() => 894710606),
  mainNetworkId: jest.fn(() => 860833102),
  hexToBytes: mockHexToBytes,
  bytesToBase64: mockBytesToBase64,
}));

jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { WifAdapter } from "@/lib/wallet/adapters/wif";

function rpcResponse(result: unknown) {
  return {
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  };
}

describe("WifAdapter", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionInstances.length = 0;
    process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_WIF_MAX_SYSTEM_FEE_GAS = "20";
    global.fetch = mockFetch;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK;
    delete process.env.NEXT_PUBLIC_WIF_MAX_SYSTEM_FEE_GAS;
  });

  it("connects from WIF and signs auth messages as UTF-8 hex", async () => {
    const adapter = new WifAdapter();

    const account = await adapter.connectWithWif("  test-wif  ");
    const signed = await adapter.signMessage("sign-me");

    expect(mockFromWIF).toHaveBeenCalledWith("test-wif");
    expect(account).toEqual({
      address: "NDirectWifAddress",
      publicKey: "03directpub",
      label: "Direct WIF",
    });
    expect(mockAccountSign).toHaveBeenCalledWith("7369676e2d6d65");
    expect(signed).toEqual({
      publicKey: "03directpub",
      data: "signed-message",
      salt: "",
      message: "sign-me",
    });
  });

  it("builds, fee-estimates, signs, and relays an invoke without sending WIF to RPC", async () => {
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.method === "getblockcount") return rpcResponse(100);
      if (body.method === "getversion") return rpcResponse({ protocol: { network: 894710606 } });
      if (body.method === "invokefunction") {
        return rpcResponse({ state: "HALT", gasconsumed: "100", stack: [] });
      }
      if (body.method === "calculatenetworkfee") return rpcResponse({ networkfee: "2" });
      if (body.method === "sendrawtransaction") {
        return rpcResponse({ hash: `0x${"b".repeat(64)}` });
      }
      throw new Error(`unexpected method ${body.method}`);
    });

    const adapter = new WifAdapter();
    await adapter.connectWithWif("test-wif");

    const result = await adapter.invoke({
      scriptHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      operation: "transfer",
      args: [{ type: "Hash160", value: "NDirectWifAddress" }],
      signers: [{ account: "NDirectWifAddress", scopes: 1 }],
    });

    expect(result.txid).toBe(`0x${"b".repeat(64)}`);
    expect(mockEmitContractCall).toHaveBeenCalledWith(
      "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      "transfer",
      15,
      [{ type: "Hash160", value: "NDirectWifAddress" }],
    );
    expect(mockTransactionInstances).toHaveLength(2);
    expect(mockTransactionInstances[0].init).toEqual(
      expect.objectContaining({
        systemFee: 100n,
        networkFee: 0n,
        validUntilBlock: 5860,
      }),
    );
    expect(mockTransactionInstances[1].init).toEqual(
      expect.objectContaining({
        systemFee: 100n,
        networkFee: 2n,
      }),
    );
    expect(mockTransactionSign).toHaveBeenCalledWith("test-wif", 894710606);
    const rpcBodies = mockFetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
    expect(rpcBodies.some((body) => JSON.stringify(body).includes("test-wif"))).toBe(false);
    expect(rpcBodies.map((body) => body.method)).toEqual([
      "getblockcount",
      "getversion",
      "invokefunction",
      "calculatenetworkfee",
      "sendrawtransaction",
    ]);
  });
});
