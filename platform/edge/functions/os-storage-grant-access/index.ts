import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-storage-grant-access", permission: "storage" },
  async ({ appId, params }) => {
    const readerAppId = String(params.readerAppId ?? "").trim();
    if (!readerAppId) throw new Error("readerAppId required");
    const keyPrefix = String(params.keyPrefix ?? "").trim();
    if (!keyPrefix) throw new Error("keyPrefix required");
    // Access grants are managed at the edge layer, not on-chain
    return { granted: true, appId, readerAppId, keyPrefix };
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
