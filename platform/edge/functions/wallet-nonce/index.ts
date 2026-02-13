// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json, error } from "../_shared/response.ts";
import { ensureUserRow } from "../_shared/supabase.ts";

// Nonce expires after 5 minutes (300 seconds)
const NONCE_TTL_SECONDS = 300;
// Maximum retry attempts for nonce generation
const MAX_NONCE_RETRIES = 3;

// Returns a nonce + canonical message for Neo N3 wallet signature binding.
// The nonce includes a timestamp for expiration validation.
export const handler = createHandler(
  { method: "POST", auth: "user_only", rateLimit: "wallet-nonce" },
  async ({ req, auth }) => {
    // Retry logic for nonce generation with proper error handling
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_NONCE_RETRIES; attempt++) {
      try {
        const nonce = crypto.randomUUID();
        const timestamp = Math.floor(Date.now() / 1000);
        const expiresAt = timestamp + NONCE_TTL_SECONDS;
        const message = `Sign this message to bind your Neo N3 wallet to your account.\n\nUser: ${auth.userId}\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

        // Store nonce with creation timestamp for expiration validation
        const ensured = await ensureUserRow(
          auth,
          {
            nonce,
            nonce_created_at: new Date().toISOString(),
          },
          req
        );

        if (ensured instanceof Response) {
          // If it's a conflict error, retry with a new nonce
          if (ensured.status === 409) {
            lastError = new Error("Nonce conflict, retrying...");
            continue;
          }
          return ensured;
        }

        return json({ nonce, message, expires_at: expiresAt, ttl_seconds: NONCE_TTL_SECONDS }, {}, req);
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.error(`Nonce generation attempt ${attempt + 1} failed:`, lastError.message);
        // Brief delay before retry
        if (attempt < MAX_NONCE_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }

    // All retries exhausted
    console.error("Nonce generation failed after all retries:", lastError?.message);
    return error(500, "Failed to generate nonce. Please try again.", "NONCE_GENERATION_FAILED", req);
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
