import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { createOSHandler, invokeOSContractCached } from "../_shared/os-service.ts";

// Audit fix E-7: previously this endpoint returned the constant "0" which is
// indistinguishable from a real zero balance. Now it routes to the kernel's
// `GetPaymentBalance(appId, user)` read so the value reflects on-chain state.
// If the kernel hash isn't configured the handler throws — callers can detect
// the misconfiguration instead of silently treating every user as zero-balance.

export const handler = createOSHandler(
  { scopeName: "os-payment-balance", permission: "payments", cacheable: true },
  async ({ appId, userId }) => {
    const contractHash = getKernelHash();
    if (!contractHash) {
      throw new Error("payment service contract hash not configured");
    }
    const result = await invokeOSContractCached(contractHash, "GetPaymentBalance", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
    // Normalize to a decimal-string regardless of the underlying type so the
    // proxy can render it without further parsing.
    if (typeof result === "string") return result;
    if (typeof result === "number" || typeof result === "bigint") {
      return String(result);
    }
    if (result && typeof result === "object" && "value" in (result as Record<string, unknown>)) {
      return String((result as Record<string, unknown>).value);
    }
    return "0";
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
