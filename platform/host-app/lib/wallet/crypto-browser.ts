/**
 * Browser-compatible cryptographic utilities using Web Crypto API
 */

export interface BrowserEncryptionResult {
  encryptedData: string;
  salt: string;
  iv: string;
  tag: string;
  iterations: number;
}

/**
 * Encrypt private key in browser using Web Crypto API
 * Private key never leaves the browser unencrypted
 */
export async function encryptPrivateKeyBrowser(
  privateKey: string,
  password: string,
  iterations = 100000,
): Promise<BrowserEncryptionResult> {
  const enc = new TextEncoder();

  // Generate random salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(32));
  const iv = window.crypto.getRandomValues(new Uint8Array(16));

  // Import password as key material
  const passwordKey = await window.crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);

  // Derive encryption key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  // Encrypt the private key
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(privateKey));

  // Extract ciphertext and tag (last 16 bytes)
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16);
  const tag = encryptedArray.slice(-16);

  return {
    encryptedData: btoa(String.fromCharCode(...ciphertext)),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tag)),
    iterations,
  };
}

export async function decryptPrivateKeyBrowser(
  encryptedData: string,
  password: string,
  salt: string,
  iv: string,
  tag: string,
  iterations: number,
): Promise<string> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)),
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  // Web Crypto AES-GCM expects the tag to be appended to the ciphertext
  const ciphertext = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  const tagBytes = Uint8Array.from(atob(tag), (c) => c.charCodeAt(0));

  const dataToDecrypt = new Uint8Array(ciphertext.length + tagBytes.length);
  dataToDecrypt.set(ciphertext);
  dataToDecrypt.set(tagBytes, ciphertext.length);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)),
    },
    key,
    dataToDecrypt,
  );

  return new TextDecoder().decode(decrypted);
}
