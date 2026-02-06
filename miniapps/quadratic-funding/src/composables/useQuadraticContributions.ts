import type { Ref } from "vue";
import { ref, reactive } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { requireNeoChain } from "@shared/utils/chain";
import type { RoundItem } from "../pages/index/components/RoundList.vue";
import type { ProjectItem } from "../pages/index/components/ProjectList.vue";

export function useQuadraticContributions(
  selectedRound: Ref<RoundItem | null>,
  ensureContractAddress: () => Promise<string>,
  setStatus: (msg: string, type: "success" | "error") => void,
  refreshProjects: () => Promise<void>,
  refreshRounds: () => Promise<void>
) {
  const { t } = useI18n();
  const { address, connect, invokeContract, chainType } = useWallet() as WalletSDK;

  const isContributing = ref(false);

  const contributeForm = reactive({
    roundId: "",
    projectId: "",
    amount: "",
    memo: "",
  });

  const selectProject = (project: ProjectItem) => {
    contributeForm.projectId = project.id;
    contributeForm.roundId = project.roundId;
  };

  const contribute = async (data: { roundId: string; projectId: string; amount: string; memo: string }) => {
    if (!requireNeoChain(chainType, t)) return;
    if (isContributing.value) return;
    if (!selectedRound.value) {
      setStatus(t("noSelectedRound"), "error");
      return;
    }

    const parsedProjectId = Number.parseInt(data.projectId.trim(), 10);
    if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0) {
      setStatus(t("invalidContribution"), "error");
      return;
    }

    const decimals = selectedRound.value.assetSymbol === "NEO" ? 0 : 8;
    const amount = (() => {
      const [intPart, fracPart = ""] = data.amount.split(".");
      // NEO is indivisible — reject fractional amounts explicitly
      if (decimals === 0 && fracPart.length > 0) {
        setStatus(t("neoNoFractional"), "error");
        return null;
      }
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const value = `${intPart}${normalized}`;
      return value.replace(/^0+/, "") || "0";
    })();

    if (amount === null) return;

    if (!amount || amount === "0") {
      setStatus(t("invalidContribution"), "error");
      return;
    }

    try {
      isContributing.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const memo = data.memo.trim().slice(0, 160);

      await invokeContract({
        scriptHash: contract,
        operation: "contribute",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: selectedRound.value.id },
          { type: "Integer", value: String(parsedProjectId) },
          { type: "Integer", value: amount },
          { type: "String", value: memo },
        ],
      });

      setStatus(t("contributionSent"), "success");
      await refreshProjects();
      await refreshRounds();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isContributing.value = false;
    }
  };

  const goToContribute = (project: ProjectItem, activeTab: Ref<string>) => {
    selectProject(project);
    activeTab.value = "contribute";
  };

  return {
    isContributing,
    contributeForm,
    selectProject,
    contribute,
    goToContribute,
  };
}
