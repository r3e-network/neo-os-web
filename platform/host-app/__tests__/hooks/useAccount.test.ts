/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useAccount } from "@/hooks/useAccount";

// Mock wallet store
const mockWalletStore: {
  connected: boolean;
  loading: boolean;
  address: string | null;
  publicKey: string | null;
  provider: string | null;
  signMessage: jest.Mock;
  invoke: jest.Mock;
} = {
  connected: false,
  loading: false,
  address: null,
  publicKey: null,
  provider: null,
  signMessage: jest.fn(),
  invoke: jest.fn(),
};

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: () => mockWalletStore,
}));

// Mock account store
const mockAccountStore = {
  mode: null,
  address: "",
  publicKey: "",
};

jest.mock("@/lib/auth0/account-store", () => ({
  useAccountStore: () => mockAccountStore,
  AccountMode: {},
}));

// Mock Auth0
const mockUser: { sub: string | null } = { sub: null };
jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({
    user: mockUser.sub ? { sub: mockUser.sub } : null,
    isLoading: false,
  }),
}));

// Mock Auth0Adapter
jest.mock("@/lib/wallet/adapters/auth0", () => ({
  Auth0Adapter: jest.fn().mockImplementation(() => ({
    signWithPassword: jest.fn().mockResolvedValue({ data: "signed-data" }),
    invokeWithPassword: jest.fn().mockResolvedValue({ txid: "0x123" }),
  })),
}));

describe("useAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletStore.connected = false;
    mockWalletStore.address = null;
    mockWalletStore.publicKey = null;
    mockWalletStore.provider = null;
    mockUser.sub = null;
  });

  describe("connection state", () => {
    it("returns not connected when no wallet or user", () => {
      const { result } = renderHook(() => useAccount());
      expect(result.current.isConnected).toBe(false);
      expect(result.current.mode).toBeNull();
    });

    it("returns connected in wallet mode", () => {
      mockWalletStore.connected = true;
      mockWalletStore.address = "NXV7ZhHiyM1aHXwpVsRZC6BN3y4gABn6";
      mockWalletStore.provider = "neoline";

      const { result } = renderHook(() => useAccount());
      expect(result.current.isConnected).toBe(true);
      expect(result.current.mode).toBe("wallet");
    });

    it("returns connected in oauth mode", () => {
      mockUser.sub = "auth0|123456";

      const { result } = renderHook(() => useAccount());
      expect(result.current.isConnected).toBe(true);
      expect(result.current.mode).toBe("oauth");
    });
  });

  describe("signing context", () => {
    it("returns null when not connected", () => {
      const { result } = renderHook(() => useAccount());
      expect(result.current.signingContext).toBeNull();
    });

    it("returns wallet context without password requirement", () => {
      mockWalletStore.connected = true;
      mockWalletStore.address = "NXV7ZhHiyM1aHXwpVsRZC6BN3y4gABn6";
      mockWalletStore.publicKey = "pubkey123";
      mockWalletStore.provider = "neoline";

      const { result } = renderHook(() => useAccount());
      expect(result.current.signingContext?.requiresPassword).toBe(false);
    });
  });

  describe("password modal", () => {
    it("opens modal when requestPassword is called", () => {
      const { result } = renderHook(() => useAccount());

      act(() => {
        result.current.requestPassword(async () => {});
      });

      expect(result.current.showPasswordModal).toBe(true);
    });

    it("closes modal when cancelPassword is called", () => {
      const { result } = renderHook(() => useAccount());

      act(() => {
        result.current.requestPassword(async () => {});
      });

      act(() => {
        result.current.cancelPassword();
      });

      expect(result.current.showPasswordModal).toBe(false);
    });
  });

  describe("error handling", () => {
    it("clears error when clearError is called", () => {
      const { result } = renderHook(() => useAccount());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
