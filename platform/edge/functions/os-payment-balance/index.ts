import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-payment-balance", permission: "payments", cacheable: true },
  async () => {
    return "0";
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
