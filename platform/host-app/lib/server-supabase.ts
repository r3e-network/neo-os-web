import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./supabase-env";

const BUILD_FALLBACK_URL = "https://localhost.supabase.co";
const BUILD_FALLBACK_KEY = "build-time-placeholder";

let cachedAnonClient: SupabaseClient | null = null;
let cachedServiceClient: SupabaseClient | null = null;

function buildClient(key: string): SupabaseClient {
  const { url } = getSupabaseEnv();
  const resolvedURL = url || BUILD_FALLBACK_URL;
  const token = key || BUILD_FALLBACK_KEY;
  return createClient(resolvedURL, token, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function isServerSupabaseConfigured(): boolean {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  return Boolean(url && (serviceRoleKey || anonKey));
}

export function hasServiceRoleSupabase(): boolean {
  const { url, serviceRoleKey } = getSupabaseEnv();
  return Boolean(url && serviceRoleKey);
}

export function getServerSupabaseClient(options: { requireServiceRole?: boolean } = {}): SupabaseClient | null {
  if (!isServerSupabaseConfigured()) {
    return null;
  }

  const requireServiceRole = Boolean(options.requireServiceRole);
  const { anonKey, serviceRoleKey } = getSupabaseEnv();

  if (requireServiceRole) {
    if (!serviceRoleKey) return null;
    if (!cachedServiceClient) cachedServiceClient = buildClient(serviceRoleKey);
    return cachedServiceClient;
  }

  if (anonKey) {
    if (!cachedAnonClient) cachedAnonClient = buildClient(anonKey);
    return cachedAnonClient;
  }

  if (serviceRoleKey) {
    if (!cachedServiceClient) cachedServiceClient = buildClient(serviceRoleKey);
    return cachedServiceClient;
  }

  return null;
}
