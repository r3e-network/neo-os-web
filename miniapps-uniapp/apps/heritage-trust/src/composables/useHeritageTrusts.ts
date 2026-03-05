import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { messages } from "@/locale/messages";
import { parseGas, toFixed8, toFixedDecimals } from "@shared/utils/format";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { waitForListedEventByTransaction } from "@shared/utils";
import type { Trust } from "../pages/index/components/TrustCard.vue";

export function useHeritageTrusts() {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeContract, invokeRead, getBalance } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t("error") : t(key)
  );

  const isLoading = ref(false);
  const isLoadingData = ref(false);
  const trusts = ref<Trust[]>([]);
  const { status, setStatus, clearStatus } = useStatusMessage();

  const myCreatedTrusts = computed(() => trusts.value.filter((t) => t.role === "owner"));
  const myBeneficiaryTrusts = computed(() => trusts.value.filter((t) => t.role === "beneficiary"));

  const stats = computed(() => ({
    totalTrusts: trusts.value.length,
    totalNeoValue: trusts.value.reduce((sum, t) => sum + (t.neoValue || 0), 0),
    activeTrusts: trusts.value.filter((t) => t.status === "active" || t.status === "triggered").length,
  }));

  const toNumber = (value: unknown) => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  };

  const toTimestampMs = (value: unknown) => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num > 1e12 ? num : num * 1000;
  };

  const loadData = async () => {
    try {
      if (!address.value) {
        await connect();
      }
      if (!address.value) return;

      isLoadingData.value = true;
      const contract = await ensureContractAddress();

      const totalResult = await invokeRead({
        scriptHash: contract,
        operation: "totalTrusts",
        args: [],
      });
      const totalTrusts = Number(parseInvokeResult(totalResult) || 0);
      const userTrusts: Trust[] = [];
      const now = Date.now();

      for (let i = 1; i <= totalTrusts; i++) {
        const trustResult = await invokeRead({
          scriptHash: contract,
          operation: "getTrustDetails",
          args: [{ type: "Integer", value: i.toString() }],
        });
        const parsed = parseInvokeResult(trustResult);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        const trustData = parsed as Record<string, unknown>;

        // Owner matching logic
        const owner = trustData.owner;
        const primaryHeir = trustData.primaryHeir;
        const ownerVal = String(owner || "");
        const primaryHeirVal = String(primaryHeir || "");
        const addrVal = String(address.value || "");

        const isOwner = ownerVal === addrVal;
        const isBeneficiary = primaryHeirVal === addrVal;

        if (!isOwner && !isBeneficiary) continue;

        const deadlineMs = toTimestampMs(trustData.deadline);
        const rawStatus = String(trustData.status || "");
        const rawReleaseMode = String(trustData.releaseMode || "");
        const onlyRewards = Boolean(trustData.onlyRewards);
        const hasGasRelease = toNumber(trustData.monthlyGas) > 0 && toNumber(trustData.gasPrincipal) > 0;
        const derivedReleaseMode: Trust["releaseMode"] = onlyRewards
          ? "rewards_only"
          : hasGasRelease
            ? "fixed"
            : "neo_rewards";
        const releaseMode: Trust["releaseMode"] =
          rawReleaseMode === "fixed" || rawReleaseMode === "neo_rewards" || rawReleaseMode === "rewards_only"
            ? (rawReleaseMode as Trust["releaseMode"])
            : derivedReleaseMode;

        let status: Trust["status"] = "pending";
        if (rawStatus === "active") status = "active";
        else if (rawStatus === "grace_period") status = "pending";
        else if (rawStatus === "executable") status = "triggered";
        else if (rawStatus === "executed") status = "executed";
        else status = "pending";

        const daysRemaining = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 86400000)) : 0;

        userTrusts.push({
          id: i.toString(),
          name: String(trustData.trustName || t("trustFallback", { id: i })),
          beneficiary: String(trustData.primaryHeir || t("unknown")),
          neoValue: Number(trustData.principal || 0),
          gasPrincipal: parseGas(trustData.gasPrincipal || 0),
          accruedYield: parseGas(trustData.accruedYield || 0),
          claimedYield: parseGas(trustData.claimedYield || 0),
          monthlyNeo: Number(trustData.monthlyNeo || 0),
          monthlyGas: parseGas(trustData.monthlyGas || 0),
          onlyRewards,
          releaseMode,
          totalNeoReleased: Number(trustData.totalNeoReleased || 0),
          totalGasReleased: parseGas(trustData.totalGasReleased || 0),
          createdTime: trustData.createdTime
            ? new Date(Number(trustData.createdTime) * 1000).toISOString().split("T")[0]
            : t("unknown"),
          icon: isOwner ? "📜" : "🎁",
          status,
          daysRemaining,
          deadline: deadlineMs ? new Date(deadlineMs).toISOString().split("T")[0] : t("notAvailable"),
          canExecute: status === "triggered",
          role: isOwner ? "owner" : "beneficiary",
          executed: Boolean(trustData.executed),
        });
      }

      trusts.value = userTrusts.sort((a, b) => Number(b.id) - Number(a.id));
    } catch {
      // Silent fail
    } finally {
      isLoadingData.value = false;
    }
  };

  const heartbeatTrust = async (trust: Trust) => {
    if (isLoading.value) return;
    try {
      isLoading.value = true;
      if (!address.value) {
        await connect();
      }
      if (!address.value) throw new Error(t("error"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "heartbeat",
        args: [{ type: "Integer", value: trust.id }],
      });
      setStatus(t("heartbeat"), "success");
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const claimYield = async (trust: Trust) => {
    if (isLoading.value) return;
    try {
      isLoading.value = true;
      if (!address.value) {
        await connect();
      }
      if (!address.value) throw new Error(t("error"));
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "claimYield",
        args: [{ type: "Integer", value: trust.id }],
      });
      setStatus(t("claimYield"), "success");
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const claimReleased = async (trust: Trust) => {
    if (isLoading.value) return;
    try {
      isLoading.value = true;
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "claimReleasedAssets",
        args: [{ type: "Integer", value: trust.id }],
      });
      setStatus(t("claimReleased"), "success");
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const executeTrust = async (trust: Trust) => {
    if (isLoading.value) return;
    try {
      isLoading.value = true;
      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "executeTrust",
        args: [{ type: "Integer", value: trust.id }],
      });
      setStatus(t("executeTrust"), "success");
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  const createTrust = async (
    form: {
      name: string;
      beneficiary: string;
      neoValue: string;
      gasValue: string;
      monthlyNeo: string;
      monthlyGas: string;
      releaseMode: string;
      intervalDays: string;
      notes: string;
    },
    saveTrustName: (id: string, name: string) => void,
    onSuccess: () => void
  ) => {
    const neoAmount = Number(toFixedDecimals(form.neoValue, 0));
    let gasAmountDisplay = Number.parseFloat(form.gasValue);
    if (!Number.isFinite(gasAmountDisplay)) gasAmountDisplay = 0;

    let monthlyNeoAmount = Number(toFixedDecimals(form.monthlyNeo, 0));
    let monthlyGasDisplay = Number.parseFloat(form.monthlyGas);
    if (!Number.isFinite(monthlyGasDisplay)) monthlyGasDisplay = 0;
    const intervalDays = Number(toFixedDecimals(form.intervalDays, 0));
    const releaseMode = form.releaseMode;

    const onlyRewards = releaseMode === "rewardsOnly";
    if (releaseMode !== "fixed") {
      gasAmountDisplay = 0;
      monthlyGasDisplay = 0;
    }
    if (releaseMode === "rewardsOnly") {
      monthlyNeoAmount = 0;
    }
    if (neoAmount <= 0) {
      monthlyNeoAmount = 0;
    }
    if (gasAmountDisplay <= 0) {
      monthlyGasDisplay = 0;
    }

    if (
      isLoading.value ||
      !form.name.trim() ||
      !form.beneficiary ||
      !(neoAmount > 0 || gasAmountDisplay > 0) ||
      !(intervalDays > 0)
    ) {
      return;
    }

    try {
      isLoading.value = true;
      setStatus(t("creating"), "loading");

      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("error"));
      }

      if (onlyRewards && neoAmount <= 0) {
        throw new Error(t("rewardsRequireNeo"));
      }
      if (!onlyRewards && neoAmount > 0 && monthlyNeoAmount <= 0) {
        throw new Error(t("invalidReleaseSchedule"));
      }
      if (releaseMode === "fixed" && gasAmountDisplay > 0 && monthlyGasDisplay <= 0) {
        throw new Error(t("invalidReleaseSchedule"));
      }

      const neo = await getBalance("NEO");
      const neoBalance = typeof neo === "string" ? parseFloat(neo) || 0 : typeof neo === "number" ? neo : 0;
      if (neoAmount > neoBalance) {
        throw new Error(t("insufficientNeo"));
      }
      if (gasAmountDisplay > 0) {
        const gas = await getBalance("GAS");
        const gasBalance = typeof gas === "string" ? parseFloat(gas) || 0 : typeof gas === "number" ? gas : 0;
        if (gasAmountDisplay > gasBalance) {
          throw new Error(t("insufficientGas"));
        }
      }

      const contract = await ensureContractAddress();
      if (!contract) {
        throw new Error(t("error"));
      }

      const tx = await invokeContract({
        scriptHash: contract,
        operation: "createTrust",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: form.beneficiary },
          { type: "Integer", value: neoAmount },
          { type: "Integer", value: toFixed8(gasAmountDisplay) },
          { type: "Integer", value: intervalDays },
          { type: "Integer", value: monthlyNeoAmount },
          { type: "Integer", value: toFixed8(monthlyGasDisplay) },
          { type: "Boolean", value: onlyRewards },
          { type: "String", value: form.name.trim().slice(0, 100) },
          { type: "String", value: form.notes.trim().slice(0, 300) },
          { type: "Integer", value: "0" },
        ],
      });

      const timeoutErrorMessage = "__TRUST_CREATED_EVENT_TIMEOUT__";
      try {
        const match = await waitForListedEventByTransaction(tx, {
          listEvents: async () => {
            const { useEvents } = await import("@neo/uniapp-sdk");
            const { list } = useEvents();
            const res = await list({ app_id: "miniapp-heritage-trust", event_name: "TrustCreated", limit: 25 });
            return res.events || [];
          },
          timeoutMs: 30000,
          pollIntervalMs: 1500,
          errorMessage: timeoutErrorMessage,
        });

        if (match) {
          const values = Array.isArray(match.state) ? match.state.map(parseStackItem) : [];
          const trustId = String(values[0] || "");
          if (trustId) {
            saveTrustName(trustId, form.name);
          }
        }
      } catch (e: unknown) {
        if (!(e instanceof Error) || e.message !== timeoutErrorMessage) {
          throw e;
        }
      }

      setStatus(t("trustCreated"), "success");
      onSuccess();
      await loadData();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    isLoadingData,
    trusts,
    myCreatedTrusts,
    myBeneficiaryTrusts,
    stats,
    status,
    setStatus,
    clearStatus,
    loadData,
    heartbeatTrust,
    claimYield,
    claimReleased,
    executeTrust,
    createTrust,
    ensureContractAddress,
  };
}
