/**
 * Collection Store - Zustand store for user's MiniApp collections
 */

import { create } from "zustand";

interface CollectionState {
  collections: Set<string>;
  loading: boolean;
  error: string | null;
}

interface CollectionActions {
  fetchCollections: (walletAddress: string) => Promise<void>;
  addCollection: (walletAddress: string, appId: string) => Promise<boolean>;
  removeCollection: (walletAddress: string, appId: string) => Promise<boolean>;
  isCollected: (appId: string) => boolean;
  clearCollections: () => void;
}

type CollectionStore = CollectionState & CollectionActions;

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: new Set<string>(),
  loading: false,
  error: null,

  fetchCollections: async (walletAddress: string) => {
    if (!walletAddress) return;

    set({ loading: true, error: null });

    try {
      const res = await fetch("/api/collections", {
        headers: { "x-wallet-address": walletAddress },
      });

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      const appIds = new Set<string>(data.collections?.map((c: { app_id: string }) => c.app_id) || []);

      set({ collections: appIds, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addCollection: async (walletAddress: string, appId: string) => {
    if (!walletAddress) return false;

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
        },
        body: JSON.stringify({ appId }),
      });

      if (!res.ok) return false;

      set((state) => ({
        collections: new Set([...state.collections, appId]),
      }));

      return true;
    } catch {
      return false;
    }
  },

  removeCollection: async (walletAddress: string, appId: string) => {
    if (!walletAddress) return false;

    try {
      const res = await fetch(`/api/collections/${appId}`, {
        method: "DELETE",
        headers: { "x-wallet-address": walletAddress },
      });

      if (!res.ok) return false;

      set((state) => {
        const newSet = new Set(state.collections);
        newSet.delete(appId);
        return { collections: newSet };
      });

      return true;
    } catch {
      return false;
    }
  },

  isCollected: (appId: string) => get().collections.has(appId),

  clearCollections: () => set({ collections: new Set(), error: null }),
}));
