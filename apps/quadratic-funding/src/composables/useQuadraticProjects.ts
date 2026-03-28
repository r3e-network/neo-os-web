import type { Ref } from "vue";
import { ref, watch, onUnmounted } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { ProjectItem } from "../pages/index/components/ProjectList.vue";
import type { RoundItem } from "../pages/index/components/RoundList.vue";

export function useQuadraticProjects(
  selectedRound: Ref<RoundItem | null>,
  ensureContractAddress: () => Promise<string>,
  setStatus: (msg: string, type: "success" | "error") => void
) {
  const { t } = createUseI18n(messages)();
  const wallet = useWallet() as WalletSDK;
  const { address, chainType } = wallet;
  const { read, invokeDirectly, ensureWallet } = useContractInteraction({
    appId: "miniapp-quadratic-funding",
    t,
    wallet,
  });

  const projects = ref<ProjectItem[]>([]);
  const isRefreshingProjects = ref(false);
  const isRegisteringProject = ref(false);
  const claimingProjectId = ref<string | null>(null);

  const parseBigInt = (value: unknown) => {
    try {
      return BigInt(String(value ?? "0"));
    } catch (_e) {
      return 0n;
    }
  };

  const parseBool = (value: unknown) => value === true || value === "true" || value === 1 || value === "1";

  const parseProject = (raw: Record<string, unknown>, id: string): ProjectItem | null => {
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
    const parsed = await read("getRoundProjects", [
      { type: "Integer", value: roundId },
      { type: "Integer", value: "0" },
      { type: "Integer", value: "50" },
    ], contract);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => Number.parseInt(String(value || "0"), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchProjectDetails = async (projectId: string) => {
    const contract = await ensureContractAddress();
    const parsed = await read("getProjectDetails", [{ type: "Integer", value: projectId }], contract);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseProject(parsed as Record<string, unknown>, projectId);
  };

  const refreshProjects = async () => {
    if (!selectedRound.value) return;
    if (isRefreshingProjects.value) return;
    try {
      isRefreshingProjects.value = true;
      const ids = await fetchProjectIds(selectedRound.value.id);
      const details = await Promise.all(ids.map(fetchProjectDetails));
      projects.value = details.filter(Boolean) as ProjectItem[];
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
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
      await ensureWallet();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const description = data.description.trim().slice(0, 300);
      const link = data.link.trim().slice(0, 200);

      await invokeDirectly(
        "registerProject",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: selectedRound.value.id },
          { type: "String", value: name },
          { type: "String", value: description },
          { type: "String", value: link },
        ],
        contract,
      );

      setStatus(t("projectRegistered"), "success");
      await refreshProjects();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
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
      await ensureWallet();
      if (!address.value) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeDirectly(
        "claimProject",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: project.id },
        ],
        contract,
      );

      setStatus(t("projectClaimed"), "success");
      await refreshProjects();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
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

  const isMounted = ref(true);

  const stopRoundWatch = watch(
    () => selectedRound.value?.id,
    async (roundId) => {
      if (!isMounted.value) return;
      if (roundId) {
        try {
          await refreshProjects();
        } catch (_e) {
          console.warn("[useQuadraticProjects] refreshProjects failed:", _e instanceof Error ? _e.message : String(_e));
        }
      }
    }
  );

  const stopAddressWatch = watch(address, async (newAddr) => {
    if (!isMounted.value) return;
    if (!newAddr) {
      try {
        claimingProjectId.value = null;
      } catch (_e) {
        console.warn("[useQuadraticProjects] address change failed:", _e instanceof Error ? _e.message : String(_e));
      }
    }
  });

  onUnmounted(() => {
    isMounted.value = false;
    stopRoundWatch();
    stopAddressWatch();
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
