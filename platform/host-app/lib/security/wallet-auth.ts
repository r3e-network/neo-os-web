/**
 * Wallet-based authentication for API routes.
 *
 * Protocol:
 *   Client sends four headers:
 *     x-wallet-address   – Neo N3 address (N…)
 *     x-wallet-publickey – hex-encoded public key corresponding to the address
 *     x-wallet-signature – hex-encoded signature of the message
 *     x-wallet-message   – the signed payload: JSON { address, timestamp }
 *
 *   Server verifies:
 *     1. Address format is valid Neo N3
 *     2. Public key derives to the claimed address (scriptHash match)
 *     3. Message is well-formed JSON with matching address
 *     4. Timestamp is within acceptable window (5 min)
 *     5. Signature is cryptographically valid for the public key
 */

import { wallet, u } from "@cityofzion/neon-js";
import { isValidNeoAddress } from "./validation";

/** Maximum age of a signed message (ms) */
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000; // 5 minutes

export type WalletAuthResult = { ok: true; address: string } | { ok: false; status: number; error: string };

interface SignedMessage {
  address: string;
  timestamp: number;
}

/**
 * Parse and validate the signed message JSON.
 */
function parseMessage(raw: string): SignedMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.address === "string" && typeof parsed.timestamp === "number") {
      return parsed as SignedMessage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify wallet ownership from request headers.
 *
 * Returns the verified address on success, or an error payload on failure.
 */
export function requireWalletAuth(headers: Record<string, string | string[] | undefined>): WalletAuthResult {
  const address = firstHeader(headers["x-wallet-address"]);
  const publicKey = firstHeader(headers["x-wallet-publickey"]);
  const signature = firstHeader(headers["x-wallet-signature"]);
  const message = firstHeader(headers["x-wallet-message"]);

  // --- presence checks ---
  if (!address || !publicKey || !signature || !message) {
    return {
      ok: false,
      status: 401,
      error:
        "Missing wallet authentication headers (x-wallet-address, x-wallet-publickey, x-wallet-signature, x-wallet-message)",
    };
  }

  // --- address format ---
  if (!isValidNeoAddress(address)) {
    return { ok: false, status: 400, error: "Invalid Neo N3 address format" };
  }

  // --- publicKey ↔ address binding ---
  try {
    const derivedHash = wallet.getScriptHashFromPublicKey(publicKey);
    const expectedHash = wallet.getScriptHashFromAddress(address);
    if (derivedHash !== expectedHash) {
      return { ok: false, status: 400, error: "Public key does not match address" };
    }
  } catch {
    return { ok: false, status: 400, error: "Invalid public key format" };
  }

  // --- message structure ---
  const parsed = parseMessage(message);
  if (!parsed) {
    return { ok: false, status: 400, error: "Malformed signed message" };
  }

  // --- address consistency ---
  if (parsed.address !== address) {
    return {
      ok: false,
      status: 400,
      error: "Address in message does not match header",
    };
  }

  // --- timestamp freshness ---
  const age = Date.now() - parsed.timestamp;
  if (age < 0 || age > MAX_MESSAGE_AGE_MS) {
    return { ok: false, status: 401, error: "Signed message expired or clock skew" };
  }

  // --- signature verification ---
  try {
    const messageHex = u.str2hexstring(message);
    const valid = wallet.verify(messageHex, signature, publicKey);
    if (!valid) {
      return { ok: false, status: 401, error: "Invalid signature" };
    }
  } catch {
    return { ok: false, status: 401, error: "Signature verification failed" };
  }

  return { ok: true, address };
}

// ---------------------------------------------------------------------------
// HOF Middleware
// ---------------------------------------------------------------------------

import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";

/** Extended request with verified wallet address attached by withWalletAuth. */
export interface AuthenticatedRequest extends NextApiRequest {
  walletAddress: string;
}

export type AuthenticatedHandler = (req: AuthenticatedRequest, res: NextApiResponse) => void | Promise<void>;

/**
 * Higher-order function that wraps an API handler with wallet authentication.
 * Eliminates the 3-line inline auth boilerplate across 38+ routes.
 *
 * Usage:
 *   export default withWalletAuth(async (req, res) => {
 *     const address = req.walletAddress; // guaranteed valid
 *   });
 */
export function withWalletAuth(handler: AuthenticatedHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const auth = requireWalletAuth(req.headers);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    (req as AuthenticatedRequest).walletAddress = auth.address;
    return handler(req as AuthenticatedRequest, res);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
