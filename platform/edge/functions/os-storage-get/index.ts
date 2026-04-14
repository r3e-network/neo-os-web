import { buildKernelStateRead } from "../_shared/kernel-rpc.ts";
import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-get", permission: "storage", method: "POST", cacheable: true, cacheTtl: 5 },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");
    return buildKernelStateRead(appId, key);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
