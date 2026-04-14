import { buildKernelStateDelete } from "../_shared/kernel-rpc.ts";
import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-delete", permission: "storage" },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");
    return buildKernelStateDelete(appId, key);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
