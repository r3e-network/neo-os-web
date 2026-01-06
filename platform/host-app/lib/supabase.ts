/**
 * Supabase Client Singleton
 *
 * Client-side Supabase instance for browser environment.
 * Uses anonymous key for public read access and realtime subscriptions.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are required. " +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

/**
 * Singleton Supabase client instance
 * Configured for realtime subscriptions and public data access
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/** Whether Supabase is properly configured (always true since config is required) */
export const isSupabaseConfigured = true;

/**
 * Service Role Client for server-side write operations
 * Only use in API routes, never expose to client
 */
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : null;
