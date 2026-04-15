import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

const CONTRACT_HASH = getKernelHash();

export const handler = createOSHandler(
  { scopeName: "os-escrow-refund", permission: "escrow" },
  async ({ appId, userId, params }) => {
    const escrowId = String(params.escrow_id ?? params.escrowId ?? "").trim();
    if (!escrowId) throw new Error("escrow_id required");

    return buildInvocationIntent(CONTRACT_HASH, "Refund", [
      { type: "String", value: appId },
      { type: "String", value: escrowId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
