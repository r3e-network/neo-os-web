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
  const decoded = Uint8Array.from(bs58.decode(value));
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

const readLittleEndian = (bytes: Uint8Array, offset: number, length: number): number => {
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value |= (bytes[offset + index] ?? 0) << (8 * index);
  }
  return value;
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

export const validateWif = (value: string): boolean => {
  try {
    const payload = decodeBase58Check(value.trim());
    if (payload.length !== 34 || payload[0] !== WIF_PREFIX || payload[33] !== WIF_SUFFIX) {
      return false;
    }
    new PrivateKey(payload.slice(1, 33));
    return true;
  } catch (_error: unknown) {
    return false;
  }
};

export const validatePrivateKey = (value: string): boolean => {
  try {
    new PrivateKey(value.trim());
    return true;
  } catch (_error: unknown) {
    return false;
  }
};

export const validatePublicKey = (value: string): boolean => {
  try {
    new PublicKey(value.trim());
    return true;
  } catch (_error: unknown) {
    return false;
  }
};

export const validateHexScript = (value: string): boolean => {
  const cleaned = normalizeHex(value);
  return isHex(cleaned);
};

export const convertPrivateKeyToWif = (privateKey: string): string => {
  const normalized = new PrivateKey(privateKey.trim()).toBytes();
  return encodeBase58Check(concatBytes(Uint8Array.of(WIF_PREFIX), normalized, Uint8Array.of(WIF_SUFFIX)));
};

export const convertPublicKeyToAddress = (publicKey: string): string => new PublicKey(publicKey.trim()).getAddress();

export const disassembleScript = (script: string): string[] => {
  const cleaned = normalizeHex(script);
  if (!isHex(cleaned)) return [];

  try {
    const bytes = bytesFromHex(cleaned);
    const tokens: string[] = [];

    for (let cursor = 0; cursor < bytes.length; cursor += 1) {
      const opcode = bytes[cursor];
      const opcodeName = OPCODE_NAME_BY_VALUE[opcode];

      if (opcode >= 0x01 && opcode <= 0x4b) {
        const length = opcode;
        const data = takeBytes(bytes, cursor + 1, length);
        tokens.push(`PUSHBYTES${length} ${bytesToHex(data)}`);
        cursor += length;
        continue;
      }

      if (opcode === OpCode.PUSHDATA1) {
        const length = bytes[cursor + 1] ?? 0;
        const data = takeBytes(bytes, cursor + 2, length);
        tokens.push(`PUSHDATA1 ${bytesToHex(data)}`);
        cursor += 1 + length;
        continue;
      }

      if (opcode === OpCode.PUSHDATA2) {
        const length = readLittleEndian(bytes, cursor + 1, 2);
        const data = takeBytes(bytes, cursor + 3, length);
        tokens.push(`PUSHDATA2 ${bytesToHex(data)}`);
        cursor += 2 + length;
        continue;
      }

      if (opcode === OpCode.PUSHDATA4) {
        const length = readLittleEndian(bytes, cursor + 1, 4);
        const data = takeBytes(bytes, cursor + 5, length);
        tokens.push(`PUSHDATA4 ${bytesToHex(data)}`);
        cursor += 4 + length;
        continue;
      }

      tokens.push(opcodeName ?? `OP_${opcode.toString(16).padStart(2, "0")}`);
    }

    return tokens;
  } catch (_error: unknown) {
    return [];
  }
};

export const getPublicKey = (privateKey: string): string => new PrivateKey(privateKey.trim()).publicKey().toString();

export const getPrivateKeyFromWIF = (wif: string): string => {
  const payload = decodeBase58Check(wif.trim());
  if (payload.length !== 34 || payload[0] !== WIF_PREFIX || payload[33] !== WIF_SUFFIX) {
    throw new Error("invalid WIF");
  }
  return bytesToHex(payload.slice(1, 33));
};
