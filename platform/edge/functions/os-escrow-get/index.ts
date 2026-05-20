import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

// Audit fix O-1: EscrowProxy.get() in apps/shared/services/os/EscrowProxy.ts
// was calling this endpoint, but the file didn't exist (404 in production).
// The implementation mirrors os-vesting-get for consistency: a cacheable
// safe-read against the OS kernel's GetEscrow operation.

export const handler = createOSHandler(
  { scopeName: "os-escrow-get", permission: "escrow", cacheable: true },
  async ({ appId, params }) => {
    const escrowId = String(params.escrow_id ?? params.escrowId ?? "").trim();
    if (!escrowId) throw new Error("escrow_id required");

    return invokeOSContractCached(getKernelHash(), "GetEscrow", [
      { type: "String", value: appId },
      { type: "String", value: escrowId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
