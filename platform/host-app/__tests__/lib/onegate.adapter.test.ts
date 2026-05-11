import { OneGateAdapter } from "@/lib/wallet/adapters/onegate";

describe("OneGateAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as unknown as { OneGate?: unknown }).OneGate;
    delete (window as unknown as { OneGateDapiProvider?: unknown }).OneGateDapiProvider;
    delete (window as unknown as { Neo?: unknown }).Neo;
    delete (window as unknown as { neoDapiProvider?: unknown }).neoDapiProvider;
    delete (window as unknown as { neoDapi?: unknown }).neoDapi;
  });

  it("prefers OneGate's NEP-21 provider when available", async () => {
    const legacyApi = {
      getAccount: jest.fn(),
      getBalance: jest.fn(),
      signMessage: jest.fn(),
      invoke: jest.fn(),
    };
    const nep21Provider = {
      name: "OneGate",
      network: 894710606,
      getAccounts: jest.fn().mockResolvedValue([
        { hash: "0xonegatehash", address: "NOneGateAddress", isDefault: true },
      ]),
      getBalance: jest.fn()
        .mockResolvedValueOnce({ amount: "3" })
        .mockResolvedValueOnce({ amount: "9.5" }),
      signMessage: jest.fn().mockResolvedValue({
        pubkey: "03onegate",
        signature: "signed",
        account: "0xonegatehash",
      }),
      invoke: jest.fn().mockResolvedValue({ txid: "0xonegatetx" }),
    };
    (window as unknown as { OneGate?: unknown }).OneGate = legacyApi;
    (window as unknown as { OneGateDapiProvider?: unknown }).OneGateDapiProvider =
      nep21Provider;

    const adapter = new OneGateAdapter();

    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NOneGateAddress",
      network: "testnet",
    });
    await expect(adapter.getBalance("NOneGateAddress")).resolves.toEqual({
      neo: "3",
      gas: "9.5",
    });
    await expect(adapter.signMessage("hello")).resolves.toMatchObject({
      data: "signed",
      publicKey: "03onegate",
    });
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "ClaimReward",
      args: [{ type: "Hash160", value: "NOneGateAddress" }],
      signers: [{ account: "NOneGateAddress", scopes: 1 }],
    })).resolves.toEqual({ txid: "0xonegatetx" });

    expect(legacyApi.getAccount).not.toHaveBeenCalled();
    expect(legacyApi.invoke).not.toHaveBeenCalled();
    expect(nep21Provider.invoke).toHaveBeenCalledWith(
      [{
        hash: "0xcontract",
        operation: "claimReward",
        args: [{ type: "Hash160", value: "0xonegatehash" }],
      }],
      [{ account: "0xonegatehash", scopes: "CalledByEntry" }],
    );
  });

  it("falls back to the legacy OneGate API when NEP-21 is not injected", async () => {
    const legacyApi = {
      network: "neo-n3-testnet",
      getAccount: jest.fn().mockResolvedValue({
        address: "NLegacyOneGate",
        publicKey: "03legacy",
      }),
      getBalance: jest.fn().mockResolvedValue({ neo: "1", gas: "2" }),
      signMessage: jest.fn().mockResolvedValue({
        publicKey: "03legacy",
        data: "legacy-signed",
        salt: "",
        message: "hello",
      }),
      invoke: jest.fn().mockResolvedValue({ txid: "0xlegacy" }),
    };
    (window as unknown as { OneGate?: unknown }).OneGate = legacyApi;

    const adapter = new OneGateAdapter();

    await expect(adapter.connect()).resolves.toMatchObject({
      address: "NLegacyOneGate",
      publicKey: "03legacy",
      network: "testnet",
    });
    await expect(adapter.getBalance("NLegacyOneGate")).resolves.toEqual({
      neo: "1",
      gas: "2",
    });
    await expect(adapter.signMessage("hello")).resolves.toMatchObject({
      data: "legacy-signed",
    });
    await expect(adapter.invoke({
      scriptHash: "0xcontract",
      operation: "claimReward",
      args: [],
    })).resolves.toEqual({ txid: "0xlegacy" });
  });
});
