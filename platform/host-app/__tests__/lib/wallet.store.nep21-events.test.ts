import { useWalletStore } from "@/lib/wallet/store";

type ProviderListener = () => void;

const makeBalance = (neo: string, gas: string) => {
  let call = 0;
  return jest.fn(async () => {
    call += 1;
    return { amount: call % 2 === 1 ? neo : gas };
  });
};

describe("wallet store NEP-21 events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    delete (window as unknown as { Neo?: unknown }).Neo;
    useWalletStore.setState({
      connected: false,
      address: "",
      publicKey: "",
      network: null,
      provider: null,
      balance: null,
      loading: false,
      error: null,
    });
  });

  it("refreshes the connected account after the standard accountchanged event", async () => {
    const listeners = new Map<string, ProviderListener>();
    const provider = {
      network: 894710606,
      getAccounts: jest.fn()
        .mockResolvedValueOnce([
          { hash: "0xinitial", address: "NInitialAddress", isDefault: true },
        ])
        .mockResolvedValueOnce([
          { hash: "0xchanged", address: "NChangedAddress", isDefault: true },
        ]),
      getBalance: makeBalance("1", "2"),
      signMessage: jest.fn(),
      invoke: jest.fn(),
      on: jest.fn((eventName: string, listener: ProviderListener) => {
        listeners.set(eventName, listener);
      }),
      removeListener: jest.fn(),
    };
    (window as unknown as { Neo?: { DapiProvider?: unknown } }).Neo = {
      DapiProvider: provider,
    };

    await useWalletStore.getState().connect("nep21");
    expect(useWalletStore.getState().address).toBe("NInitialAddress");
    expect(useWalletStore.getState().network).toBe("testnet");

    listeners.get("accountchanged")?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useWalletStore.getState().address).toBe("NChangedAddress");
    expect(useWalletStore.getState().balance).toEqual({ neo: "1", gas: "2" });
  });
});
