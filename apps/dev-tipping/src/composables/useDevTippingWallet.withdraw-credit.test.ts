import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDevTippingWallet } from "./useDevTippingWallet";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import type { DevTippingAttestation } from "../dev-tipping-rpc";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ALICE_HASH = addressToScriptHash(ALICE);

const t = (key: string) => key;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

function makeChain() {
  let creditReads = 0;
  // withdraw() settles on CreditWithdrawn(account, amount); amount is slot 1.
  const invoke = vi.fn(
    async (
      _op: string,
      _args: ContractArg[],
      options?: {
        waitForEvent?: string;
        scriptHash?: string;
        onTransactionSent?: (txid: string) => void;
      },
    ): Promise<TxResult> => {
      const txid = `0x${"a".repeat(64)}`;
      options?.onTransactionSent?.(txid);
      return {
        txid,
        success: true,
        verified: true,
        event: { state: [ALICE_HASH, "150000000"] },
      } as unknown as TxResult;
    },
  );
  const chain = {
    address: { get: () => ALICE },
    contractAddress: { get: () => "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec" },
    ensureWallet: vi.fn(async () => ALICE),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    invoke,
    read: vi.fn(async (operation: string) => {
      if (operation === "minTip") return "100000";
      if (operation === "totalDevelopers") return "2";
      if (operation === "creditOf") {
        creditReads += 1;
        return creditReads === 1 ? "150000000" : "0";
      }
      return "0";
    }),
  } as unknown as ChainService;
  return { chain, invoke };
}

describe("dev-tipping — withdrawCredit reclaims stranded tip credit", () => {
  it("calls withdraw(walletHash), verifies CreditWithdrawn, and returns a confirmed outcome", async () => {
    const { chain, invoke } = makeChain();
    const app = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-dev-tipping" },
    );
    const wallet = useDevTippingWallet({
      app,
      t,
      launchNetwork: "testnet",
      attestContract: vi.fn(async (): Promise<DevTippingAttestation> => ({
        compatible: true,
        network: "testnet",
        contract: "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec",
        checksum: 2_483_335_541,
        updateCounter: 0,
        reason: "ok",
      })),
    });

    const outcome = await wallet.withdrawCredit();

    const call = invoke.mock.calls.find((c) => c[0] === "withdraw");
    expect(call, "withdraw invoked").toBeTruthy();
    expect(call![1]).toEqual([{ type: "Hash160", value: ALICE_HASH }]);
    expect(call![2]).toMatchObject({ waitForEvent: "CreditWithdrawn" });
    expect(outcome).toBe("confirmed");
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
