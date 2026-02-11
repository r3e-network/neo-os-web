/**
 * Client-side wallet authentication header utilities.
 *
 * Provides two levels of headers:
 *   - getWalletHeaders()     – read-only: just x-wallet-address (for GET filtering)
 *   - getWalletAuthHeaders() – write auth: signed message with all 4 headers
 *
 * The signed headers match the protocol expected by requireWalletAuth() on the server.
 */

import { useWalletStore } from "@/lib/wallet/store";

/**
 * Simple address-only headers for read operations.
 * Server endpoints that only filter by address (no signature check) can use this.
 */
export function getWalletHeaders(): Record<string, string> {
  const { address } = useWalletStore.getState();
  return address ? { "x-wallet-address": address } : {};
}

/**
 * Full signed authentication headers for write operations.
 *
 * Signs a timestamped message with the connected wallet and returns
 * all four headers required by the server's requireWalletAuth():
 *   - x-wallet-address
 *   - x-wallet-publickey
 *   - x-wallet-signature
 *   - x-wallet-message
 *
 * @throws Error if wallet is not connected or signing fails
 */
export async function getWalletAuthHeaders(): Promise<Record<string, string>> {
  const { address, publicKey, connected, signMessage } = useWalletStore.getState();

  if (!connected || !address || !publicKey) {
    throw new Error("Wallet not connected");
  }

  const message = JSON.stringify({ address, timestamp: Date.now() });
  const signed = await signMessage(message);

  return {
    "x-wallet-address": address,
    "x-wallet-publickey": publicKey,
    "x-wallet-signature": signed.data,
    "x-wallet-message": message,
  };
}
