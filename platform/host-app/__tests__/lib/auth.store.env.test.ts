jest.mock("@/lib/wallet/store", () => {
  const walletState = {
    address: "NUserAddress",
    publicKey: "03userpub",
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  };

  return {
    useWalletStore: {
      getState: () => walletState,
    },
    getWalletAdapter: () => ({
      signMessage: jest.fn(async () => ({ data: "signed", publicKey: "03userpub" })),
    }),
  };
});

describe("auth store env access", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    sessionStorage.clear();
  });

  it("reads NEXT_PUBLIC_SUPABASE_URL lazily during wallet login", async () => {
    const { useAuthStore } = require("../../lib/auth/store") as typeof import("../../lib/auth/store");

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://lazy.supabase.co";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nonce: "nonce-1", message: "sign-me" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "jwt-token", user: { id: "user-1" } }),
      });

    await useAuthStore.getState().loginWallet("neoline" as never);

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://lazy.supabase.co/functions/v1/auth-wallet-nonce",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://lazy.supabase.co/functions/v1/auth-wallet",
      expect.objectContaining({ method: "POST" }),
    );
    expect(useAuthStore.getState().authenticated).toBe(true);
    expect(sessionStorage.getItem("sb-access-token")).toBe("jwt-token");
  });
});
