/**
 * useCollections Hook - React hook for MiniApp collection management
 */

import { useEffect, useCallback, useMemo } from "react";
import { useCollectionStore } from "@/lib/collections/store";
import { useWalletStore } from "@/lib/wallet/store";

export function useCollections() {
  const { address, connected } = useWalletStore();
  const {
    collections,
    loading,
    error,
    fetchCollections,
    addCollection,
    removeCollection,
    isCollected,
    clearCollections,
  } = useCollectionStore();

  // Fetch collections when wallet connects
  useEffect(() => {
    if (connected && address) {
      fetchCollections(address);
    } else {
      clearCollections();
    }
  }, [connected, address, fetchCollections, clearCollections]);

  const toggleCollection = useCallback(
    async (appId: string) => {
      if (!connected || !address) return false;

      if (isCollected(appId)) {
        return removeCollection(address, appId);
      } else {
        return addCollection(address, appId);
      }
    },
    [connected, address, isCollected, addCollection, removeCollection],
  );

  // Create a new Set on each render when collections change
  // This ensures React detects the change for useMemo dependencies
  const collectionsSet = useMemo(() => new Set(collections), [collections]);

  return {
    collections: Array.from(collections),
    collectionsSet,
    loading,
    error,
    isCollected,
    toggleCollection,
    isWalletConnected: connected,
  };
}
