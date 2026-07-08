import { describe, expect, it, vi } from "vitest";

import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { createMiniAppFramework } from "@shared/react";

// Shared mutable handle so each test can drive the SDK's eligibility result and
// error independently (the composable reads gasSponsorSDK.eligibilityError).
const sdkState = {
  eligibilityError: { value: "" as string },
  sponsorshipError: { value: "" as string },
  eligibility: {
    gas_balance: "0",
    used_today: "0",
    daily_limit: "0.1",
    resets_at: "",
  },
};

// The composable pulls eligibility/request plumbing from the wallet SDK at
// construction; stub it so the donate/send transfer paths run standalone.
vi.mock("@shared/utils/wallet-sdk", () => ({
  useGasSponsor: () => ({
    isRequestingSponsorship: { value: false },
    eligibilityError: sdkState.eligibilityError,
    sponsorshipError: sdkState.sponsorshipError,
    checkEligibility: vi.fn(async () => sdkState.eligibility),
    requestSponsorship: vi.fn(async () => ({ success: true })),
  }),
}));

// import.meta.env.VITE_PLATFORM_API is undefined under vitest, so the composable
// treats the sponsorship API as unconfigured. The donate/send tests below seed
// the chain-read balance directly, which is exactly the path that must keep
// working when the API is down.
import { useGasSponsorApp } from "../../gas-sponsor/src/composables/useGasSponsor";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";

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

/**
 * Wrap a mock chain (+ balance service) in the MiniApp framework SDK the
 * composable now consumes. The framework's chain layer is a
 * behavior-preserving passthrough (ensureWallet/address/invoke forward
 * straight to the underlying chain), so the recorded invoke calls and their
 * arg shapes are unchanged; app.wallet.balance("GAS", address) delegates to
 * the injected balance service exactly as the retired direct
 * BalanceService.getGasBalance call did.
 */
function makeApp(chain: ChainService, gas = 0) {
  return createMiniAppFramework(
    { services: { chain, balance: makeBalance(gas) }, t } as never,
    { appId: "miniapp-gas-sponsor" },
  );
}

/** BalanceService stand-in returning a fixed chain GAS balance. */
function makeBalance(gas: number) {
  return {
    getBalance: vi.fn(async () => gas),
  };
}

describe("gas-sponsor base-unit scaling", () => {
  it("rejects over-precision donate amounts before touching the wallet", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({ app: makeApp(chain, 10), t });

    app.chainGasBalance.set(10);
    app.donateAmount.set("4.000000005");

    await expect(app.handleDonate()).rejects.toThrow("invalidAmount");

    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("preserves precision float math loses on large send amounts", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({ app: makeApp(chain, 2_000_000_000), t });

    app.chainGasBalance.set(2_000_000_000);
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

describe("gas-sponsor honest service state + chain-read gate", () => {
  it("marks the sponsorship service unavailable when the platform API is unconfigured", async () => {
    sdkState.eligibilityError.value = "";
    sdkState.eligibility = { gas_balance: "0", used_today: "0", daily_limit: "0.1", resets_at: "" };
    const chain = makeChain();
    const app = useGasSponsorApp({ app: makeApp(chain, 5), t });

    await app.loadUserData();

    expect(app.serviceAvailable.get()).toBe(false);
    expect(app.serviceNotice.get()).toBe("sponsorServiceUnconfigured");
    // Eligibility is NOT presented as a fabricated "eligible" when unknown.
    expect(app.isEligible.get()).toBe(false);
    expect(app.eligibleDisplay.get()).toBe("notAvailable");
    expect(app.gasBalanceDisplay.get()).toBe("notAvailable");
  });

  it("gates donate/send on the real chain balance, not the API balance", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({ app: makeApp(chain, 3), t });

    // API is down (zeros), but the wallet really holds 3 GAS on-chain.
    await app.loadUserData();

    expect(app.chainGasBalance.get()).toBe(3);
    expect(app.isFunded.get()).toBe(true);

    app.donateAmount.set("1");
    expect(app.donateAmountValid.get()).toBe(true);
    app.donateAmount.set("9"); // exceeds chain balance
    expect(app.donateAmountValid.get()).toBe(false);
  });

  it("refuses sponsorship requests while the service is unavailable", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({ app: makeApp(chain, 0), t });

    await app.loadUserData();
    await expect(app.requestSponsorship()).rejects.toThrow("sponsorServiceUnavailable");
  });

  it("routes donations to the testnet pool when launched on testnet", async () => {
    const chain = makeChain();
    const app = useGasSponsorApp({
      app: makeApp(chain, 5),
      t,
      network: "testnet",
    });

    app.chainGasBalance.set(5);
    app.donateAmount.set("1");
    await app.handleDonate();

    const [, args] = chain.invoke.mock.calls[0];
    // Per-network pool destination (testnet entry).
    expect(args[1]).toEqual({ type: "Hash160", value: "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK" });
  });
});
