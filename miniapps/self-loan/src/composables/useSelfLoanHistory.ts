import { ref } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { parseGas, parseStackItem } from "@shared/utils/neo";
import { useI18n } from "@/composables/useI18n";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { useSelfLoanCore, APP_ID } from "./useSelfLoanCore";
import type { Loan } from "./useSelfLoanCore";

export interface LoanHistoryEntry {
  icon: string;
  label: string;
  amount: number;
  timestamp: string;
}

export interface LoanStats {
  totalLoans: number;
  totalBorrowed: number;
  totalRepaid: number;
}

export interface ContractLoanEntry {
  id: number;
  createdTime: number;
  netBorrow: number;
  repaid: number;
  active: boolean;
  collateral: number;
}

export function useSelfLoanHistory() {
  const { t } = useI18n();
  const { handleError } = useErrorHandler();
  const { address, ensureContractAddress, loadLoanPosition, toNumber, parseInvokeResult, parseGas, invokeRead } =
    useSelfLoanCore();

  const { list: listEvents } = useEvents();

  const stats = ref<LoanStats>({ totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 });
  const loanHistory = ref<LoanHistoryEntry[]>([]);

  const ownerMatches = (value: unknown, currentAddress: string) => {
    const val = String(value || "");
    if (val === currentAddress) return true;
    return false;
  };

  const listAllEvents = async (eventName: string) => {
    const events: any[] = [];
    let afterId: string | undefined;
    let hasMore = true;
    while (hasMore) {
      try {
        const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 50, after_id: afterId });
        events.push(...res.events);
        hasMore = Boolean(res.has_more && res.last_id);
        afterId = res.last_id || undefined;
      } catch (e) {
        handleError(e, { operation: "listEvents", metadata: { eventName } });
        break;
      }
    }
    return events;
  };

  const loadHistoryFromContract = async () => {
    if (!address.value) return;

    try {
      const contract = await ensureContractAddress();
      const countRes = await invokeRead({
        contractAddress: contract,
        operation: "GetUserLoanCount",
        args: [{ type: "Hash160", value: address.value }],
      });
      const count = Number(parseInvokeResult(countRes) || 0);
      if (!count) {
        stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
        loanHistory.value = [];
        return;
      }

      const limit = Math.min(count, 50);
      const idsRes = await invokeRead({
        contractAddress: contract,
        operation: "GetUserLoans",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: "0" },
          { type: "Integer", value: String(limit) },
        ],
      });
      const idsRaw = parseInvokeResult(idsRes);
      const idsList = Array.isArray(idsRaw) ? idsRaw : idsRaw != null ? [idsRaw] : [];
      const ids = idsList.map((id) => Number(id)).filter((id) => id > 0);

      const entries = await Promise.all(
        ids.map(async (loanId) => {
          try {
            const detailRes = await invokeRead({
              contractAddress: contract,
              operation: "GetLoanDetails",
              args: [{ type: "Integer", value: String(loanId) }],
            });
            const parsed = parseInvokeResult(detailRes);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
            const data = parsed as Record<string, unknown>;
            const collateral = toNumber(data.collateral);
            const originalDebt = parseGas(data.originalDebt);
            const repaid = parseGas(data.totalRepaid);
            const active = Boolean(data.active);
            const createdTime = Number(data.createdTime || 0);
            const netBorrow = originalDebt;
            return {
              id: loanId,
              createdTime,
              netBorrow,
              repaid,
              active,
              collateral,
            } as ContractLoanEntry;
          } catch (e) {
            handleError(e, { operation: "loadLoanDetail", metadata: { loanId } });
            return null;
          }
        })
      );

      const validEntries = entries.filter((entry): entry is ContractLoanEntry => Boolean(entry));
      stats.value = {
        totalLoans: validEntries.length,
        totalBorrowed: validEntries.reduce((sum, entry) => sum + entry.netBorrow, 0),
        totalRepaid: validEntries.reduce((sum, entry) => sum + entry.repaid, 0),
      };

      const history = validEntries
        .flatMap((entry) => {
          const createdLabel = {
            icon: "💰",
            label: t("borrowedLabel"),
            amount: entry.netBorrow,
            timestampRaw: entry.createdTime * 1000,
          };
          const repaidLabel =
            entry.repaid > 0
              ? {
                  icon: "↩️",
                  label: t("repaidLabel"),
                  amount: entry.repaid,
                  timestampRaw: entry.createdTime * 1000,
                }
              : null;
          const closedLabel = entry.active
            ? null
            : {
                icon: "✅",
                label: t("closedLabel"),
                amount: 0,
                timestampRaw: entry.createdTime * 1000,
              };
          return [createdLabel, repaidLabel, closedLabel].filter(Boolean);
        })
        .sort((a, b) => Number(b?.timestampRaw || 0) - Number(a?.timestampRaw || 0));

      loanHistory.value = history.slice(0, 20).map((item: any) => ({
        icon: item.icon,
        label: item.label,
        amount: item.amount,
        timestamp: new Date(item.timestampRaw || Date.now()).toLocaleString(),
      }));

      const latest = validEntries.reduce((max, entry) => (entry.id > max ? entry.id : max), 0);
      if (latest > 0) {
        await loadLoanPosition(latest);
      }
    } catch (e) {
      handleError(e, { operation: "loadHistoryFromContract" });
      stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
      loanHistory.value = [];
    }
  };

  const loadHistory = async () => {
    if (!address.value) return;

    try {
      const [createdEvents, repaidEvents, closedEvents] = await Promise.all([
        listAllEvents("LoanCreated"),
        listAllEvents("LoanRepaid"),
        listAllEvents("LoanClosed"),
      ]);

      const created = createdEvents
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          return {
            id: Number(values[0] || 0),
            borrower: values[1],
            collateral: toNumber(values[2]),
            borrowed: parseGas(values[3]),
            timestamp: evt.created_at,
            tx: evt.tx_hash,
          };
        })
        .filter((entry) => entry.id > 0 && ownerMatches(entry.borrower, address.value as string));

      const loanIds = new Set(created.map((entry) => entry.id));

      const repaid = repaidEvents
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          return {
            id: Number(values[0] || 0),
            repaid: parseGas(values[1]),
            timestamp: evt.created_at,
            tx: evt.tx_hash,
          };
        })
        .filter((entry) => loanIds.has(entry.id));

      const closed = closedEvents
        .map((evt) => {
          const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
          return {
            id: Number(values[0] || 0),
            borrower: values[1],
            timestamp: evt.created_at,
            tx: evt.tx_hash,
          };
        })
        .filter((entry) => loanIds.has(entry.id) || ownerMatches(entry.borrower, address.value as string));

      if (created.length === 0) {
        await loadHistoryFromContract();
        return;
      }

      stats.value = {
        totalLoans: created.length,
        totalBorrowed: created.reduce((sum, entry) => sum + entry.borrowed, 0),
        totalRepaid: repaid.reduce((sum, entry) => sum + entry.repaid, 0),
      };

      const history = [
        ...created.map((entry) => ({
          icon: "💰",
          label: t("borrowedLabel"),
          amount: entry.borrowed,
          timestampRaw: entry.timestamp,
        })),
        ...repaid.map((entry) => ({
          icon: "↩️",
          label: t("repaidLabel"),
          amount: entry.repaid,
          timestampRaw: entry.timestamp,
        })),
        ...closed.map((entry) => ({
          icon: "✅",
          label: t("closedLabel"),
          amount: 0,
          timestampRaw: entry.timestamp,
        })),
      ].sort((a, b) => new Date(b.timestampRaw || 0).getTime() - new Date(a.timestampRaw || 0).getTime());

      loanHistory.value = history.slice(0, 20).map((item) => ({
        icon: item.icon,
        label: item.label,
        amount: item.amount,
        timestamp: new Date(item.timestampRaw || Date.now()).toLocaleString(),
      }));

      if (created.length > 0) {
        const latest = created.reduce((max, entry) => (entry.id > max ? entry.id : max), 0);
        await loadLoanPosition(latest);
      }
    } catch (e) {
      handleError(e, { operation: "loadHistory" });
      await loadHistoryFromContract();
    }
  };

  return {
    stats,
    loanHistory,
    loadHistory,
    loadHistoryFromContract,
  };
}
