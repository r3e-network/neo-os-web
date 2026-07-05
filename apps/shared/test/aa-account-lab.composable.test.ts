import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { ChainService } from "../services";
import type { StorageProxy } from "../services/os/StorageProxy";
import { createMiniAppFramework } from "../react";
import { useAAAccountLab } from "../../aa-account-lab/src/composables/useAAAccountLab";
import { deriveRegistrationAccountIdHash } from "../utils/aa-account";

function makeApp(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-aa-account-lab" },
  );
}

// Valid Neo address whose script hash the contract can witness as backup owner.
const WALLET_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const WALLET_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const VERIFIER_HASH = "0x5be915aea3ce85e4752d522632f0a9520e377aaf";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    notAvailable: "Not available",
    backupOwnerMustSign: "The backup owner must sign this transaction.",
    invalidTimelock: "Invalid timelock",
    invalidBackupOwner: "Invalid backup owner",
    timelockDays: "{days} days",
    escapeActive: "Escape active",
    escapeInactive: "Inactive",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

function makeChain(address: string | null) {
  return {
    address: createObservable<string | null>(address),
    // register flow polls getVerifier; return a non-empty verifier so the
    // confirmation loop resolves immediately on the first read.
    read: vi.fn().mockResolvedValue({ type: "ByteString", value: "" }),
    invoke: vi.fn().mockResolvedValue({ txid: "0xtx" }),
  } as unknown as ChainService & {
    invoke: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
}

function makeStorage() {
  return {
    set: vi.fn().mockResolvedValue(undefined),
  } as unknown as StorageProxy & { set: ReturnType<typeof vi.fn> };
}

function baseForm(lab: ReturnType<typeof useAAAccountLab>) {
  lab.registerForm.verifierHash = VERIFIER_HASH;
  lab.registerForm.verifierParamsHex = "112233";
  lab.registerForm.hookHash = "";
  lab.registerForm.backupOwner = WALLET_ADDRESS;
  lab.registerForm.escapeTimelock = "2592000";
}

describe("AA Account Lab composable register flow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers with the contract-derived accountId, not a free seed", async () => {
    vi.useFakeTimers();
    const chain = makeChain(WALLET_ADDRESS);
    // The post-register confirmation poll reads getVerifier; return a non-empty
    // verifier so the poll resolves on the first attempt.
    const verifierBase64 = Buffer.from(
      VERIFIER_HASH.replace(/^0x/, ""),
      "hex",
    )
      .reverse()
      .toString("base64");
    chain.read = vi
      .fn()
      .mockResolvedValue({ type: "ByteString", value: verifierBase64 });
    const lab = useAAAccountLab({ app: makeApp(chain), storageService: makeStorage(), t });
    baseForm(lab);

    const pending = lab.submitRegister();
    await vi.runAllTimersAsync();
    await pending;

    const expectedId = deriveRegistrationAccountIdHash({
      verifierContractHash: VERIFIER_HASH,
      verifierParamsHex: "112233",
      hookContractHash: "",
      backupOwnerAddress: WALLET_ADDRESS,
      escapeTimelock: 2_592_000,
    });

    const call = chain.invoke.mock.calls[0];
    expect(call[0]).toBe("registerAccount");
    // First arg is the accountId — must equal the registration-derived hash.
    expect(call[1][0]).toEqual({ type: "Hash160", value: `0x${expectedId}` });
  });

  it("blocks registration when the backup owner is not the connected wallet", async () => {
    // Connected wallet differs from the entered backup owner -> witness fails.
    const chain = makeChain("NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF");
    const lab = useAAAccountLab({ app: makeApp(chain), storageService: makeStorage(), t });
    baseForm(lab);

    await expect(lab.submitRegister()).rejects.toThrow(
      "The backup owner must sign this transaction.",
    );
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("reverses byte-order Hash160 reads to the canonical 0x display form", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    // getVerifier returns the chain (little-endian) bytes for WALLET_HASH; the
    // composable must reverse them back to the 0x display hash.
    const base64 = Buffer.from(WALLET_HASH.replace(/^0x/, ""), "hex")
      .reverse()
      .toString("base64");
    chain.read = vi
      .fn()
      // getVerifier, getHook, getBackupOwner
      .mockResolvedValueOnce({ type: "ByteString", value: base64 })
      .mockResolvedValueOnce({ type: "ByteString", value: "" })
      .mockResolvedValueOnce({ type: "ByteString", value: base64 })
      // getEscapeTimelock, isEscapeActive
      .mockResolvedValueOnce({ type: "Integer", value: "2592000" })
      .mockResolvedValueOnce({ type: "Boolean", value: false });

    const inspectLab = useAAAccountLab({
      app: makeApp(chain),
      storageService: makeStorage(),
      t,
    });
    inspectLab.inspectForm.accountIdInput = WALLET_HASH;
    await inspectLab.inspectAccount();

    expect(inspectLab.currentVerifier.get()).toBe(WALLET_HASH);
    expect(inspectLab.currentBackupOwner.get()).toBe(WALLET_HASH);
    // Empty hook read collapses to the localized placeholder, not garbage.
    expect(inspectLab.currentHook.get()).toBe("Not available");
    // Escape posture is read and humanized to days.
    expect(inspectLab.currentEscapeTimelock.get()).toBe("30 days");
    expect(inspectLab.hasInspected.get()).toBe(true);
  });
});
