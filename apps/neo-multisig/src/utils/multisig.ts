/**
 * Neo N3 multisig utilities.
 *
 * Wraps @r3e/neo-js-sdk operations for multi-signature account creation,
 * transaction building, witness construction, and signature verification.
 */

import {
  BinaryReader,
  bytesToHex,
  hash160,
  hexToBytes,
  reverseBytes,
  RpcClient,
  ScriptBuilder,
  sc,
  tx,
  Tx,
  wallet,
  PublicKey,
  Witness,
  WitnessScope,
} from "@r3e/neo-js-sdk/browser";

const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const FIXED8 = 100_000_000;

const RPC_URLS: Record<string, string> = {
  "neo-n3-mainnet": "https://mainnet2.neo.coz.io:443",
  "neo-n3-testnet": "https://testnet1.neo.coz.io:443",
};

const NETWORK_MAGICS: Record<string, number> = {
  "neo-n3-mainnet": 860833102,
  "neo-n3-testnet": 894710606,
};

// ---------------------------------------------------------------------------
// Public key helpers
// ---------------------------------------------------------------------------

export function normalizePublicKey(key: string): string {
  return key.replace(/^0x/i, "").toLowerCase();
}

export function normalizePublicKeys(keys: string[]): string[] {
  const normalized = keys.map(normalizePublicKey);
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new Error("duplicate public keys");
  }
  return normalized.sort();
}

export function getPublicKeyAddress(publicKey: string): string {
  return new PublicKey(normalizePublicKey(publicKey)).getAddress();
}

// ---------------------------------------------------------------------------
// Multisig account
// ---------------------------------------------------------------------------

export function createMultisigAccount(
  threshold: number,
  publicKeys: string[],
): { address: string; scriptHash: string; publicKeys: string[] } {
  const sorted = normalizePublicKeys(publicKeys);
  const verificationScript = buildVerificationScriptHex(threshold, sorted);
  const scriptHash = bytesToHex(reverseBytes(hexToBytes(hash160(verificationScript))));
  const address = wallet.getAddressFromScriptHash(scriptHash);
  return { address, scriptHash, publicKeys: sorted };
}

// ---------------------------------------------------------------------------
// Verification script & witness
// ---------------------------------------------------------------------------

function buildVerificationScriptHex(threshold: number, sortedKeys: string[]): string {
  const sb = new ScriptBuilder();
  sb.emitPush(threshold);
  for (const key of sortedKeys) {
    sb.emitPush(hexToBytes(key));
  }
  sb.emitPush(sortedKeys.length);
  sb.emitSyscall("System.Crypto.CheckMultisig");
  return sb.toHex();
}

export function buildVerificationScript(
  threshold: number,
  signers: string[],
): { script: string; publicKeys: string[] } {
  const sorted = normalizePublicKeys(signers);
  const script = buildVerificationScriptHex(threshold, sorted);
  return { script, publicKeys: sorted };
}

export function buildWitness(verificationScript: string, orderedSignatures: string[]): Witness {
  const sb = new ScriptBuilder();
  for (const sig of orderedSignatures) {
    sb.emitPush(hexToBytes(sig));
  }
  return new Witness(sb.toBytes(), hexToBytes(verificationScript));
}

// ---------------------------------------------------------------------------
// Network / RPC
// ---------------------------------------------------------------------------

export function getNetworkMagic(chainId: string): number {
  return NETWORK_MAGICS[chainId] ?? 894710606;
}

export function getRpcClient(chainId: string): RpcClient {
  const url = RPC_URLS[chainId] ?? "https://testnet1.neo.coz.io:443";
  return new RpcClient(url);
}

// ---------------------------------------------------------------------------
// Address / amount validation
// ---------------------------------------------------------------------------

export function isValidAddress(address: string): boolean {
  try {
    if (!address || typeof address !== "string") return false;
    return /^N[A-Za-z0-9]{33}$/.test(address.trim());
  } catch {
    return false;
  }
}

export function validateAmount(amount: string, asset: "GAS" | "NEO"): boolean {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (asset === "NEO" && !Number.isInteger(n)) return false;
  return true;
}

