import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetWalletForTests, useWallet } from "../utils/wallet-sdk";

const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

function resetInjectedWallets() {
  const target = window as typeof window & {
    Neo?: unknown;
    OneGateDapiProvider?: unknown;
    neoDapiProvider?: unknown;
    neoDapi?: unknown;
    neo3Dapi?: unknown;
    NEOLineN3?: unknown;
  };
  delete target.Neo;
  delete target.OneGateDapiProvider;
  delete target.neoDapiProvider;
  delete target.neoDapi;
  delete target.neo3Dapi;
  delete target.NEOLineN3;
}

function createNep21Provider(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test NEP-21 Wallet",
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
    call: vi.fn(async () => ({ state: "HALT", stack: [{ type: "Integer", value: "7" }] })),
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
      [{
        hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "transfer",
        args: [{ type: "Hash160", value: "0x01" }],
      }],
      [{ account: "0x1111111111111111111111111111111111111111", scopes: "CalledByEntry" }],
    );

    await expect(wallet.invokeRead({
      scriptHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      operation: "BalanceOf",
      args: [{ type: "Hash160", value: "0x1111111111111111111111111111111111111111" }],
    })).resolves.toMatchObject({ state: "HALT" });
    expect(provider.call).toHaveBeenCalledWith({
      hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      operation: "balanceOf",
      args: [{ type: "Hash160", value: "0x1111111111111111111111111111111111111111" }],
    });

    await expect(wallet.getBalance("GAS")).resolves.toBe("42");
    expect(provider.getBalance).toHaveBeenCalledWith(
      "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      "0x1111111111111111111111111111111111111111",
    );

    await expect(wallet.send?.("GAS", "100000000", "0x2222222222222222222222222222222222222222")).resolves.toMatchObject({ txid: "0xsendtx" });
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
    expect(provider.signMessage).toHaveBeenCalledWith("aGVsbG8=", "0x1111111111111111111111111111111111111111");
  });

  it("normalizes the connected account Hash160 argument for OneGate transaction construction", async () => {
    window.history.replaceState({}, "", "/?network=testnet");
    const provider = createNep21Provider({ name: "OneGate" });
    window.OneGateDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    await expect(wallet.invokeContract({
      scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "claimRangeGasPool",
      args: [
        { type: "String", value: "miniapp-gas-lucky-pool" },
        { type: "Integer", value: "42" },
        { type: "Hash160", value: "NTestAddress" },
      ],
      signers: [{ account: "NTestAddress", scopes: 1 }],
    })).resolves.toMatchObject({ txid: "0xtxid" });

    expect(provider.invoke).toHaveBeenCalledWith(
      [{
        hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        operation: "claimRangeGasPool",
        args: [
          { type: "String", value: "miniapp-gas-lucky-pool" },
          { type: "Integer", value: "42" },
          { type: "Hash160", value: "0x1111111111111111111111111111111111111111" },
        ],
      }],
      [{ account: "0x1111111111111111111111111111111111111111", scopes: "CalledByEntry" }],
    );
  });

  it("blocks transaction calls when the wallet network differs from the DApp network", async () => {
    window.history.replaceState({}, "", "/?network=mainnet");
    const provider = createNep21Provider({ network: TESTNET_MAGIC });
    window.neoDapiProvider = provider;

    const wallet = useWallet();
    await wallet.connect();

    await expect(wallet.invokeContract({
      scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "Transfer",
      args: [],
    })).rejects.toThrow(/targets Neo N3 Mainnet/i);
    expect(provider.invoke).not.toHaveBeenCalled();
  });

  it("accepts the standard Neo.DapiProvider.ready event", async () => {
    const provider = createNep21Provider();
    const requestedVersions: string[] = [];
    window.addEventListener("Neo.DapiProvider.request", (event) => {
      requestedVersions.push((event as CustomEvent<{ version?: string }>).detail?.version ?? "");
    });
    const wallet = useWallet();
    const connectPromise = wallet.connect();

    await Promise.resolve();
    expect(requestedVersions).toEqual(["1.0"]);

    window.dispatchEvent(new CustomEvent("Neo.DapiProvider.ready", {
      detail: { provider },
    }));

    await connectPromise;
    expect(wallet.address.value).toBe("NTestAddress");
  });

  it("updates the connected account from the standard accountchanged event", async () => {
    let accountChangedListener: (() => void) | undefined;
    const provider = createNep21Provider({
      getAccounts: vi.fn()
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

  it("falls back to NeoLine but blocks writes when the wallet network cannot be verified", async () => {
    const neoLine = {
      getAccount: vi.fn(async () => ({ address: "NNeoLineAddress" })),
      invoke: vi.fn(async () => ({ txid: "0xneoline" })),
      invokeRead: vi.fn(async () => ({ state: "HALT", stack: [] })),
      getBalance: vi.fn(async () => ({
        GAS: [{ amount: "12", contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf" }],
      })),
    };
    window.neo3Dapi = neoLine;

    const wallet = useWallet();
    await wallet.connect();
    expect(wallet.address.value).toBe("NNeoLineAddress");

    await expect(wallet.invokeContract({
      scriptHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      operation: "Transfer",
      args: [],
    })).rejects.toThrow(/not verified/i);
    expect(neoLine.invoke).not.toHaveBeenCalled();
  });

  it("does not request a root neo-manifest from host-rendered pages", async () => {
    window.history.replaceState({}, "", "/miniapps/miniapp-profitanchor");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const wallet = useWallet();

    await expect(wallet.getContractAddress()).rejects.toThrow("Contract address not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
