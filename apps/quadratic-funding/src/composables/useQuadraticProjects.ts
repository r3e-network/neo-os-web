import { createObservable, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import type { ProjectItem } from "../pages/index/components/ProjectList";
import type { RoundItem } from "../pages/index/components/RoundList";

export function useQuadraticProjects(
  selectedRound: Observable<RoundItem | null>,
  ensureContractAddress: () => Promise<string>,
  setStatus: (msg: string, type: "success" | "error") => void
) {
  const { t } = createUseI18n(messages)();
  const wallet = useWallet() as WalletSDK;
  const address = refToObservable(wallet.address);
  const chainType = refToObservable(wallet.chainType);
  const { read, invokeDirectly, ensureWallet } = useContractInteraction({
    appId: "miniapp-quadratic-funding",
    t,
    wallet,
  });

  const projects = createObservable<ProjectItem[]>([]);
  const isRefreshingProjects = createObservable(false);
  const isRegisteringProject = createObservable(false);
  const claimingProjectId = createObservable<string | null>(null);

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
    if (!selectedRound.get()) return;
    if (isRefreshingProjects.get()) return;
    try {
      isRefreshingProjects.set(true);
      const ids = await fetchProjectIds(selectedRound.get().id);
      const details = await Promise.all(ids.map(fetchProjectDetails));
      projects.set(details.filter(Boolean) as ProjectItem[]);
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isRefreshingProjects.set(false);
    }
  };

  const registerProject = async (data: { name: string; description: string; link: string }) => {
    if (!requireNeoChain(chainType, t)) return;
    if (isRegisteringProject.get()) return;
    if (!selectedRound.get()) {
      setStatus(t("noSelectedRound"), "error");
      return;
    }

    const name = data.name.trim().slice(0, 60);
    if (!name) {
      setStatus(t("invalidProject"), "error");
      return;
    }

    try {
      isRegisteringProject.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const description = data.description.trim().slice(0, 300);
      const link = data.link.trim().slice(0, 200);

      await invokeDirectly(
        "registerProject",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Integer", value: selectedRound.get().id },
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
      isRegisteringProject.set(false);
    }
  };

  const canClaimProject = (project: ProjectItem) => {
    if (!selectedRound.get() || !address.get()) return false;
    return (
      selectedRound.get().finalized &&
      !selectedRound.get().cancelled &&
      !project.claimed &&
      project.owner === address.get()
    );
  };

  const claimProject = async (project: ProjectItem) => {
    if (!requireNeoChain(chainType, t)) return;
    if (claimingProjectId.get()) return;

    try {
      claimingProjectId.set(project.id);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      await invokeDirectly(
        "claimProject",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Integer", value: project.id },
        ],
        contract,
      );

      setStatus(t("projectClaimed"), "success");
      await refreshProjects();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      claimingProjectId.set(null);
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
