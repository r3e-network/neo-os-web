/**
 * Cryptographic utilities for encrypting/decrypting private keys
 * Uses PBKDF2 for key derivation and AES-GCM for encryption
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const _TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export interface EncryptionResult {
  encryptedData: string;
  salt: string;
  iv: string;
  tag: string;
  iterations: number;
}

export interface KeyDerivationParams {
  iterations: number;
  keyLength: number;
  digest: string;
}

/**
 * Encrypt private key with password
 */
export function encryptPrivateKey(privateKey: string, password: string): EncryptionResult {
  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const iterations = 100000;

  // Derive encryption key from password
  const key = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, "sha256");

  // Encrypt private key
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    iterations,
  };
}

/**
 * Decrypt private key with password
 */
export function decryptPrivateKey(
  encryptedData: string,
  password: string,
  salt: string,
  iv: string,
  tag: string,
  iterations: number,
): string {
  // Derive decryption key from password
  const saltBuffer = Buffer.from(salt, "base64");
  const key = pbkdf2Sync(password, saltBuffer, iterations, KEY_LENGTH, "sha256");

  // Decrypt private key
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData, "base64")), decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain special character");
  }

  return { valid: errors.length === 0, errors };
}
