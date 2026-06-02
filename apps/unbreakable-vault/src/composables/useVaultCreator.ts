/**
 * useVaultCreator — Vault creation with password hashing and GAS deposit
 *
 * Uses the direct-prepaid MiniApp contract flow:
 *   GAS.transfer(wallet -> vault, bounty, "miniapp-unbreakablevault:create")
 *   createVault(creator, secretHash, bounty, difficulty, title, description)
 */

import { createObservable } from "@shared/react/context";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { ChainService } from "@shared/services/ChainService";
import { sha256Hex } from "@shared/utils/hash";
import { toFixed8 } from "@shared/utils/format";

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
  /** Shared chain service for wallet-signed direct contract calls */
  chainService: ChainService;
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

function valueFromRecord(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

function resolveCreatedVaultId(result: unknown, secretHash: string): string {
  if (typeof result === "string" && result.trim()) return result.trim();

  const explicitId = valueFromRecord(result, [
    "vaultId",
    "vault_id",
    "escrowId",
    "escrow_id",
    "id",
  ]);
  if (explicitId) return explicitId;

  const txid = valueFromRecord(result, ["txid", "tx", "transactionHash"]);
  if (txid) return `pending-${txid.replace(/^0x/i, "").slice(0, 12)}`;

  return `vault-${secretHash.slice(0, 12)}`;
}

function base64FromBytes(bytes: number[]): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return output;
}

function hashHexToBase64(hash: string): string {
  const normalized = hash.replace(/^0x/i, "");
  const bytes = normalized.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || [];
  return base64FromBytes(bytes);
}

// ============================================================================
// Composable
// ============================================================================

export function useVaultCreator({
  chainService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseVaultCreatorOptions) {
  const myVaults = createObservable<MyVault[]>([]);
  const createdVaultId = createObservable<string | null>(null);
  const isCreating = createObservable(false);

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
      myVaults.set(vaults.sort((a, b) => b.created - a.created));
    } catch (e) {
      console.error(
        "[unbreakable-vault] loadMyVaults error:",
        e instanceof Error ? e.message : String(e),
      );
      eventBus.emit("vault:error", { message: "My vaults unavailable" });
    }
  };

  /**
   * Create a vault via the live Vault contract funded transaction flow.
   */
  const createVault = async (
    form: VaultCreateForm,
    onSuccess: (vaultId: string) => void,
    loadRecentVaults: () => Promise<void>,
  ) => {
    if (isCreating.get()) return;
    isCreating.set(true);
    try {
      const amount = Number.parseFloat(form.bounty);
      if (!Number.isFinite(amount) || amount < 1) {
        throw new Error(t("vaultCreateFailed"));
      }
      const bountyFixed8 = toFixed8(form.bounty);
      const hash = form.secretHash || (await sha256Hex(form.secret));
      const creator = await chainService.ensureWallet();

      const result = await chainService.invokeWithPayment(
        bountyFixed8,
        `miniapp-unbreakablevault:create:${hash.slice(0, 10)}`,
        "createVault",
        [
          { type: "Hash160", value: creator },
          { type: "ByteArray", value: hashHexToBase64(hash) },
          { type: "Integer", value: bountyFixed8 },
          { type: "Integer", value: String(form.difficulty) },
          { type: "String", value: form.title.trim().slice(0, 100) },
          { type: "String", value: form.description.trim().slice(0, 300) },
        ],
        { waitForEvent: "VaultCreated" },
      );
      const vaultId = resolveCreatedVaultId(result, hash);

      // Store vault metadata
      await storageService.set(`vault-meta:${vaultId}`, {
        secretHash: hash,
        difficulty: form.difficulty,
        title: form.title.trim().slice(0, 100),
        description: form.description.trim().slice(0, 300),
      });

      createdVaultId.set(vaultId || createdVaultId.get());

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
      isCreating.set(false);
    }
  };

  return {
    address: createObservable(""),
    isCreating,
    myVaults,
    createdVaultId,
    loadMyVaults,
    createVault,
  };
}

export type UseVaultCreatorReturn = ReturnType<typeof useVaultCreator>;
