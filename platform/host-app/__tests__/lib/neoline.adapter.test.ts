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

    expect(legacyInstance.getAccount).not.toHaveBeenCalled();
    expect(legacyInstance.invoke).not.toHaveBeenCalled();
    expect(nep21Provider.invoke).toHaveBeenCalledWith(
      [{
        hash: "0xcontract",
        operation: "claimReward",
        args: [{ type: "Hash160", value: "0xneolinehash" }],
      }],
      [{ account: "0xneolinehash", scopes: "CalledByEntry" }],
    );
    expect(nep21Provider.invoke).toHaveBeenLastCalledWith(
      [
        {
          hash: "0xcontract",
          operation: "claimReward",
          args: [{ type: "Hash160", value: "0xneolinehash" }],
        },
        {
          hash: "0xanchor",
          operation: "registerAnchor",
          args: [{ type: "String", value: "anchor-1" }],
        },
      ],
      [{ account: "0xneolinehash", scopes: "CalledByEntry" }],
    );
  });

  it("rejects legacy NeoLine APIs when a NeoLine NEP-21 provider is not injected", async () => {
    const legacyInstance = {
      getAccount: jest.fn().mockResolvedValue({ address: "NLegacyNeoLine" }),
      getPublicKey: jest.fn().mockResolvedValue({ publicKey: "03legacy" }),
      getBalance: jest.fn().mockResolvedValue({ GAS: [{ amount: "1", contract: "gas" }] }),
      signMessage: jest.fn().mockResolvedValue({ data: "legacy-signed" }),
      invoke: jest.fn().mockResolvedValue({ txid: "0xlegacy" }),
    };
    (window as unknown as { NEOLineN3?: unknown }).NEOLineN3 = {
      Init: jest.fn(() => legacyInstance),
    };

    const adapter = new NeoLineAdapter();

    expect(adapter.isInstalled()).toBe(false);
    await expect(adapter.connect()).rejects.toThrow(/NEP-21 dAPI|not installed/i);
    await expect(adapter.getBalance("NLegacyNeoLine")).rejects.toThrow(/NEP-21 dAPI|not installed/i);
    await expect(adapter.signMessage("hello")).rejects.toThrow(/NEP-21 dAPI|not installed/i);
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "claimReward",
      args: [],
    })).rejects.toThrow(/NEP-21 dAPI|not installed/i);

    expect(legacyInstance.getAccount).not.toHaveBeenCalled();
    expect(legacyInstance.getBalance).not.toHaveBeenCalled();
    expect(legacyInstance.signMessage).not.toHaveBeenCalled();
    expect(legacyInstance.invoke).not.toHaveBeenCalled();
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
