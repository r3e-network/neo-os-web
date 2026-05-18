/**
 * Supabase Client Singleton
 *
 * Client-side Supabase instance for browser environment.
 * Uses anonymous key for public read access and realtime subscriptions.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";
import { getPublicSupabaseEnv } from "./supabase-env";

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getPublicSupabaseEnv();
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const shouldWarnMissingConfig =
  process.env.NEXT_PUBLIC_SUPABASE_WARN_MISSING === "true";

if (!isConfigured && shouldWarnMissingConfig && typeof window !== "undefined") {
  logger.warn("Supabase environment variables not configured. Realtime features will be disabled.");
}

function createUnavailableSupabaseClient(): SupabaseClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error("Supabase is not configured. Check isSupabaseConfigured before use.");
      },
    },
  ) as SupabaseClient;
}

/**
 * Singleton Supabase client instance
 * Configured for realtime subscriptions and public data access
 * Consumers should check isSupabaseConfigured before making requests.
 */
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createUnavailableSupabaseClient();

/** Whether Supabase is properly configured */
export const isSupabaseConfigured = isConfigured;
