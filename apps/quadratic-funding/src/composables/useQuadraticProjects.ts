/**
 * useQuadraticProjects — project listing, claim eligibility and the
 * register/claim write flows, rewritten onto the MiniApp framework SDK
 * (reads via app.chain.readRaw, writes via app.chain.invoke; messaging owned
 * by the shared flow kit so banner/notify copy stays byte-identical).
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { ownerMatchesAddress, parseHash160 } from "@shared/utils/neo";
import type { QuadraticFlowKit, Translator } from "./quadraticFlowKit";
import type { ProjectItem, RoundItem } from "./quadraticTypes";

export interface UseQuadraticProjectsOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: Translator;
  /** Shared flow plumbing (guard/banner/preconditions). */
  kit: QuadraticFlowKit;
  /** Currently selected round (owned by useQuadraticRounds). */
  selectedRound: Observable<RoundItem | null>;
}

export function useQuadraticProjects({
  app,
  t,
  kit,
  selectedRound,
}: UseQuadraticProjectsOptions) {
  const { arg } = app.chain;
  const address = app.chain.address as Observable<string | null>;

  const projects = createObservable<ProjectItem[]>([]);
  const isRefreshingProjects = createObservable(false);
  const isRegisteringProject = createObservable(false);
  const claimingProjectId = createObservable<string | null>(null);

  const parseProject = (raw: Record<string, unknown>, id: string): ProjectItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      id,
      roundId: String(raw.roundId || ""),
      // Normalize the contract UInt160 owner to display-order 0x hex so
      // canClaimProject can match it against the connected wallet.
      owner: parseHash160(raw.owner) || String(raw.owner || ""),
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
    const parsed = await app.chain.readRaw("getRoundProjects", [
      arg.integer(roundId),
      arg.integer(0),
      arg.integer(50),
    ]);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => Number.parseInt(String(value || "0"), 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchProjectDetails = async (projectId: string) => {
    const parsed = await app.chain.readRaw("getProjectDetails", [arg.integer(projectId)]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseProject(parsed as Record<string, unknown>, projectId);
  };

  const refreshProjects = async () => {
    if (!selectedRound.get()) return;
    if (isRefreshingProjects.get()) return;
    try {
      isRefreshingProjects.set(true);
      const ids = await fetchProjectIds(selectedRound.get()!.id);
      const details = await Promise.all(ids.map(fetchProjectDetails));
      projects.set(details.filter(Boolean) as ProjectItem[]);
    } catch (e) {
      kit.reportError(e);
    } finally {
      isRefreshingProjects.set(false);
    }
  };

  const registerProject = async (data: {
    name: string;
    description: string;
    link: string;
  }): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (isRegisteringProject.get()) return false;
    if (!selectedRound.get()) {
      kit.setStatus(t("noSelectedRound"), "error");
      return false;
    }

    const name = data.name.trim().slice(0, 60);
    if (!name) {
      kit.setStatus(t("invalidProject"), "error");
      return false;
    }

    isRegisteringProject.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const description = data.description.trim().slice(0, 300);
        const link = data.link.trim().slice(0, 200);

        await app.chain.invoke("registerProject", [
          arg.hash160(caller),
          arg.integer(selectedRound.get()!.id),
          arg.string(name),
          arg.string(description),
          arg.string(link),
        ]);
      }, "projectRegistered");
      if (ok) await refreshProjects();
      return ok;
    } finally {
      isRegisteringProject.set(false);
    }
  };

  const canClaimProject = (project: ProjectItem) => {
    const round = selectedRound.get();
    if (!round || !address.get()) return false;
    return (
      round.finalized &&
      !round.cancelled &&
      !project.claimed &&
      project.matchedAmount > 0n &&
      ownerMatchesAddress(project.owner, address.get())
    );
  };

  // Reactive set of project ids the connected wallet may claim, so the view can
  // gate the Claim control without re-implementing the eligibility rules.
  const claimableProjectIds = createDerived<string[]>(
    () => projects.get().filter((project) => canClaimProject(project)).map((project) => project.id),
    [projects, selectedRound, address],
  );

  const claimProject = async (project: ProjectItem): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (claimingProjectId.get()) return false;

    claimingProjectId.set(project.id);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        await app.chain.invoke("claimProject", [
          arg.hash160(caller),
          arg.integer(project.id),
        ]);
      }, "projectClaimed");
      if (ok) await refreshProjects();
      return ok;
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
    claimableProjectIds,
    claimProject,
    projectStatusLabel,
    projectStatusClass,
  };
}
