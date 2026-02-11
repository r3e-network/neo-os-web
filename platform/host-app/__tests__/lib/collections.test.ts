/**
 * Collection Store Tests
 */

import { renderHook, act } from "@testing-library/react";

jest.mock("@/lib/security/wallet-auth-client", () => ({
  getWalletAuthHeaders: jest.fn().mockResolvedValue({
    "x-wallet-address": "NXtest",
    "x-wallet-publickey": "03aa",
    "x-wallet-signature": "deadbeef",
    "x-wallet-message": "{}",
  }),
}));

import { useCollectionStore } from "@/lib/collections/store";

// Mock fetch
global.fetch = jest.fn();

describe("useCollectionStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCollectionStore.setState({ collections: new Set(), loading: false, error: null });
  });

  describe("fetchCollections", () => {
    it("should fetch collections for wallet address", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ collections: [{ app_id: "miniapp-lottery" }] }),
      });

      const { result } = renderHook(() => useCollectionStore());

      await act(async () => {
        await result.current.fetchCollections("NeoAddress123");
      });

      expect(result.current.collections.has("miniapp-lottery")).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it("should handle fetch error", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useCollectionStore());

      await act(async () => {
        await result.current.fetchCollections("NeoAddress123");
      });

      expect(result.current.error).toBeTruthy();
    });

    it("should not fetch without wallet address", async () => {
      const { result } = renderHook(() => useCollectionStore());

      await act(async () => {
        await result.current.fetchCollections("");
      });

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("addCollection", () => {
    it("should add app to collection", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      const { result } = renderHook(() => useCollectionStore());

      await act(async () => {
        const success = await result.current.addCollection("NeoAddress123", "miniapp-coinflip");
        expect(success).toBe(true);
      });

      expect(result.current.collections.has("miniapp-coinflip")).toBe(true);
    });

    it("should return false on error", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      const { result } = renderHook(() => useCollectionStore());

      await act(async () => {
        const success = await result.current.addCollection("NeoAddress123", "miniapp-coinflip");
        expect(success).toBe(false);
      });
    });
  });

  describe("removeCollection", () => {
    it("should remove app from collection", async () => {
      useCollectionStore.setState({ collections: new Set(["miniapp-lottery"]) });
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useCollectionStore());

      await act(async () => {
        const success = await result.current.removeCollection("NeoAddress123", "miniapp-lottery");
        expect(success).toBe(true);
      });

      expect(result.current.collections.has("miniapp-lottery")).toBe(false);
    });
  });

  describe("isCollected", () => {
    it("should return true for collected app", () => {
      useCollectionStore.setState({ collections: new Set(["miniapp-lottery"]) });
      const { result } = renderHook(() => useCollectionStore());
      expect(result.current.isCollected("miniapp-lottery")).toBe(true);
    });

    it("should return false for non-collected app", () => {
      const { result } = renderHook(() => useCollectionStore());
      expect(result.current.isCollected("miniapp-unknown")).toBe(false);
    });
  });

  describe("clearCollections", () => {
    it("should clear all collections", () => {
      useCollectionStore.setState({ collections: new Set(["a", "b"]), error: "test" });
      const { result } = renderHook(() => useCollectionStore());

      act(() => {
        result.current.clearCollections();
      });

      expect(result.current.collections.size).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });
});
