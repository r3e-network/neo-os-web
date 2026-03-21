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
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
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
    { name: "AES-GCM", iv },
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (_e: unknown) {
    throw new Error("Invalid payload format: failed to parse JSON");
  }
  if (!parsed || parsed.v !== 1 || parsed.alg !== "AES-GCM") {
    throw new Error("Invalid payload format");
  }
  const salt = base64ToBytes(parsed.salt || "");
  const iv = base64ToBytes(parsed.iv || "");
  const data = base64ToBytes(parsed.data || "");
  const key = await deriveKey(password, salt);
  const plain = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  const decoder = new TextDecoder();
  return decoder.decode(plain);
}
