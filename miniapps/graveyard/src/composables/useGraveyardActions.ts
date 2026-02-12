import { ref, computed, onMounted, onUnmounted, watch, type Ref } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { HistoryItem } from "@/types";

const APP_ID = "miniapp-graveyard";

export function useGraveyardActions() {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
  const { list: listEvents } = useEvents();

  const totalDestroyed = ref(0);
  const gasReclaimed = ref(0);
  const assetHash = ref("");
  const memoryType = ref(1);
  const { status, setStatus, clearStatus } = useStatusMessage();
  const history = ref<HistoryItem[]>([]);
  const showConfirm = ref(false);
  const isDestroying = ref(false);
  const showWarningShake = ref(false);
  const forgettingId = ref<string | null>(null);
  const memoryTypeOptions = computed(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ]);
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  const waitForEvent = async (txid: string, eventName: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
      const match = res.events.find((evt) => evt.tx_hash === txid);
      if (match) return match;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return null;
  };

  const initiateDestroy = () => {
    if (!assetHash.value) {
      setStatus(t("enterAssetHash"), "error");
      showWarningShake.value = true;
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => {
        showWarningShake.value = false;
        shakeTimer = null;
      }, 500);
      return;
    }
    showConfirm.value = true;
  };

  const executeDestroy = async () => {
    showConfirm.value = false;
    if (isLoading.value || isDestroying.value) return;
    isDestroying.value = true;

    try {
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("connectWallet"));
      const contract = await ensureContractAddress();

      const { receiptId, invoke } = await processPayment("0.1", `graveyard:bury:${assetHash.value.slice(0, 10)}`);
      if (!receiptId) throw new Error(t("receiptMissing"));

      const tx = await invoke(
        "BuryMemory",
        [
          { type: "Hash160", value: address.value as string },
          { type: "String", value: assetHash.value },
          { type: "Integer", value: String(memoryType.value) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      const txid = String(
        (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || ""
      );
      const evt = txid ? await waitForEvent(txid, "MemoryBuried") : null;
      if (!evt) throw new Error(t("buryPending"));

      const evtRecord = evt as unknown as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const memoryId = String(values[0] ?? "");
      const contentHash = String(values[2] ?? assetHash.value);
      history.value.unshift({
        id: memoryId || String(Date.now()),
        hash: contentHash,
        time: new Date(evt.created_at || Date.now()).toLocaleString(),
        forgotten: false,
      });

      totalDestroyed.value += 1;
      gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
      setStatus(t("memoryBuried"), "success");
      assetHash.value = "";
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isDestroying.value = false;
    }
  };

  const loadStats = async () => {
    if (!contractAddress.value) {
      contractAddress.value = (await ensureContractAddress()) as string;
    }
    if (!contractAddress.value) return;
    try {
      const statsRes = await invokeRead({ scriptHash: contractAddress.value, operation: "getPlatformStats" });
      const parsed = parseInvokeResult(statsRes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const stats = parsed as Record<string, unknown>;
        const total = Number(stats.totalBuried ?? stats.totalMemories ?? 0);
        const fee = Number(stats.buryFee ?? 0);
        totalDestroyed.value = Number.isFinite(total) ? total : 0;
        if (Number.isFinite(fee) && fee > 0) {
          gasReclaimed.value = Number(((totalDestroyed.value * fee) / 1e8).toFixed(2));
        } else {
          gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
        }
        return;
      }
      const totalRes = await invokeRead({ scriptHash: contractAddress.value, operation: "totalMemories" });
      totalDestroyed.value = Number(parseInvokeResult(totalRes) || 0);
      gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
    } catch (e: unknown) {
      /* non-critical: graveyard stats fetch */
    }
  };

  const loadHistory = async () => {
    try {
      const contract = await ensureContractAddress();
      const res = await listEvents({ app_id: APP_ID, event_name: "MemoryBuried", limit: 20 });
      const entries = await Promise.all(
        res.events.map(async (evt) => {
          const evtRecord = evt as unknown as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          const memoryId = String(values[0] ?? evt.id);
          let contentHash = String(values[2] ?? "");
          let forgotten = false;
          if (memoryId) {
            try {
              const detailRes = await invokeRead({
                scriptHash: contract,
                operation: "getMemoryDetails",
                args: [{ type: "Integer", value: memoryId }],
              });
              const parsed = parseInvokeResult(detailRes);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const detail = parsed as Record<string, unknown>;
                forgotten = Boolean(detail.forgotten);
                if (!forgotten && detail.contentHash) {
                  contentHash = String(detail.contentHash);
                }
              }
            } catch {
              /* Individual memory detail fetch failure — skip enrichment */
            }
          }
          return {
            id: memoryId,
            hash: contentHash,
            time: new Date(evt.created_at || Date.now()).toLocaleString(),
            forgotten,
          };
        })
      );
      history.value = entries;
    } catch (e: unknown) {
      /* non-critical: graveyard history fetch */
    }
  };

  const forgetMemory = async (item: HistoryItem) => {
    if (!item.id || item.forgotten) return;
    if (isLoading.value || forgettingId.value) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: t("forgetConfirmTitle"),
        content: t("forgetConfirmText"),
        confirmText: t("forgetAction"),
        cancelText: t("cancel"),
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false),
      });
    });

    if (!confirmed) return;

    forgettingId.value = item.id;
    try {
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("connectWallet"));
      const contract = await ensureContractAddress();

      const { receiptId, invoke } = await processPayment("1", `graveyard:forget:${item.id}`);
      if (!receiptId) throw new Error(t("receiptMissing"));

      await invoke(
        "ForgetMemory",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: String(item.id) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract
      );

      history.value = history.value.map((entry) => (entry.id === item.id ? { ...entry, forgotten: true } : entry));
      setStatus(t("forgetSuccess"), "success");
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      forgettingId.value = null;
    }
  };

  const cleanupTimers = () => {
    if (shakeTimer) {
      clearTimeout(shakeTimer);
      shakeTimer = null;
    }
  };

  return {
    // State
    totalDestroyed,
    gasReclaimed,
    assetHash,
    memoryType,
    status,
    history,
    showConfirm,
    isDestroying,
    showWarningShake,
    forgettingId,
    memoryTypeOptions,
    // Actions
    initiateDestroy,
    executeDestroy,
    loadStats,
    loadHistory,
    forgetMemory,
    cleanupTimers,
  };
}
