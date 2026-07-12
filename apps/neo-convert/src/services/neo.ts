import bs58 from "bs58";
import { sha256 } from "@noble/hashes/sha256";
import { OpCode, PrivateKey, PublicKey } from "@r3e/neo-js-sdk/core";

export type NeoAccount = {
  address: string;
  publicKey: string;
  privateKey: string;
  wif: string;
};

const HEX_PATTERN = /^[0-9a-f]+$/i;
const WIF_PREFIX = 0x80;
const WIF_SUFFIX = 0x01;
// Neo N3 address version byte (0x35 → addresses start with 'N').
const ADDRESS_VERSION = 0x35;
export const MAX_SCRIPT_BYTES = 65_536;
export const MAX_SOURCE_CHARS = MAX_SCRIPT_BYTES * 2 + 2;

const OPCODE_NAME_BY_VALUE = Object.entries(OpCode).reduce<Record<number, string>>((acc, [name, value]) => {
  if (typeof value === "number") {
    acc[value] = name;
  }
  return acc;
}, {});

const normalizeHex = (value: string): string => value.trim().replace(/^0x/i, "");

const isHex = (value: string): boolean => value.length > 0 && value.length % 2 === 0 && HEX_PATTERN.test(value);

const bytesFromHex = (value: string): Uint8Array => {
  const normalized = normalizeHex(value);
  if (!isHex(normalized)) {
    throw new Error("invalid hex");
  }
  return Uint8Array.from(normalized.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? []);
};

const bytesToHex = (value: Uint8Array): string =>
  Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const checksum = (payload: Uint8Array): Uint8Array => sha256(sha256(payload)).slice(0, 4);

const concatBytes = (...values: Uint8Array[]): Uint8Array => {
  const totalLength = values.reduce((sum, value) => sum + value.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const value of values) {
    out.set(value, offset);
    offset += value.length;
  }
  return out;
};

const encodeBase58Check = (payload: Uint8Array): string => bs58.encode(concatBytes(payload, checksum(payload)));

const decodeBase58Check = (value: string): Uint8Array => {
  const normalized = value.trim();
  // The only products decoded here are a 34-character N3 address and a
  // 52-character WIF. Bound the decoder before its expensive base conversion
  // so a pasted oversized script cannot monopolize the UI thread.
  if (!normalized || normalized.length > 64) {
    throw new Error("invalid base58check length");
  }
  const decoded = Uint8Array.from(bs58.decode(normalized));
  if (decoded.length < 5) {
    throw new Error("invalid base58check payload");
  }
  const payload = decoded.slice(0, -4);
  const actualChecksum = decoded.slice(-4);
  const expectedChecksum = checksum(payload);
  if (bytesToHex(actualChecksum) !== bytesToHex(expectedChecksum)) {
    throw new Error("invalid base58check checksum");
  }
  return payload;
};

const takeBytes = (bytes: Uint8Array, offset: number, length: number) => bytes.slice(offset, offset + length);

const requireBytes = (bytes: Uint8Array, offset: number, length: number): void => {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(length)
    || offset < 0
    || length < 0
    || offset + length > bytes.length
  ) {
    throw new Error("truncated NeoVM operand");
  }
};

const readLittleEndian = (bytes: Uint8Array, offset: number, length: number): number => {
  // Use an unsigned accumulator. Bitwise `<<` would overflow at 32 bits and
  // could yield a negative number for PUSHDATA4-sized prefixes.
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value += (bytes[offset + index] ?? 0) * 2 ** (8 * index);
  }
  return value;
};

/**
 * Neo N3 push-integer opcodes carry a fixed-width little-endian operand:
 * 0x00 PUSHINT8 (1), 0x01 PUSHINT16 (2), 0x02 PUSHINT32 (4),
 * 0x03 PUSHINT64 (8), 0x04 PUSHINT128 (16), 0x05 PUSHINT256 (32).
 */
