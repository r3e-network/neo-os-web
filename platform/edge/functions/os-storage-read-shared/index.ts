import { buildKernelStateRead } from "../_shared/kernel-rpc.ts";
import { createOSHandler } from "../_shared/os-service.ts";
import { hasStorageGrant } from "../_shared/storage-grants.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-read-shared", permission: "storage", cacheable: true, cacheTtl: 10 },
  async ({ appId, params }) => {
    const ownerAppId = String(params.ownerAppId ?? params.owner_app_id ?? "").trim();
    if (!ownerAppId) throw new Error("owner_app_id required");
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");

    // Enforce the shared-storage grant model. The calling app (appId) is the
    // reader; it may only read ownerAppId's state when ownerAppId has recorded
    // a grant (owner_app_id=ownerAppId, reader_app_id=appId) whose key_prefix
    // covers `key`. An app reading its own state is always allowed.
    // hasStorageGrant throws on DB failure → fail-closed (treated as deny).
    if (appId !== ownerAppId) {
      const allowed = await hasStorageGrant(ownerAppId, appId, key);
      if (!allowed) {
        throw new Error(`app "${appId}" has no shared-storage grant from "${ownerAppId}" for this key`);
      }
    }

    return buildKernelStateRead(ownerAppId, key);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
