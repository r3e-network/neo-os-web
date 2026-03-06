type SupabaseAuthHeaders = {
  apikey: string;
  Authorization: string;
};

type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  authHeaders: SupabaseAuthHeaders | null;
};

function trimEnv(value: string | undefined): string {
  return String(value || "").trim();
}

export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  return {
    url: trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function getSupabaseEnv(): SupabaseEnv {
  const publicEnv = getPublicSupabaseEnv();
  const url = publicEnv.url || trimEnv(process.env.SUPABASE_URL);
  const serviceRoleKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const authToken = serviceRoleKey || publicEnv.anonKey;

  return {
    url,
    anonKey: publicEnv.anonKey,
    serviceRoleKey,
    authHeaders: authToken
      ? {
          apikey: authToken,
          Authorization: `Bearer ${authToken}`,
        }
      : null,
  };
}
