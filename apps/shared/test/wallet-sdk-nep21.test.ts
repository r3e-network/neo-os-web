import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetWalletForTests, useWallet } from "../utils/wallet-sdk";

const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

function resetInjectedWallets() {
  const target = window as typeof window & {
    NEP21Provider?: unknown;
    NEP21Providers?: unknown;
    Neo?: unknown;
    OneGateDapiProvider?: unknown;
    neoDapiProvider?: unknown;
    neoDapi?: unknown;
    neo3Dapi?: unknown;
    NEOLineN3?: unknown;
    OneGate?: unknown;
    NeoMiniAppWalletConfirmIntent?: unknown;
  };
  delete target.NEP21Provider;
  delete target.NEP21Providers;
  delete target.Neo;
  delete target.OneGateDapiProvider;
  delete target.neoDapiProvider;
  delete target.neoDapi;
  delete target.neo3Dapi;
  delete target.NEOLineN3;
  delete target.OneGate;
  delete target.NeoMiniAppWalletConfirmIntent;
}

function createNep21Provider(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test NEP-21 connector",
    dapiVersion: "1.0.0",
    network: TESTNET_MAGIC,
    supportedNetworks: [MAINNET_MAGIC, TESTNET_MAGIC],
    compatibility: ["NEP-21"],
    getAccounts: vi.fn(async () => [
      {
        hash: "0x1111111111111111111111111111111111111111",
        address: "NTestAddress",
        isDefault: true,
      },
    ]),
    call: vi.fn(async () => ({
      state: "HALT",
      stack: [{ type: "Integer", value: "7" }],
    })),
    invoke: vi.fn(async () => "0xtxid"),
    getBalance: vi.fn(async () => "42"),
    send: vi.fn(async () => ({ hash: "0xsendtx" })),
    signMessage: vi.fn(async () => ({
      signature: "signed-message",
      account: "0x1111111111111111111111111111111111111111",
      pubkey: "03abc",
    })),
    ...overrides,
  };
}

