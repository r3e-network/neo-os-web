import { normalizeUInt160 } from "../_shared/contracts.ts";
import { getEnv } from "../_shared/env.ts";
import { parseDecimalToInt } from "../_shared/amount.ts";
import { createOSHandler } from "../_shared/os-service.ts";

// Neo N3 Testnet GAS contract hash (native contract)
const NEO_TESTNET_GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

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

    const gasContractHash = normalizeUInt160(getEnv("CONTRACT_GAS_HASH") ?? NEO_TESTNET_GAS_HASH);
    const paymentServiceHash = normalizeUInt160(
      getEnv("CONTRACT_PAYMENT_SERVICE_HASH") ?? "",
    );
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