const PUSHINT_OPERAND_SIZE: Record<number, number> = {
  [OpCode.PUSHINT8]: 1,
  [OpCode.PUSHINT16]: 2,
  [OpCode.PUSHINT32]: 4,
  [OpCode.PUSHINT64]: 8,
  [OpCode.PUSHINT128]: 16,
  [OpCode.PUSHINT256]: 32,
};

/**
 * SYSCALL interop service hashes → names. The hash is sha256(name)[0..4] stored
 * little-endian in the script, so the operand bytes render as the hex keys
 * below (e.g. 0x627d5b52 → "627d5b52"). Covers the common interop surface so a
 * disassembled SYSCALL reads as a name rather than an opaque 4-byte hash.
 */
const SYSCALL_NAME_BY_HASH: Record<string, string> = {
  "627d5b52": "System.Contract.Call",
  "1af77b67": "System.Contract.CallNative",
  "95da3a81": "System.Contract.GetCallFlags",
  cf998702: "System.Contract.CreateStandardAccount",
  "6a33e909": "System.Contract.CreateMultisigAccount",
  "56e7b327": "System.Crypto.CheckSig",
  "9ed0dc3a": "System.Crypto.CheckMultisig",
  b279fcf6: "System.Runtime.Platform",
  c5fba0e0: "System.Runtime.GetNetwork",
  e97d38a0: "System.Runtime.GetTrigger",
  b7c38803: "System.Runtime.GetTime",
  "2d510830": "System.Runtime.GetScriptContainer",
  dbfea874: "System.Runtime.GetExecutingScriptHash",
  "39536e3c": "System.Runtime.GetCallingScriptHash",
  f9b4e238: "System.Runtime.GetEntryScriptHash",
  b30c808f: "System.Runtime.LoadScript",
  f827ec8c: "System.Runtime.CheckWitness",
  "84271143": "System.Runtime.GetInvocationCounter",
  "6bdea928": "System.Runtime.GetRandom",
  cfe74796: "System.Runtime.Log",
  "95016f61": "System.Runtime.Notify",
  "274335f1": "System.Runtime.GetNotifications",
  "1488d8ce": "System.Runtime.GasLeft",
  c35a8cbc: "System.Runtime.BurnGas",
  "4c4992dc": "System.Runtime.GetAddressVersion",
  "9bf667ce": "System.Storage.GetContext",
  f6b46be2: "System.Storage.GetReadOnlyContext",
  "764cbfe9": "System.Storage.AsReadOnly",
  "925de831": "System.Storage.Get",
  df30b89a: "System.Storage.Find",
  e63f1884: "System.Storage.Put",
  "2f58c5ed": "System.Storage.Delete",
  "9c08ed9c": "System.Iterator.Next",
  f354bf1d: "System.Iterator.Value",
};

/** Decode a fixed-width little-endian operand as a signed two's-complement BigInt. */
const readSignedLittleEndian = (bytes: Uint8Array, offset: number, length: number): bigint => {
  let value = 0n;
  for (let index = length - 1; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[offset + index] ?? 0);
  }
  // Apply the sign bit of the most-significant byte (NeoVM integers are signed).
  const signBitSet = ((bytes[offset + length - 1] ?? 0) & 0x80) !== 0;
  if (signBitSet) {
    value -= 1n << BigInt(8 * length);
  }
  return value;
};

/**
 * Neo N3 opcodes that carry a fixed-width immediate operand which is NOT
 * length-prefixed data (jump offsets, syscall hashes, slot counts, etc.).
 * Without this framing the disassembler would mis-read the operand bytes as
 * standalone opcodes. Sizes are taken from the Neo N3 VM opcode table.
 */