describe("wallet-sdk NEP-21 support", () => {
  beforeEach(() => {
    __resetWalletForTests();
    resetInjectedWallets();
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("connects through an injected NEP-21 provider and tracks network", async () => {
    const provider = createNep21Provider();
    window.neoDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    expect(provider.getAccounts).toHaveBeenCalledTimes(1);
    expect(wallet.address.value).toBe("NTestAddress");
    expect(wallet.chainType.value).toBe("neo-n3-testnet");
    expect(wallet.chainId?.value).toBe("neo-n3-testnet");
  });

  it("detects OneGate's injected NEP-21 provider before requesting wallet events", async () => {
    const provider = createNep21Provider({ name: "OneGate" });
    window.OneGateDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    expect(provider.getAccounts).toHaveBeenCalledTimes(1);
    expect(wallet.address.value).toBe("NTestAddress");
    expect(wallet.chainType.value).toBe("neo-n3-testnet");
  });

  it("authenticates with a OneGate-native compatible challenge when accounts are gated", async () => {
    const authenticate = vi.fn(async () => ({
      address: "NAuthenticated",
      network: MAINNET_MAGIC,
    }));
    const provider = createNep21Provider({
      name: "OneGate",
      supportedNetworks: [MAINNET_MAGIC],
      getAccounts: vi.fn(async () => []),
      authenticate,
    });
    window.OneGateDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    const payload = authenticate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      action: "Authentication",
      domain: "localhost",
      networks: [MAINNET_MAGIC],
      Action: "Authentication",
      Domain: "localhost",
      Networks: [MAINNET_MAGIC],
    });
    expect(typeof payload.nonce).toBe("string");
    expect(typeof payload.Nonce).toBe("number");
    expect(payload.Timestamp).toBe(
      Math.floor(Number(payload.timestamp) / 1000),
    );
    expect(wallet.address.value).toBe("NAuthenticated");
    expect(wallet.chainType.value).toBe("neo-n3-mainnet");
  });

  it("connects through the governance-style NEP21Provider global", async () => {
    const provider = createNep21Provider({ dapiVersion: "1.0" });
    (window as typeof window & { NEP21Provider?: unknown }).NEP21Provider =
      provider;

    const wallet = useWallet();
    await wallet.connect();

    expect(provider.getAccounts).toHaveBeenCalledTimes(1);
    expect(wallet.address.value).toBe("NTestAddress");
    expect(wallet.chainType.value).toBe("neo-n3-testnet");
  });

  it("connects through a named provider in the governance-style NEP21Providers registry", async () => {
    const provider = createNep21Provider({
      name: "OneGate",
      dapiVersion: "1.0",
    });
    (
      window as typeof window & { NEP21Providers?: Record<string, unknown> }
    ).NEP21Providers = {
      OneGate: provider,
    };

    const wallet = useWallet();
    await wallet.connect();

    expect(provider.getAccounts).toHaveBeenCalledTimes(1);
    expect(wallet.address.value).toBe("NTestAddress");
  });

  it("uses the host wallet bridge when a sandboxed miniapp is embedded", async () => {
    window.history.replaceState(
      {},
      "",
      "/miniapps/forever-album/index.html?network=testnet&source=embed",
    );
    const bridgeRequests: Array<Record<string, any>> = [];
    const onBridgeMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, any>;
      if (data?.type !== "neo-miniapp-wallet-bridge:request") return;
      bridgeRequests.push(data);
      const result =
        data.method === "getAccounts"
          ? [
              {
                hash: "0x1111111111111111111111111111111111111111",
                address: "NHostWallet",
                isDefault: true,
              },
            ]
          : { txid: "0xhostbridge" };
      window.postMessage(
        {
          type: "neo-miniapp-wallet-bridge:response",
          id: data.id,
          ok: true,
          result,
        },
        "*",
      );
    };
    window.addEventListener("message", onBridgeMessage);

    try {
      const wallet = useWallet();
      await wallet.connect();
      expect(wallet.address.value).toBe("NHostWallet");
      expect(wallet.chainId?.value).toBe("neo-n3-testnet");

      await expect(
        wallet.invokeContract({
          scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          operation: "StorePhoto",
          args: [{ type: "Hash160", value: "NHostWallet" }],
          signers: [{ account: "NHostWallet", scopes: 1 }],
        }),
      ).resolves.toMatchObject({ txid: "0xhostbridge" });

      const invokeRequest = bridgeRequests.find(
        (entry) => entry.method === "invoke",
      );
      expect(invokeRequest?.payload).toMatchObject({
        invocations: [
          {
            hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            operation: "storePhoto",
            args: [
              {
                type: "Hash160",
                value: "0x1111111111111111111111111111111111111111",
              },
            ],
          },
        ],
        signers: [
          {
            account: "0x1111111111111111111111111111111111111111",
            scopes: "CalledByEntry",
          },
        ],
      });
    } finally {
      window.removeEventListener("message", onBridgeMessage);
    }
  });

  it("performs embedded host bridge read calls without requesting accounts", async () => {
    window.history.replaceState(
      {},
      "",
      "/miniapps/trustanchor/index.html?network=testnet&source=embed",
    );
    const bridgeRequests: Array<Record<string, any>> = [];
    const onBridgeMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, any>;
      if (data?.type !== "neo-miniapp-wallet-bridge:request") return;
      bridgeRequests.push(data);
      if (data.method !== "call") {
        window.postMessage(
          {
            type: "neo-miniapp-wallet-bridge:response",
            id: data.id,
            ok: false,
            error: { message: `Unexpected ${data.method} request.` },
          },
          "*",
        );
        return;
      }
      window.postMessage(
        {
          type: "neo-miniapp-wallet-bridge:response",
          id: data.id,
          ok: true,
          result: { state: "HALT", stack: [{ type: "Integer", value: "7" }] },
        },
        "*",
      );
    };
    window.addEventListener("message", onBridgeMessage);

    try {
      const wallet = useWallet();
      await expect(
        wallet.invokeRead({
          scriptHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          operation: "GetStats",
          args: [],
        }),
      ).resolves.toMatchObject({ state: "HALT" });

      expect(wallet.address.value).toBeNull();
      expect(bridgeRequests.map((entry) => entry.method)).toEqual(["call"]);
      expect(bridgeRequests[0]?.payload).toMatchObject({
        invocation: {
          hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          operation: "getStats",
          args: [],
        },
      });
    } finally {
      window.removeEventListener("message", onBridgeMessage);
    }
  });

  it("rejects the legacy OneGate host wallet when NEP-21 is not injected", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const oneGate = {
      getAccount: vi.fn(async () => ({
        address: "NOneGateLegacyAddress",
        publicKey: "03onegate",
      })),
      getNetwork: vi.fn(async () => "testnet"),
      getBalance: vi.fn(async () => ({ gas: "9.5", neo: "1" })),
      invoke: vi.fn(async () => ({ txid: "0xonegatelegacy" })),
      signMessage: vi.fn(async () => ({
        signature: "signed",
        publicKey: "03onegate",
      })),
    };
    (window as typeof window & { OneGate?: unknown }).OneGate = oneGate;

    const wallet = useWallet();
    await expect(wallet.connect()).rejects.toThrow(/NEP-21 dAPI wallet/i);

    expect(oneGate.getAccount).not.toHaveBeenCalled();
    expect(wallet.address.value).toBeNull();
  });

  it("maps shared invoke/read/balance/sign APIs to NEP-21 methods", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const provider = createNep21Provider();
    window.neoDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    const invokeResult = await wallet.invokeContract({
      scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "Transfer",
      args: [{ type: "Hash160", value: "0x01" }],
      signers: [{ account: "NTestAddress", scopes: 1 }],
    });
    expect(invokeResult.txid).toBe("0xtxid");
    expect(provider.invoke).toHaveBeenCalledWith(
      [
        {
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          operation: "transfer",
          args: [{ type: "Hash160", value: "0x01" }],
        },
      ],
      [
        {
          account: "0x1111111111111111111111111111111111111111",
          scopes: "CalledByEntry",
        },
      ],
    );

    await expect(
      wallet.invokeRead({
        scriptHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        operation: "BalanceOf",
        args: [
          {
            type: "Hash160",
            value: "0x1111111111111111111111111111111111111111",
          },
        ],
      }),
    ).resolves.toMatchObject({ state: "HALT" });
    expect(provider.call).toHaveBeenCalledWith({
      hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      operation: "balanceOf",
      args: [
        {
          type: "Hash160",
          value: "0x1111111111111111111111111111111111111111",
        },
      ],
    });

    provider.getAccounts.mockClear();
    await expect(
      wallet.invokeRead({
        scriptHash: "0xcccccccccccccccccccccccccccccccccccccccc",
        operation: "TotalSupply",
        args: [],
      }),
    ).resolves.toMatchObject({ state: "HALT" });
    expect(provider.getAccounts).not.toHaveBeenCalled();
    expect(provider.call).toHaveBeenLastCalledWith({
      hash: "0xcccccccccccccccccccccccccccccccccccccccc",
      operation: "totalSupply",
      args: [],
    });

    await expect(wallet.getBalance("GAS")).resolves.toBe("42");
    expect(provider.getBalance).toHaveBeenCalledWith(
      "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      "0x1111111111111111111111111111111111111111",
    );

    await expect(
      wallet.send?.(
        "GAS",
        "100000000",
        "0x2222222222222222222222222222222222222222",
      ),
    ).resolves.toMatchObject({ txid: "0xsendtx" });
    expect(provider.send).toHaveBeenCalledWith(
      "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "100000000",
    );

    await expect(wallet.signMessage?.("hello")).resolves.toMatchObject({
      data: "signed-message",
      signature: "signed-message",
      publicKey: "03abc",
    });
    expect(provider.signMessage).toHaveBeenCalledWith(
      "aGVsbG8=",
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("normalizes the connected account Hash160 argument for OneGate transaction construction", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const provider = createNep21Provider({ name: "OneGate" });
    window.OneGateDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    await expect(
      wallet.invokeContract({
        scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "claimRangeGasPool",
        args: [
          { type: "String", value: "miniapp-gas-lucky-pool" },
          { type: "Integer", value: "42" },
          { type: "Hash160", value: "NTestAddress" },
        ],
        signers: [{ account: "NTestAddress", scopes: 1 }],
      }),
    ).resolves.toMatchObject({ txid: "0xtxid" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [
        {
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          operation: "claimRangeGasPool",
          args: [
            { type: "String", value: "miniapp-gas-lucky-pool" },
            { type: "Integer", value: "42" },
            {
              type: "Hash160",
              value: "0x1111111111111111111111111111111111111111",
            },
          ],
        },
      ],
      [
        {
          account: "0x1111111111111111111111111111111111111111",
          scopes: "CalledByEntry",
        },
      ],
    );
  });

  it("confirms OS-binder invocation intents before submitting through the wallet", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const provider = createNep21Provider();
    window.neoDapiProvider = provider;
    const confirmIntent = vi.fn(async () => true);
    window.NeoMiniAppWalletConfirmIntent = confirmIntent;

    const wallet = useWallet();
    await wallet.connect();

    await expect(
      wallet.invokeWithConfirmation?.(
        {
          scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          operation: "RegisterAnchor",
          args: [{ type: "Hash160", value: "NTestAddress" }],
          signers: [{ account: "NTestAddress", scopes: 1 }],
        },
        {
          endpoint: "os-binder",
          appId: "miniapp-aa-market-hub",
        },
      ),
    ).resolves.toMatchObject({ txid: "0xtxid" });

    expect(confirmIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "RegisterAnchor",
      }),
      expect.objectContaining({
        endpoint: "os-binder",
        appId: "miniapp-aa-market-hub",
      }),
    );
    expect(provider.invoke).toHaveBeenCalledWith(
      [
        {
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          operation: "registerAnchor",
          args: [
            {
              type: "Hash160",
              value: "0x1111111111111111111111111111111111111111",
            },
          ],
        },
      ],
      [
        {
          account: "0x1111111111111111111111111111111111111111",
          scopes: "CalledByEntry",
        },
      ],
    );
  });

  it("does not submit wallet intents when the confirmation is rejected", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const provider = createNep21Provider();
    window.neoDapiProvider = provider;
    window.NeoMiniAppWalletConfirmIntent = vi.fn(async () => false);

    const wallet = useWallet();
    await wallet.connect();

    await expect(
      wallet.invokeWithConfirmation?.({
        scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "RegisterAnchor",
        args: [],
      }),
    ).rejects.toThrow(/canceled/i);
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("blocks transaction calls when the wallet network differs from the DApp network", async () => {
    window.history.replaceState({}, "", "/?network=mainnet");
    const provider = createNep21Provider({ network: TESTNET_MAGIC });
    window.neoDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    await expect(
      wallet.invokeContract({
        scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "Transfer",
        args: [],
      }),
    ).rejects.toThrow(/targets Neo N3 Mainnet/i);
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("accepts the standard Neo.DapiProvider.ready event", async () => {
    const provider = createNep21Provider();
    const requestedVersions: string[] = [];
    window.addEventListener("Neo.DapiProvider.request", (event) => {
      requestedVersions.push(
        (event as CustomEvent<{ version?: string }>).detail?.version ?? "",
      );
    });
    const wallet = useWallet();
    const connectPromise = wallet.connect();

    await Promise.resolve();
    expect(requestedVersions).toEqual(["1.0"]);

    window.dispatchEvent(
      new CustomEvent("Neo.DapiProvider.ready", {
        detail: { provider },
      }),
    );

    await connectPromise;
    expect(wallet.address.value).toBe("NTestAddress");
  });

  it("accepts ready events where detail is the NEP-21 provider itself", async () => {
    const provider = createNep21Provider();
    const wallet = useWallet();
    const connectPromise = wallet.connect();

    await Promise.resolve();

    window.dispatchEvent(
      new CustomEvent("Neo.DapiProvider.ready", {
        detail: provider,
      }),
    );

    await connectPromise;
    expect(wallet.address.value).toBe("NTestAddress");
  });

  it("updates the connected account from the standard accountchanged event", async () => {
    let accountChangedListener: (() => void) | undefined;
    const provider = createNep21Provider({
      getAccounts: vi
        .fn()
        .mockResolvedValueOnce([
          {
            hash: "0x1111111111111111111111111111111111111111",
            address: "NInitialAddress",
            isDefault: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            hash: "0x2222222222222222222222222222222222222222",
            address: "NChangedAddress",
            isDefault: true,
          },
        ]),
      on: vi.fn((eventName: string, listener: () => void) => {
        if (eventName === "accountchanged") accountChangedListener = listener;
      }),
    });
    window.neoDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();
    expect(wallet.address.value).toBe("NInitialAddress");

    accountChangedListener?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(wallet.address.value).toBe("NChangedAddress");
  });

  it("rejects the legacy NeoLine API when NEP-21 is not injected", async () => {
    const neoLine = {
      getAccount: vi.fn(async () => ({ address: "NNeoLineAddress" })),
      invoke: vi.fn(async () => ({ txid: "0xneoline" })),
      invokeRead: vi.fn(async () => ({ state: "HALT", stack: [] })),
      getBalance: vi.fn(async () => ({
        GAS: [
          {
            amount: "12",
            contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
          },
        ],
      })),
    };
    (window as typeof window & { neo3Dapi?: unknown }).neo3Dapi = neoLine;

    const wallet = useWallet();
    await expect(wallet.connect()).rejects.toThrow(/NEP-21 dAPI wallet/i);
    expect(neoLine.getAccount).not.toHaveBeenCalled();
    expect(neoLine.invoke).not.toHaveBeenCalled();
  });

  it("re-reads the provider network on write paths so a mid-session switch is rejected", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    // No .on support: the 'networkchanged' event can never fire, so only an
    // on-demand provider.network re-read can catch the switch.
    const provider = createNep21Provider();
    window.neoDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();
    expect(wallet.chainType.value).toBe("neo-n3-testnet");

    // User flips the wallet to mainnet mid-session.
    provider.network = MAINNET_MAGIC;

    await expect(
      wallet.invokeContract({
        scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "Transfer",
        args: [],
      }),
    ).rejects.toThrow(/targets Neo N3 Testnet/i);
    expect(provider.invoke).not.toHaveBeenCalled();

    await expect(
      wallet.invokeMultiple?.({
        invokeArgs: [
          {
            scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            operation: "Transfer",
            args: [],
          },
        ],
      }),
    ).rejects.toThrow(/targets Neo N3 Testnet/i);

    await expect(
      wallet.send?.(
        "GAS",
        "100000000",
        "0x2222222222222222222222222222222222222222",
      ),
    ).rejects.toThrow(/targets Neo N3 Testnet/i);
    expect(provider.send).not.toHaveBeenCalled();

    await expect(wallet.getBalance("GAS")).rejects.toThrow(
      /targets Neo N3 Testnet/i,
    );
    expect(provider.getBalance).not.toHaveBeenCalled();

    // Switching back restores the write path.
    provider.network = TESTNET_MAGIC;
    await expect(
      wallet.invokeContract({
        scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "Transfer",
        args: [],
      }),
    ).resolves.toMatchObject({ txid: "0xtxid" });
  });

  it("does not request a root neo-manifest from host-rendered pages", async () => {
    window.history.replaceState({}, "", "/miniapps/miniapp-profitanchor");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const wallet = useWallet();

    await expect(wallet.getContractAddress()).rejects.toThrow(
      "Contract address not configured",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
