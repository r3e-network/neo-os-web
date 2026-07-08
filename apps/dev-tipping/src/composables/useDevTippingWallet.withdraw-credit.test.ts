import { describe, expect, it, vi } from "vitest";

import { useDevTippingWallet } from "./useDevTippingWallet";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ALICE_HASH = addressToScriptHash(ALICE);

const t = (key: string) => key;

function makeChain() {
  // withdraw() settles on CreditWithdrawn(account, amount); amount is slot 1.
  const invoke = vi.fn(
    async (
      _op: string,
      _args: ContractArg[],
      _options?: { waitForEvent?: string; scriptHash?: string },
    ): Promise<TxResult> => ({
      txid: "0xtx",
      success: true,
      event: { state: [ALICE_HASH, "150000000"] },
    } as unknown as TxResult),
  );
  const chain = {
    address: { get: () => ALICE },
    contractAddress: { get: () => "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec" },
    ensureWallet: vi.fn(async () => ALICE),
    invoke,
    read: vi.fn(async () => "0"),
  } as unknown as ChainService;
  return { chain, invoke };
}

describe("dev-tipping — withdrawCredit reclaims stranded tip credit", () => {
  it("calls withdraw(walletHash) waiting for CreditWithdrawn and returns the human amount", async () => {
    const { chain, invoke } = makeChain();
    const app = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dev-tipping" },
    );
    const wallet = useDevTippingWallet({ app, t });

    const amount = await wallet.withdrawCredit();

    const call = invoke.mock.calls.find((c) => c[0] === "withdraw");
    expect(call, "withdraw invoked").toBeTruthy();
    expect(call![1]).toEqual([{ type: "Hash160", value: ALICE_HASH }]);
    expect(call![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
    // 150000000 base units (slot 1) => 1.5 GAS.
    expect(amount).toBeCloseTo(1.5, 8);
  });
});

describe("dev-tipping — registry wallet comparison matches hash vs address", () => {
  it("recognizes a contract Hash160 wallet as the connected base58 address", () => {
    // getDeveloper returns wallet as a Hash160 (LE 0x hex) — the previous
    // `dev.wallet === addr` compared that to a base58 address and never matched.
    const devWalletHash = addressToScriptHash(ALICE); // chain (LE) form
    expect(ownerMatchesAddress(devWalletHash, ALICE)).toBe(true);
    // A different wallet must NOT match.
    const other = addressToScriptHash("NUuJw4C4XJFzxAvSZnFTfsNoWZytmQKXQP");
    expect(ownerMatchesAddress(other, ALICE)).toBe(false);
  });
});
