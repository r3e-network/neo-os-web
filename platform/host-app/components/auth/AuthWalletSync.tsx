import { useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useWalletStore } from "@/lib/wallet/store";

/**
 * AuthWalletSync - Handles wallet state sync with Auth0 session
 *
 * NOTE: Does NOT auto-connect. Users must manually connect their wallet.
 * Only handles cleanup when Auth0 session ends.
 */
export function AuthWalletSync() {
  const { user, isLoading } = useUser();
  const { disconnect, connected, provider } = useWalletStore();

  useEffect(() => {
    if (isLoading) return;

    // Only handle disconnect when social user logs out
    // Do NOT auto-connect - let user manually choose to connect
    if (!user && connected && provider === "auth0") {
      disconnect();
    }
  }, [user, isLoading, connected, provider, disconnect]);

  return null;
}
