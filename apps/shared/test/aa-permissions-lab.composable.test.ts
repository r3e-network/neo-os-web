import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { ChainService } from "../services";
import type { StorageProxy } from "../services/os/StorageProxy";
import { createMiniAppFramework } from "../react";
import { useAAPermissionsLab } from "../../aa-permissions-lab/src/composables/useAAPermissionsLab";

function makeApp(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-aa-permissions-lab" },
  );
}

const ACCOUNT_ID_HASH = "0x1111111111111111111111111111111111111111";

function t(key: string) {
  const messages: Record<string, string> = {
    notAvailable: "Not available",
    notBackupOwner:
      "Connect the backup-owner wallet to rotate this account's bindings.",
  };
  return messages[key] ?? key;
}

function makeChain(connected = false) {
  // refreshState now reads 7 values: verifier/hook/backupOwner (Hash160) plus
  // the two-phase pending flags and times. parseHash160 reverses Hash160 bytes;
  // repeated-byte hashes (0x22.., 0x33.., 0x44..) reverse to themselves.
  // Connection state is derived from the address (app.wallet.isConnected()),
  // matching the real ChainService where isConnected = Boolean(address).
  return {
    address: createObservable<string | null>(
      connected ? "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32" : null,
    ),
    read: vi
      .fn()
      .mockResolvedValueOnce("0x2222222222222222222222222222222222222222")
      .mockResolvedValueOnce("0x3333333333333333333333333333333333333333")
      .mockResolvedValueOnce("0x4444444444444444444444444444444444444444")
      .mockResolvedValueOnce(false) // hasPendingVerifierUpdate
      .mockResolvedValueOnce(false) // hasPendingHookUpdate
      .mockResolvedValueOnce(0) // getPendingVerifierUpdateTime
      .mockResolvedValueOnce(0), // getPendingHookUpdateTime
    invoke: vi.fn(),
  } as unknown as ChainService & { read: ReturnType<typeof vi.fn> };
}

function makeStorage() {
  return {
    set: vi.fn().mockResolvedValue(undefined),
  } as unknown as StorageProxy & { set: ReturnType<typeof vi.fn> };
}

describe("AA Permissions Lab composable", () => {
  it("reads permission state without writing OS storage before a wallet is connected", async () => {
    const chain = makeChain(false);
    const storage = makeStorage();
    const lab = useAAPermissionsLab({ app: makeApp(chain), storageService: storage, t });

    lab.form.accountIdHash = ACCOUNT_ID_HASH;
    await lab.refreshState();

    expect(chain.read).toHaveBeenCalledTimes(7);
    expect(lab.currentVerifier.get()).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(lab.hasInspected.get()).toBe(true);
    expect(lab.hasPendingVerifier.get()).toBe(false);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("persists inspected state only when a wallet is connected", async () => {
    const chain = makeChain(true);
    const storage = makeStorage();
    const lab = useAAPermissionsLab({ app: makeApp(chain), storageService: storage, t });

    lab.form.accountIdHash = ACCOUNT_ID_HASH;
    await lab.refreshState();

    expect(storage.set).toHaveBeenCalledWith(
      "permissions:1111111111111111111111111111111111111111",
      expect.objectContaining({
        verifier: "0x2222222222222222222222222222222222222222",
        hook: "0x3333333333333333333333333333333333333333",
        backupOwner: "0x4444444444444444444444444444444444444444",
      }),
    );
  });

  it("blocks a verifier rotation when the wallet is not the backup owner", async () => {
    // Connected wallet (NR3E4...) differs from the inspected backup owner (0x4444...).
    const chain = makeChain(true);
    const lab = useAAPermissionsLab({ app: makeApp(chain), storageService: makeStorage(), t });
    lab.form.accountIdHash = ACCOUNT_ID_HASH;
    await lab.refreshState();

    lab.form.verifierHash = "0x5555555555555555555555555555555555555555";
    lab.form.verifierParamsHex = "";
    await expect(lab.submitVerifier()).rejects.toThrow(
      "Connect the backup-owner wallet to rotate this account's bindings.",
    );
    expect((chain as unknown as { invoke: ReturnType<typeof vi.fn> }).invoke).not.toHaveBeenCalled();
  });

  it("surfaces a pending verifier rotation and confirms it in a second phase", async () => {
    const chain = {
      address: createObservable<string | null>(null),
      read: vi
        .fn()
        .mockResolvedValueOnce("0x2222222222222222222222222222222222222222")
        .mockResolvedValueOnce("0x3333333333333333333333333333333333333333")
        .mockResolvedValueOnce("0x4444444444444444444444444444444444444444")
        .mockResolvedValueOnce(true) // hasPendingVerifierUpdate
        .mockResolvedValueOnce(false) // hasPendingHookUpdate
        .mockResolvedValueOnce(1_900_000_000) // getPendingVerifierUpdateTime
        .mockResolvedValueOnce(0)
        // second refreshState after confirm
        .mockResolvedValue("0x2222222222222222222222222222222222222222"),
      invoke: vi.fn().mockResolvedValue({ txid: "0xtx" }),
    } as unknown as ChainService & {
      read: ReturnType<typeof vi.fn>;
      invoke: ReturnType<typeof vi.fn>;
    };
    const lab = useAAPermissionsLab({ app: makeApp(chain), storageService: makeStorage(), t });
    lab.form.accountIdHash = ACCOUNT_ID_HASH;
    await lab.refreshState();

    expect(lab.hasPendingVerifier.get()).toBe(true);
    expect(lab.pendingVerifierUnlockAt.get()).toBe(1_900_000_000);

    await lab.confirmVerifier();
    expect(
      (chain as unknown as { invoke: ReturnType<typeof vi.fn> }).invoke,
    ).toHaveBeenCalledWith(
      "confirmVerifierUpdate",
      [{ type: "Hash160", value: ACCOUNT_ID_HASH }],
      expect.objectContaining({ scriptHash: expect.any(String) }),
    );
  });
});
