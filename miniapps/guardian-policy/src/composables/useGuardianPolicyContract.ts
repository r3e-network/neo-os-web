import { ref, computed } from "vue";
import type { WalletSDK } from "@neo/types";
import { ownerMatchesAddress, parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { Policy, Level } from "../pages/index/components/PoliciesList.vue";
import type { ActionHistoryItem } from "../pages/index/components/ActionHistory.vue";

export function useGuardianPolicyContract(
  wallet: WalletSDK,
  ensureContractAddress: () => Promise<string>,
  listAllEvents: (eventName: string) => Promise<Array<{ id: string; state?: unknown[]; created_at?: string }>>,
  processPayment: (amount: string, memo: string) => Promise<{ receiptId: string | null; invoke: (...args: unknown[]) => Promise<unknown> }>,
  setStatus: (msg: string, type: "success" | "error" | "loading") => void,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  const { address, connect, invokeContract, invokeRead } = wallet;

  const policies = ref<Policy[]>([]);
  const actionHistory = ref<ActionHistoryItem[]>([]);
  const assetType = ref("");
  const policyType = ref(1);
  const coverage = ref("");
  const threshold = ref("");
  const startPrice = ref("");
  const priceDecimals = ref(8);

  const premiumDisplay = computed(() => {
    const amount = parseFloat(coverage.value);
    if (!Number.isFinite(amount) || amount <= 0) return "0";
    return (amount * 0.05).toFixed(2);
  });

  const stats = computed(() => ({
    totalPolicies: policies.value.length,
    activePolicies: policies.value.filter((p) => p.active && !p.claimed).length,
    claimedPolicies: policies.value.filter((p) => p.claimed).length,
    totalCoverage: policies.value.reduce((sum, p) => sum + (p.coverageValue || 0), 0),
  }));

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  const formatWithDecimals = (value: string, decimals: number) => {
    const cleaned = String(value || "").replace(/[^\d]/g, "");
    if (!cleaned) return "0";
    const padded = cleaned.padStart(decimals + 1, "0");
    const whole = padded.slice(0, -decimals);
    const frac = padded.slice(-decimals).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : whole;
  };

  const toInteger = (value: string, decimals: number) => {
    const normalized = String(value || "").trim();
    const [wholeRaw, fracRaw = ""] = normalized.split(".");
    const whole = wholeRaw.replace(/[^\d]/g, "") || "0";
    const frac = fracRaw.replace(/[^\d]/g, "");
    const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
    const combined = `${whole}${padded}`.replace(/^0+/, "");
    return combined || "0";
  };

  const levelFromThreshold = (thresholdPercent: number): Level => {
    if (thresholdPercent <= 10) return "critical";
    if (thresholdPercent <= 20) return "high";
    if (thresholdPercent <= 30) return "medium";
    return "low";
  };

  const parsePolicyStruct = (raw: unknown) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const data = raw as Record<string, unknown>;
      return {
        holder: data.holder,
        assetType: String(data.assetType || ""),
        coverage: Number(data.coverage || 0),
        premium: Number(data.premium || 0),
        startPrice: String(data.startPrice || "0"),
        threshold: Number(data.thresholdPercent || 0),
        startTime: Number(data.startTime || 0),
        endTime: Number(data.endTime || 0),
        active: Boolean(data.active),
        claimed: Boolean(data.claimed),
      };
    }
    const data = Array.isArray(raw) ? raw : [];
    return {
      holder: data[0],
      assetType: String(data[1] || ""),
      coverage: Number(data[2] || 0),
      premium: Number(data[3] || 0),
      startPrice: String(data[4] || "0"),
      threshold: Number(data[5] || 0),
      startTime: Number(data[6] || 0),
      endTime: Number(data[7] || 0),
      active: Boolean(data[8]),
      claimed: Boolean(data[9]),
    };
  };

  const fetchPolicies = async () => {
    if (!address.value) return;
    const createdEvents = await listAllEvents("PolicyCreated");
    const policyIds = createdEvents
      .map((evt) => {
        const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
        return {
          id: String(values[0] || ""),
          holder: values[1],
        };
      })
      .filter((entry) => entry.id && ownerMatches(entry.holder))
      .map((entry) => entry.id);

    const uniqueIds = Array.from(new Set(policyIds));
    const contract = await ensureContractAddress();
    const policyList: Policy[] = [];

    for (const id of uniqueIds) {
      const res = await invokeRead({
        scriptHash: contract,
        operation: "GetPolicyDetails",
        args: [{ type: "Integer", value: id }],
      });
      const parsed = parseInvokeResult(res);
      const data = parsePolicyStruct(parsed);
      if (!data.assetType) continue;

      const coverageGas = data.coverage / 1e8;
      const endTimeMs = data.endTime > 1e12 ? data.endTime : data.endTime * 1000;
      const endDate = endTimeMs ? new Date(endTimeMs).toISOString().split("T")[0] : t("notAvailable");
      const description = t("policyDescription", {
        coverage: coverageGas.toFixed(2),
        threshold: data.threshold,
        date: endDate,
      });

      policyList.push({
        id,
        name: data.assetType,
        description,
        active: data.active,
        claimed: data.claimed,
        level: levelFromThreshold(data.threshold),
        coverageValue: coverageGas,
      });
    }

    policies.value = policyList;
  };

  const fetchHistory = async () => {
    const [createdEvents, claimEvents, processedEvents] = await Promise.all([
      listAllEvents("PolicyCreated"),
      listAllEvents("ClaimRequested"),
      listAllEvents("ClaimProcessed"),
    ]);

    const history: ActionHistoryItem[] = [];
    const userPolicyIds = new Set<string>();

    createdEvents.forEach((evt) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
      const policyId = String(values[0] || "");
      const holder = values[1];
      if (!policyId || !ownerMatches(holder)) return;
      userPolicyIds.add(policyId);
      history.push({
        id: evt.id,
        action: `${t("policyCreated")} #${policyId}`,
        time: new Date(evt.created_at || Date.now()).toLocaleString(),
        type: "create",
      });
    });

    claimEvents.forEach((evt) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
      const policyId = String(values[0] || "");
      if (!policyId || !userPolicyIds.has(policyId)) return;
      history.push({
        id: evt.id,
        action: `${t("requestClaim")} #${policyId}`,
        time: new Date(evt.created_at || Date.now()).toLocaleString(),
        type: "claim",
      });
    });

    processedEvents.forEach((evt) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
      const policyId = String(values[0] || "");
      const approved = Boolean(values[2]);
      const payout = Number(values[3] || 0) / 1e8;
      if (!policyId || !userPolicyIds.has(policyId)) return;
      history.push({
        id: evt.id,
        action: `${t("claimProcessed")} #${policyId} · ${approved ? "Approved" : "Denied"} · ${payout.toFixed(2)} GAS`,
        time: new Date(evt.created_at || Date.now()).toLocaleString(),
        type: "processed",
      });
    });

    actionHistory.value = history.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);
  };

  const refreshData = async () => {
    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) return;
      await fetchPolicies();
      await fetchHistory();
    } catch (e: unknown) {
      /* non-critical: guardian policy refresh */
    }
  };

  const fetchPrice = async (getPrice: (symbol: string) => Promise<{ price?: string; decimals?: number } | null>) => {
    if (!assetType.value) {
      setStatus(t("fillAllFields"), "error");
      return;
    }
    try {
      const symbol = assetType.value.trim().replace("/", "-");
      const price = await getPrice(symbol);
      if (price?.price) {
        priceDecimals.value = price.decimals ?? 8;
        startPrice.value = formatWithDecimals(price.price, priceDecimals.value);
        setStatus(t("priceFetched"), "success");
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const createPolicy = async () => {
    if (!assetType.value || !coverage.value || !threshold.value || !startPrice.value) {
      setStatus(t("fillAllFields"), "error");
      return;
    }

    const coverageInt = toInteger(coverage.value, 8);
    const startPriceInt = toInteger(startPrice.value, priceDecimals.value);
    const thresholdPercent = Math.floor(Number(threshold.value));
    const selectedPolicyType = Number(policyType.value);

    if (
      Number(coverageInt) <= 0 ||
      Number(startPriceInt) <= 0 ||
      thresholdPercent <= 0 ||
      thresholdPercent > 50 ||
      selectedPolicyType < 1 ||
      selectedPolicyType > 3
    ) {
      setStatus(t("fillAllFields"), "error");
      return;
    }

    try {
      setStatus(t("creatingPolicy"), "loading");
      if (!address.value) {
        await connect();
      }
      if (!address.value) throw new Error(t("error"));

      const contract = await ensureContractAddress();
      const { receiptId, invoke } = await processPayment(premiumDisplay.value || "0", `policy:${assetType.value.trim()}`);
      if (!receiptId) throw new Error(t("receiptMissing"));
      await invoke(
        "createPolicy",
        [
          { type: "Hash160", value: address.value },
          { type: "String", value: assetType.value.trim() },
          { type: "Integer", value: String(selectedPolicyType) },
          { type: "Integer", value: coverageInt },
          { type: "Integer", value: startPriceInt },
          { type: "Integer", value: String(thresholdPercent) },
          { type: "Integer", value: String(receiptId) },
        ],
        contract,
      );
      setStatus(t("policyCreated"), "success");
      assetType.value = "";
      coverage.value = "";
      threshold.value = "";
      startPrice.value = "";
      await refreshData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const requestClaim = async (policyId: string) => {
    if (!policyId) return;
    try {
      setStatus(t("claimRequested"), "loading");
      if (!address.value) {
        await connect();
      }
      if (!address.value) throw new Error(t("error"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "RequestClaim",
        args: [{ type: "Integer", value: policyId }],
      });
      setStatus(t("claimRequested"), "success");
      await refreshData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  return {
    // State
    policies,
    actionHistory,
    assetType,
    policyType,
    coverage,
    threshold,
    startPrice,
    premiumDisplay,
    stats,
    // Actions
    refreshData,
    fetchPrice,
    createPolicy,
    requestClaim,
  };
}
