/**
 * Unit tests for the wallet-bridge seam isolated out of PlayAreaShared.tsx
 * (roadmap O-C). These exercise the pure normalizers and the request
 * dispatcher directly — no iframe rendering — which the module split newly
 * enables. The end-to-end origin/postMessage behavior stays covered by
 * PlayAreaShared.bridge.test.tsx.
 */
import {
  bridgeInvocationToParams,
  buildEmbeddedWalletBridgeResultDetail,
  describeSensitiveBridgeOperation,
  GAS_ASSET_HASH,
  handleEmbeddedWalletBridgeRequest,
  invocationContractHash,
  normalizeBridgeArgs,
  normalizeBridgeOperation,
  normalizeBridgeScope,
  normalizeBridgeSigners,
  resolveSenderArgs,
  SENSITIVE_BRIDGE_METHODS,
} from "../../components/playarea/bridge";

const WALLET_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const TARGET_CONTRACT = "0x442162de9c0d0e30b09590b125c2b1f7e8fa5e3b";

const mockWalletState: {
  connected: boolean;
  address: string;
  publicKey: string;
  network: "mainnet" | "testnet" | null;
} = {
  connected: true,
  address: WALLET_ADDRESS,
  publicKey: "02abcdef",
  network: "testnet",
};

const mockAdapter = {
  invoke: jest.fn(),
  invokeMultiple: jest.fn(),
  getBalance: jest.fn(),
  signMessage: jest.fn(),
  send: jest.fn(),
};

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: { getState: () => mockWalletState },
  getWalletAdapter: () => mockAdapter,
}));

beforeEach(() => {
  mockWalletState.connected = true;
  mockWalletState.address = WALLET_ADDRESS;
  mockWalletState.network = "testnet";
  mockAdapter.invoke.mockReset().mockResolvedValue({ txid: "0xfeed" });
  mockAdapter.invokeMultiple.mockReset().mockResolvedValue({ txid: "0xbatch" });
  mockAdapter.getBalance
    .mockReset()
    .mockResolvedValue({ neo: "5", gas: "12.5" });
  mockAdapter.signMessage
    .mockReset()
    .mockResolvedValue({ signature: "0xsig" });
  mockAdapter.send.mockReset().mockResolvedValue({ txid: "0xsent" });
});

describe("normalizeBridgeOperation", () => {
  it("canonicalizes PascalCase kernel methods to their camelCase form", () => {
    expect(normalizeBridgeOperation("RegisterMiniApp")).toBe("registerMiniApp");
    expect(normalizeBridgeOperation("SubmitMiniAppRequest")).toBe(
      "submitMiniAppRequest",
    );
  });

  it("maps the updateMiniApp alias to configureMiniApp", () => {
    expect(normalizeBridgeOperation("updateMiniApp")).toBe("configureMiniApp");
  });

  it("passes through already-camelCase kernel methods unchanged", () => {
    expect(normalizeBridgeOperation("putMiniAppState")).toBe("putMiniAppState");
  });

  it("passes through unknown operations verbatim (after trimming)", () => {
    expect(normalizeBridgeOperation("  transfer ")).toBe("transfer");
    expect(normalizeBridgeOperation(undefined)).toBe("");
    expect(normalizeBridgeOperation(42)).toBe("");
  });
});

describe("normalizeBridgeScope", () => {
  it("accepts finite numbers as-is", () => {
    expect(normalizeBridgeScope(16)).toBe(16);
  });

  it("parses numeric strings", () => {
    expect(normalizeBridgeScope("128")).toBe(128);
  });

  it("maps named scopes (case-insensitive) and OR-combines comma lists", () => {
    expect(normalizeBridgeScope("CalledByEntry")).toBe(1);
    expect(normalizeBridgeScope("global")).toBe(128);
    expect(normalizeBridgeScope("CustomContracts,CustomGroups")).toBe(48);
  });

  it("defaults unknown/empty input to CalledByEntry (1)", () => {
    expect(normalizeBridgeScope("nope")).toBe(1);
    expect(normalizeBridgeScope(null)).toBe(1);
  });
});

