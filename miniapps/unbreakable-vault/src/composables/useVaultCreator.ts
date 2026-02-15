import { ref } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { normalizeScriptHash, addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import { toFixed8 } from "@shared/utils/format";
import { sha256Hex } from "@shared/utils/hash";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";

/** Handles vault creation with password hashing and GAS deposit. */
export function useVaultCreator(
  APP_ID: string,
  t: (key: string) => string,
  setStatus: (msg: string, type: string) => void
) {
  const {
    address,
    ensureWallet,
    ensureContractAddress,
    isProcessing: isCreating,
  } = useContractInteraction({ appId: APP_ID, t });
  const { processPayment } = usePaymentFlow(APP_ID);
  const { list: listEvents } = useEvents();

  const myVaults = ref<{ id: string; bounty: number; created: number }[]>([]);
  const createdVaultId = ref<string | null>(null);

  const loadMyVaults = async () => {
    if (!address.value) {
      myVaults.value = [];
      return;
    }
    try {
      const res = await listEvents({ app_id: APP_ID, event_name: "VaultCreated", limit: 50 });
      const myHash = normalizeScriptHash(addressToScriptHash(address.value));
      const vaults = res.events
        .map((evt: Record<string, unknown>) => {
          const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
          const id = String(values[0] ?? "");
          const creator = String(values[1] ?? "");
          const bountyValue = Number(values[2] ?? 0);
          const creatorHash = normalizeScriptHash(addressToScriptHash(creator));
          if (!id || creatorHash !== myHash) return null;
          return {
            id,
            bounty: bountyValue,
            created: evt.created_at ? new Date(evt.created_at as string).getTime() : Date.now(),
          };
        })
        .filter(Boolean) as { id: string; bounty: number; created: number }[];
      myVaults.value = vaults.sort((a, b) => b.created - a.created);
    } catch {
      // My vaults load failure is non-critical
    }
  };

  const createVault = async (
    form: {
      bounty: string;
      title: string;
      description: string;
      difficulty: number;
      secret: string;
      secretHash: string;
    },
    onSuccess: (vaultId: string) => void,
    loadRecentVaults: () => Promise<void>
  ) => {
    if (isCreating.value) return;
    try {
      await ensureWallet();
      const contract = await ensureContractAddress();
      const amount = Number.parseFloat(form.bounty);
      const bountyInt = toFixed8(amount);
      const hash = form.secretHash || (await sha256Hex(form.secret));
      const { receiptId, invoke } = await processPayment(String(amount), `vault:create:${hash.slice(0, 10)}`);
      if (!receiptId) throw new Error(t("receiptMissing"));
      const res = await invoke(
        "createVault",
        [
          { type: "Hash160", value: address.value as string },
          { type: "ByteArray", value: hash },
          { type: "Integer", value: bountyInt },
          { type: "Integer", value: String(form.difficulty) },
          { type: "String", value: form.title.trim().slice(0, 100) },
          { type: "String", value: form.description.trim().slice(0, 300) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );
      const resRecord = res as Record<string, unknown>;
      const stackArr = resRecord?.stack as unknown[] | undefined;
      const firstStackItem = stackArr?.[0] as Record<string, unknown> | undefined;
      const vaultId = String(resRecord?.result || firstStackItem?.value || "");
      createdVaultId.value = vaultId || createdVaultId.value;
      setStatus(t("vaultCreated"), "success");
      onSuccess(vaultId);
      await loadRecentVaults();
      await loadMyVaults();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("vaultCreateFailed")), "error");
    }
  };

  return {
    address,
    isCreating,
    myVaults,
    createdVaultId,
    loadMyVaults,
    createVault,
  };
}
