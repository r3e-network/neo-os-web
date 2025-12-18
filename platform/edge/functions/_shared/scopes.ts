import type { AuthContext } from "./supabase.ts";
import { error } from "./response.ts";

// API key scopes are optional (backward compatible). If a key has no scopes,
// it is treated as "full access" within the authenticated user context.
//
// If scopes are provided, endpoints should call `requireScope(...)` with the
// Edge function name (e.g. "pay-gas") to enforce least privilege.

export function requireScopes(req: Request, auth: AuthContext, requiredScopes: string[]): Response | null {
  if (auth.authType !== "api_key") return null;

  const scopes = Array.isArray(auth.scopes) ? auth.scopes : [];
  if (scopes.length === 0) return null; // default: allow all (legacy keys)
  if (scopes.includes("*")) return null;

  const missing = requiredScopes.filter((scope) => !scopes.includes(scope));
  if (missing.length === 0) return null;

  return error(403, `api key missing required scope(s): ${missing.join(", ")}`, "SCOPE_REQUIRED", req);
}

export function requireScope(req: Request, auth: AuthContext, requiredScope: string): Response | null {
  return requireScopes(req, auth, [requiredScope]);
}