describe("normalizeBridgeSigners", () => {
  it("returns undefined for non-arrays and empty signer sets", () => {
    expect(normalizeBridgeSigners(undefined)).toBeUndefined();
    expect(normalizeBridgeSigners([{ scopes: 1 }])).toBeUndefined();
  });

  it("maps account + scopes and keeps optional allow-lists", () => {
    expect(
      normalizeBridgeSigners([
        {
          account: WALLET_ADDRESS,
          scopes: "CustomContracts",
          allowedContracts: [TARGET_CONTRACT, ""],
        },
      ]),
    ).toEqual([
      {
        account: WALLET_ADDRESS,
        scopes: 16,
        allowedContracts: [TARGET_CONTRACT],
      },
    ]);
  });

  it("rejects WitnessRules signers rather than silently widening the witness", () => {
    expect(() =>
      normalizeBridgeSigners([
        { account: WALLET_ADDRESS, scopes: "WitnessRules" },
      ]),
    ).toThrow(/WitnessRules/);
    expect(() =>
      normalizeBridgeSigners([
        {
          account: WALLET_ADDRESS,
          scopes: 1,
          rules: [{ action: "Allow" }],
        },
      ]),
    ).toThrow(/WitnessRules/);
  });
});

describe("invocationContractHash + normalizeBridgeArgs", () => {
  it("resolves the contract from hash > scriptHash > contractHash", () => {
    expect(invocationContractHash({ hash: TARGET_CONTRACT })).toBe(
      TARGET_CONTRACT,
    );
    expect(invocationContractHash({ scriptHash: TARGET_CONTRACT })).toBe(
      TARGET_CONTRACT,
    );
    expect(invocationContractHash({ contractHash: TARGET_CONTRACT })).toBe(
      TARGET_CONTRACT,
    );
    expect(invocationContractHash({})).toBe("");
  });

  it("defaults arg type to String and preserves values", () => {
    expect(
      normalizeBridgeArgs([{ value: "x" }, { type: "Hash160", value: "y" }]),
    ).toEqual([
      { type: "String", value: "x" },
      { type: "Hash160", value: "y" },
    ]);
    expect(normalizeBridgeArgs("not-an-array")).toEqual([]);
  });
});

describe("resolveSenderArgs", () => {
  it("replaces Hash160 sender placeholders with the wallet address", () => {
    const params = bridgeInvocationToParams({
      hash: TARGET_CONTRACT,
      operation: "transfer",
      args: [
        { type: "Hash160", value: "{{sender}}" },
        { type: "Hash160", value: TARGET_CONTRACT },
        { type: "Integer", value: "1" },
      ],
    });
    const resolved = resolveSenderArgs(params, WALLET_ADDRESS);
    expect(resolved.args[0].value).toBe(WALLET_ADDRESS);
    // Non-placeholder Hash160 and non-Hash160 args stay untouched.
    expect(resolved.args[1].value).toBe(TARGET_CONTRACT);
    expect(resolved.args[2].value).toBe("1");
  });

  it("is a no-op when no address is supplied", () => {
    const params = bridgeInvocationToParams({
      hash: TARGET_CONTRACT,
      operation: "transfer",
      args: [{ type: "Hash160", value: "sender" }],
    });
    expect(resolveSenderArgs(params, "")).toBe(params);
  });
});

describe("bridgeInvocationToParams", () => {
  it("throws a specific error when the script hash is missing", () => {
    expect(() =>
      bridgeInvocationToParams({ operation: "transfer", args: [] }),
    ).toThrow(/missing script hash/);
  });

  it("throws a specific error when the operation is missing", () => {
    expect(() =>
      bridgeInvocationToParams({ hash: TARGET_CONTRACT, args: [] }),
    ).toThrow(/missing operation/);
  });
});

describe("SENSITIVE_BRIDGE_METHODS", () => {
  it("gates exactly the signing / fund-moving methods", () => {
    expect([...SENSITIVE_BRIDGE_METHODS].sort()).toEqual([
      "invoke",
      "send",
      "signMessage",
    ]);
  });
});

