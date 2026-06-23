import { NeoLineAdapter } from "@/lib/wallet/adapters/neoline";
import { resetNep21ProviderCacheForTests } from "../../../sdk/src/nep21-provider";

describe("NeoLineAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetNep21ProviderCacheForTests();
    delete (window as unknown as { NEP21Provider?: unknown }).NEP21Provider;
    delete (window as unknown as { NEP21Providers?: unknown }).NEP21Providers;
    delete (window as unknown as { OneGateDapiProvider?: unknown }).OneGateDapiProvider;
    delete (window as unknown as { Neo?: unknown }).Neo;
    delete (window as unknown as { neoDapiProvider?: unknown }).neoDapiProvider;
    delete (window as unknown as { neoDapi?: unknown }).neoDapi;
    delete (window as unknown as { NEOLineN3?: unknown }).NEOLineN3;
    delete (window as unknown as { NEOLine?: unknown }).NEOLine;
  });

  it("prefers a named NeoLine NEP-21 provider over the legacy NeoLine API", async () => {
    const legacyInstance = {
      getAccount: jest.fn(),
      getPublicKey: jest.fn(),
      getBalance: jest.fn(),
      signMessage: jest.fn(),
      invoke: jest.fn(),
    };
    (window as unknown as { NEOLineN3?: unknown }).NEOLineN3 = {
      Init: jest.fn(() => legacyInstance),
    };

    const nep21Provider = {
      name: "NeoLine",
      dapiVersion: "1.0.0",
      compatibility: ["NEP-21"],
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xneolinehash", address: "NNeoLineAddress", isDefault: true },
      ]),
      getBalance: jest.fn()
        .mockResolvedValueOnce({ amount: "5" })
        .mockResolvedValueOnce({ amount: "12.5" }),
      signMessage: jest.fn().mockResolvedValue({
        pubkey: "03neoline",
        signature: "signed",
        account: "0xneolinehash",
      }),
      invoke: jest.fn().mockResolvedValue({ txid: "0xneolinetx" }),
      send: jest.fn().mockResolvedValue({ txid: "0xneolinesend" }),
    };
    (window as unknown as { NEP21Providers?: Record<string, unknown> }).NEP21Providers = {
      NeoLine: nep21Provider,
    };

    const adapter = new NeoLineAdapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NNeoLineAddress",
      network: "testnet",
    });
    await expect(adapter.getBalance("NNeoLineAddress")).resolves.toEqual({
      neo: "5",
      gas: "12.5",
    });
    await expect(adapter.signMessage("hello")).resolves.toMatchObject({
      publicKey: "03neoline",
      data: "signed",
    });
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "ClaimReward",
      args: [{ type: "Hash160", value: "NNeoLineAddress" }],
      signers: [{ account: "NNeoLineAddress", scopes: 1 }],
    })).resolves.toEqual({ txid: "0xneolinetx" });
    await expect(adapter.invokeMultiple([
      {
        scriptHash: "0xcontract",
        operation: "ClaimReward",
        args: [{ type: "Hash160", value: "NNeoLineAddress" }],
      },
      {
        scriptHash: "0xanchor",
        operation: "RegisterAnchor",
        args: [{ type: "String", value: "anchor-1" }],
      },
    ], [{ account: "NNeoLineAddress", scopes: 1 }])).resolves.toEqual({
      txid: "0xneolinetx",
    });
    await expect(
      adapter.send("GAS", "100000000", "NRecipientAddress"),
    ).resolves.toEqual({ txid: "0xneolinesend" });

    expect(legacyInstance.getAccount).not.toHaveBeenCalled();
    expect(legacyInstance.invoke).not.toHaveBeenCalled();
    expect(nep21Provider.invoke).toHaveBeenCalledWith(
      [{
        hash: "0xcontract",
        operation: "ClaimReward",
        args: [{ type: "Hash160", value: "0xneolinehash" }],
      }],
      [{ account: "0xneolinehash", scopes: "CalledByEntry" }],
    );
    expect(nep21Provider.invoke).toHaveBeenLastCalledWith(
      [
        {
          hash: "0xcontract",
          operation: "ClaimReward",
          args: [{ type: "Hash160", value: "0xneolinehash" }],
        },
        {
          hash: "0xanchor",
          operation: "RegisterAnchor",
          args: [{ type: "String", value: "anchor-1" }],
        },
      ],
      [{ account: "0xneolinehash", scopes: "CalledByEntry" }],
    );
    expect(nep21Provider.send).toHaveBeenCalledWith(
      "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      "0xneolinehash",
      "NRecipientAddress",
      "100000000",
    );
  });

  it("delegates account and network events from the NEP-21 provider", async () => {
    const listeners = new Map<string, () => void>();
    const nep21Provider = {
      name: "NeoLine",
      dapiVersion: "1.0.0",
      compatibility: ["NEP-21"],
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xneolinehash", address: "NNeoLineAddress", isDefault: true },
      ]),
      invoke: jest.fn(),
      on: jest.fn((eventName: string, listener: () => void) => {
        listeners.set(eventName, listener);
      }),
      removeListener: jest.fn(),
    };
    (window as unknown as { NEP21Providers?: Record<string, unknown> }).NEP21Providers = {
      NeoLine: nep21Provider,
    };

    const adapter = new NeoLineAdapter();
    await adapter.connect();

    const accountListener = jest.fn();
    const networkListener = jest.fn();
    const unsubscribeAccount = adapter.onAccountChanged(accountListener);
    const unsubscribeNetwork = adapter.onNetworkChanged(networkListener);

    listeners.get("accountchanged")?.();
    listeners.get("networkchanged")?.();

    expect(accountListener).toHaveBeenCalledTimes(1);
    expect(networkListener).toHaveBeenCalledTimes(1);

    unsubscribeAccount();
    unsubscribeNetwork();
    expect(nep21Provider.removeListener).toHaveBeenCalledWith(
      "accountchanged",
      expect.any(Function),
    );
    expect(nep21Provider.removeListener).toHaveBeenCalledWith(
      "accountschanged",
      expect.any(Function),
    );
    expect(nep21Provider.removeListener).toHaveBeenCalledWith(
      "networkchanged",
      expect.any(Function),
    );
  });

  it("uses the legacy NEOLineN3 provider when a NeoLine NEP-21 provider is not injected", async () => {
    const legacyInstance = {
      getNetworks: jest.fn().mockResolvedValue({ defaultNetwork: "TestNet" }),
      getAccount: jest.fn().mockResolvedValue({
        address: "NLegacyNeoLine",
        label: "Legacy",
      }),
      AddressToScriptHash: jest.fn().mockResolvedValue({
        scriptHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
      getPublicKey: jest.fn().mockResolvedValue({ publicKey: "03legacy" }),
      getBalance: jest.fn()
        .mockResolvedValueOnce({
          balances: [
            {
              amount: "1",
              contract: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
            },
          ],
        })
        .mockResolvedValueOnce({
          balances: [
            {
              amount: "2.5",
              contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
            },
          ],
        }),
      signMessage: jest.fn().mockResolvedValue({
        publicKey: "03legacy",
        data: "legacy-signed",
      }),
      invoke: jest.fn().mockResolvedValue({ txid: "0xlegacy" }),
      send: jest.fn().mockResolvedValue({ txid: "0xlegacysend" }),
    };
    (window as unknown as { NEOLineN3?: unknown }).NEOLineN3 = {
      Init: jest.fn(() => legacyInstance),
    };

    const adapter = new NeoLineAdapter();

    expect(adapter.isInstalled()).toBe(true);
    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NLegacyNeoLine",
      network: "testnet",
    });
    await expect(adapter.getBalance("NLegacyNeoLine")).resolves.toEqual({
      neo: "1",
      gas: "2.5",
    });
    await expect(adapter.signMessage("hello")).resolves.toMatchObject({
      publicKey: "03legacy",
      data: "legacy-signed",
    });
    await expect(adapter.invoke({
      scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "claimReward",
      args: [{ type: "Hash160", value: "NLegacyNeoLine" }],
      signers: [{ account: "NLegacyNeoLine", scopes: 1 }],
    })).resolves.toEqual({ txid: "0xlegacy" });
    await expect(
      adapter.send("GAS", "100000000", "NRecipientAddress"),
    ).resolves.toEqual({ txid: "0xlegacysend" });
    legacyInstance.getNetworks.mockResolvedValue({ defaultNetwork: "MainNet" });
    await expect(adapter.getNetwork()).resolves.toBe("mainnet");

    expect(legacyInstance.AddressToScriptHash).toHaveBeenCalledWith({
      address: "NLegacyNeoLine",
    });
    expect(legacyInstance.signMessage).toHaveBeenCalledWith({
      message: "aGVsbG8=",
    });
    expect(legacyInstance.invoke).toHaveBeenCalledWith({
      scriptHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "claimReward",
      args: [
        {
          type: "Hash160",
          value: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ],
      signers: [{ account: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", scopes: 1 }],
      suggestedSystemFee: undefined,
    });
    expect(legacyInstance.send).toHaveBeenCalledWith({
      asset: "d2a4cff31913016155e38e474a2c06d08be276cf",
      fromAddress: "NLegacyNeoLine",
      toAddress: "NRecipientAddress",
      amount: "100000000",
      data: undefined,
    });
  });

  it("waits for NeoLine NEP-21 lazy injection after the standard request event", async () => {
    const requestedVersions: string[] = [];
    window.addEventListener("Neo.DapiProvider.request", (event) => {
      requestedVersions.push(
        (event as CustomEvent<{ version?: string }>).detail?.version ?? "",
      );
    });

    const provider = {
      name: "NeoLine",
      dapiVersion: "1.0.0",
      compatibility: ["NEP-21"],
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xlazyneoline", address: "NLazyNeoLine", isDefault: true },
      ]),
      invoke: jest.fn(),
    };
    const adapter = new NeoLineAdapter();
    const connected = adapter.connect();

    await Promise.resolve();
    expect(requestedVersions).toEqual(["1.0"]);

    window.dispatchEvent(
      new CustomEvent("Neo.DapiProvider.ready", {
        detail: { provider },
      }),
    );

    await expect(connected).resolves.toMatchObject({
      address: "NLazyNeoLine",
      network: "testnet",
    });
  });
});
