import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { messages } from "@/locale/messages";
import { parseGas, toFixed8, toFixedDecimals, sleep } from "@shared/utils/format";
import { parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { Trust } from "../pages/index/components/TrustCard.vue";

const APP_ID = "miniapp-heritage-trust";

export function useHeritageTrusts() {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeContract, invokeRead, getBalance } = useWallet() as WalletSDK;
  const { list: listEvents } = useEvents();
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t("error") : t(key),
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

  const waitForEvent = async (txid: string, eventName: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 25 });
      const match = res.events.find((evt) => evt.tx_hash === txid);
      if (match) return match;
      await sleep(1500);
    }
    return null;
  };

  const fetchData = async () => {
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
      await fetchData();
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
      await fetchData();
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
      await fetchData();
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
      await fetchData();
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
    fetchData,
    heartbeatTrust,
    claimYield,
    claimReleased,
    executeTrust,
    ensureContractAddress,
  };
}
