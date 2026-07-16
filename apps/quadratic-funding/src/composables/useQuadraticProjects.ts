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
import { eventStateValue } from "@shared/utils/chain-events";
import {
  truncateUtf8Bytes,
  utf8ByteLength,
  type QuadraticFlowKit,
  type Translator,
} from "./quadraticFlowKit";
import type { QuadraticPendingTracker } from "./quadraticPending";
import type { ProjectItem, RoundItem } from "./quadraticTypes";

/**
 * Contract limits in the contract's unit — UTF-8 BYTES, not UTF-16 chars
 * (MiniAppQuadraticFunding.cs MAX_PROJECT_NAME_LENGTH / MAX_PROJECT_DESC_LENGTH /
 * MAX_PROJECT_LINK_LENGTH; see truncateUtf8Bytes in quadraticFlowKit). A
 * char-measured value up to 3× the byte budget deterministically reverts
 * registerProject after the user already paid the transaction fee.
 */
const MAX_PROJECT_NAME_BYTES = 60;
const MAX_PROJECT_DESC_BYTES = 300;
const MAX_PROJECT_LINK_BYTES = 200;

export interface UseQuadraticProjectsOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: Translator;
  /** Shared flow plumbing (guard/banner/preconditions). */
  kit: QuadraticFlowKit;
  /** Currently selected round (owned by useQuadraticRounds). */
  selectedRound: Observable<RoundItem | null>;
  /** Fail-closed deployment capability gate for every contract write. */
  ensureFundingWritesEnabled?: () => Promise<boolean>;
  pending?: QuadraticPendingTracker;
}

function normalizeProjectLink(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  // The contract asserts link.Length <= 200 over the UTF-8 ByteString — a
  // link must be rejected (never truncated: a cut URL is a different URL)
  // when it exceeds that BYTE budget, not a UTF-16 char count.
  if (utf8ByteLength(raw) > MAX_PROJECT_LINK_BYTES) return null;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? raw
      : null;
  } catch {
    return null;
  }
}

