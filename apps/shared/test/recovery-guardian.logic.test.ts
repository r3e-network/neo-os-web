import { describe, expect, it, vi } from "vitest";

import {
  accountIdArg,
  normalizeHash160Input,
  readRecoveryGuardianState,
  requestRecoveryTicket,
} from "../../recovery-guardian/src/recoveryChain";

const OWNER = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
const ACCOUNT_ID = "0x1111111111111111111111111111111111111111";
const CONTRACT = "0x198b3a9cec9bccc2110d19bd929b10374a9d034d";

function createChain() {
  return {
    ensureWallet: vi.fn().mockResolvedValue(OWNER),
    invoke: vi.fn().mockResolvedValue({
      txid: "0xrecoverytx",
      success: true,
    }),
    read: vi.fn(async (method: string) => {
      const values: Record<string, unknown> = {
        getOwner: "0x2222222222222222222222222222222222222222",
        getAccountAddress: "0x3333333333333333333333333333333333333333",
        getAAContract: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
        getMorpheusOracle: "0x4444444444444444444444444444444444444444",
        getNetwork: "testnet",
        getAccountIdText: "aa:test",
        getThreshold: 2,
        getTimelock: 3600,
        getRecoveryNonce: 7,
        getSessionNonce: 11,
        getPendingRecovery: [
          "0x5555555555555555555555555555555555555555",
          7,
          1,
          1700000000,
          1700003600,
          true,
        ],
        getActiveSession: [
          "0x6666666666666666666666666666666666666666",
          "aa_action",
          "0x7777777777777777777777777777777777777777",
          1700007200,
          true,
        ],
      };
      return values[method] ?? null;
    }),
  };
}

describe("Recovery Guardian chain logic", () => {
  it("normalizes account ids as SocialRecoveryVerifier ByteArray args", () => {
    expect(accountIdArg(ACCOUNT_ID)).toEqual({
      type: "ByteArray",
      value: ACCOUNT_ID,
    });
  });

  it("reads the deployed verifier state from chain safe methods", async () => {
    const chain = createChain();

    const payload = await readRecoveryGuardianState({
      chain: chain as never,
      accountId: ACCOUNT_ID,
      contractHash: CONTRACT,
    });

    expect(chain.read).toHaveBeenCalledWith(
      "getOwner",
      [{ type: "ByteArray", value: ACCOUNT_ID }],
      { scriptHash: CONTRACT, cache: false },
    );
    expect(chain.read).toHaveBeenCalledWith(
      "getPendingRecovery",
      [{ type: "ByteArray", value: ACCOUNT_ID }],
      { scriptHash: CONTRACT, cache: false },
    );
    expect(payload).toEqual(
      expect.objectContaining({
        account_id: "aa:test",
        threshold: "2",
        timelock: "3600",
        recovery_nonce: "7",
        pending_recovery: expect.objectContaining({
          approvedCount: "1",
          active: true,
        }),
      }),
    );
  });

  it("requests recovery tickets with the live ABI and connected owner witness", async () => {
    const chain = createChain();
    const now = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    try {
      await requestRecoveryTicket({
        chain: chain as never,
        accountId: ACCOUNT_ID,
        newOwner: OWNER,
        expiryMinutes: "30",
        provider: "web3auth",
        encryptedParams: "{}",
        contractHash: CONTRACT,
      });
    } finally {
      now.mockRestore();
    }

    expect(chain.invoke).toHaveBeenCalledWith(
      "requestRecoveryTicket",
      [
        { type: "ByteArray", value: ACCOUNT_ID },
        { type: "String", value: "web3auth" },
        {
          type: "Hash160",
          value: normalizeHash160Input(OWNER, "New owner"),
        },
        { type: "String", value: "1700001800" },
        { type: "String", value: "{}" },
      ],
      { scriptHash: CONTRACT },
    );
  });
});
