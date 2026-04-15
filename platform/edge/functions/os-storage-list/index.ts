import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-list", permission: "storage", cacheable: true },
  async ({ appId, params }) => {
    const prefix = String(params.prefix ?? "").trim();
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
    return {
      contract: getKernelHash(),
      operation: "GetMiniAppState",
      args: [
        { type: "String", value: appId },
        { type: "ByteArray", value: Array.from(new TextEncoder().encode(prefix)).map(b => b.toString(16).padStart(2, "0")).join("") },
      ],
      meta: { list: true, limit },
    };
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