describe("handleEmbeddedWalletBridgeRequest", () => {
  it("returns the host account for getAccounts", async () => {
    const result = await handleEmbeddedWalletBridgeRequest(
      "getAccounts",
      undefined,
      "testnet",
    );
    expect(result).toEqual([
      expect.objectContaining({ address: WALLET_ADDRESS, isDefault: true }),
    ]);
  });

  it("returns the wallet's verified network magic for authenticate", async () => {
    // Wallet is verified on mainnet — even though the bridge target below is
    // also mainnet, the response must reflect the wallet's own network.
    mockWalletState.network = "mainnet";
    const result = (await handleEmbeddedWalletBridgeRequest(
      "authenticate",
      undefined,
      "mainnet",
    )) as { network: number; networkVerified: boolean; address: string };
    expect(result.network).toBe(860833102);
    expect(result.networkVerified).toBe(true);
    expect(result.address).toBe(WALLET_ADDRESS);
  });

  it("flags authenticate as unverified when the wallet network is null", async () => {
    mockWalletState.network = null;
    const result = (await handleEmbeddedWalletBridgeRequest(
      "authenticate",
      undefined,
      "testnet",
    )) as { network: number | null; networkVerified: boolean };
    // Must not assert the target-network magic for a wallet whose network we
    // could not read.
    expect(result.network).toBeNull();
    expect(result.networkVerified).toBe(false);
  });

  it("invokes the adapter with the contract resolved from the invocation hash", async () => {
    const result = await handleEmbeddedWalletBridgeRequest(
      "invoke",
      {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
        ],
      },
      "testnet",
    );
    expect(result).toEqual({ txid: "0xfeed" });
    expect(mockAdapter.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptHash: TARGET_CONTRACT,
        operation: "transfer",
      }),
    );
    expect(mockAdapter.invokeMultiple).not.toHaveBeenCalled();
  });

  it("routes multi-invocation requests through invokeMultiple", async () => {
    const result = await handleEmbeddedWalletBridgeRequest(
      "invoke",
      {
        invocations: [
          { hash: TARGET_CONTRACT, operation: "a", args: [] },
          { hash: TARGET_CONTRACT, operation: "b", args: [] },
        ],
      },
      "testnet",
    );
    expect(result).toEqual({ txid: "0xbatch" });
    expect(mockAdapter.invokeMultiple).toHaveBeenCalledTimes(1);
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("fails closed for invoke when the wallet network is unverified", async () => {
    mockWalletState.network = null;
    await expect(
      handleEmbeddedWalletBridgeRequest(
        "invoke",
        {
          invocations: [
            { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
          ],
        },
        "testnet",
      ),
    ).rejects.toThrow(/unverified/);
    expect(mockAdapter.invoke).not.toHaveBeenCalled();
  });

  it("throws on a FAULTed bridge read instead of handing back fake data", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: { state: "FAULT", stack: [], gasconsumed: "0" },
      }),
    }) as unknown as typeof fetch;
    try {
      await expect(
        handleEmbeddedWalletBridgeRequest(
          "call",
          {
            invocation: {
              hash: TARGET_CONTRACT,
              operation: "getStatus",
              args: [],
            },
          },
          "testnet",
        ),
      ).rejects.toThrow(/fault/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns the decoded result for a HALTed bridge read", async () => {
    const originalFetch = globalThis.fetch;
    const haltResult = { state: "HALT", stack: [{ type: "Integer", value: "7" }] };
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: haltResult }),
    }) as unknown as typeof fetch;
    try {
      const result = await handleEmbeddedWalletBridgeRequest(
        "call",
        {
          invocation: {
            hash: TARGET_CONTRACT,
            operation: "getStatus",
            args: [],
          },
        },
        "testnet",
      );
      expect(result).toEqual(haltResult);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("still serves getAccounts when the wallet network is unverified", async () => {
    mockWalletState.network = null;
    await expect(
      handleEmbeddedWalletBridgeRequest("getAccounts", undefined, "testnet"),
    ).resolves.toBeTruthy();
  });

  it("rejects an invoke that targets a different chain than the wallet", async () => {
    mockWalletState.network = "mainnet";
    await expect(
      handleEmbeddedWalletBridgeRequest(
        "invoke",
        {
          invocations: [
            { hash: TARGET_CONTRACT, operation: "transfer", args: [] },
          ],
        },
        "testnet",
      ),
    ).rejects.toThrow(/Wallet is on mainnet but this embedded dApp targets testnet/);
  });

  it("returns balance by asset and rejects unsupported methods", async () => {
    await expect(
      handleEmbeddedWalletBridgeRequest(
        "getBalance",
        { asset: "GAS" },
        "testnet",
      ),
    ).resolves.toBe("12.5");
    await expect(
      handleEmbeddedWalletBridgeRequest("teleport", {}, "testnet"),
    ).rejects.toThrow(/Unsupported embedded wallet method/);
  });

  it("dispatches send through a send-capable adapter", async () => {
    const result = await handleEmbeddedWalletBridgeRequest(
      "send",
      { asset: "GAS", amount: "1", to: WALLET_ADDRESS },
      "testnet",
    );
    expect(result).toEqual({ txid: "0xsent" });
    expect(mockAdapter.send).toHaveBeenCalledWith(
      "GAS",
      "1",
      WALLET_ADDRESS,
      undefined,
    );
  });
});

