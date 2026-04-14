import { buildKernelStateWrite } from "../_shared/kernel-rpc.ts";
import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-set", permission: "storage" },
  async ({ appId, params }) => {
    const key = String(params.key ?? "").trim();
    if (!key) throw new Error("key required");
    const value = params.value;
    if (value === undefined || value === null) throw new Error("value required");
    return buildKernelStateWrite(appId, key, JSON.stringify(value));
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
