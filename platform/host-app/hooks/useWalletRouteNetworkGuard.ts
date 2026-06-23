import { useEffect } from "react";

import { useWalletStore } from "@/lib/wallet/store";

/**
 * Re-check the connected wallet whenever the active route changes.
 *
 * Wallet extensions only emit `networkchanged` when the user switches inside
 * the wallet. A MiniApp route can also switch target network via `?network=...`;
 * this guard makes that host-side transition update the global wallet store so
 * the navbar, action console, and embedded iframe bridge all converge quickly.
 */
export function useWalletRouteNetworkGuard(routeKey: string) {
  const connected = useWalletStore((state) => state.connected);
  const refreshBalance = useWalletStore((state) => state.refreshBalance);

  useEffect(() => {
    if (!connected) return;
    void refreshBalance();
  }, [connected, refreshBalance, routeKey]);
}
