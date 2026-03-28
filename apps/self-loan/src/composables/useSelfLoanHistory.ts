import { ref } from "vue";
import { useEvents } from "@shared/utils/wallet-sdk";
import { parseStackItem } from "@shared/utils/neo";
import { parseGas } from "@shared/utils/format";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { useErrorHandler } from "@shared/composables/useErrorHandler";
import { APP_ID } from "./useSelfLoanCore";
import type { Loan } from "./useSelfLoanCore";
import type { Ref } from "vue";

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

interface SelfLoanHistoryDeps {
  address: Ref<string>;
  ensureContractAddress: () => Promise<string>;
  loadLoanPosition: (loanId: number) => Promise<void>;
}

export function useSelfLoanHistory(deps: SelfLoanHistoryDeps) {
  const { t } = createUseI18n(messages)();
  const { handleError } = useErrorHandler();
  const { read } = useContractInteraction({ appId: APP_ID, t });

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const { list: listEvents } = useEvents();
  const { listAllEvents } = useAllEvents(listEvents, APP_ID, {
    onError: (error: unknown, eventName: string) => {
      handleError(error, { operation: "listEvents", metadata: { eventName } });
    },
  });

  const stats = ref<LoanStats>({ totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 });
  const loanHistory = ref<LoanHistoryEntry[]>([]);

  const ownerMatches = (value: unknown, currentAddress: string) => {
    const val = String(value || "");
    if (val === currentAddress) return true;
    return false;
  };

  const loadHistoryFromContract = async () => {
    if (!deps.address.value) return;

    try {
      const contract = await deps.ensureContractAddress();
      const countResult = await read(
        "GetUserLoanCount",
        [{ type: "Hash160", value: deps.address.value }],
        contract,
      );
      const count = Number(countResult || 0);
      if (!count) {
        stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
        loanHistory.value = [];
        return;
      }

      const limit = Math.min(count, 50);
      const idsResult = await read(
        "GetUserLoans",
        [
          { type: "Hash160", value: deps.address.value },
          { type: "Integer", value: "0" },
          { type: "Integer", value: String(limit) },
        ],
        contract,
      );
      const idsRaw = idsResult;
      const idsList = Array.isArray(idsRaw) ? idsRaw : idsRaw != null ? [idsRaw] : [];
      const ids = idsList.map((id) => Number(id)).filter((id) => id > 0);

      const entries = await Promise.all(
        ids.map(async (loanId) => {
          try {
            const parsed = await read(
              "GetLoanDetails",
              [{ type: "Integer", value: String(loanId) }],
              contract,
            );
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
        }),
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

      loanHistory.value = history.slice(0, 20).map((item: Record<string, unknown>) => ({
        icon: item.icon as string,
        label: item.label as string,
        amount: item.amount as number,
        timestamp: new Intl.DateTimeFormat(undefined).format(new Date((item.timestampRaw as number) || Date.now())),
      }));

      const latest = validEntries.reduce((max, entry) => (entry.id > max ? entry.id : max), 0);
      if (latest > 0) {
        await deps.loadLoanPosition(latest);
      }
    } catch (e) {
      handleError(e, { operation: "loadHistoryFromContract" });
      stats.value = { totalLoans: 0, totalBorrowed: 0, totalRepaid: 0 };
      loanHistory.value = [];
    }
  };

  const loadHistory = async () => {
    if (!deps.address.value) return;

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
        .filter((entry) => entry.id > 0 && ownerMatches(entry.borrower, deps.address.value as string));

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
        .filter((entry) => loanIds.has(entry.id) || ownerMatches(entry.borrower, deps.address.value as string));

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
        timestamp: new Intl.DateTimeFormat(undefined).format(new Date(item.timestampRaw || Date.now())),
      }));

      if (created.length > 0) {
        const latest = created.reduce((max, entry) => (entry.id > max ? entry.id : max), 0);
        await deps.loadLoanPosition(latest);
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