const FIXED_OPERAND_SIZE: Record<number, number> = {
  // 1-byte short jump offsets
  [OpCode.JMP]: 1,
  [OpCode.JMPIF]: 1,
  [OpCode.JMPIFNOT]: 1,
  [OpCode.JMPEQ]: 1,
  [OpCode.JMPNE]: 1,
  [OpCode.JMPGT]: 1,
  [OpCode.JMPGE]: 1,
  [OpCode.JMPLT]: 1,
  [OpCode.JMPLE]: 1,
  [OpCode.CALL]: 1,
  [OpCode.ENDTRY]: 1,
  // 4-byte long jump offsets (the *_L variants)
  [OpCode.JMP_L]: 4,
  [OpCode.JMPIF_L]: 4,
  [OpCode.JMPIFNOT_L]: 4,
  [OpCode.JMPEQ_L]: 4,
  [OpCode.JMPNE_L]: 4,
  [OpCode.JMPGT_L]: 4,
  [OpCode.JMPGE_L]: 4,
  [OpCode.JMPLT_L]: 4,
  [OpCode.JMPLE_L]: 4,
  [OpCode.CALL_L]: 4,
  [OpCode.ENDTRY_L]: 4,
  // Other immediates
  [OpCode.PUSHA]: 4, // 32-bit relative pointer
  [OpCode.CALLT]: 2, // method token id
  [OpCode.SYSCALL]: 4, // interop service hash
  [OpCode.TRY]: 2, // catch + finally 1-byte offsets
  [OpCode.TRY_L]: 8, // catch + finally 4-byte offsets
  [OpCode.INITSSLOT]: 1, // static field count
  [OpCode.INITSLOT]: 2, // local count + arg count
  [OpCode.NEWARRAY_T]: 1, // stack-item type
  [OpCode.ISTYPE]: 1, // stack-item type
  [OpCode.CONVERT]: 1, // stack-item type
  // Slot index opcodes (single-byte index operand)
  [OpCode.LDSFLD]: 1,
  [OpCode.STSFLD]: 1,
  [OpCode.LDLOC]: 1,
  [OpCode.STLOC]: 1,
  [OpCode.LDARG]: 1,
  [OpCode.STARG]: 1,
};

export const generateAccount = (): NeoAccount => {
  const privateKey = new PrivateKey();
  const publicKey = privateKey.publicKey();
  return {
    address: publicKey.getAddress(),
    publicKey: publicKey.toString(),
    privateKey: bytesToHex(privateKey.toBytes()),
    wif: encodeBase58Check(concatBytes(Uint8Array.of(WIF_PREFIX), privateKey.toBytes(), Uint8Array.of(WIF_SUFFIX))),
  };
};

const privateKeyFromHex = (value: string): PrivateKey => {
  const normalized = normalizeHex(value);
  if (normalized.length !== 64 || !HEX_PATTERN.test(normalized)) {
    throw new Error("invalid private key");
  }
  const privateKey = new PrivateKey(normalized);
  // The SDK constructor accepts any 32-byte value. Deriving the public key is
  // what enforces the secp256r1 scalar range (rejecting zero and n-or-higher).
  privateKey.publicKey();
  return privateKey;
};

const publicKeyFromCompressedHex = (value: string): PublicKey => {
  const normalized = normalizeHex(value);
  if (!/^(02|03)[0-9a-f]{64}$/i.test(normalized)) {
    throw new Error("invalid compressed public key");
  }
  const publicKey = new PublicKey(normalized);
  // Force curve-point decoding; the constructor alone accepts malformed
  // compressed points and only fails later during address derivation.
  publicKey.getAddress();
  return publicKey;
};

export const validateWif = (value: string): boolean => {
  try {
    const normalized = value.trim();
    if (normalized.length !== 52) return false;
    const payload = decodeBase58Check(normalized);
    if (payload.length !== 34 || payload[0] !== WIF_PREFIX || payload[33] !== WIF_SUFFIX) {
      return false;
    }
    const privateKey = new PrivateKey(payload.slice(1, 33));
    privateKey.publicKey();
    return true;
  } catch (_error: unknown) {
    return false;
  }
};

export const validatePrivateKey = (value: string): boolean => {
  try {
    privateKeyFromHex(value);
    return true;
  } catch (_error: unknown) {
    return false;
  }
};