export function useQuadraticProjects({
  app,
  t,
  kit,
  selectedRound,
  ensureFundingWritesEnabled = async () => true,
  pending,
}: UseQuadraticProjectsOptions) {
  const { arg } = app.chain;
  const address = app.chain.address as Observable<string | null>;

  const projects = createObservable<ProjectItem[]>([]);
  const isRefreshingProjects = createObservable(false);
  const projectsComplete = createObservable(false);
  const isRegisteringProject = createObservable(false);
  const claimingProjectId = createObservable<string | null>(null);
  let refreshGeneration = 0;

  const reservePendingWrite = (): string | undefined | null => {
    if (!pending) return undefined;
    const reservation = pending.reserve();
    if (!reservation) kit.setStatus(t("pendingBlocksWrites"), "error");
    return reservation;
  };
  const revalidateFundingWriteScope = async () => {
    if (!(await ensureFundingWritesEnabled())) {
      throw new Error(t("fundingWriteScopeChanged"));
    }
  };

  const eventInteger = (event: unknown, index: number): bigint | null => {
    const text = String(eventStateValue(event, index) ?? "").trim();
    if (!/^-?\d+$/.test(text)) return null;
    try {
      return BigInt(text);
    } catch {
      return null;
    }
  };

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

  const fetchProjectIds = async (roundId: string, expectedCount: bigint) => {
    const maxProjects = 5_000n;
    if (expectedCount < 0n || expectedCount > maxProjects) {
      throw new Error(t("collectionTooLarge"));
    }
    const ids: string[] = [];
    const pageSize = 50;
    for (let offset = 0; BigInt(offset) < expectedCount; offset += pageSize) {
      const parsed = await app.chain.readRaw("getRoundProjects", [
        arg.integer(roundId),
        arg.integer(offset),
        arg.integer(pageSize),
      ]);
      if (!Array.isArray(parsed)) throw new Error(t("chainSnapshotUnavailable"));
      ids.push(...parsed
        .map((value) => String(value ?? "").trim())
        .filter((value) => /^[1-9]\d*$/.test(value)));
      if (parsed.length < pageSize && BigInt(ids.length) < expectedCount) {
        throw new Error(t("chainSnapshotUnavailable"));
      }
    }
    const unique = [...new Set(ids)];
    if (BigInt(unique.length) !== expectedCount) throw new Error(t("chainSnapshotUnavailable"));
    return unique;
  };

  const fetchProjectDetails = async (projectId: string) => {
    const parsed = await app.chain.readRaw("getProjectDetails", [arg.integer(projectId)]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseProject(parsed as Record<string, unknown>, projectId);
  };

  const refreshProjects = async () => {
    const targetRound = selectedRound.get();
    const targetRoundId = targetRound?.id ?? "";
    refreshGeneration += 1;
    const generation = refreshGeneration;
    if (!targetRoundId) {
      projects.set([]);
      projectsComplete.set(false);
      isRefreshingProjects.set(false);
      return;
    }
    try {
      isRefreshingProjects.set(true);
      projectsComplete.set(false);
      const expectedCount = targetRound?.projectCount ?? 0n;
      const ids = await fetchProjectIds(targetRoundId, expectedCount);
      const details: Array<ProjectItem | null> = [];
      for (let offset = 0; offset < ids.length; offset += 25) {
        details.push(...await Promise.all(ids.slice(offset, offset + 25).map(fetchProjectDetails)));
      }
      if (details.some((project) => !project)) throw new Error(t("chainSnapshotUnavailable"));
      if (generation === refreshGeneration && selectedRound.get()?.id === targetRoundId) {
        projects.set(details as ProjectItem[]);
        projectsComplete.set(true);
      }
    } catch (e) {
      if (generation === refreshGeneration) {
        projects.set([]);
        projectsComplete.set(false);
        kit.reportError(e);
      }
    } finally {
      if (generation === refreshGeneration) isRefreshingProjects.set(false);
    }
  };

  const registerProject = async (data: {
    name: string;
    description: string;
    link: string;
  }): Promise<boolean> => {
    if (!(await kit.onNeoChain())) return false;
    if (isRegisteringProject.get()) return false;
    const targetRound = selectedRound.get();
    if (!targetRound) {
      kit.setStatus(t("noSelectedRound"), "error");
      return false;
    }
    if (targetRound.cancelled || targetRound.finalized || Date.now() > targetRound.endTime) {
      kit.setStatus(t("roundStateChanged"), "error");
      return false;
    }

    // Truncate by UTF-8 BYTES (the contract's unit), not UTF-16 chars — see
    // MAX_PROJECT_NAME_BYTES. Computed once so the sent args, the pending
    // record and the readback comparison can never disagree.
    const name = truncateUtf8Bytes(data.name.trim(), MAX_PROJECT_NAME_BYTES);
    if (!name) {
      kit.setStatus(t("invalidProject"), "error");
      return false;
    }
    const link = normalizeProjectLink(data.link);
    if (link === null) {
      kit.setStatus(t("invalidProjectLink"), "error");
      return false;
    }
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;

    isRegisteringProject.set(true);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const description = truncateUtf8Bytes(data.description.trim(), MAX_PROJECT_DESC_BYTES);
        const roundId = targetRound.id;
        await kit.ensureContract();
        const liveRoundRaw = await app.chain.readRaw("getRoundDetails", [arg.integer(roundId)]);
        if (!liveRoundRaw || typeof liveRoundRaw !== "object" || Array.isArray(liveRoundRaw)) {
          throw new Error(t("chainSnapshotUnavailable"));
        }
        const liveRound = liveRoundRaw as Record<string, unknown>;
        const liveStatus = String(liveRound.status ?? "");
        if (liveStatus !== "upcoming" && liveStatus !== "active") {
          throw new Error(t("roundStateChanged"));
        }
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "register-project",
              eventName: "ProjectRegistered",
              wallet: caller,
              roundId,
              name,
              description,
              link,
            })
          : null;

        await revalidateFundingWriteScope();

        let registeredId = "";
        const result = await app.chain.invoke("registerProject", [
          arg.hash160(caller),
          arg.integer(roundId),
          arg.string(name),
          arg.string(description),
          arg.string(link),
        ], {
          waitForEvent: "ProjectRegistered",
          waitTimeoutMs: 30_000,
          ...(pendingDraft
            ? { onTransactionSent: (txid: string) => pending?.persistBroadcast(reservation!, pendingDraft, txid) }
            : {}),
        });
        kit.requireVerifiedTransaction(result, (event) => {
          const id = eventInteger(event, 0);
          if (id && id > 0n) registeredId = id.toString();
          return Boolean(registeredId)
            && eventInteger(event, 1) === BigInt(roundId)
            && ownerMatchesAddress(eventStateValue(event, 2), caller);
        });
        const readback = await fetchProjectDetails(registeredId);
        if (
          !readback
          || readback.roundId !== roundId
          || !ownerMatchesAddress(readback.owner, caller)
          || readback.name !== name
          || readback.description !== description
          || readback.link !== link
        ) {
          throw new Error(t("chainReadbackMismatch"));
        }
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "projectRegistered");
      if (ok) await refreshProjects();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
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
      project.totalContributed + project.matchedAmount > 0n &&
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
    if (!(await ensureFundingWritesEnabled())) return false;
    const reservation = reservePendingWrite();
    if (reservation === null) return false;

    claimingProjectId.set(project.id);
    try {
      const ok = await kit.guard(async () => {
        const caller = await kit.ensureCaller();
        const liveProject = await fetchProjectDetails(project.id);
        if (!liveProject || !canClaimProject(liveProject)) {
          throw new Error(t("projectStateChanged"));
        }
        const expectedAmount = liveProject.totalContributed + liveProject.matchedAmount;
        await kit.ensureContract();
        const pendingDraft = pending
          ? await pending.prepare(reservation!, {
              kind: "claim-project",
              eventName: "ProjectClaimed",
              wallet: caller,
              roundId: liveProject.roundId,
              projectId: liveProject.id,
              amount: expectedAmount.toString(),
            })
          : null;
        await revalidateFundingWriteScope();
        const result = await app.chain.invoke("claimProject", [
          arg.hash160(caller),
          arg.integer(project.id),
        ], {
          waitForEvent: "ProjectClaimed",
          waitTimeoutMs: 30_000,
          ...(pendingDraft
            ? { onTransactionSent: (txid: string) => pending?.persistBroadcast(reservation!, pendingDraft, txid) }
            : {}),
        });
        kit.requireVerifiedTransaction(
          result,
          (event) =>
            eventInteger(event, 0) === BigInt(project.id)
            && ownerMatchesAddress(eventStateValue(event, 1), caller)
            && eventInteger(event, 2) === expectedAmount,
        );
        const readback = await fetchProjectDetails(project.id);
        if (!readback?.claimed) throw new Error(t("chainReadbackMismatch"));
        if (pending) pending.complete(reservation!, result.txid ?? "");
      }, "projectClaimed");
      if (ok) await refreshProjects();
      return ok;
    } finally {
      if (pending && reservation) pending.release(reservation);
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
    projectsComplete,
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
