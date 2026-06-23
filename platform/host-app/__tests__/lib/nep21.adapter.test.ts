import { Nep21Adapter } from "@/lib/wallet/adapters/nep21";

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const TESTNET_MAGIC = 894710606;

function installProvider(provider: unknown) {
  (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
    DapiProvider: provider,
  };
}

describe("Nep21Adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/");
    delete (window as unknown as { NEP21Provider?: unknown }).NEP21Provider;
    delete (window as unknown as { NEP21Providers?: unknown }).NEP21Providers;
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
      send: jest.fn().mockResolvedValue({ hash: "0xsend" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toEqual({
      address: "NUserAddress",
      accountHash: "0xuserhash",
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
    await expect(
      adapter.send("GAS", "100000000", "NRecipientAddress"),
    ).resolves.toEqual({ txid: "0xsend" });

    expect(provider.getBalance).toHaveBeenNthCalledWith(1, NEO_CONTRACT, "0xuserhash");
    expect(provider.getBalance).toHaveBeenNthCalledWith(2, GAS_CONTRACT, "0xuserhash");
    expect(provider.signMessage).toHaveBeenCalledWith("aGVsbG8=", "0xuserhash");
    expect(provider.invoke).toHaveBeenCalledWith(
      [{ hash: "0xcontract", operation: "Transfer", args: [{ type: "Hash160", value: "0xuserhash" }] }],
      [{ account: "0xuserhash", scopes: "CalledByEntry" }],
    );
    expect(provider.send).toHaveBeenCalledWith(
      GAS_CONTRACT,
      "0xuserhash",
      "NRecipientAddress",
      "100000000",
    );
  });

  it("falls back to a transfer invoke when the provider has no direct send lane", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xtransfer" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();
    await adapter.connect();

    await expect(
      adapter.send("NEO", "1", "NRecipientAddress"),
    ).resolves.toEqual({ txid: "0xtransfer" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [
        {
          hash: NEO_CONTRACT,
          operation: "transfer",
          args: [
            { type: "Hash160", value: "0xuserhash" },
            { type: "Hash160", value: "NRecipientAddress" },
            { type: "Integer", value: "1" },
            { type: "Any", value: null },
          ],
        },
      ],
      [{ account: "0xuserhash", scopes: "CalledByEntry" }],
    );
  });

  it("converts fallback GAS sends to base units and rejects invalid NEO fractions", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xtransfer" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();
    await adapter.connect();

    await expect(
      adapter.send("GAS", "1.25", "NRecipientAddress"),
    ).resolves.toEqual({ txid: "0xtransfer" });

    expect(provider.invoke).toHaveBeenLastCalledWith(
      [
        {
          hash: GAS_CONTRACT,
          operation: "transfer",
          args: [
            { type: "Hash160", value: "0xuserhash" },
            { type: "Hash160", value: "NRecipientAddress" },
            { type: "Integer", value: "125000000" },
            { type: "Any", value: null },
          ],
        },
      ],
      [{ account: "0xuserhash", scopes: "CalledByEntry" }],
    );

    provider.invoke.mockClear();
    await expect(
      adapter.send("NEO", "1.5", "NRecipientAddress"),
    ).rejects.toThrow(/positive whole number/);
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("accepts accountHash-only account objects from compatible wallets", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { accountHash: "0xaccounthashonly", address: "NAccountHashOnly", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xhashonly" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();

    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NAccountHashOnly",
      accountHash: "0xaccounthashonly",
    });
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "claim",
      args: [{ type: "Hash160", value: "NAccountHashOnly" }],
      signers: [{ account: "NAccountHashOnly", scopes: 1 }],
    })).resolves.toEqual({ txid: "0xhashonly" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [
        {
          hash: "0xcontract",
          operation: "claim",
          args: [{ type: "Hash160", value: "0xaccounthashonly" }],
        },
      ],
      [{ account: "0xaccounthashonly", scopes: "CalledByEntry" }],
    );
  });

  it("prefers getNetwork over a stale provider.network property on connect", async () => {
    const provider = {
      network: 860833102,
      getNetwork: jest.fn().mockResolvedValue(894710606),
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xtx" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();

    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NUserAddress",
      network: "testnet",
    });
    expect(provider.getNetwork).toHaveBeenCalled();
  });

  it("requests authentication only for the active page network", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const provider = {
      network: 860833102,
      supportedNetworks: [860833102, TESTNET_MAGIC],
      getNetwork: jest.fn().mockResolvedValue(TESTNET_MAGIC),
      getAccounts: jest.fn().mockResolvedValue([]),
      authenticate: jest.fn().mockResolvedValue({
        address: "NAuthenticatedAddress",
        hash: "0xauthenticated",
        network: TESTNET_MAGIC,
        pubkey: "03auth",
      }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();

    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NAuthenticatedAddress",
      accountHash: "0xauthenticated",
      network: "testnet",
    });
    expect(provider.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        networks: [TESTNET_MAGIC],
        domain: "localhost",
      }),
    );
  });

  it("rediscovers the injected provider after disconnect", async () => {
    const firstProvider = {
      dapiVersion: "1.0.0",
      network: TESTNET_MAGIC,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xfirst", address: "NFirstAddress", isDefault: true },
      ]),
    };
    const secondProvider = {
      dapiVersion: "1.0.0",
      network: TESTNET_MAGIC,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xsecond", address: "NSecondAddress", isDefault: true },
      ]),
    };

    installProvider(firstProvider);
    const adapter = new Nep21Adapter();
    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NFirstAddress",
    });

    await adapter.disconnect();
    installProvider(secondProvider);

    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NSecondAddress",
      accountHash: "0xsecond",
    });
    expect(secondProvider.getAccounts).toHaveBeenCalled();
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

  it("maps composite numeric signer scopes without recursive overflow", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xscopes" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();
    await adapter.connect();

    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "claim",
      args: [],
      signers: [{ account: "NUserAddress", scopes: 48 }],
    })).resolves.toEqual({ txid: "0xscopes" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [{ hash: "0xcontract", operation: "claim", args: [] }],
      [{ account: "0xuserhash", scopes: "CustomContracts, CustomGroups" }],
    );
  });

  it("normalizes nested connected account Hash160 arguments", async () => {
    const provider = {
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xuserhash", address: "NUserAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xnested" }),
    };
    installProvider(provider);

    const adapter = new Nep21Adapter();
    await adapter.connect();

    await expect(adapter.invoke({
      scriptHash: "0xaa",
      operation: "nestedClaim",
      args: [
        {
          type: "Array",
          value: [
            { type: "String", value: "miniapp" },
            { type: "Hash160", value: "NUserAddress" },
          ],
        },
      ],
    })).resolves.toEqual({ txid: "0xnested" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [
        {
          hash: "0xaa",
          operation: "nestedClaim",
          args: [
            {
              type: "Array",
              value: [
                { type: "String", value: "miniapp" },
                { type: "Hash160", value: "0xuserhash" },
              ],
            },
          ],
        },
      ],
      undefined,
    );
  });

  it("falls back to authenticate when accounts are unavailable", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
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
      accountHash: "0xonegatehash",
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

  it("detects a governance-style NEP21Provider global immediately", async () => {
    const provider = {
      name: "OneGate",
      dapiVersion: "1.0",
      network: 894710606,
      compatibility: ["NEP-21"],
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xproviderhash", address: "NProviderAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xprovider" }),
    };
    (window as unknown as { NEP21Provider?: unknown }).NEP21Provider = provider;

    const adapter = new Nep21Adapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NProviderAddress",
      accountHash: "0xproviderhash",
      network: "testnet",
    });
  });

  it("detects a named governance-style NEP21Providers registry entry", async () => {
    const provider = {
      name: "OneGate",
      dapiVersion: "1.0",
      network: 894710606,
      compatibility: ["NEP-21"],
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xregistryhash", address: "NRegistryAddress", isDefault: true },
      ]),
      invoke: jest.fn().mockResolvedValue({ txid: "0xregistry" }),
    };
    (window as unknown as { NEP21Providers?: Record<string, unknown> }).NEP21Providers = {
      OneGate: provider,
    };

    const adapter = new Nep21Adapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NRegistryAddress",
      accountHash: "0xregistryhash",
      network: "testnet",
    });
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
      accountHash: "0xeventhash",
      publicKey: "",
      label: undefined,
      network: null,
    });
  });

  it("accepts ready events where detail is the NEP-21 provider itself", async () => {
    const provider = {
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xdirecteventhash", address: "NDirectEventAddress", isDefault: true },
      ]),
      invoke: jest.fn(),
    };

    const adapter = new Nep21Adapter();
    const connected = adapter.connect();
    window.dispatchEvent(new CustomEvent("Neo.DapiProvider.ready", {
      detail: provider,
    }));

    await expect(connected).resolves.toMatchObject({
      address: "NDirectEventAddress",
    });
  });
});
