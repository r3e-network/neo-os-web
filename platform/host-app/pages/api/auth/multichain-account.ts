/**
 * Multi-Chain Account API
 * Supports storing and retrieving encrypted accounts for multiple chains
 *
 * POST: Store pre-encrypted account (encryption happens in browser)
 * GET: Retrieve encrypted account data for specified chain
 */
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { ChainId, ChainType } from "../../../lib/chains/types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

interface EncryptedAccountData {
  encryptedData: string;
  salt: string;
  iv: string;
  tag: string;
  iterations: number;
}

interface StoredAccount {
  chainId: ChainId;
  chainType: ChainType;
  address: string;
  publicKey: string;
  encrypted: EncryptedAccountData;
}

export default withApiAuthRequired(async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const authSub = session.user.sub;

  // GET: Retrieve accounts
  if (req.method === "GET") {
    return handleGetAccounts(req, res, authSub);
  }

  // POST: Store new account
  if (req.method === "POST") {
    return handleStoreAccount(req, res, authSub);
  }

  // DELETE: Remove account
  if (req.method === "DELETE") {
    return handleDeleteAccount(req, res, authSub);
  }

  return res.status(405).json({ error: "Method not allowed" });
});

// ============================================================================
// GET: Retrieve accounts
// ============================================================================

async function handleGetAccounts(req: NextApiRequest, res: NextApiResponse, authSub: string) {
  try {
    const chainId = req.query.chain_id as ChainId | undefined;

    let query = supabase
      .from("multichain_accounts")
      .select(
        "chain_id, chain_type, address, public_key, encrypted_private_key, encryption_salt, key_derivation_params",
      )
      .eq("auth0_sub", authSub);

    if (chainId) {
      query = query.eq("chain_id", chainId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch accounts:", error);
      return res.status(500).json({ error: "Failed to fetch accounts" });
    }

    const accounts: StoredAccount[] = (data || []).map((row) => ({
      chainId: row.chain_id,
      chainType: row.chain_type,
      address: row.address,
      publicKey: row.public_key,
      encrypted: {
        encryptedData: row.encrypted_private_key,
        salt: row.encryption_salt,
        iv: row.key_derivation_params?.iv,
        tag: row.key_derivation_params?.tag,
        iterations: row.key_derivation_params?.iterations,
      },
    }));

    return res.json({ accounts });
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return res.status(500).json({ error: "Failed to fetch accounts" });
  }
}

// ============================================================================
// POST: Store new account
// ============================================================================

async function handleStoreAccount(req: NextApiRequest, res: NextApiResponse, authSub: string) {
  const { chainId, chainType, address, publicKey, encrypted } = req.body;

  // Validate required fields
  if (!chainId || !chainType || !address || !publicKey || !encrypted) {
    return res.status(400).json({
      error: "Missing required fields: chainId, chainType, address, publicKey, encrypted",
    });
  }

  // Validate encrypted object structure
  const { encryptedData, salt, iv, tag, iterations } = encrypted;
  if (!encryptedData || !salt || !iv || !tag || !iterations) {
    return res.status(400).json({ error: "Invalid encrypted data structure" });
  }

  try {
    // Check if account already exists for this chain
    const { data: existing } = await supabase
      .from("multichain_accounts")
      .select("address")
      .eq("auth0_sub", authSub)
      .eq("chain_id", chainId)
      .single();

    if (existing) {
      return res.status(400).json({
        error: `Account already exists for chain ${chainId}`,
      });
    }

    // Store pre-encrypted key
    const { error: insertError } = await supabase.from("multichain_accounts").insert({
      auth0_sub: authSub,
      chain_id: chainId,
      chain_type: chainType,
      address: address,
      public_key: publicKey,
      encrypted_private_key: encryptedData,
      encryption_salt: salt,
      key_derivation_params: { iv, tag, iterations },
    });

    if (insertError) {
      console.error("Failed to store account:", insertError);
      return res.status(500).json({ error: "Failed to store account" });
    }

    return res.json({ chainId, address, publicKey });
  } catch (error) {
    console.error("Failed to create account:", error);
    return res.status(500).json({ error: "Failed to create account" });
  }
}

// ============================================================================
// DELETE: Remove account
// ============================================================================

async function handleDeleteAccount(req: NextApiRequest, res: NextApiResponse, authSub: string) {
  const chainId = req.query.chain_id as ChainId;

  if (!chainId) {
    return res.status(400).json({ error: "chain_id is required" });
  }

  try {
    const { error } = await supabase
      .from("multichain_accounts")
      .delete()
      .eq("auth0_sub", authSub)
      .eq("chain_id", chainId);

    if (error) {
      console.error("Failed to delete account:", error);
      return res.status(500).json({ error: "Failed to delete account" });
    }

    return res.json({ success: true, chainId });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return res.status(500).json({ error: "Failed to delete account" });
  }
}
