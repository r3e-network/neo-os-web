const ENVELOPE_VERSION = 2;
const ENVELOPE_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";
const ENVELOPE_INFO = "morpheus-confidential-payload-v2";
const AES_GCM_TAG_LENGTH_BYTES = 16;

export type ConfidentialTransferInput = {
  appId: string;
  network: "mainnet" | "testnet" | string;
  senderHint?: string;
  recipient: string;
  asset: "GAS" | "NEO" | string;
  amount: string;
  memo?: string;
};

export type ConfidentialTransferPackage = {
  publicEnvelope: {
    kind: "miniapp.private_transfer.intent.v1";
    app_id: string;
    target_chain: "neo_n3";
    network: string;
    asset: string;
    note_commitment: string;
    nullifier_hash: string;
    privacy_model: "morpheus_confidential_compute";
  };
  confidentialPayload: {
    kind: "miniapp.private_transfer.payload.v1";
    app_id: string;
    target_chain: "neo_n3";
    network: string;
    sender_hint?: string;
    recipient: string;
    asset: string;
    amount: string;
    memo?: string;
    note_secret: string;
    settlement: {
      mode: "confidential_compute_release";
      required_checks: string[];
    };
  };
};

function requireBrowserCrypto() {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle || typeof cryptoImpl.getRandomValues !== "function") {
    throw new Error("Web Crypto is required for Morpheus confidential encryption");
  }
  return cryptoImpl;
}

function decodeBase64ToBytes(value: string) {
  const binary = globalThis.atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodeBytesToBase64(bytesLike: ArrayBuffer | Uint8Array) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

function randomHex(byteLength: number) {
  const cryptoImpl = requireBrowserCrypto();
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(byteLength));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function sha256Hex(value: string) {
  const digest = await requireBrowserCrypto().subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function encryptTextWithOraclePublicKey(publicKeyBase64: string, plaintext: string) {
  const cryptoImpl = requireBrowserCrypto();
  const recipientPublicKeyBytes = decodeBase64ToBytes(publicKeyBase64);
  if (recipientPublicKeyBytes.length !== 32) {
    throw new Error("Morpheus oracle public key must be a 32-byte raw X25519 key");
  }

  const recipientPublicKey = await cryptoImpl.subtle.importKey(
    "raw",
    toArrayBuffer(recipientPublicKeyBytes),
    { name: "X25519" },
    false,
    [],
  );
  const ephemeralKeyPair = (await cryptoImpl.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const ephemeralPublicKeyBytes = new Uint8Array(
    await cryptoImpl.subtle.exportKey("raw", ephemeralKeyPair.publicKey),
  );
  const sharedSecret = new Uint8Array(
    await cryptoImpl.subtle.deriveBits(
      { name: "X25519", public: recipientPublicKey },
      ephemeralKeyPair.privateKey,
      256,
    ),
  );
  const keyMaterial = await cryptoImpl.subtle.importKey(
    "raw",
    toArrayBuffer(sharedSecret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  const info = new Uint8Array([
    ...new TextEncoder().encode(ENVELOPE_INFO),
    ...ephemeralPublicKeyBytes,
    ...recipientPublicKeyBytes,
  ]);
  const aesKey = await cryptoImpl.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(recipientPublicKeyBytes),
      info: toArrayBuffer(info),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = cryptoImpl.getRandomValues(new Uint8Array(12));
  const encryptedBytes = new Uint8Array(
    await cryptoImpl.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      new TextEncoder().encode(plaintext),
    ),
  );
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - AES_GCM_TAG_LENGTH_BYTES);
  const tag = encryptedBytes.slice(encryptedBytes.length - AES_GCM_TAG_LENGTH_BYTES);

  return encodeBytesToBase64(
    new TextEncoder().encode(
      JSON.stringify({
        v: ENVELOPE_VERSION,
        alg: ENVELOPE_ALGORITHM,
        epk: encodeBytesToBase64(ephemeralPublicKeyBytes),
        iv: encodeBytesToBase64(iv),
        ct: encodeBytesToBase64(ciphertext),
        tag: encodeBytesToBase64(tag),
      }),
    ),
  );
}

export async function encryptJsonWithOraclePublicKey(publicKeyBase64: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Morpheus confidential payload must be a JSON object");
  }
  return encryptTextWithOraclePublicKey(publicKeyBase64, JSON.stringify(payload));
}

export async function buildConfidentialTransferPackage(
  input: ConfidentialTransferInput,
): Promise<ConfidentialTransferPackage> {
  const network = String(input.network || "testnet").includes("mainnet") ? "mainnet" : "testnet";
  const asset = String(input.asset || "GAS").trim().toUpperCase();
  const amount = String(input.amount || "").trim();
  const recipient = String(input.recipient || "").trim();
  if (!recipient) throw new Error("recipient is required");
  if (!amount || Number(amount) <= 0) throw new Error("amount must be positive");

  const noteSecret = randomHex(32);
  const appId = String(input.appId || "miniapp-private-transfer").trim();
  const confidentialPayload: ConfidentialTransferPackage["confidentialPayload"] = {
    kind: "miniapp.private_transfer.payload.v1",
    app_id: appId,
    target_chain: "neo_n3",
    network,
    sender_hint: input.senderHint ? String(input.senderHint).trim() : undefined,
    recipient,
    asset,
    amount,
    memo: input.memo ? String(input.memo).trim().slice(0, 160) : undefined,
    note_secret: noteSecret,
    settlement: {
      mode: "confidential_compute_release",
      required_checks: [
        "asset_deposit_observed",
        "recipient_and_amount_decrypted_inside_tee",
        "nullifier_unused",
        "signed_settlement_intent_returned",
      ],
    },
  };
  const noteCommitment = await sha256Hex(JSON.stringify({
    app_id: appId,
    network,
    recipient,
    asset,
    amount,
    note_secret: noteSecret,
  }));
  const nullifierHash = await sha256Hex(`nullifier:${appId}:${network}:${noteSecret}`);

  return {
    publicEnvelope: {
      kind: "miniapp.private_transfer.intent.v1",
      app_id: appId,
      target_chain: "neo_n3",
      network,
      asset,
      note_commitment: noteCommitment,
      nullifier_hash: nullifierHash,
      privacy_model: "morpheus_confidential_compute",
    },
    confidentialPayload,
  };
}
