import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { sha256Hex } from "@shared/utils/hash";
import { formatHash } from "@shared/utils/format";
import { createSidebarItems } from "@shared/utils";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { useContractAddress } from "@shared/composables/useContractAddress";
import type { StatItem } from "@shared/components/NeoStats.vue";
import type { RecordItem } from "../components/QueryRecordForm.vue";

const APP_ID = "miniapp-exfiles";
const CREATE_FEE = "0.1";
const QUERY_FEE = "0.05";

export function useExFiles(t: (key: string) => string) {
  const { address, connect, invokeRead } = useWallet() as WalletSDK;
  const { processPayment, isLoading } = usePaymentFlow(APP_ID);
  const { list: listEvents } = useEvents();
  const { contractAddress, ensure: ensureContractAddress } = useContractAddress(t);
  const { status, setStatus: showStatus, clearStatus } = useStatusMessage();

  // --- Reactive state ---
  const activeTab = ref("files");
  const records = ref<RecordItem[]>([]);
  const recordContent = ref("");
  const recordRating = ref("3");
  const recordCategory = ref(0);
  const queryInput = ref("");
  const queryResult = ref<RecordItem | null>(null);

  // --- Computed ---
  const appState = computed(() => ({
    activeTab: activeTab.value,
    address: address.value,
    recordsCount: records.value.length,
    isLoading: isLoading.value,
  }));

  const sidebarItems = createSidebarItems(t, [
    { labelKey: "totalRecords", value: () => records.value.length },
    { labelKey: "averageRating", value: () => averageRating.value },
    { labelKey: "totalQueries", value: () => totalQueries.value },
    { labelKey: "sidebarWallet", value: () => (address.value ? t("connected") : t("disconnected")) },
  ]);

  const sortedRecords = computed(() =>
    [...records.value].sort((a, b) => b.createTime - a.createTime),
  );

  const averageRating = computed(() => {
    if (!records.value.length) return "0.0";
    const total = records.value.reduce((sum, record) => sum + record.rating, 0);
    return (total / records.value.length).toFixed(1);
  });

  const totalQueries = computed(() =>
    records.value.reduce((sum, record) => sum + record.queryCount, 0),
  );

  const canCreate = computed(() => {
    const rating = Number(recordRating.value);
    return recordContent.value.trim().length > 0 && rating >= 1 && rating <= 5;
  });

  const statsData = computed<StatItem[]>(() => [
    { label: t("totalRecords"), value: records.value.length, variant: "default" },
    { label: t("averageRating"), value: averageRating.value, variant: "accent" },
    { label: t("totalQueries"), value: totalQueries.value, variant: "default" },
  ]);

  // --- Helpers ---
  const formatHashDisplay = (hash: string) => {
    if (!hash) return "--";
    const clean = hash.startsWith("0x") ? hash : `0x${hash}`;
    return formatHash(clean, 10, 6) || clean;
  };

  const parseRecord = (recordId: number, raw: unknown): RecordItem => {
    const values = Array.isArray(raw) ? raw : [];
    const dataHash = String(values[1] || "");
    const createTime = Number(values[4] || 0);
    return {
      id: recordId,
      dataHash,
      rating: Number(values[2] || 0),
      queryCount: Number(values[3] || 0),
      createTime,
      active: Boolean(values[5]),
      category: Number(values[6] || 0),
      date: createTime ? new Date(createTime * 1000).toISOString().split("T")[0] : "--",
      hashShort: formatHashDisplay(dataHash),
    };
  };

  // --- Actions ---
  const loadRecords = async () => {
    await ensureContractAddress();
    const res = await listEvents({ app_id: APP_ID, event_name: "RecordCreated", limit: 50 });
    const ids = Array.from(
      new Set(
        res.events
          .map((evt: Record<string, unknown>) => {
            const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
            return Number(values[0] || 0);
          })
          .filter((id: number) => id > 0),
      ),
    );
    const list: RecordItem[] = [];
    for (const id of ids) {
      const recordRes = await invokeRead({
        scriptHash: contractAddress.value as string,
        operation: "getRecord",
        args: [{ type: "Integer", value: id }],
      });
      const data = parseInvokeResult(recordRes);
      list.push(parseRecord(id, data));
    }
    records.value = list;
  };

  const viewRecord = (record: RecordItem) => {
    queryResult.value = record;
    showStatus(`${t("record")} #${record.id}`, "success");
  };

  const createRecord = async () => {
    if (!canCreate.value || isLoading.value) return;
    const rating = Number(recordRating.value);
    if (!recordContent.value.trim()) {
      showStatus(t("invalidContent"), "error");
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      showStatus(t("invalidRating"), "error");
      return;
    }
    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }
      await ensureContractAddress();
      const hashHex = await sha256Hex(recordContent.value.trim());
      const { receiptId, invoke } = await processPayment(CREATE_FEE, `create:${hashHex.slice(0, 8)}`);
      if (!receiptId) {
        throw new Error(t("receiptMissing"));
      }
      // Contract signature: CreateRecord(creator, dataHash, rating, category, receiptId)
      await invoke(
        "CreateRecord",
        [
          { type: "Hash160", value: address.value as string },
          { type: "ByteArray", value: hashHex },
          { type: "Integer", value: rating },
          { type: "Integer", value: recordCategory.value },
          { type: "Integer", value: String(receiptId) },
        ],
        contractAddress.value as string,
      );
      showStatus(t("recordCreated"), "success");
      recordContent.value = "";
      recordRating.value = "3";
      await loadRecords();
      activeTab.value = "files";
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const queryRecord = async () => {
    if (!queryInput.value.trim() || isLoading.value) return;
    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }
      await ensureContractAddress();
      const input = queryInput.value.trim();
      const isHash = /^(0x)?[0-9a-fA-F]{64}$/.test(input);
      const hashHex = isHash ? input.replace(/^0x/, "") : await sha256Hex(input);
      const { receiptId, invoke, waitForEvent } = await processPayment(QUERY_FEE, `query:${hashHex.slice(0, 8)}`);
      if (!receiptId) {
        throw new Error(t("receiptMissing"));
      }
      const tx = await invoke(
        "queryByHash",
        [
          { type: "Hash160", value: address.value as string },
          { type: "ByteArray", value: hashHex },
          { type: "Integer", value: String(receiptId) },
        ],
        contractAddress.value as string,
      );
      const txid = String(
        (tx as { txid?: string; txHash?: string })?.txid || (tx as { txid?: string; txHash?: string })?.txHash || "",
      );
      if (txid) {
        const evt = await waitForEvent(txid, "RecordQueried");
        if (evt) {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          const recordId = Number(values[0] || 0);
          if (recordId > 0) {
            const recordRes = await invokeRead({
              scriptHash: contractAddress.value as string,
              operation: "getRecord",
              args: [{ type: "Integer", value: recordId }],
            });
            const data = parseInvokeResult(recordRes);
            queryResult.value = parseRecord(recordId, data);
          }
        }
      }
      showStatus(t("recordQueried"), "success");
      await loadRecords();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const init = async () => {
    try {
      await loadRecords();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("failedToLoad")), "error");
    }
  };

  return {
    // State
    activeTab,
    records,
    recordContent,
    recordRating,
    recordCategory,
    queryInput,
    queryResult,
    isLoading,
    status,
    // Computed
    appState,
    sidebarItems,
    sortedRecords,
    statsData,
    canCreate,
    // Actions
    viewRecord,
    createRecord,
    queryRecord,
    init,
  };
}
