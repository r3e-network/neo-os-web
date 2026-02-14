import { ref } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { parseGas, formatNumber } from "@shared/utils/format";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";

export interface Developer {
  id: number;
  name: string;
  role: string;
  wallet: string;
  totalTips: number;
  tipCount: number;
  balance: number;
  rank: string;
}

export interface RecentTip {
  id: string;
  to: string;
  amount: string;
  time: string;
}

export function useDevTippingStats() {
  const { invokeRead } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? "Contract unavailable" : key,
  );

  const developers = ref<Developer[]>([]);
  const recentTips = ref<RecentTip[]>([]);
  const totalDonated = ref(0);
  const isLoading = ref(false);

  const formatNum = (n: number) => formatNumber(n, 2);

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const loadDevelopers = async (t: Function) => {
    isLoading.value = true;
    try {
      const contract = await ensureContractAddress();
      const totalRes = await invokeRead({
        scriptHash: contract,
        operation: "totalDevelopers",
        args: [],
      });
      const total = toNumber(parseInvokeResult(totalRes));

      if (!total) {
        developers.value = [];
        totalDonated.value = 0;
        return;
      }

      const ids = Array.from({ length: total }, (_, i) => i + 1);
      const devs = await Promise.all(
        ids.map(async (id) => {
          const detailsRes = await invokeRead({
            scriptHash: contract,
            operation: "getDeveloperDetails",
            args: [{ type: "Integer", value: id }],
          });
          const parsed = parseInvokeResult(detailsRes);
          const details =
            parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
          const name = String(details.name || "").trim();
          const role = String(details.role || "").trim();
          const wallet = String(details.wallet || "").trim();
          const totalReceived = parseGas(details.totalReceived ?? 0);
          const tipCount = toNumber(details.tipCount);
          const balance = parseGas(details.balance ?? 0);

          if (!wallet) return null;

          return {
            id,
            name: name || t("defaultDevName", { id }),
            role: role || t("defaultDevRole"),
            wallet,
            totalTips: totalReceived,
            tipCount,
            balance,
            rank: "",
          };
        })
      );

      const donatedRes = await invokeRead({
        scriptHash: contract,
        operation: "totalDonated",
        args: [],
      });
      totalDonated.value = parseGas(parseInvokeResult(donatedRes));

      const validDevs = devs.filter((d): d is Developer => d !== null);
      validDevs.sort((a, b) => b.totalTips - a.totalTips);
      validDevs.forEach((dev, idx) => {
        dev.rank = `#${idx + 1}`;
      });
      developers.value = validDevs;
    } catch (_e: unknown) {
      // Stats load failure is non-critical
    } finally {
      isLoading.value = false;
    }
  };

  const loadRecentTips = async (APP_ID: string, t: Function) => {
    try {
      const res = await listEvents({ app_id: APP_ID, event_name: "TipSent", limit: 20 });
      const devMap = new Map(developers.value.map((dev) => [dev.id, dev.name]));

      recentTips.value = res.events.map((evt) => {
        const evtRecord = evt as unknown as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const devId = toNumber(values[1] ?? 0);
        const amount = parseGas(values[2]);
        const to = devMap.get(devId) || t("defaultDevName", { id: devId });

        return {
          id: evt.id,
          to,
          amount: amount.toFixed(2),
          time: new Date(evt.created_at || Date.now()).toLocaleString(),
        };
      });
    } catch (_e: unknown) {
      // Stats load failure is non-critical
    }
  };

  return {
    developers,
    recentTips,
    totalDonated,
    isLoading,
    formatNum,
    loadDevelopers,
    loadRecentTips,
    ensureContractAddress,
  };
}
