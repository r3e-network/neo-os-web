/**
 * useCollections Hook Tests
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useCollections } from "@/hooks/useCollections";
import { useCollectionStore } from "@/lib/collections/store";
import { useWalletStore } from "@/lib/wallet/store";

// Mock stores
jest.mock("@/lib/collections/store");
jest.mock("@/lib/wallet/store");

const mockUseCollectionStore = useCollectionStore as jest.MockedFunction<typeof useCollectionStore>;
const mockUseWalletStore = useWalletStore as jest.MockedFunction<typeof useWalletStore>;

describe("useCollections", () => {
  const mockFetchCollections = jest.fn();
  const mockAddCollection = jest.fn();
  const mockRemoveCollection = jest.fn();
  const mockClearCollections = jest.fn();
  const mockIsCollected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseCollectionStore.mockReturnValue({
      collections: new Set(["miniapp-lottery"]),
      loading: false,
      error: null,
      fetchCollections: mockFetchCollections,
      addCollection: mockAddCollection,
      removeCollection: mockRemoveCollection,
      isCollected: mockIsCollected,
      clearCollections: mockClearCollections,
    });

    mockUseWalletStore.mockReturnValue({
      connected: true,
      address: "NeoAddress123",
      publicKey: "",
      provider: "neoline",
      balance: null,
      loading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      refreshBalance: jest.fn(),
      clearError: jest.fn(),
    });
  });

  it("should fetch collections when wallet connects", () => {
    renderHook(() => useCollections());
    expect(mockFetchCollections).toHaveBeenCalledWith("NeoAddress123");
  });

  it("should clear collections when wallet disconnects", () => {
    mockUseWalletStore.mockReturnValue({
      connected: false,
      address: "",
      publicKey: "",
      provider: null,
      balance: null,
      loading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      refreshBalance: jest.fn(),
      clearError: jest.fn(),
    });

    renderHook(() => useCollections());
    expect(mockClearCollections).toHaveBeenCalled();
  });

  it("should toggle collection - add", async () => {
    mockIsCollected.mockReturnValue(false);
    mockAddCollection.mockResolvedValue(true);

    const { result } = renderHook(() => useCollections());

    await act(async () => {
      const success = await result.current.toggleCollection("miniapp-coinflip");
      expect(success).toBe(true);
    });

    expect(mockAddCollection).toHaveBeenCalledWith("NeoAddress123", "miniapp-coinflip");
  });

  it("should toggle collection - remove", async () => {
    mockIsCollected.mockReturnValue(true);
    mockRemoveCollection.mockResolvedValue(true);

    const { result } = renderHook(() => useCollections());

    await act(async () => {
      const success = await result.current.toggleCollection("miniapp-lottery");
      expect(success).toBe(true);
    });

    expect(mockRemoveCollection).toHaveBeenCalledWith("NeoAddress123", "miniapp-lottery");
  });

  it("should return false when wallet not connected", async () => {
    mockUseWalletStore.mockReturnValue({
      connected: false,
      address: "",
      publicKey: "",
      provider: null,
      balance: null,
      loading: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      refreshBalance: jest.fn(),
      clearError: jest.fn(),
    });

    const { result } = renderHook(() => useCollections());

    await act(async () => {
      const success = await result.current.toggleCollection("miniapp-lottery");
      expect(success).toBe(false);
    });
  });
});
