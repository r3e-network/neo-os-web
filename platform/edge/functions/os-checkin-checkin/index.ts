import { getKernelHash } from "../_shared/kernel-rpc.ts";
import { buildInvocationIntent, createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-checkin-checkin", permission: "checkin" },
  async ({ appId, userId }) => {
    return buildInvocationIntent(getKernelHash(), "CheckIn", [
      { type: "String", value: appId },
      { type: "Hash160", value: userId },
    ]);
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
