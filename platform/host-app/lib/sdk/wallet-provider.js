/**
 * Unified Wallet Provider for MiniApp SDK
 *
 * Abstracts wallet operations so MiniApps don't need to know
 * whether the user is using a social account or extension wallet.
 */

// Wallet provider type
let currentProvider = null;
let passwordCallback = null;

/**
 * Set the password callback for social account signing
 * @param {Function} callback - Async function that returns password
 */
export function setPasswordCallback(callback) {
  passwordCallback = callback;
}

/**
 * Set the current wallet provider
 * @param {Object} provider - Provider with invoke, getAccount, signMessage methods
 */
export function setWalletProvider(provider) {
  currentProvider = provider;
}

/**
 * Get current wallet provider
 */
export function getWalletProvider() {
  return currentProvider;
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected() {
  return currentProvider !== null;
}

/**
 * Get wallet address (provider-agnostic)
 */
export async function getWalletAddress() {
  if (!currentProvider) {
    throw new Error("Wallet not connected");
  }
  return currentProvider.getAddress();
}

/**
 * Invoke contract (provider-agnostic)
 * For social accounts, this will trigger password prompt
 */
export async function invokeContract(params) {
  if (!currentProvider) {
    throw new Error("Wallet not connected");
  }

  // Check if this is a social account that needs password
  if (currentProvider.requiresPassword && passwordCallback) {
    const password = await passwordCallback();
    return currentProvider.invokeWithPassword(params, password);
  }

  return currentProvider.invoke(params);
}

/**
 * Sign message (provider-agnostic)
 */
export async function signMessage(message) {
  if (!currentProvider) {
    throw new Error("Wallet not connected");
  }

  if (currentProvider.requiresPassword && passwordCallback) {
    const password = await passwordCallback();
    return currentProvider.signWithPassword(message, password);
  }

  return currentProvider.signMessage(message);
}

/**
 * Get wallet balance
 */
export async function getWalletBalance() {
  if (!currentProvider) {
    throw new Error("Wallet not connected");
  }
  const address = await currentProvider.getAddress();
  return currentProvider.getBalance(address);
}
