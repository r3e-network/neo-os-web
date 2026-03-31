import { normalizeUInt160 } from "../_shared/contracts.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { NATIVE_CONTRACTS, OS_CONTRACTS } from "../_shared/os-contracts.ts";
import { createOSHandler } from "../_shared/os-service.ts";

export const handler = createOSHandler(
  { scopeName: "os-payment-deposit", permission: "payments" },
  async ({ appId, params }) => {
    let amount: bigint;
    try {
      amount = parseDecimalToInt(String(params.amount ?? ""), 8);
    } catch {
      throw new Error("invalid amount");
    }
    if (amount <= 0n) throw new Error("amount must be > 0");

    const gasContractHash = normalizeUInt160(NATIVE_CONTRACTS.gas);
    const paymentServiceHash = normalizeUInt160(OS_CONTRACTS.payment);
    if (!paymentServiceHash) throw new Error("payment service contract not configured");

    const memo = String(params.memo ?? "").trim() || appId;

    // Return a GAS.Transfer intent: wallet signs transfer of GAS to PaymentService
    // with appId encoded in the data field for OnNEP17Payment routing.
    return {
      intent: "deposit",
      invocation: {
        contract_hash: gasContractHash,
        method: "transfer",
        params: [
          { type: "Hash160", value: "SENDER" },
          { type: "Hash160", value: paymentServiceHash },
          { type: "Integer", value: amount.toString() },
          { type: "String", value: memo },
        ],
      },
    };
  },
);

if (import.meta.main) {
  Deno.serve(handler);
}
