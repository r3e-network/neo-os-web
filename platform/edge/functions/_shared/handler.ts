/**
 * Edge Function Handler Factory
 *
 * Eliminates boilerplate by chaining: CORS preflight -> method check -> auth ->
 * rate limit -> scope -> wallet -> ensureUser -> try/catch -> business logic.
 */

import { handleCorsPreflight } from "./cors.ts";
import { errorResponse } from "./error-codes.ts";
import { requireRateLimit } from "./ratelimit.ts";
import { requireScope, requireHostScope } from "./scopes.ts";
import { requireAuth, requireUser, requirePrimaryWallet, ensureUserRow, type AuthContext } from "./supabase.ts";

export interface HandlerConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** "user" = requireAuth (bearer or api_key), "user_only" = requireUser (bearer only), false = public. Default: "user" */
  auth?: "user" | "user_only" | false;
  rateLimit?: string;
  scope?: string;
  hostScope?: string;
  requireWallet?: boolean;
  ensureUser?: boolean;
}

export interface HandlerContext {
  req: Request;
  url: URL;
  auth: AuthContext;
  wallet: { address: string };
}

/** Overload: auth=false yields no auth/wallet on context */
export function createHandler(
  config: HandlerConfig & { auth: false },
  fn: (ctx: { req: Request; url: URL }) => Promise<Response>
): (req: Request) => Promise<Response>;
export function createHandler(
  config: HandlerConfig,
  fn: (ctx: HandlerContext) => Promise<Response>
): (req: Request) => Promise<Response>;
export function createHandler(
  config: HandlerConfig,
  // deno-lint-ignore no-explicit-any
  fn: (ctx: any) => Promise<Response>
): (req: Request) => Promise<Response> {
  const method = config.method;
  const authMode = config.auth ?? "user";

  return async (req: Request): Promise<Response> => {
    // 1. CORS preflight
    const preflight = handleCorsPreflight(req);
    if (preflight) return preflight;

    // 2. Method check
    if (req.method !== method) return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

    // 3. Auth
    let auth: AuthContext | undefined;
    if (authMode === "user") {
      const result = await requireAuth(req);
      if (result instanceof Response) return result;
      auth = result;
    } else if (authMode === "user_only") {
      const result = await requireUser(req);
      if (result instanceof Response) return result;
      auth = result;
    }

    // 4. Rate limit
    if (config.rateLimit) {
      const rl = await requireRateLimit(req, config.rateLimit, auth);
      if (rl) return rl;
    }

    // 5. Scope
    if (config.scope && auth) {
      const scopeCheck = requireScope(req, auth, config.scope);
      if (scopeCheck) return scopeCheck;
    }
    if (config.hostScope && auth) {
      const scopeCheck = requireHostScope(req, auth, config.hostScope);
      if (scopeCheck) return scopeCheck;
    }

    // 6. Wallet
    let wallet: { address: string } | undefined;
    if (config.requireWallet && auth) {
      const walletCheck = await requirePrimaryWallet(auth.userId, req);
      if (walletCheck instanceof Response) return walletCheck;
      wallet = walletCheck;
    }

    // 7. Ensure user row
    if (config.ensureUser && auth) {
      const ensured = await ensureUserRow(auth, {}, req);
      if (ensured instanceof Response) return ensured;
    }

    // 8. Execute business logic with try/catch
    try {
      if (authMode === false) {
        return await fn({ req, url: new URL(req.url) });
      }
      return await fn({
        req,
        url: new URL(req.url),
        auth: auth!,
        wallet: wallet ?? { address: "" },
      });
    } catch (err) {
      console.error("Handler error:", err);
      return errorResponse("SERVER_001", { message: (err as Error).message }, req);
    }
  };
}
