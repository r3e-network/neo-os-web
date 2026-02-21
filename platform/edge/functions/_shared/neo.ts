import { p256 } from "https://esm.sh/@noble/curves@1.4.0/p256";
import { ripemd160 } from "https://esm.sh/@noble/hashes@1.4.0/ripemd160";
import { sha256 } from "https://esm.sh/@noble/hashes@1.4.0/sha256";

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const textEncoder = new TextEncoder();

function base58Encode(bytes: Uint8Array): string {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) + BigInt(b);

  let out = "";
  while (x > 0n) {
    const mod = x % 58n;
    x = x / 58n;
    out = base58Alphabet[Number(mod)] + out;
  }

  for (const b of bytes) {
    if (b !== 0) break;
    out = base58Alphabet[0] + out;
  }

  return out || base58Alphabet[0];
}

function decodeHex(hex: string): Uint8Array {
  const trimmed = hex.trim();
  if (trimmed.length % 2 !== 0) throw new Error("invalid hex length");
  const out = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex");
    out[i] = byte;
  }
  return out;
}

function decodeBase64(value: string): Uint8Array {
  let s = value.trim();
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodeWalletBytes(value: string): Uint8Array {
  let s = value.trim();
  s = s.replace(/^0x/i, "");
  if (!s) throw new Error("empty value");

  // Prefer hex when the string looks like hex.
  if (/^[0-9a-fA-F]+$/.test(s)) return decodeHex(s);

  // Otherwise treat as base64/base64url.
  return decodeBase64(s);
}

function normalizeCompressedPublicKey(publicKey: Uint8Array): Uint8Array {
  if (publicKey.length === 33) {
    const prefix = publicKey[0];
    if (prefix !== 0x02 && prefix !== 0x03) throw new Error("invalid compressed public key");
    return publicKey;
  }

  if (publicKey.length === 65 && publicKey[0] === 0x04) {
    const x = publicKey.slice(1, 33);
    const y = publicKey.slice(33, 65);
    const yOdd = (y[y.length - 1] & 1) === 1;
    const prefix = yOdd ? 0x03 : 0x02;
    const out = new Uint8Array(33);
    out[0] = prefix;
    out.set(x, 1);
    return out;
  }

  throw new Error(`unsupported public key length: ${publicKey.length}`);
}

export function publicKeyToAddress(publicKeyBytes: Uint8Array): string {
  const compressed = normalizeCompressedPublicKey(publicKeyBytes);

  // Verification script = PUSHDATA1(0x0C) + len(33) + pubkey + SYSCALL System.Crypto.CheckSig
  // System.Crypto.CheckSig syscall id = 0x27b3e756 (little endian bytes: 56 e7 b3 27)
  const script = new Uint8Array(2 + 33 + 5);
  script[0] = 0x0c;
  script[1] = 33;
  script.set(compressed, 2);
  script.set(new Uint8Array([0x41, 0x56, 0xe7, 0xb3, 0x27]), 35);

  const scriptHash = ripemd160(sha256(script));

  // Neo N3 address = Base58Check(0x35 + scriptHash)
  const payload = new Uint8Array(1 + scriptHash.length);
  payload[0] = 0x35;
  payload.set(scriptHash, 1);

  const checksum = sha256(sha256(payload)).slice(0, 4);
  const addressBytes = new Uint8Array(payload.length + checksum.length);
  addressBytes.set(payload, 0);
  addressBytes.set(checksum, payload.length);

  return base58Encode(addressBytes);
}

export function verifyNeoSignature(
  address: string,
  message: string,
  signatureEncoded: string,
  publicKeyEncoded: string,
): boolean {
  try {
    const signature = decodeWalletBytes(signatureEncoded);
    const publicKey = decodeWalletBytes(publicKeyEncoded);

    const derived = publicKeyToAddress(publicKey);
    if (derived !== address) return false;

    const msgHash = sha256(textEncoder.encode(message));
    return p256.verify(signature, msgHash, publicKey);
  } catch {
    return false;
  }
}

