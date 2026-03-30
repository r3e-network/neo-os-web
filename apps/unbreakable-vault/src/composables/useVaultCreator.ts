/**
 * useVaultCreator — Vault creation with password hashing and GAS deposit
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (EscrowProxy, PaymentProxy, StorageProxy, BadgeProxy) via
 * edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.listEvents("VaultCreated", { limit: 50 })
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("createVault", [...], { waitForEvent: "VaultCreated" })
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.list("myVaults:", 50)
 *     paymentService.deposit(bounty, "create:<hash>")
 *     escrowService.create({ ... })
 *     badgeService.award("vault-creator", "")
 */

import { ref } from "vue";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { sha256Hex } from "@shared/utils/hash";

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
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string) => string;
}

// ============================================================================
// Helpers
// ============================================================================

interface StoredVault {
  id: string;
  creator: string;
  bounty: number;
  created: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultCreator({
  escrowService,
  paymentService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseVaultCreatorOptions) {
  const myVaults = ref<MyVault[]>([]);
  const createdVaultId = ref<string | null>(null);
  const isCreating = ref(false);

  /**
   * Load vaults created by the current user via StorageProxy.
   */
  const loadMyVaults = async () => {
    try {
      const vaultMap = await storageService.list("myVaults:", 50);
      const vaults: MyVault[] = [];
      if (vaultMap && typeof vaultMap === "object") {
        for (const [, value] of Object.entries(vaultMap)) {
          const stored = value as StoredVault;
          if (stored && stored.id) {
            vaults.push({
              id: String(stored.id),
              bounty: Number(stored.bounty ?? 0),
              created: Number(stored.created ?? Date.now()),
            });
          }
        }
      }
      myVaults.value = vaults.sort((a, b) => b.created - a.created);
    } catch (e) {
      console.error(
        "[unbreakable-vault] loadMyVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "My vaults unavailable" });
    }
  };

  /**
   * Create a vault via PaymentProxy (deposit bounty) + EscrowProxy (create vault).
   * The edge functions handle wallet connection, GAS transfer, and vault creation.
   */
  const createVault = async (
    form: VaultCreateForm,
    onSuccess: (vaultId: string) => void,
    loadRecentVaults: () => Promise<void>,
  ) => {
    if (isCreating.value) return;
    isCreating.value = true;
    try {
      const amount = Number.parseFloat(form.bounty);
      const hash = form.secretHash || (await sha256Hex(form.secret));

      // Step 1: Deposit GAS bounty via PaymentProxy
      await paymentService.deposit(
        form.bounty,
        `miniapp-unbreakablevault:create:${hash.slice(0, 10)}`,
      );

      // Step 2: Create the vault via EscrowProxy
      const vaultId = await escrowService.create({
        beneficiary: "",
        amount: String(amount),
        milestones: [{
          name: "vault",
          amount: String(amount),
        }],
      });

      // Store vault metadata
      await storageService.set(`vault-meta:${vaultId}`, {
        secretHash: hash,
        difficulty: form.difficulty,
        title: form.title.trim().slice(0, 100),
        description: form.description.trim().slice(0, 300),
      });

      createdVaultId.value = vaultId || createdVaultId.value;

      eventBus.emit("vault:created", { action: t("vaultCreated") });

      // Hint badge for vault creator (fire-and-forget)
      badgeService.award("vault-creator", "").catch(() => {});

      onSuccess(vaultId);
      await loadRecentVaults();
      await loadMyVaults();
    } catch (e) {
      eventBus.emit("vault:error", {
        message: e instanceof Error ? e.message : t("vaultCreateFailed"),
      });
      throw e;
    } finally {
      isCreating.value = false;
    }
  };

  return {
    address: ref(""),
    isCreating,
    myVaults,
    createdVaultId,
    loadMyVaults,
    createVault,
  };
}

export type UseVaultCreatorReturn = ReturnType<typeof useVaultCreator>;
