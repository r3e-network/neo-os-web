function ensureCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Crypto API not available");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error("Invalid payload format: malformed base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

/**
 * Exact string length of the v1 AES-GCM envelope produced below. Photo data
 * URLs are ASCII, so their UTF-8 byte length and JavaScript string length are
 * identical. Keeping the estimate beside the serializer prevents the capacity
 * meter from drifting away from the payload that is actually stored.
 */
export function estimateEncryptedPayloadLength(plainTextLength: number): number {
  const cipherBase64Length = Math.ceil((Math.max(0, plainTextLength) + 16) / 3) * 4;
  return 91 + cipherBase64Length;
}

interface EncryptedPayloadEnvelope {
  v: 1;
  alg: "AES-GCM";
  salt: string;
  iv: string;
  data: string;
}

function canonicalBase64ByteLength(value: string): number | null {
  if (
    value.length === 0
    || value.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return value.length / 4 * 3 - padding;
}

function parseEncryptedPayloadEnvelope(payload: string): EncryptedPayloadEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Invalid payload format: failed to parse JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid payload format");
  }
  const typed = parsed as Partial<EncryptedPayloadEnvelope>;
  if (typed.v !== 1 || typed.alg !== "AES-GCM") {
    throw new Error("Invalid payload format");
  }
  if (typeof typed.salt !== "string" || typeof typed.iv !== "string" || typeof typed.data !== "string") {
    throw new Error("Invalid payload format: missing required fields");
  }
  if (
    canonicalBase64ByteLength(typed.salt) !== 16
    || canonicalBase64ByteLength(typed.iv) !== 12
    || (canonicalBase64ByteLength(typed.data) ?? 0) < 16
  ) {
    throw new Error("Invalid payload format: invalid AES-GCM envelope");
  }
  return typed as EncryptedPayloadEnvelope;
}

/** Cheap structural check used while recovering a wallet album. */
export function isEncryptedPayloadEnvelope(payload: string): boolean {
  try {
    parseEncryptedPayloadEnvelope(payload);
    return true;
  } catch {
    return false;
  }
}

async function deriveKey(password: string, salt: Uint8Array) {
  ensureCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bytesToArrayBuffer(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPayload(payload: string, password: string): Promise<string> {
  ensureCrypto();
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
    key,
    encoder.encode(payload),
  );
  return JSON.stringify({
    v: 1,
    alg: "AES-GCM",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  });
}

export async function decryptPayload(payload: string, password: string): Promise<string> {
  ensureCrypto();
  const typed = parseEncryptedPayloadEnvelope(payload);
  const salt = base64ToBytes(typed.salt);
  const iv = base64ToBytes(typed.iv);
  const data = base64ToBytes(typed.data);
  const key = await deriveKey(password, salt);
  const plain = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesToArrayBuffer(iv) },
    key,
    bytesToArrayBuffer(data),
  );
  const decoder = new TextDecoder();
  return decoder.decode(plain);
}
