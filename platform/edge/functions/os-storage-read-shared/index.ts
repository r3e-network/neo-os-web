import { buildKernelStateRead } from "../_shared/kernel-rpc.ts";
import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-read-shared", permission: "storage", cacheable: true, cacheTtl: 10 },
  async ({ params }) => {
    const ownerAppId = String(params.ownerAppId ?? params.owner_app_id ?? "").trim();
    if (!ownerAppId) throw new Error("owner_app_id required");
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");
    return buildKernelStateRead(ownerAppId, key);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
