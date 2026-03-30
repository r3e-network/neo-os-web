import { getEnv } from "../_shared/env.ts";
import { createOSHandler, invokeOSContract } from "../_shared/os-service.ts";

const CONTRACT_HASH = getEnv("CONTRACT_PAYMENT_SERVICE_HASH") ?? "";

export const handler = createOSHandler(
  { scopeName: "os-payment-balance", permission: "payments" },
  async ({ appId, userId }) => {
    return invokeOSContract(CONTRACT_HASH, "GetBalance", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
