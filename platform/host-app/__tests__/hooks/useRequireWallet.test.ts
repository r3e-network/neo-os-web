/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react";
import { useRequireWallet } from "@/hooks/useRequireWallet";

// Mock next/router
const mockReplace = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({
    replace: mockReplace,
    pathname: "/test",
  }),
}));

// Mock wallet store
const mockWalletStore: {
  connected: boolean;
  loading: boolean;
  address: string | null;
  provider: string | null;
} = {
  connected: false,
  loading: false,
  address: null,
  provider: null,
};

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: () => mockWalletStore,
}));

// Mock Auth0
const mockUser: { sub: string | null } = { sub: null };
jest.mock("@auth0/nextjs-auth0/client", () => ({
  useUser: () => ({
    user: mockUser.sub ? { sub: mockUser.sub } : null,
    isLoading: false,
  }),
}));

describe("useRequireWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletStore.connected = false;
    mockWalletStore.loading = false;
    mockWalletStore.address = null;
    mockWalletStore.provider = null;
    mockUser.sub = null;
  });

  describe("redirect mode (default)", () => {
    it("redirects when not connected", () => {
      renderHook(() => useRequireWallet());

      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("redirects to custom URL", () => {
      renderHook(() => useRequireWallet({ redirectUrl: "/login" }));

      expect(mockReplace).toHaveBeenCalledWith("/login");
    });

    it("does not redirect when wallet connected", () => {
      mockWalletStore.connected = true;
      mockWalletStore.address = "NXV7ZhHiyM1aHXwpVsRZC6BN3y4gABn6";

      renderHook(() => useRequireWallet());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("does not redirect when user logged in via Auth0", () => {
      mockUser.sub = "auth0|123456";

      renderHook(() => useRequireWallet());

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe("modal mode", () => {
    it("shows modal when not connected", () => {
      const { result } = renderHook(() => useRequireWallet({ useModal: true }));

      expect(result.current.showModal).toBe(true);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("does not show modal when connected", () => {
      mockWalletStore.connected = true;

      const { result } = renderHook(() => useRequireWallet({ useModal: true }));

      expect(result.current.showModal).toBe(false);
    });

    it("can close modal manually", () => {
      // Use autoCheck: false to prevent effect from reopening modal
      const { result } = renderHook(() => useRequireWallet({ useModal: true, autoCheck: false }));

      // First open the modal manually
      act(() => {
        result.current.openModal();
      });
      expect(result.current.showModal).toBe(true);

      // Then close it
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.showModal).toBe(false);
    });

    it("can open modal manually when autoCheck is disabled", () => {
      // Start with connected state and autoCheck disabled
      mockWalletStore.connected = true;

      const { result } = renderHook(() => useRequireWallet({ useModal: true, autoCheck: false }));

      // Modal should be closed initially
      expect(result.current.showModal).toBe(false);

      // Simulate disconnection
      mockWalletStore.connected = false;

      act(() => {
        result.current.openModal();
      });

      // Modal should now be open
      expect(result.current.showModal).toBe(true);
    });
  });

  describe("checkConnection", () => {
    it("returns true when connected", () => {
      mockWalletStore.connected = true;

      const { result } = renderHook(() => useRequireWallet({ autoCheck: false }));

      let isConnected: boolean;
      act(() => {
        isConnected = result.current.checkConnection();
      });

      expect(isConnected!).toBe(true);
    });

    it("returns false and redirects when not connected", () => {
      const { result } = renderHook(() => useRequireWallet({ autoCheck: false }));

      let isConnected: boolean;
      act(() => {
        isConnected = result.current.checkConnection();
      });

      expect(isConnected!).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("returns false and shows modal in modal mode", () => {
      const { result } = renderHook(() => useRequireWallet({ useModal: true, autoCheck: false }));

      let isConnected: boolean;
      act(() => {
        isConnected = result.current.checkConnection();
      });

      expect(isConnected!).toBe(false);
      expect(result.current.showModal).toBe(true);
    });
  });

  describe("loading state", () => {
    it("does not redirect while loading", () => {
      mockWalletStore.loading = true;

      renderHook(() => useRequireWallet());

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("returns loading state", () => {
      mockWalletStore.loading = true;

      const { result } = renderHook(() => useRequireWallet());

      expect(result.current.loading).toBe(true);
    });
  });

  describe("connection info", () => {
    it("returns address when connected", () => {
      mockWalletStore.connected = true;
      mockWalletStore.address = "NXV7ZhHiyM1aHXwpVsRZC6BN3y4gABn6";
      mockWalletStore.provider = "neoline";

      const { result } = renderHook(() => useRequireWallet());

      expect(result.current.address).toBe("NXV7ZhHiyM1aHXwpVsRZC6BN3y4gABn6");
      expect(result.current.provider).toBe("neoline");
    });

    it("returns null when not connected", () => {
      const { result } = renderHook(() => useRequireWallet({ autoCheck: false }));

      expect(result.current.address).toBeNull();
      expect(result.current.provider).toBeNull();
    });
  });

  describe("legacy string parameter", () => {
    it("supports legacy string parameter for redirectUrl", () => {
      renderHook(() => useRequireWallet("/custom-redirect"));

      expect(mockReplace).toHaveBeenCalledWith("/custom-redirect");
    });
  });
});
