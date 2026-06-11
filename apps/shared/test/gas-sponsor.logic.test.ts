import { describe, expect, it, vi } from "vitest";

import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { EventBus } from "../services/EventBus";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

// The composable pulls eligibility/request plumbing from the wallet SDK at
// construction; stub it so the donate/send transfer paths run standalone.
vi.mock("@shared/utils/wallet-sdk", () => ({
  useGasSponsor: () => ({
    isRequestingSponsorship: { value: false },
    sponsorshipError: { value: "" },
    checkEligibility: vi.fn(async () => ({
      eligible: false,
      gas_balance: "0",
      used_today: "0",
      daily_limit: "0.1",
      resets_at: "",
    })),
    requestSponsorship: vi.fn(async () => ({ success: true })),
  }),
}));

import { useGasSponsorApp } from "../../gas-sponsor/src/composables/useGasSponsor";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;

function t(key: string) {
  return key;
}

/** Minimal ChainService stand-in recording GAS transfer invocations. */
function makeChain() {
  const invoke = vi.fn(
    async (_op: string, _args: ContractArg[], _options?: unknown): Promise<TxResult> => ({
      txid: "0xtx",
      success: true,
    }),
  );

  const chain = {
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
  } as unknown as ChainService & { invoke: typeof invoke };

  return chain;
}

describe("gas-sponsor base-unit scaling", () => {
  it("converts donate amounts with the shared float-free toFixed8 (truncates beyond 8 decimals)", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({ chain, eventBus: new EventBus(), t });

    app.gasBalance.set("10");
    // 9 decimal places: float math (parseFloat * 1e8 + round) yields
    // 400000001 — MORE base units than the user typed. The shared
    // string-parsing toFixed8 truncates to exactly 8 decimals.
    app.donateAmount.set("4.000000005");
    await app.handleDonate();

    const [op, args, options] = chain.invoke.mock.calls[0];
    expect(op).toBe("transfer");
    expect(options).toEqual({ scriptHash: GAS_HASH });
    expect(args[2]).toEqual({ type: "Integer", value: "400000000" });
  });

  it("preserves precision float math loses on large send amounts", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({ chain, eventBus: new EventBus(), t });

    app.gasBalance.set("2000000000");
    app.recipientAddress.set(ALICE);
    // 1e9 GAS + 1 base unit is not representable as a double: the float
    // path silently drops the final base unit.
    app.sendAmount.set("1000000000.00000001");
    await app.handleSend();

    const [op, args] = chain.invoke.mock.calls[0];
    expect(op).toBe("transfer");
    expect(args[1]).toEqual({ type: "Hash160", value: ALICE });
    expect(args[2]).toEqual({ type: "Integer", value: "100000000000000001" });
  });
});
