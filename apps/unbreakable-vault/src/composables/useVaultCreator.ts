/**
 * useVaultCreator — Vault creation with password hashing and GAS deposit
 *
 * Migrated to PlatformServices pattern:
 *   - useContractInteraction(hash) -> chain.read() / chain.invoke()
 *   - useEvents().list -> chain.listEvents()
 *   - waitForListedEventByTransaction -> chain.waitForEvent()
 */

import { ref } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { normalizeScriptHash, addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { toFixed8 } from "@shared/utils/format";
import { sha256Hex } from "@shared/utils/hash";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Types
// ============================================================================

export interface MyVault {
  id: string;
  bounty: number;
  created: number;
}

export interface VaultCreateForm {
  bounty: string;
  title: string;
  description: string;
  difficulty: number;
  secret: string;
  secretHash: string;
}

export interface UseVaultCreatorOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultCreator({ chain, eventBus, t }: UseVaultCreatorOptions) {
  const myVaults = ref<MyVault[]>([]);
  const createdVaultId = ref<string | null>(null);

  const loadMyVaults = async () => {
    if (!chain.address.value) {
      myVaults.value = [];
      return;
    }
    try {
      const events = await chain.listEvents("VaultCreated", { limit: 50 });
      const myHash = normalizeScriptHash(addressToScriptHash(chain.address.value));
      const vaults = (events as { state?: unknown[]; created_at?: string }[])
        .map((evt) => {
          const values = Array.isArray(evt?.state)
            ? (evt.state as unknown[]).map(parseStackItem)
            : [];
          const id = String(values[0] ?? "");
          const creator = String(values[1] ?? "");
          const bountyValue = Number(values[2] ?? 0);
          const creatorHash = normalizeScriptHash(addressToScriptHash(creator));
          if (!id || creatorHash !== myHash) return null;
          return {
            id,
            bounty: bountyValue,
            created: evt.created_at ? new Date(evt.created_at).getTime() : Date.now(),
          };
        })
        .filter(Boolean) as MyVault[];
      myVaults.value = vaults.sort((a, b) => b.created - a.created);
    } catch (e) {
      console.error(
        "[unbreakable-vault] loadMyVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "My vaults unavailable" });
    }
  };

  const createVault = async (
    form: VaultCreateForm,
    onSuccess: (vaultId: string) => void,
    loadRecentVaults: () => Promise<void>,
  ) => {
    if (chain.isProcessing.value) return;
    try {
      await chain.ensureWallet();
      const amount = Number.parseFloat(form.bounty);
      const bountyInt = toFixed8(amount);
      const hash = form.secretHash || (await sha256Hex(form.secret));

      // Step 1: Transfer GAS bounty to the contract
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: bountyInt },
          { type: "String", value: `miniapp-unbreakablevault:create:${hash.slice(0, 10)}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 2: Create the vault
      const result = await chain.invoke(
        "createVault",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "ByteArray", value: hash },
          { type: "Integer", value: bountyInt },
          { type: "Integer", value: String(form.difficulty) },
          { type: "String", value: form.title.trim().slice(0, 100) },
          { type: "String", value: form.description.trim().slice(0, 300) },
        ],
        { waitForEvent: "VaultCreated", waitTimeoutMs: 30000 },
      );

      const evtRecord = result.event as { state?: unknown[] } | undefined;
      const values = Array.isArray(evtRecord?.state)
        ? evtRecord!.state.map(parseStackItem)
        : [];
      const vaultId = String(values[0] ?? "");
      createdVaultId.value = vaultId || createdVaultId.value;

      eventBus.emit("vault:created", { action: t("vaultCreated") });
      onSuccess(vaultId);
      await loadRecentVaults();
      await loadMyVaults();
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("vaultCreateFailed"),
      });
      throw e;
    }
  };

  return {
    address: chain.address,
    isCreating: chain.isProcessing,
    myVaults,
    createdVaultId,
    loadMyVaults,
    createVault,
  };
}

export type UseVaultCreatorReturn = ReturnType<typeof useVaultCreator>;
