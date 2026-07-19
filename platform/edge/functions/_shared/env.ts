export function getEnv(name: string): string | undefined {
  const raw = Deno.env.get(name);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function mustGetEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`missing required env var: ${name}`);
  return value;
}

export function isProductionEnv(): boolean {
  const candidates = [
    getEnv("EDGE_ENV"),
    getEnv("DENO_ENV"),
    getEnv("ENV"),
    getEnv("NODE_ENV"),
    getEnv("SUPABASE_ENV"),
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  // Fail closed (audit): production is the default. An unset or
  // unrecognized indicator is treated as production — non-production
  // (which relaxes host-only scope checks, the manifest permission gate,
  // usage caps, and ratelimit fail-open) must be declared explicitly.
  const nonProductionMarkers = ["dev", "development", "local", "test"];
  return !candidates.some((v) => nonProductionMarkers.includes(v));
}
