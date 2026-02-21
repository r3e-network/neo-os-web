/**
 * Supabase Client Singleton
 *
 * Client-side Supabase instance for browser environment.
 * Uses anonymous key for public read access and realtime subscriptions.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured && typeof window !== "undefined") {
  logger.warn("Supabase environment variables not configured. Realtime features will be disabled.");
}

// Build-time fallback URL (never used for actual requests when isConfigured is false)
const BUILD_FALLBACK_URL = "https://localhost.supabase.co";
const BUILD_FALLBACK_KEY = "build-time-placeholder";

/**
 * Singleton Supabase client instance
 * Configured for realtime subscriptions and public data access
 * Note: When not configured, client is created with fallback values but
 * consumers should check isSupabaseConfigured before making requests.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || BUILD_FALLBACK_URL,
  supabaseAnonKey || BUILD_FALLBACK_KEY,
  {
    auth: {
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);

/** Whether Supabase is properly configured */
export const isSupabaseConfigured = isConfigured;
