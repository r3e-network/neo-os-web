/**
 * useDevTippingStats — Domain logic for loading developer stats and recent tips
 *
 * Receives ChainService from PlatformServices instead of instantiating
 * its own useContractInteraction / useStatusMessage / useEvents.
 */

import { ref } from "vue";
import type { ChainService } from "@shared/services";
import { parseGas, formatNum } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";

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

export interface UseDevTippingStatsOptions {
  chain: ChainService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useDevTippingStats({ chain, t }: UseDevTippingStatsOptions) {
  const developers = ref<Developer[]>([]);
  const recentTips = ref<RecentTip[]>([]);
  const totalDonated = ref(0);
  const isLoading = ref(false);

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const loadDevelopers = async () => {
    isLoading.value = true;
    try {
      const total = toNumber(await chain.read("totalDevelopers"));

      if (!total) {
        developers.value = [];
        totalDonated.value = 0;
        return;
      }

      const ids = Array.from({ length: total }, (_, i) => i + 1);
      const devs = await Promise.all(
        ids.map(async (id) => {
          const parsed = await chain.read("getDeveloperDetails", [{ type: "Integer", value: id }]);
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
        }),
      );

      totalDonated.value = parseGas(await chain.read("totalDonated"));

      const validDevs = devs.filter((d): d is Developer => d !== null);
      validDevs.sort((a, b) => b.totalTips - a.totalTips);
      validDevs.forEach((dev, idx) => {
        dev.rank = `#${idx + 1}`;
      });
      developers.value = validDevs;
    } catch (_e) {
      console.warn("[useDevTippingStats] stats load failed:", _e instanceof Error ? _e.message : String(_e));
    } finally {
      isLoading.value = false;
    }
  };

  const loadRecentTips = async () => {
    try {
      const events = await chain.listEvents("TipSent", { limit: 20 });
      const devMap = new Map(developers.value.map((dev) => [dev.id, dev.name]));

      recentTips.value = events.map((evt) => {
        const evtRecord = evt as unknown as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const devId = toNumber(values[1] ?? 0);
        const amount = parseGas(values[2]);
        const to = devMap.get(devId) || t("defaultDevName", { id: devId });

        return {
          id: String(evtRecord.id ?? ""),
          to,
          amount: amount.toFixed(2),
          time: new Intl.DateTimeFormat(undefined).format(new Date((evtRecord.created_at as string) || Date.now())),
        };
      });
    } catch (_e) {
      console.warn("[useDevTippingStats] loadRecentTips failed:", _e instanceof Error ? _e.message : String(_e));
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
  };
}