export function formatFixed8(value: string | number | bigint): string {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return (n / FIXED8).toFixed(8).replace(/\.?0+$/, "");
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export function verifySignature(
  message: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const pk = new PublicKey(normalizePublicKey(publicKey));
    return pk.verify(hexToBytes(message), hexToBytes(signature));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Transaction building
// ---------------------------------------------------------------------------

export async function buildTransferTransaction(params: {
  chainId: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  assetSymbol: "GAS" | "NEO";
  threshold: number;
  publicKeys: string[];
}): Promise<{
  tx: Record<string, unknown>;
  systemFee: string;
  networkFee: string;
  validUntilBlock: number;
}> {
  const { chainId, fromAddress, toAddress, amount, assetSymbol, threshold, publicKeys } = params;
  const client = getRpcClient(chainId);
  const assetHash = assetSymbol === "GAS" ? GAS_HASH : NEO_HASH;

  const rawAmount =
    assetSymbol === "NEO"
      ? BigInt(Math.floor(Number(amount)))
      : BigInt(Math.round(Number(amount) * FIXED8));

  const fromScriptHash = wallet.getScriptHashFromAddress(fromAddress);

  const sb = new sc.ScriptBuilder();
  sb.emitContractCall({
    scriptHash: assetHash,
    operation: "transfer",
    args: [
      sc.ContractParam.hash160(fromScriptHash),
      sc.ContractParam.hash160(wallet.getScriptHashFromAddress(toAddress)),
      sc.ContractParam.integer(rawAmount.toString()),
      sc.ContractParam.any(),
    ],
  });

  const currentHeight = await client.getBlockCount();
  const validUntilBlock = currentHeight + 5760; // ~24 hours

  const script = sb.build();
  const transaction = new tx.Transaction({
    signers: [
      {
        account: fromScriptHash,
        scopes: WitnessScope.CalledByEntry,
      },
    ],
    validUntilBlock,
    script,
  });

  // Estimate fees via RPC
  const invokeResult = await client.invokeScript({
    script,
    signers: [{ account: fromScriptHash, scopes: "CalledByEntry" }],
  });

  const systemFee = invokeResult.gasconsumed
    ? (Number(invokeResult.gasconsumed) / FIXED8).toFixed(8)
    : "0";

  // Rough network fee estimate for multisig (verification script is large)
  const verificationScript = buildVerificationScriptHex(threshold, normalizePublicKeys(publicKeys));
  const estimatedSize = verificationScript.length / 2 + threshold * 65 + 200;
  const networkFee = (estimatedSize * 1000 / FIXED8).toFixed(8);

  transaction.systemFee = BigInt(Math.ceil(Number(systemFee) * FIXED8));
  transaction.networkFee = BigInt(Math.ceil(Number(networkFee) * FIXED8));

  return {
    tx: transaction as unknown as Record<string, unknown>,
    systemFee,
    networkFee,
    validUntilBlock,
  };
}

// ---------------------------------------------------------------------------
// Signing lifecycle: sign-data, witness assembly, broadcast
// ---------------------------------------------------------------------------

/**
 * Parse an unsigned transaction hex (as produced by `serialize(false)`) into a
 * core Tx. The unsigned form omits the witness var-array, so it must be read
 * with `unmarshalUnsignedFrom` rather than the full `unmarshalFrom`.
 */
function parseUnsignedCoreTx(transactionHex: string): InstanceType<typeof Tx> {
  const reader = new BinaryReader(hexToBytes(transactionHex));
  return Tx.unmarshalUnsignedFrom(reader) as InstanceType<typeof Tx>;
}

/**
 * Compute the canonical sign-data for an unsigned multisig transaction.
 *
 * Every signer must sign exactly these bytes (the transaction's unsigned
 * hash combined with the network magic) for their signature to be valid in
 * the multisig witness. The hex returned here is deterministic for a given
 * transaction + network, so it can be shared with other signers and
 * re-derived on load.
 */
export function getRequestSignData(
  transactionHex: string,
  chainId: string,
): string {
  const core = parseUnsignedCoreTx(transactionHex);
  const signData = core.getSignData(getNetworkMagic(chainId));
  return bytesToHex(signData);
}

/**
 * Order collected signatures to match the sorted signer public keys.
 *
 * A Neo multisig witness requires the invocation script to push signatures in
 * the same order as the public keys appear in the verification script, using
 * exactly `threshold` of them. Signers whose public key is unknown to the
 * account are ignored.
 *
 * @returns The first `threshold` signatures in public-key order, or null when
 *          not enough valid signatures have been collected yet.
 */
export function orderSignatures(
  signers: string[],
  signatures: Record<string, string>,
  threshold: number,
): string[] | null {
  const normalizedSigs = new Map<string, string>();
  for (const [pubKey, sig] of Object.entries(signatures)) {
    normalizedSigs.set(normalizePublicKey(pubKey), sig);
  }

  const ordered: string[] = [];
  for (const key of normalizePublicKeys(signers)) {
    const sig = normalizedSigs.get(key);
    if (sig) ordered.push(sig);
    if (ordered.length >= threshold) break;
  }

  return ordered.length >= threshold ? ordered : null;
}

/**
 * Assemble a fully-signed multisig transaction hex from collected signatures.
 *
 * Rebuilds the verification script from the signer set + threshold, orders the
 * collected signatures, attaches the resulting witness, and returns the signed
 * serialized transaction ready for `broadcastTransaction`.
 *
 * @throws when fewer than `threshold` signatures are available.
 */
export function assembleSignedTransaction(params: {
  transactionHex: string;
  signers: string[];
  threshold: number;
  signatures: Record<string, string>;
}): string {
  const { transactionHex, signers, threshold, signatures } = params;
  const ordered = orderSignatures(signers, signatures, threshold);
  if (!ordered) {
    throw new Error("Not enough signatures to assemble the transaction");
  }

  const { script: verificationScript } = buildVerificationScript(
    threshold,
    signers,
  );
  const witness = buildWitness(verificationScript, ordered);

  // Rebuild a compat Transaction from the unsigned core tx so we can attach
  // the assembled multisig witness and emit a fully-signed serialization.
  const core = parseUnsignedCoreTx(transactionHex);
  const transaction = new tx.Transaction({
    nonce: core.nonce,
    systemFee: core.systemFee,
    networkFee: core.networkFee,
    validUntilBlock: core.validUntilBlock,
    script: core.script,
    signers: core.signers.map((signer) => signer.toJSON()),
    attributes: core.attributes,
    witnesses: [
      new tx.Witness({
        invocationScript: witness.invocation,
        verificationScript: witness.verification,
      }),
    ],
  });

  return transaction.serialize(true);
}

/**
 * Relay a signed transaction to the network. Returns the transaction id.
 */
export async function broadcastTransaction(
  chainId: string,
  signedTxHex: string,
): Promise<string> {
  const client = getRpcClient(chainId);
  const result = (await client.sendRawTransaction({
    tx: signedTxHex,
  })) as { hash?: string } | string;

  if (typeof result === "string") return result;
  if (result && typeof result.hash === "string") return result.hash;
  throw new Error("Broadcast did not return a transaction hash");
}
