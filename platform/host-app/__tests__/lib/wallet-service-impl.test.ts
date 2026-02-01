import { getWalletService } from "@/lib/wallet/wallet-service-impl";

describe("WalletServiceImpl getBalance (Neo)", () => {
  it("uses Neo adapter balance for extension wallets", async () => {
    const service = getWalletService() as {
    _account: { address: string; publicKey: string };
    _providerType: string;
    _extensionProvider: string;
    _chainId: string;
    neoAdapters: {
      neoline: { getBalance: jest.Mock };
    };
    getBalance: () => Promise<unknown>;
  };
    service._account = { address: "NdzC4b1Bq9m2b8nQzX6H9y9Zq7x5P1tK2a", publicKey: "pub" };
    service._providerType = "extension";
    service._extensionProvider = "neoline";
    service._chainId = "neo-n3-mainnet";

    const expected = {
      native: "123",
      nativeSymbol: "GAS",
      governance: "10",
      governanceSymbol: "NEO",
    };
    service.neoAdapters = { neoline: { getBalance: jest.fn().mockResolvedValue(expected) } };

    await expect(service.getBalance()).resolves.toEqual(expected);
  });
});