export const validatePublicKey = (value: string): boolean => {
  try {
    publicKeyFromCompressedHex(value);
    return true;
  } catch (_error: unknown) {
    return false;
  }
};

export const validateHexScript = (value: string): boolean => {
  const cleaned = normalizeHex(value);
  return cleaned.length <= MAX_SCRIPT_BYTES * 2 && isHex(cleaned);
};

export const isOversizedHexScript = (value: string): boolean => {
  const cleaned = normalizeHex(value);
  return cleaned.length > MAX_SCRIPT_BYTES * 2 && HEX_PATTERN.test(cleaned);
};

export const convertPrivateKeyToWif = (privateKey: string): string => {
  const normalized = privateKeyFromHex(privateKey).toBytes();
  return encodeBase58Check(concatBytes(Uint8Array.of(WIF_PREFIX), normalized, Uint8Array.of(WIF_SUFFIX)));
};

export const convertPublicKeyToAddress = (publicKey: string): string => publicKeyFromCompressedHex(publicKey).getAddress();

/**
 * A Neo N3 address is base58check(version 0x35 ‖ scriptHash[20]). Validate the
 * version byte and the 20-byte payload so a paste of a bare base58 string (or a
 * Neo Legacy 0x17-version address) is rejected rather than mis-converted.
 */
export const validateAddress = (value: string): boolean => {
  try {
    const normalized = value.trim();
    if (normalized.length !== 34) return false;
    const payload = decodeBase58Check(normalized);
    return payload.length === 21 && payload[0] === ADDRESS_VERSION;
  } catch (_error: unknown) {
    return false;
  }
};

export interface AddressScriptHash {
  /** Big-endian display form, e.g. 0x… (the form RPC/explorers print). */
  bigEndian: string;
  /** Little-endian form as stored in scripts (the byte order on the VM stack). */
  littleEndian: string;
}

/**
 * Decode a Neo N3 address to its 20-byte script hash in both byte orders. The
 * base58check payload carries the script hash little-endian; the canonical 0x…
 * display form is that reversed.
 *
 * framework-exempt: this conversion IS the app's product (neo-convert is a key
 * toolkit) — it must expose {bigEndian, littleEndian} and throw on invalid
 * input for the converter UI, unlike the framework's plumbing-oriented
 * single-value addressToScriptHash / arg.hash160 lane.
 */
export const addressToScriptHash = (address: string): AddressScriptHash => {
  const payload = decodeBase58Check(address.trim());
  if (payload.length !== 21 || payload[0] !== ADDRESS_VERSION) {
    throw new Error("invalid address");
  }
  const littleEndianBytes = payload.slice(1);
  const bigEndianBytes = Uint8Array.from(littleEndianBytes).reverse();
  return {
    bigEndian: `0x${bytesToHex(bigEndianBytes)}`,
    littleEndian: bytesToHex(littleEndianBytes),
  };
};

