import type { Ref } from "vue";
import { ref, computed, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "./useI18n";
import { requireNeoChain } from "@shared/utils/chain";
import { parseInvokeResult } from "@shared/utils/neo";
import type { ProjectItem } from "../pages/index/components/ProjectList.vue";
import type { RoundItem } from "../pages/index/components/RoundList.vue";

export function useQuadraticProjects(
  selectedRound: Ref<RoundItem | null>,
  ensureContractAddress: () => Promise<string>,
  setStatus: (msg: string, type: "success" | "error") => void
) {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead, chainType } = useWallet() as WalletSDK;

  const projects = ref<ProjectItem[]>([]);
  const isRefreshingProjects = ref(false);
  const isRegisteringProject = ref(false);
  const claimingProjectId = ref<string | null>(null);

  const parseBigInt = (value: unknown) => {
    try {
      return BigInt(String(value ?? "0"));
    } catch {
      return 0n;
    }
  };

  const parseBool = (value: unknown) =>
    value === true || value === "true" || value === 1 || value === "1";

  const parseProject = (raw: any, id: string): ProjectItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      id,
      roundId: String(raw.roundId || ""),
      owner: String(raw.owner || ""),
      name: String(raw.name || ""),
      description: String(raw.description || ""),
      link: String(raw.link || ""),
      totalContributed: parseBigInt(raw.totalContributed),
      contributorCount: parseBigInt(raw.contributorCount),
      matchedAmount: parseBigInt(raw.matchedAmount),
      active: parseBool(raw.active),
      claimed: parseBool(raw.claimed),
      status: String(raw.status || ""),
    };
  };

  const fetchProjectIds = async (roundId: string) => {
    const contract = await ensureContractAddress();
    const result = await invokeRead({
      contractAddress: contract,
      operation: "getRoundProjects",
      args: [
        { type: "Integer", value: roundId },
        { type: "Integer", value: "0" },
        { type: "Integer", value: "50" },
      ],
    });
    const parsed = parseInvokeResult(result);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => Number.parseInt(String(value || "0"), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchProjectDetails = async (projectId: string) => {
    const contract = await ensureContractAddress();
    const details = await invokeRead({
      contractAddress: contract,
      operation: "getProjectDetails",
      args: [{ type: "Integer", value: projectId }],
    });
    const parsed = parseInvokeResult(details) as any;
    return parseProject(parsed, projectId);
  };

  const refreshProjects = async () => {
    if (!selectedRound.value) return;
    if (isRefreshingProjects.value) return;
    try {
      isRefreshingProjects.value = true;
      const ids = await fetchProjectIds(selectedRound.value.id);
      const details = await Promise.all(ids.map(fetchProjectDetails));
      projects.value = details.filter(Boolean) as ProjectItem[];
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isRefreshingProjects.value = false;
    }
  };

  const registerProject = async (data: { name: string; description: string; link: string }) => {
    if (!requireNeoChain(chainType, t)) return;
    if (isRegisteringProject.value) return;
    if (!selectedRound.value) {
      setStatus(t("noSelectedRound"), "error");
      return;
    }

    const name = data.name.trim().slice(0, 60);
    if (!name) {
      setStatus(t("invalidProject"), "error");
      return;
    }

    try {
      isRegisteringProject.value = true;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const description = data.description.trim().slice(0, 300);
      const link = data.link.trim().slice(0, 200);

      await invokeContract({
        scriptHash: contract,
        operation: "registerProject",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: selectedRound.value.id },
          { type: "String", value: name },
          { type: "String", value: description },
          { type: "String", value: link },
        ],
      });

      setStatus(t("projectRegistered"), "success");
      await refreshProjects();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      isRegisteringProject.value = false;
    }
  };

  const canClaimProject = (project: ProjectItem) => {
    if (!selectedRound.value || !address.value) return false;
    return (
      selectedRound.value.finalized &&
      !selectedRound.value.cancelled &&
      !project.claimed &&
      project.owner === address.value
    );
  };

  const claimProject = async (project: ProjectItem) => {
    if (!requireNeoChain(chainType, t)) return;
    if (claimingProjectId.value) return;

    try {
      claimingProjectId.value = project.id;
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeContract({
        scriptHash: contract,
        operation: "claimProject",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Integer", value: project.id },
        ],
      });

      setStatus(t("projectClaimed"), "success");
      await refreshProjects();
    } catch (e: any) {
      setStatus(e.message || t("contractMissing"), "error");
    } finally {
      claimingProjectId.value = null;
    }
  };

  const projectStatusLabel = (project: ProjectItem) => {
    if (project.claimed) return t("projectStatusClaimed");
    return project.active ? t("projectStatusActive") : t("projectStatusInactive");
  };

  const projectStatusClass = (project: ProjectItem) => {
    if (project.claimed) return "claimed";
    return project.active ? "active" : "inactive";
  };

  watch(
    () => selectedRound.value?.id,
    async (roundId) => {
      if (roundId) await refreshProjects();
    }
  );

  watch(address, async (newAddr) => {
    if (!newAddr) claimingProjectId.value = null;
  });

  return {
    projects,
    isRefreshingProjects,
    isRegisteringProject,
    claimingProjectId,
    refreshProjects,
    registerProject,
    canClaimProject,
    claimProject,
    projectStatusLabel,
    projectStatusClass,
  };
}
