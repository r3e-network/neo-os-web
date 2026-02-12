/**
 * Password Cache Service
 * Securely caches session password using Web Crypto API
 * Uses sessionStorage to ensure data is cleared when tab is closed
 * SECURITY: Uses AES-GCM encryption with a session-derived key
 */

import { logger } from "@/lib/logger";

const CACHE_KEY = "wallet_session_auth";
const SESSION_DURATION = 10 * 60 * 1000; // 10 minutes (reduced from 30 for security)

interface CachedAuth {
  encrypted: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded IV
  expiry: number;
}

// Generate a random encryption key for this session
async function getOrCreateSessionKey(): Promise<CryptoKey | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;

  try {
    // Check if we have a cached key in memory (not storage for security)
    const existingKey = (window as { __sessionCryptoKey?: CryptoKey }).__sessionCryptoKey;
    if (existingKey) return existingKey;

    // Generate a new key for this session
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // not extractable
      ["encrypt", "decrypt"],
    );

    // Store in memory only (not in storage)
    (window as { __sessionCryptoKey?: CryptoKey }).__sessionCryptoKey = key;
    return key;
  } catch {
    return null;
  }
}

async function encryptPassword(password: string): Promise<{ encrypted: string; iv: string } | null> {
  const key = await getOrCreateSessionKey();
  if (!key) return null;

  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
    };
  } catch {
    return null;
  }
}

async function decryptPassword(encrypted: string, iv: string): Promise<string | null> {
  const key = await getOrCreateSessionKey();
  if (!key) return null;

  try {
    const encryptedData = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const ivData = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: ivData }, key, encryptedData);

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    return null;
  }
}

export const PasswordCache = {
  /**
   * Save password to session storage with encryption
   */
  async set(password: string): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      const result = await encryptPassword(password);
      if (!result) {
        logger.warn("Encryption not available, password not cached");
        return;
      }

      const data: CachedAuth = {
        encrypted: result.encrypted,
        iv: result.iv,
        expiry: Date.now() + SESSION_DURATION,
      };

      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e: unknown) {
      logger.warn("Failed to cache password", e);
    }
  },

  /**
   * Retrieve valid cached password
   */
  async get(): Promise<string | null> {
    if (typeof window === "undefined") return null;

    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const data: CachedAuth = JSON.parse(raw);

      // Check for expiration
      if (Date.now() > data.expiry) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }

      return await decryptPassword(data.encrypted, data.iv);
    } catch (e: unknown) {
      logger.warn("Failed to retrieve cached password", e);
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
  },

  /**
   * Clear cached password and session key
   */
  clear(): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(CACHE_KEY);
    // Clear the in-memory key as well
    delete (window as { __sessionCryptoKey?: CryptoKey }).__sessionCryptoKey;
  },
};
