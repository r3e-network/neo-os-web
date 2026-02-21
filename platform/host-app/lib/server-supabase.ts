// TODO: generate typed Database with `supabase gen types typescript` and import here.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUILD_FALLBACK_URL = "https://localhost.supabase.co";
const BUILD_FALLBACK_KEY = "build-time-placeholder";

function getSupabaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
}

function getAnonKey(): string {
  return String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

function getServiceRoleKey(): string {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

let cachedAnonClient: SupabaseClient | null = null;
let cachedServiceClient: SupabaseClient | null = null;

function buildClient(key: string): SupabaseClient {
  const url = getSupabaseUrl() || BUILD_FALLBACK_URL;
  const token = key || BUILD_FALLBACK_KEY;
  return createClient(url, token, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function isServerSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  return Boolean(url && (getServiceRoleKey() || getAnonKey()));
}

export function hasServiceRoleSupabase(): boolean {
  return Boolean(getSupabaseUrl() && getServiceRoleKey());
}

export function getServerSupabaseClient(options: { requireServiceRole?: boolean } = {}): SupabaseClient | null {
  if (!isServerSupabaseConfigured()) {
    return null;
  }

  const requireServiceRole = Boolean(options.requireServiceRole);
  const serviceRoleKey = getServiceRoleKey();

  if (requireServiceRole) {
    if (!serviceRoleKey) return null;
    if (!cachedServiceClient) cachedServiceClient = buildClient(serviceRoleKey);
    return cachedServiceClient;
  }

  // Prefer anon key (respects RLS) when service role is not required.
  const anonKey = getAnonKey();
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

