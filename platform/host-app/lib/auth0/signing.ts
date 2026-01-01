/**
 * Unified signing system for wallet and OAuth modes
 */

import { wallet } from "@cityofzion/neon-js";
import { getWalletAdapter } from "@/lib/wallet/store";

export type SigningMode = "wallet" | "oauth";

// Generic transaction type for compatibility
export type NeoTransaction = {
  sign: (account: InstanceType<typeof wallet.Account>) => NeoTransaction;
  witnesses: Array<{ invocationScript: string }>;
};

export interface SigningContext {
  mode: SigningMode;
  walletAddress: string;
  provider?: string;
}

export interface SigningResult {
  signature: string;
  publicKey: string;
}

/**
 * Sign transaction with wallet or OAuth account
 */
export async function signTransaction(
  transaction: NeoTransaction,
  context: SigningContext,
  password?: string,
): Promise<SigningResult> {
  if (context.mode === "wallet") {
    return signWithWallet(transaction);
  } else {
    if (!password) {
      throw new Error("Password required for OAuth signing");
    }
    return signWithOAuth(transaction, context.walletAddress, password);
  }
}

/**
 * Sign with connected wallet
 */
async function signWithWallet(transaction: NeoTransaction): Promise<SigningResult> {
  const adapter = getWalletAdapter();
  if (!adapter) {
    throw new Error("No wallet connected");
  }

  // For wallet mode, transactions are signed via invoke() method
  // This function is primarily for OAuth mode
  throw new Error("Use wallet.invoke() for transaction signing in wallet mode");
}

/**
 * Sign with OAuth account (requires password)
 */
async function signWithOAuth(
  transaction: NeoTransaction,
  walletAddress: string,
  password: string,
): Promise<SigningResult> {
  // Get private key from API
  const response = await fetch("/api/account/get-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, password }),
  });

  if (!response.ok) {
    throw new Error("Failed to decrypt private key");
  }

  const { privateKey } = await response.json();

  // Create account and sign
  const account = new wallet.Account(privateKey);
  const signedTx = transaction.sign(account);

  return {
    signature: signedTx.witnesses[0].invocationScript,
    publicKey: account.publicKey,
  };
}

/**
 * Sign message with wallet or OAuth account
 */
export async function signMessage(message: string, context: SigningContext, password?: string): Promise<string> {
  if (context.mode === "wallet") {
    const adapter = getWalletAdapter();
    if (!adapter) {
      throw new Error("No wallet connected");
    }
    const result = await adapter.signMessage(message);
    return result.data; // Return the signature data
  } else {
    if (!password) {
      throw new Error("Password required for OAuth signing");
    }

    const response = await fetch("/api/account/get-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: context.walletAddress, password }),
    });

    if (!response.ok) {
      throw new Error("Failed to decrypt private key");
    }

    const { privateKey } = await response.json();
    const account = new wallet.Account(privateKey);

    // Sign message using Neo's signing mechanism
    return wallet.sign(message, account.privateKey);
  }
}
