/**
 * Neo N3 multisig utilities.
 *
 * Wraps @r3e/neo-js-sdk operations for multi-signature account creation,
 * transaction building, witness construction, and signature verification.
 */

import {
  wallet,
  tx,
  sc,
  u,
  RpcClient,
  Witness,
  WitnessScope,
  ScriptBuilder,
  PublicKey,
} from "@r3e/neo-js-sdk/browser";

const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const FIXED8 = 100_000_000;

const RPC_URLS: Record<string, string> = {
  "neo-n3-mainnet": "https://mainnet1.neo.coz.io:443",
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
  const account = new wallet.Account(PublicKey.fromHex(normalizePublicKey(publicKey)));
  return account.address;
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
  const scriptHash = u.reverseHex(wallet.getScriptHashFromScript(verificationScript));
  const address = wallet.getAddressFromScriptHash(scriptHash.replace(/^0x/, ""));
  return { address, scriptHash, publicKeys: sorted };
}

// ---------------------------------------------------------------------------
// Verification script & witness
// ---------------------------------------------------------------------------

function buildVerificationScriptHex(threshold: number, sortedKeys: string[]): string {
  const sb = new ScriptBuilder();
  sb.emitPush(threshold);
  for (const key of sortedKeys) {
    sb.emitPush(u.hexToBytes(key));
  }
  sb.emitPush(sortedKeys.length);
  sb.emitSysCall("System.Crypto.CheckMultisig");
  return u.bytesToHex(sb.build());
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
    sb.emitPush(u.hexToBytes(sig));
  }
  return new Witness({
    invocationScript: u.bytesToHex(sb.build()),
    verificationScript,
  });
}

// ---------------------------------------------------------------------------
// Network / RPC
// ---------------------------------------------------------------------------

export function getNetworkMagic(chainId: string): number {
  return NETWORK_MAGICS[chainId] ?? NETWORK_MAGICS["neo-n3-testnet"];
}

export function getRpcClient(chainId: string): RpcClient {
  const url = RPC_URLS[chainId] ?? RPC_URLS["neo-n3-testnet"];
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
    const pk = PublicKey.fromHex(normalizePublicKey(publicKey));
    return wallet.verify(
      u.hexToBytes(message),
      u.hexToBytes(signature),
      pk,
    );
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

  const sb = new ScriptBuilder();
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

  const transaction = new tx.Transaction({
    signers: [
      {
        account: fromScriptHash,
        scopes: WitnessScope.CalledByEntry,
      },
    ],
    validUntilBlock,
    script: u.bytesToHex(sb.build()),
  });

  // Estimate fees via RPC
  const invokeResult = await client.invokeScript(
    u.bytesToHex(sb.build()),
    [{ account: fromScriptHash, scopes: "CalledByEntry" }],
  );

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
