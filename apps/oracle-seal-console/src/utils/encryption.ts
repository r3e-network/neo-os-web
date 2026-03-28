const ENVELOPE_VERSION = 2;
const ENVELOPE_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";
const ENVELOPE_INFO = "morpheus-confidential-payload-v2";
const AES_GCM_TAG_LENGTH_BYTES = 16;

function assertBrowserCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("assertBrowserCrypto: WebCrypto is unavailable in this environment.");
  }
}

function decodeBase64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBytesToBase64(bytesLike: ArrayBuffer | Uint8Array) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

async function importOracleX25519Key(publicKeyBase64: string) {
  assertBrowserCrypto();
  return window.crypto.subtle.importKey(
    "raw",
    decodeBase64ToBytes(publicKeyBase64),
    { name: "X25519" },
    false,
    [],
  );
}

async function deriveAesKey(sharedSecret: Uint8Array, senderPublicKey: Uint8Array, recipientPublicKey: Uint8Array) {
  assertBrowserCrypto();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(sharedSecret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  const info = new Uint8Array([
    ...new TextEncoder().encode(ENVELOPE_INFO),
    ...senderPublicKey,
    ...recipientPublicKey,
  ]);
  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(recipientPublicKey),
      info: toArrayBuffer(info),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

export async function encryptTextWithOraclePublicKey(publicKeyBase64: string, plaintext: string) {
  assertBrowserCrypto();
  const recipientPublicKeyBytes = decodeBase64ToBytes(publicKeyBase64);
  const recipientPublicKey = await importOracleX25519Key(publicKeyBase64);
  const ephemeralKeyPair = await window.crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const ephemeralPublicKeyBytes = new Uint8Array(
    await window.crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey),
  );
  const sharedSecret = new Uint8Array(
    await window.crypto.subtle.deriveBits(
      { name: "X25519", public: recipientPublicKey },
      ephemeralKeyPair.privateKey,
      256,
    ),
  );
  const aesKey = await deriveAesKey(sharedSecret, ephemeralPublicKeyBytes, recipientPublicKeyBytes);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBytes = new Uint8Array(
    await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      new TextEncoder().encode(plaintext),
    ),
  );
  // AES-GCM appends the tag to the ciphertext; split them apart
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - AES_GCM_TAG_LENGTH_BYTES);
  const tag = encryptedBytes.slice(encryptedBytes.length - AES_GCM_TAG_LENGTH_BYTES);

  return encodeBytesToBase64(
    new TextEncoder().encode(JSON.stringify({
      v: ENVELOPE_VERSION,
      alg: ENVELOPE_ALGORITHM,
      epk: encodeBytesToBase64(ephemeralPublicKeyBytes),
      iv: encodeBytesToBase64(iv),
      ct: encodeBytesToBase64(ciphertext),
      tag: encodeBytesToBase64(tag),
    })),
  );
}

export async function encryptJsonWithOraclePublicKey(publicKeyBase64: string, jsonText: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (_e) {
    throw new Error(`encryptJsonWithOraclePublicKey: invalid JSON provided for encryption — ${jsonText.slice(0, 50)}...`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("encryptJsonWithOraclePublicKey: confidential payload must be a JSON object.");
  }
  return encryptTextWithOraclePublicKey(publicKeyBase64, JSON.stringify(parsed));
}