export const disassembleScript = (script: string): string[] => {
  const cleaned = normalizeHex(script);
  if (!isHex(cleaned) || cleaned.length > MAX_SCRIPT_BYTES * 2) return [];

  try {
    const bytes = bytesFromHex(cleaned);
    const tokens: string[] = [];

    // Neo N3 (NeoVM) opcode framing — NOT Neo Legacy (NEO2). There is no
    // PUSHBYTES range: pushes are PUSHINT8..256 (0x00-0x05, fixed operands),
    // PUSHNULL (0x0B), PUSHDATA1/2/4 (0x0C-0x0E, length-prefixed) and
    // PUSHM1/PUSH0..PUSH16 (0x0F-0x20). All other opcodes resolve by name and
    // skip any fixed immediate operand so following bytes frame correctly.
    for (let cursor = 0; cursor < bytes.length; cursor += 1) {
      const opcode = bytes[cursor];
      if (opcode === undefined) break;
      const opcodeName = OPCODE_NAME_BY_VALUE[opcode];

      // Length-prefixed data pushes — handled FIRST so they are reachable.
      if (opcode === OpCode.PUSHDATA1) {
        requireBytes(bytes, cursor + 1, 1);
        const length = bytes[cursor + 1] ?? 0;
        requireBytes(bytes, cursor + 2, length);
        const data = takeBytes(bytes, cursor + 2, length);
        tokens.push(`PUSHDATA1 ${bytesToHex(data)}`);
        cursor += 1 + length;
        continue;
      }

      if (opcode === OpCode.PUSHDATA2) {
        requireBytes(bytes, cursor + 1, 2);
        const length = readLittleEndian(bytes, cursor + 1, 2);
        requireBytes(bytes, cursor + 3, length);
        const data = takeBytes(bytes, cursor + 3, length);
        tokens.push(`PUSHDATA2 ${bytesToHex(data)}`);
        cursor += 2 + length;
        continue;
      }

      if (opcode === OpCode.PUSHDATA4) {
        requireBytes(bytes, cursor + 1, 4);
        const length = readLittleEndian(bytes, cursor + 1, 4);
        requireBytes(bytes, cursor + 5, length);
        const data = takeBytes(bytes, cursor + 5, length);
        tokens.push(`PUSHDATA4 ${bytesToHex(data)}`);
        cursor += 4 + length;
        continue;
      }

      // Fixed-width integer pushes (PUSHINT8..PUSHINT256). Decode the
      // little-endian operand to a signed decimal value (the raw hex is kept in
      // parentheses) so the reader doesn't have to byte-swap by hand.
      const pushIntSize = PUSHINT_OPERAND_SIZE[opcode];
      if (pushIntSize !== undefined) {
        requireBytes(bytes, cursor + 1, pushIntSize);
        const decimal = readSignedLittleEndian(bytes, cursor + 1, pushIntSize);
        const data = takeBytes(bytes, cursor + 1, pushIntSize);
        tokens.push(`${opcodeName} ${decimal.toString()} (0x${bytesToHex(data)})`);
        cursor += pushIntSize;
        continue;
      }

      // SYSCALL: resolve the 4-byte interop hash to its service name where
      // known, keeping the raw hash in parentheses for reference.
      if (opcode === OpCode.SYSCALL) {
        requireBytes(bytes, cursor + 1, 4);
        const data = takeBytes(bytes, cursor + 1, 4);
        const hashHex = bytesToHex(data);
        const name = SYSCALL_NAME_BY_HASH[hashHex];
        tokens.push(name ? `SYSCALL ${name} (0x${hashHex})` : `SYSCALL 0x${hashHex}`);
        cursor += 4;
        continue;
      }

      // Opcodes carrying a fixed immediate operand (jumps, slots…).
      const operandSize = FIXED_OPERAND_SIZE[opcode];
      if (operandSize !== undefined && opcodeName) {
        requireBytes(bytes, cursor + 1, operandSize);
        const data = takeBytes(bytes, cursor + 1, operandSize);
        tokens.push(`${opcodeName} ${bytesToHex(data)}`);
        cursor += operandSize;
        continue;
      }

      // No-operand opcodes (PUSHM1/PUSH0..PUSH16, arithmetic, stack ops, …).
      tokens.push(opcodeName ?? `OP_${opcode.toString(16).padStart(2, "0")}`);
    }

    return tokens;
  } catch (_error: unknown) {
    return [];
  }
};

export const getPublicKey = (privateKey: string): string => privateKeyFromHex(privateKey).publicKey().toString();

export const getPrivateKeyFromWIF = (wif: string): string => {
  const payload = decodeBase58Check(wif.trim());
  if (payload.length !== 34 || payload[0] !== WIF_PREFIX || payload[33] !== WIF_SUFFIX) {
    throw new Error("invalid WIF");
  }
  const privateKey = new PrivateKey(payload.slice(1, 33));
  privateKey.publicKey();
  return bytesToHex(privateKey.toBytes());
};
