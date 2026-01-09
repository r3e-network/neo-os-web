import { useEffect, useState } from "react";
import { useWalletStore, getWalletAdapter } from "@/lib/wallet/store";
import { logger } from "@/lib/logger";

/**
 * WalletAutoReconnect
 * 
 * Automatically reconnects the wallet if a provider was persisted in storage
 * but the connection state is currently false (due to page reload).
 */
export function WalletAutoReconnect() {
    const { provider, connected, connect } = useWalletStore();
    const [attempted, setAttempted] = useState(false);

    useEffect(() => {
        // Only run if we have a persisted provider, but we think we are disconnected.
        // Also, ignoring 'auth0' because that is handled by AuthWalletSync and requires explicit login.
        if (provider && !connected && provider !== "auth0" && !attempted) {
            const adapter = getWalletAdapter();

            // If the adapter is not installed (e.g. extension not ready yet), we might want to wait/retry.
            // But for now, let's try to connect. The store's connect action handles "not installed" gracefully.

            logger.debug("[WalletAutoReconnect] Attempting auto-reconnect for provider:", provider);
            setAttempted(true); // Prevent infinite loops or multiple attempts

            // We add a small delay to ensure window.NEOLine is injected
            const timer = setTimeout(() => {
                connect(provider).catch((err) => {
                    console.warn("[WalletAutoReconnect] Auto-reconnect failed:", err);
                });
            }, 500);

            return () => clearTimeout(timer);
        }
    }, [provider, connected, connect, attempted]);

    return null;
}
