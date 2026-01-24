import { getEnv } from "../_shared/env.ts";
import { isInternalRepoUrl } from "../_shared/git-whitelist.ts";

export function isAutoApprovedInternalRepo(gitUrl: string): boolean {
  return isInternalRepoUrl(gitUrl);
}

export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return false;
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SUPABASE_SERVICE_KEY");
  if (!serviceKey) return false;
  return token === serviceKey;
}