describe("buildEmbeddedWalletBridgeResultDetail", () => {
  it("mirrors the executed invocation (contract, canonical operation, memo, txid)", () => {
    const detail = buildEmbeddedWalletBridgeResultDetail({
      appId: "miniapp-demo",
      network: "testnet",
      requestMethod: "invoke",
      payload: {
        invocations: [
          {
            hash: TARGET_CONTRACT,
            operation: "RegisterMiniApp",
            args: [{ type: "String", value: "miniapp-demo:create" }],
          },
        ],
      },
      result: { txid: "0xfeed" },
    });
    expect(detail).toMatchObject({
      appId: "miniapp-demo",
      network: "testnet",
      requestMethod: "invoke",
      txid: "0xfeed",
      contractHash: TARGET_CONTRACT,
      operation: "registerMiniApp",
      memo: "miniapp-demo:create",
    });
    expect(typeof detail.at).toBe("string");
  });
});

describe("describeSensitiveBridgeOperation", () => {
  const ATTACKER_ADDRESS = "NXNG7v9R2bDgWQ3wfDhsFL5xfEbk8mAt9F";
  const TRANSFER_AMOUNT = "100000000";

  it("shows recipient and amount of a GAS transfer instead of hiding the args", () => {
    const summary = describeSensitiveBridgeOperation("invoke", {
      invocations: [
        {
          hash: GAS_ASSET_HASH,
          operation: "transfer",
          args: [
            { type: "Hash160", value: WALLET_ADDRESS },
            { type: "Hash160", value: ATTACKER_ADDRESS },
            { type: "Integer", value: TRANSFER_AMOUNT },
            { type: "Any", value: null },
          ],
        },
      ],
    });
    // The user must be able to see WHO and HOW MUCH they are approving.
    expect(summary).toContain(ATTACKER_ADDRESS);
    expect(summary).toContain(TRANSFER_AMOUNT);
    // Plain-language transfer line surfaces the intent up front.
    expect(summary).toContain(`transfer ${TRANSFER_AMOUNT} to ${ATTACKER_ADDRESS}`);
    // Raw arg list still names the operation + contract + typed args.
    expect(summary).toContain(`transfer @ ${GAS_ASSET_HASH}(`);
    expect(summary).toContain("Hash160:");
    expect(summary).toContain("Integer:");
    // Regression guard: it must NOT be the old args-less wording.
    expect(summary).not.toBe(
      `submit a transaction (transfer @ ${GAS_ASSET_HASH})`,
    );
  });

  it("renders collections and Any args as readable tokens", () => {
    const summary = describeSensitiveBridgeOperation("invoke", {
      invocations: [
        {
          hash: TARGET_CONTRACT,
          operation: "configure",
          args: [
            { type: "Array", value: [1, 2, 3] },
            { type: "Map", value: [{ key: 1, value: 2 }] },
            { type: "Any", value: null },
          ],
        },
      ],
    });
    expect(summary).toContain("Array(3)");
    expect(summary).toContain("Map(1)");
    expect(summary).toContain("null");
  });

  it("keeps the signer-scope suffix alongside the rendered args", () => {
    const summary = describeSensitiveBridgeOperation("invoke", {
      invocations: [
        {
          hash: TARGET_CONTRACT,
          operation: "claim",
          args: [{ type: "Hash160", value: WALLET_ADDRESS }],
        },
      ],
      signers: [{ account: WALLET_ADDRESS, scopes: "Global" }],
    });
    expect(summary).toContain(`claim @ ${TARGET_CONTRACT}(Hash160:`);
    expect(summary).toContain("with signer scope Global");
  });

  it("warns when a GAS transfer recipient is disguised as a non-Hash160 type", () => {
    // Attack: declare the recipient/amount as ByteArray, which executes identically
    // on the VM but previously skipped the plain-language transfer line.
    const summary = describeSensitiveBridgeOperation("invoke", {
      invocations: [
        {
          hash: GAS_ASSET_HASH,
          operation: "transfer",
          args: [
            { type: "Hash160", value: WALLET_ADDRESS },
            { type: "ByteArray", value: "qrvM3e7/ABEiM0RVZneImaq7zN0=" },
            { type: "ByteArray", value: "AOH1BQ==" },
          ],
        },
      ],
    });
    // The prompt must not silently render only opaque base64.
    expect(summary).toContain("non-standard recipient encoding");
  });

  it("warns when a GAS transfer sender is disguised as a non-Hash160 type", () => {
    const summary = describeSensitiveBridgeOperation("invoke", {
      invocations: [
        {
          hash: GAS_ASSET_HASH,
          operation: "transfer",
          args: [
            { type: "ByteArray", value: "qrvM3e7/ABEiM0RVZneImaq7zN0=" },
            { type: "Hash160", value: ATTACKER_ADDRESS },
            { type: "Integer", value: TRANSFER_AMOUNT },
          ],
        },
      ],
    });

    expect(summary).toContain("non-standard sender encoding");
  });
});

