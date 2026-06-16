import { createOSHandler } from "../_shared/os-service.ts";
import { recordStorageGrant } from "../_shared/storage-grants.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-grant-access", permission: "storage" },
  async ({ appId, params }) => {
    const readerAppId = String(params.readerAppId ?? params.reader_app_id ?? "").trim();
    if (!readerAppId) throw new Error("readerAppId required");
    const keyPrefix = String(params.keyPrefix ?? params.key_prefix ?? "").trim();
    if (!keyPrefix) throw new Error("keyPrefix required");

    // Fail-closed: persist the grant before reporting success. The calling app
    // (appId) is the owner granting `readerAppId` read access to its shared
    // storage keys under `keyPrefix`. recordStorageGrant throws on validation
    // or DB failure, so we never return granted:true without a recorded grant.
    const grant = await recordStorageGrant(appId, readerAppId, keyPrefix);
    return { granted: true, appId, ...grant };
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
