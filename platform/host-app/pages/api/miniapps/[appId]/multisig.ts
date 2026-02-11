import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { wallet, tx } from "@cityofzion/neon-js";
import { NEO_NETWORK_MAGIC } from "@/lib/chains/types";

type NeonTransaction = ReturnType<typeof tx.Transaction.deserialize>;

const SUPPORTED_CHAINS = new Set(["neo-n3-mainnet", "neo-n3-testnet"]);
const STATUS_VALUES = new Set(["pending", "ready", "broadcasted", "cancelled", "expired"]);

const stripHexPrefix = (value: string) => value.replace(/^0x/i, "");

const normalizePublicKey = (key: string) => {
  const cleaned = stripHexPrefix(String(key || "").trim()).toLowerCase();
  if (!wallet.isPublicKey(cleaned)) {
    throw new Error("invalid public key");
  }
  if (!wallet.isPublicKey(cleaned, true)) {
    return wallet.getPublicKeyEncoded(cleaned);
  }
  return cleaned;
};

const getSignerAddress = (publicKey: string) => {
  const scriptHash = wallet.getScriptHashFromPublicKey(publicKey);
  return wallet.getAddressFromScriptHash(scriptHash);
};

const normalizeScriptHash = (hash: string) => stripHexPrefix(String(hash || "").trim()).toLowerCase();

const getNetworkMagic = (chainId: string) => NEO_NETWORK_MAGIC[chainId as keyof typeof NEO_NETWORK_MAGIC];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const db = supabaseAdmin;

  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "App ID required" });
  }

  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const walletAddress = auth.address;

  switch (req.method) {
    case "POST":
      return handleCreate(db, req, res, appId, walletAddress);
    case "GET":
      return handleGet(db, req, res, appId, walletAddress);
    case "PUT":
      return handleUpdate(db, req, res, appId, walletAddress);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleCreate(
  db: SupabaseClient,
  req: NextApiRequest,
  res: NextApiResponse,
  appId: string,
  creator: string,
) {
  const { chainId, scriptHash, threshold, signers, transactionHex, memo } = req.body;

  if (!scriptHash || !threshold || !signers || !transactionHex || !chainId) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!SUPPORTED_CHAINS.has(chainId)) {
    return res.status(400).json({ error: "Unsupported chain" });
  }

  const parsedThreshold = Number(threshold);
  if (!Number.isInteger(parsedThreshold) || parsedThreshold <= 0) {
    return res.status(400).json({ error: "Invalid threshold" });
  }

  if (!Array.isArray(signers) || signers.length === 0) {
    return res.status(400).json({ error: "Invalid signers" });
  }

  let normalizedSigners: string[] = [];
  try {
    normalizedSigners = signers.map((key: string) => normalizePublicKey(key));
  } catch {
    return res.status(400).json({ error: "Invalid signer public key" });
  }

  const signerSet = new Set(normalizedSigners);
  if (signerSet.size !== normalizedSigners.length) {
    return res.status(400).json({ error: "Duplicate signer public keys" });
  }

  if (parsedThreshold > normalizedSigners.length) {
    return res.status(400).json({ error: "Threshold exceeds signer count" });
  }

  const sortedSigners = [...normalizedSigners].sort();
  const verificationScript = wallet.constructMultiSigVerificationScript(parsedThreshold, sortedSigners);
  const expectedScriptHash = wallet.getScriptHashFromVerificationScript(verificationScript).toLowerCase();
  const providedScriptHash = normalizeScriptHash(scriptHash);
  if (expectedScriptHash !== providedScriptHash) {
    return res.status(400).json({ error: "Script hash does not match signers" });
  }

  let transaction: NeonTransaction;
  try {
    transaction = tx.Transaction.deserialize(stripHexPrefix(transactionHex));
  } catch {
    return res.status(400).json({ error: "Invalid transaction hex" });
  }

  const signerAccounts = transaction.signers.map((signer: { account: { toBigEndian: () => string } }) =>
    signer.account.toBigEndian().toLowerCase(),
  );
  if (!signerAccounts.includes(expectedScriptHash)) {
    return res.status(400).json({ error: "Transaction signer does not match multisig" });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create initial record
  const { data, error } = await db
    .from("miniapp_multisig_requests")
    .insert({
      id,
      app_id: appId,
      chain_id: chainId,
      script_hash: expectedScriptHash,
      threshold: parsedThreshold,
      signers: sortedSigners,
      transaction_hex: stripHexPrefix(transactionHex),
      signatures: {}, // Empty initially
      memo,
      creator,
      status: "pending",
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("Multisig create error:", error);
    return res.status(500).json({ error: "Failed to create multisig request" });
  }

  return res.status(201).json(data);
}

async function handleGet(
  db: SupabaseClient,
  req: NextApiRequest,
  res: NextApiResponse,
  appId: string,
  walletAddress: string,
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "ID required" });
  }

  const { data, error } = await db
    .from("miniapp_multisig_requests")
    .select("*")
    .eq("id", id)
    .eq("app_id", appId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Request not found" });
  }

  const signers = (data.signers as string[]) || [];
  const signerAddresses = signers.map((key) => getSignerAddress(key));
  if (data.creator !== walletAddress && !signerAddresses.includes(walletAddress)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.status(200).json(data);
}

