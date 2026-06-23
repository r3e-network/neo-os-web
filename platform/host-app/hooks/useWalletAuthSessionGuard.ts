import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth/store";
import {
  selectConnectedWalletAddress,
  useWalletStore,
} from "@/lib/wallet/store";

/**
 * Keep wallet-auth sessions bound to the currently connected wallet.
 *
 * The wallet store intentionally preserves `address` while a saved session is
 * restore-pending so the navbar can show a resume chip. Protected APIs and
 * MiniApp OS calls must not treat that remembered address as authenticated, and
 * an account/network change must not keep using a token signed by a previous
 * wallet identity.
 */
export function useWalletAuthSessionGuard() {
  const connectedWalletAddress = useWalletStore(selectConnectedWalletAddress);
  const authLoading = useAuthStore((state) => state.loading);
  const authMethod = useAuthStore((state) => state.method);
  const authWalletAddress = useAuthStore((state) => state.walletAddress);
  const authWalletType = useAuthStore((state) => state.walletType);
  const clearWalletSession = useAuthStore((state) => state.clearWalletSession);

  useEffect(() => {
    if (authLoading) return;
    const hasExternalWalletSession =
      authMethod === "wallet" || authWalletType === "external";
    if (!hasExternalWalletSession) return;
    if (
      !connectedWalletAddress ||
      connectedWalletAddress !== authWalletAddress
    ) {
      clearWalletSession();
    }
  }, [
    authLoading,
    authMethod,
    authWalletAddress,
    authWalletType,
    clearWalletSession,
    connectedWalletAddress,
  ]);
}