describe("bridgeInvocationToParams native-transfer arg-type enforcement", () => {
  const GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

  it("rejects a native GAS transfer whose sender is disguised as a ByteArray", () => {
    expect(() =>
      bridgeInvocationToParams({
        hash: GAS,
        operation: "transfer",
        args: [
          { type: "ByteArray", value: "qrvM3e7/ABEiM0RVZneImaq7zN0=" },
          { type: "Hash160", value: WALLET_ADDRESS },
          { type: "Integer", value: "100000000" },
        ],
      }),
    ).toThrow(/non-standard argument types/);
  });

  it("rejects a native GAS transfer whose recipient is disguised as a ByteArray", () => {
    expect(() =>
      bridgeInvocationToParams({
        hash: GAS,
        operation: "transfer",
        args: [
          { type: "Hash160", value: WALLET_ADDRESS },
          { type: "ByteArray", value: "qrvM3e7/ABEiM0RVZneImaq7zN0=" },
          { type: "Integer", value: "100000000" },
        ],
      }),
    ).toThrow(/non-standard argument types/);
  });

  it("rejects a native GAS transfer whose amount is disguised as a ByteArray", () => {
    expect(() =>
      bridgeInvocationToParams({
        hash: GAS,
        operation: "transfer",
        args: [
          { type: "Hash160", value: WALLET_ADDRESS },
          { type: "Hash160", value: WALLET_ADDRESS },
          { type: "ByteArray", value: "AOH1BQ==" },
        ],
      }),
    ).toThrow(/non-standard argument types/);
  });

  it("accepts a canonical native GAS transfer (Hash160 recipient, Integer amount)", () => {
    const params = bridgeInvocationToParams({
      hash: GAS,
      operation: "transfer",
      args: [
        { type: "Hash160", value: WALLET_ADDRESS },
        { type: "Hash160", value: WALLET_ADDRESS },
        { type: "Integer", value: "100000000" },
      ],
    });
    expect(params.operation).toBe("transfer");
    expect(params.args).toHaveLength(3);
  });
});
