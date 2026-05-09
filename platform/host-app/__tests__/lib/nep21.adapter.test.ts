import { Nep21Adapter } from "@/lib/wallet/adapters/nep21";

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

function installProvider(provider: unknown) {
  (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
    DapiProvider: provider,
  };
}

describe("Nep21Adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as unknown as { Neo?: unknown }).Neo;
    delete (window as unknown as { OneGateDapiProvider?: unknown }).OneGateDapiProvider;
    delete (window as unknown as { neoDapiProvider?: unknown }).neoDapiProvider;
    delete (window as unknown as { neoDapi?: unknown }).neoDapi;
  });

  it("connects, reads balances, signs messages, and invokes through a NEP-21 provider", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", label: "Main", isDefault: true },
      ]),
      getBalance: jest.fn()
        .mockResolvedValueOnce({ amount: "10" })
        .mockResolvedValueOnce({ amount: "25.5" }),
      signMessage: jest.fn().mockResolvedValue({
        pubkey: "03pub",
        signature: "signed",
        account: "0xuserhash",
      }),
      invoke: jest.fn().mockResolvedValue({ txid: "0xtx" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toEqual({
      address: "NUserAddress",
      publicKey: "",
      label: "Main",
      network: "testnet",
    });
    await expect(adapter.getNetwork()).resolves.toBe("testnet");
    await expect(adapter.getBalance("NUserAddress")).resolves.toEqual({
      neo: "10",
      gas: "25.5",
    });
    await expect(adapter.signMessage("hello")).resolves.toEqual({
      publicKey: "03pub",
      data: "signed",
      salt: "",
      message: "hello",
    });
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "Transfer",
      args: [{ type: "Hash160", value: "NUserAddress" }],
      signers: [{ account: "NUserAddress", scopes: 1 }],
    })).resolves.toEqual({ txid: "0xtx" });

    expect(provider.getBalance).toHaveBeenNthCalledWith(1, NEO_CONTRACT, "0xuserhash");
    expect(provider.getBalance).toHaveBeenNthCalledWith(2, GAS_CONTRACT, "0xuserhash");
    expect(provider.signMessage).toHaveBeenCalledWith("aGVsbG8=", "0xuserhash");
    expect(provider.invoke).toHaveBeenCalledWith(
      [{ hash: "0xcontract", operation: "transfer", args: [{ type: "Hash160", value: "0xuserhash" }] }],
      [{ account: "0xuserhash", scopes: "CalledByEntry" }],
    );
  });

  it("submits multiple invocations atomically through the NEP-21 provider", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", label: "Main", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xbatch" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();
    await adapter.connect();

    await expect(adapter.invokeMultiple([
      {
        scriptHash: "0xaa",
        operation: "registerAccounts",
        args: [{ type: "Hash160", value: "NUserAddress" }],
      },
      {
        scriptHash: "0xbb",
        operation: "registerCustomAnchorApp",
        args: [{ type: "String", value: "custom-anchor:demo" }],
      },
    ], [{ account: "NUserAddress", scopes: 1 }])).resolves.toEqual({ txid: "0xbatch" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [
        { hash: "0xaa", operation: "registerAccounts", args: [{ type: "Hash160", value: "0xuserhash" }] },
        { hash: "0xbb", operation: "registerCustomAnchorApp", args: [{ type: "String", value: "custom-anchor:demo" }] },
      ],
      [{ account: "0xuserhash", scopes: "CalledByEntry" }],
    );
  });

  it("falls back to authenticate when accounts are unavailable", async () => {
    const provider = {
      supportedNetworks: [894710606],
      getAccounts: jest.fn().mockRejectedValue(new Error("locked")),
      authenticate: jest.fn().mockResolvedValue({
        address: "NAuthAddress",
        pubkey: "03authpub",
      }),
      signMessage: jest.fn(),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();

    await expect(adapter.connect()).resolves.toEqual({
      address: "NAuthAddress",
      publicKey: "03authpub",
      network: null,
    });
    expect(provider.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "Authentication",
        grant_type: "Signature",
        allowed_algorithms: ["ECDSA-P256"],
        domain: window.location.host || "localhost",
        networks: [894710606],
      }),
    );
  });

  it("dispatches the standard provider request event before waiting for lazy injection", async () => {
    const requestedVersions: string[] = [];
    window.addEventListener("Neo.DapiProvider.request", (event) => {
      requestedVersions.push((event as CustomEvent<{ version?: string }>).detail?.version ?? "");
    });

    const adapter = new Nep21Adapter();
    const connected = adapter.connect();

    await Promise.resolve();

    expect(requestedVersions).toEqual(["1.0"]);

    window.dispatchEvent(new CustomEvent("Neo.DapiProvider.ready", {
      detail: {
        provider: {
          getAccounts: jest.fn().mockResolvedValue([
            { hash: "0xeventhash", address: "NEventAddress", isDefault: true },
          ]),
          signMessage: jest.fn(),
        },
      },
    }));

    await expect(connected).resolves.toMatchObject({ address: "NEventAddress" });
  });

  it("detects OneGate's injected NEP-21 provider immediately", async () => {
    const provider = {
      name: "OneGate",
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xonegatehash", address: "NOneGateAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ hash: "0xonegatetx" }),
      signMessage: jest.fn().mockResolvedValue({
        pubkey: "03onegate",
        signature: "signed",
        account: "0xonegatehash",
      }),
    };
    (window as unknown as { OneGateDapiProvider?: unknown }).OneGateDapiProvider = provider;

    const adapter = new Nep21Adapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NOneGateAddress",
      network: "testnet",
    });
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "claimRangeGasPool",
      args: [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Integer", value: "42" },
        { type: "Hash160", value: "NOneGateAddress" },
      ],
      signers: [{ account: "NOneGateAddress", scopes: 1 }],
    })).resolves.toEqual({ txid: "0xonegatetx" });
    expect(provider.invoke).toHaveBeenCalledWith(
      [{
        hash: "0xcontract",
        operation: "claimRangeGasPool",
        args: [
          { type: "String", value: "miniapp-gas-lucky-pool" },
          { type: "Integer", value: "42" },
          { type: "Hash160", value: "0xonegatehash" },
        ],
      }],
      [{ account: "0xonegatehash", scopes: "CalledByEntry" }],
    );
  });

  it("accepts the standard Neo.DapiProvider.ready event", async () => {
    const provider = {
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xeventhash", address: "NEventAddress", isDefault: true },
      ]),
      signMessage: jest.fn(),
    };

    const adapter = new Nep21Adapter();
    const connected = adapter.connect();
    window.dispatchEvent(new CustomEvent("Neo.DapiProvider.ready", {
      detail: { provider },
    }));

    await expect(connected).resolves.toEqual({
      address: "NEventAddress",
      publicKey: "",
      label: undefined,
      network: null,
    });
  });
});
