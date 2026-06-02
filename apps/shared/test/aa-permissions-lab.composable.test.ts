import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { ChainService } from "../services";
import type { StorageProxy } from "../services/os/StorageProxy";
import { useAAPermissionsLab } from "../../aa-permissions-lab/src/composables/useAAPermissionsLab";

const ACCOUNT_ID_HASH = "0x1111111111111111111111111111111111111111";

function t(key: string) {
  const messages: Record<string, string> = {
    notAvailable: "Not available",
  };
  return messages[key] ?? key;
}

function makeChain(isConnected = false) {
  return {
    isConnected: createObservable(isConnected),
    read: vi.fn()
      .mockResolvedValueOnce("0x2222222222222222222222222222222222222222")
      .mockResolvedValueOnce("0x3333333333333333333333333333333333333333")
      .mockResolvedValueOnce("0x4444444444444444444444444444444444444444"),
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
    const lab = useAAPermissionsLab({ chain, storageService: storage, t });

    lab.form.accountIdHash = ACCOUNT_ID_HASH;
    await lab.refreshState();

    expect(chain.read).toHaveBeenCalledTimes(3);
    expect(lab.currentVerifier.get()).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("persists inspected state only when a wallet is connected", async () => {
    const chain = makeChain(true);
    const storage = makeStorage();
    const lab = useAAPermissionsLab({ chain, storageService: storage, t });

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
});