async function handleUpdate(
  db: SupabaseClient,
  req: NextApiRequest,
  res: NextApiResponse,
  appId: string,
  signerAddress: string,
) {
  const { id, signature, publicKey, status, broadcastTxId } = req.body;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing request ID" });
  }

  // Fetch existing
  const { data: request, error: fetchError } = await db
    .from("miniapp_multisig_requests")
    .select("*")
    .eq("id", id)
    .eq("app_id", appId)
    .single();

  if (fetchError || !request) {
    return res.status(404).json({ error: "Request not found" });
  }

  const allowedSigners = (request.signers as string[]) || [];
  const signerAddresses = allowedSigners.map((key) => getSignerAddress(key));
  const isAuthorized = request.creator === signerAddress || signerAddresses.includes(signerAddress);
  if (!isAuthorized) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (status) {
    if (!STATUS_VALUES.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (request.status === "cancelled" || request.status === "broadcasted") {
      return res.status(400).json({ error: "Request is locked" });
    }
    const signatureCount = Object.keys((request.signatures as Record<string, string>) || {}).length;
    if (status === "broadcasted" && signatureCount < request.threshold) {
      return res.status(400).json({ error: "Not enough signatures" });
    }
    if (status === "broadcasted" && !broadcastTxId) {
      return res.status(400).json({ error: "Missing broadcast txid" });
    }

    const { data, error } = await db
      .from("miniapp_multisig_requests")
      .update({
        status,
        broadcast_txid: status === "broadcasted" ? broadcastTxId : request.broadcast_txid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Multisig status update error:", error);
      return res.status(500).json({ error: "Failed to update status" });
    }

    return res.status(200).json(data);
  }

  if (!signature || !publicKey) {
    return res.status(400).json({ error: "Missing signature fields" });
  }
  if (request.status === "broadcasted" || request.status === "cancelled" || request.status === "expired") {
    return res.status(400).json({ error: "Request is closed" });
  }

  let normalizedKey: string;
  try {
    normalizedKey = normalizePublicKey(publicKey);
  } catch {
    return res.status(400).json({ error: "Invalid public key" });
  }

  if (!allowedSigners.includes(normalizedKey)) {
    return res.status(403).json({ error: "Not a valid signer" });
  }

  const derivedAddress = getSignerAddress(normalizedKey);
  if (derivedAddress !== signerAddress) {
    return res.status(403).json({ error: "Signer address mismatch" });
  }

  const signatureHex = stripHexPrefix(String(signature || "")).toLowerCase();
  if (!/^[0-9a-fA-F]+$/.test(signatureHex) || signatureHex.length !== 128) {
    return res.status(400).json({ error: "Invalid signature format" });
  }

  const networkMagic = getNetworkMagic(request.chain_id);
  if (!networkMagic) {
    return res.status(400).json({ error: "Unsupported chain" });
  }

  let transaction: NeonTransaction;
  try {
    transaction = tx.Transaction.deserialize(request.transaction_hex);
  } catch {
    return res.status(400).json({ error: "Invalid transaction hex" });
  }

  const message = transaction.getMessageForSigning(networkMagic);
  let isValid = false;
  try {
    isValid = wallet.verify(message, signatureHex, normalizedKey);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return res.status(400).json({ error: "Signature verification failed" });
  }

  const currentSignatures = (request.signatures as Record<string, string>) || {};
  const newSignatures = { ...currentSignatures, [normalizedKey]: signatureHex };
  const signatureCount = Object.keys(newSignatures).length;
  const nextStatus = signatureCount >= request.threshold ? "ready" : request.status;

  const { data, error } = await db
    .from("miniapp_multisig_requests")
    .update({
      signatures: newSignatures,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Multisig update error:", error);
    return res.status(500).json({ error: "Failed to update signature" });
  }

  return res.status(200).json(data);
}
