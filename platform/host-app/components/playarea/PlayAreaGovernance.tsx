import { useEffect, useState } from "react";
import { FileSignature, Vote } from "lucide-react";

import {
  ActivityPanel,
  ChainStateStrip,
  EmbeddedDappSurface,
  MetricGrid,
  PlayShell,
  buildEmbeddedDappUrl,
  getMetric,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";
import {
  fetchCouncilGovernanceSnapshot,
  type ExplorerCouncilCandidate,
  type ExplorerCouncilGovernance,
  type ExplorerCouncilProposal,
} from "@/lib/council-governance-client";

function formatCouncilDate(value?: string) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(new Date(parsed));
}

function readCouncilVotes(
  proposal: ExplorerCouncilProposal,
  side: "for" | "against" | "neutral",
) {
  return (
    Number(proposal.councilVotes?.[side] ?? 0) +
    Number(proposal.communityVotes?.[side] ?? 0)
  );
}

function councilStatusLabel(value?: string) {
  return String(value || "proposal").trim() || "proposal";
}

function proposalKey(proposal: ExplorerCouncilProposal) {
  return String(proposal.id || proposal.number || proposal.title || "");
}

function proposalLabel(proposal: ExplorerCouncilProposal) {
  return (
    proposal.title ||
    `Proposal #${proposal.number ?? proposal.id ?? "-"}`
  );
}

function proposerLabel(proposal: ExplorerCouncilProposal) {
  return (
    proposal.proposerName ||
    proposal.proposerOrganizationId ||
    "neo.community"
  );
}

function activityRowKey(row: {
  primary: string;
  secondary?: string;
  amount?: string;
}) {
  return `activity:${row.primary}:${row.secondary || ""}:${row.amount || ""}`;
}

function hasVerifiedCouncilProfile(candidate: ExplorerCouncilCandidate) {
  const name = String(candidate.displayName || "").trim();
  const genericName = /^(Council|Candidate) node #\d+$/i.test(name);
  return Boolean(
    candidate.logoUrl ||
      candidate.profileSource === "neo-community" ||
      (name && !genericName && candidate.profileSource !== "unverified"),
  );
}

function candidateRoleLabel(candidate: ExplorerCouncilCandidate) {
  const status = String(candidate.status || "candidate").toLowerCase();
  if (status === "consensus") return "Consensus node";
  if (status === "committee") return "Committee node";
  return "Candidate node";
}

function candidateTitle(candidate: ExplorerCouncilCandidate) {
  if (hasVerifiedCouncilProfile(candidate)) {
    return candidate.displayName || candidateRoleLabel(candidate);
  }
  return `Unverified ${candidateRoleLabel(candidate).toLowerCase()} #${
    candidate.rank || "-"
  }`;
}

function candidateSourceLabel(candidate: ExplorerCouncilCandidate) {
  if (hasVerifiedCouncilProfile(candidate)) {
    return candidate.location
      ? `Neo profile · ${candidate.location}`
      : "Neo governance profile";
  }
  return "Live Explorer candidate · profile unpublished";
}

function CandidateAvatar({ candidate }: { candidate: ExplorerCouncilCandidate }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const rankLabel = candidate.rank || "N";

  return (
    <span
      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald-100 bg-emerald-100 text-xs font-semibold text-emerald-700"
      aria-label={`Council node ${rankLabel}`}
    >
      {rankLabel}
      {candidate.logoUrl && !imageFailed && (
        <img
          src={candidate.logoUrl}
          alt={`${candidateTitle(candidate)} logo`}
          className={`absolute inset-0 h-full w-full rounded-full border border-gray-200 object-cover transition-opacity ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      )}
    </span>
  );
}

export function CouncilGovernancePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);
  const [explorerGovernance, setExplorerGovernance] = useState<
    ExplorerCouncilGovernance | null | undefined
  >(undefined);
  const [selectedProposalKey, setSelectedProposalKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setExplorerGovernance(undefined);
    fetchCouncilGovernanceSnapshot(network, 21)
      .then((data: ExplorerCouncilGovernance | null) => {
        if (!cancelled) setExplorerGovernance(data);
      })
      .catch(() => {
        if (!cancelled) setExplorerGovernance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [network]);

  const explorerProposals = Array.isArray(explorerGovernance?.proposals)
    ? explorerGovernance.proposals
    : [];
  const explorerCandidates = Array.isArray(explorerGovernance?.candidates)
    ? explorerGovernance.candidates
    : [];
  const explorerLoading = explorerGovernance === undefined;
  const verifiedCandidateCount = explorerCandidates.filter(
    hasVerifiedCouncilProfile,
  ).length;
  const activeExplorerProposals = explorerProposals.filter(
    (proposal) =>
      councilStatusLabel(proposal.status).toLowerCase() === "active",
  );
  const finalizedExplorerProposals = explorerProposals.filter(
    (proposal) =>
      councilStatusLabel(proposal.status).toLowerCase() !== "active",
  );
  const total = explorerProposals.length
    ? String(explorerProposals.length)
    : getMetric(statsMap, "Total Proposals", "0");
  const active = explorerProposals.length
    ? String(activeExplorerProposals.length)
    : getMetric(statsMap, "Active", "0");
  const finalized = explorerProposals.length
    ? String(finalizedExplorerProposals.length)
    : getMetric(statsMap, "Finalized", "0");
  const quorum = explorerCandidates.length
    ? `${Math.min(11, explorerCandidates.length)}/${explorerCandidates.length} council`
    : getMetric(statsMap, "Quorum Target", "-");
  const status = getMetric(statsMap, "Status", "Ready");
  const displayedProposals = explorerProposals.slice(0, 6);
  const displayedActivityRows =
    displayedProposals.length === 0 && activity?.rows.length
      ? activity.rows.slice(0, 5)
      : [];
  const selectedProposal =
    displayedProposals.find(
      (proposal) => proposalKey(proposal) === selectedProposalKey,
    ) ?? null;
  const selectedActivity =
    displayedActivityRows.find(
      (row) => activityRowKey(row) === selectedProposalKey,
    ) ?? null;

  return (
    <PlayShell
      app={app}
      title="Council proposal workspace"
      subtitle="Read live proposals from the governance contract, then create, vote for, vote against, finalize, or revoke through real wallet-signed operations."
      tone="emerald"
      side={
        <>
          {explorerCandidates.length > 0 && (
            <div className="rounded-[18px] border border-emerald-100 bg-white p-3 shadow-sm shadow-emerald-900/5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="m-0 text-sm font-semibold text-gray-900">
                  Council nodes
                </h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  {verifiedCandidateCount ? "Neo profile" : "Live Explorer"}
                </span>
              </div>
              <div className="space-y-2">
                {explorerCandidates.slice(0, 5).map((candidate) => (
                  <div
                    key={
                      candidate.id ||
                      candidate.candidate ||
                      candidate.displayName
                    }
                    className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-2.5 py-2"
                  >
                    <CandidateAvatar candidate={candidate} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-semibold text-gray-900">
                        {candidateTitle(candidate)}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-gray-700">
                        #{candidate.rank || "-"} ·{" "}
                        {candidate.status || "candidate"}
                        {" · "}
                        {candidateSourceLabel(candidate)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-700">
                      {Number(candidate.votes || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ActivityPanel activity={activity} />
          <MetricGrid stats={stats} />
          <ChainStateStrip
            loading={loading}
            error={error}
            contractHash={contractHash}
            network={network}
            onRefresh={onRefresh}
          />
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm shadow-gray-950/5">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              Total proposals
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-gray-900">{total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 shadow-sm shadow-emerald-900/5">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Active
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-emerald-700">
              {active}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm shadow-gray-950/5">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              Finalized
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-gray-900">
              {finalized}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 shadow-sm shadow-sky-900/5">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
              Quorum target
            </p>
            <p className="m-0 mt-1 text-xl font-semibold text-sky-700">{quorum}</p>
          </div>
        </div>

        <section className="rounded-[16px] border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:rounded-[20px] sm:p-3.5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="m-0 text-sm font-semibold text-gray-900">
                Proposal queue
              </h3>
              <p className="m-0 mt-1 text-xs leading-5 text-gray-700">
                Active and finalized Neo Community governance proposals. Tap a
                row to inspect status, proposer, timing, and vote split.
              </p>
            </div>
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>

          {displayedProposals.length > 0 ? (
            <div className="space-y-2">
              {displayedProposals.map((proposal) => {
                const key = proposalKey(proposal);
                const yes = readCouncilVotes(proposal, "for");
                const no = readCouncilVotes(proposal, "against");
                const neutral = readCouncilVotes(proposal, "neutral");
                const proposalStatus = councilStatusLabel(proposal.status);
                const active =
                  proposalStatus.toLowerCase() === "active" ||
                  selectedProposalKey === key;
                const ends = formatCouncilDate(proposal.endTime);

                return (
                  <button
                    key={key}
                    type="button"
                    className={`group flex w-full flex-col items-stretch justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40 sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl sm:py-3 ${
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                        : "border-gray-200 bg-white text-gray-900 hover:border-emerald-200 hover:bg-emerald-50/40"
                    }`}
                    onClick={() => setSelectedProposalKey(key)}
                    aria-expanded={selectedProposalKey === key}
                    data-testid="council-proposal-row"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${
                          active
                            ? "bg-white/75 text-emerald-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        <Vote className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-[13px] font-semibold sm:text-sm">
                          {proposalLabel(proposal)}
                        </span>
                        <span className="mt-0.5 block break-words text-[11px] font-semibold leading-4 text-gray-700 sm:text-xs sm:leading-5">
                          {proposerLabel(proposal)} · {proposalStatus}
                          {ends ? ` · ends ${ends}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 pl-11 text-left sm:pl-0 sm:text-right">
                      <span className="block text-[13px] font-semibold tabular-nums text-gray-900 sm:text-sm">
                        {yes}/{no}/{neutral}
                      </span>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                        for/against/neutral
                      </span>
                      <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                        Details
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : explorerLoading ? (
            <div
              className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-3"
              data-testid="council-governance-loading"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-700">
                  <Vote className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-gray-900">
                    Loading live governance proposals
                  </p>
                  <p className="m-0 mt-1 text-xs font-semibold leading-5 text-gray-700">
                    Reading Neo Explorer governance data for {network}; empty
                    states are shown only after the live request completes.
                  </p>
                </div>
              </div>
            </div>
          ) : displayedActivityRows.length ? (
            <div className="space-y-2">
              {displayedActivityRows.map((row) => {
                const key = activityRowKey(row);
                const active = selectedProposalKey === key;

                return (
                  <button
                    key={key}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/40 ${
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                        : "border-gray-200 bg-white text-gray-900 hover:border-emerald-200 hover:bg-emerald-50/40"
                    }`}
                    onClick={() => setSelectedProposalKey(key)}
                    aria-expanded={active}
                    data-testid="council-proposal-row"
                  >
                    <p className="m-0 text-[13px] font-semibold text-gray-900">
                      {row.primary}
                    </p>
                    {row.secondary && (
                      <p className="m-0 mt-1 text-xs font-semibold leading-5 text-gray-700">
                        {row.secondary}
                      </p>
                    )}
                    {row.amount && (
                      <p className="m-0 mt-2 text-xs font-semibold tabular-nums text-emerald-700">
                        {row.amount}
                      </p>
                    )}
                    <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Details
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <FileSignature className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-gray-900">
                    No proposals on this network yet
                  </p>
                  <p className="m-0 mt-1 text-xs font-semibold leading-5 text-gray-700">
                    Use Create Proposal with a council wallet to submit the
                    first real proposal. Current status: {status} · {network}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedProposal && (
            <div
              className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3"
              data-testid="council-proposal-detail"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Proposal details
                  </p>
                  <h4 className="m-0 mt-1 break-words text-sm font-semibold text-gray-900">
                    {proposalLabel(selectedProposal)}
                  </h4>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  {councilStatusLabel(selectedProposal.status)}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Proposer
                  </dt>
                  <dd className="m-0 mt-1 break-words font-bold text-gray-900">
                    {proposerLabel(selectedProposal)}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Type
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-gray-900">
                    {selectedProposal.type || "proposal"}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Created
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-gray-900">
                    {formatCouncilDate(selectedProposal.createdAt) || "-"}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Voting ends
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-gray-900">
                    {formatCouncilDate(selectedProposal.endTime) || "-"}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Council votes
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-gray-900">
                    {selectedProposal.councilVotes?.for ?? 0} for /{" "}
                    {selectedProposal.councilVotes?.against ?? 0} against /{" "}
                    {selectedProposal.councilVotes?.neutral ?? 0} neutral
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Community votes
                  </dt>
                  <dd className="m-0 mt-1 font-bold text-gray-900">
                    {selectedProposal.communityVotes?.for ?? 0} for /{" "}
                    {selectedProposal.communityVotes?.against ?? 0} against /{" "}
                    {selectedProposal.communityVotes?.neutral ?? 0} neutral
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {selectedActivity && (
            <div
              className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3"
              data-testid="council-proposal-detail"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Proposal details
                  </p>
                  <h4 className="m-0 mt-1 break-words text-sm font-semibold text-gray-900">
                    {selectedActivity.primary}
                  </h4>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  Contract activity
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Status and vote split
                  </dt>
                  <dd className="m-0 mt-1 break-words font-bold text-gray-900">
                    {selectedActivity.secondary || "-"}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Quorum / progress
                  </dt>
                  <dd className="m-0 mt-1 break-words font-bold text-gray-900">
                    {selectedActivity.amount || "-"}
                  </dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 sm:col-span-2">
                  <dt className="font-semibold uppercase tracking-wide text-gray-500">
                    Source
                  </dt>
                  <dd className="m-0 mt-1 break-words font-bold text-gray-900">
                    Live Council Governance contract activity for {network}.
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        {explorerCandidates.length > 0 && (
          <section className="rounded-[16px] border border-emerald-100 bg-white p-3 shadow-sm shadow-emerald-900/5 sm:rounded-[20px] sm:p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-semibold text-gray-900">
                  {verifiedCandidateCount
                    ? "Council node identity"
                    : "Council candidate records"}
                </h3>
                <p className="m-0 mt-1 text-xs font-semibold leading-5 text-gray-700">
                  {verifiedCandidateCount
                    ? "Verified node names and logos come from Neo governance profiles."
                    : "Live Explorer candidate records are shown; this network has not published verified profile names or logos for these nodes."}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                {explorerCandidates.length} nodes
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {explorerCandidates.slice(0, 3).map((candidate) => (
                <div
                  key={
                    candidate.id || candidate.candidate || candidate.displayName
                  }
                  className="flex min-w-0 items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-2.5 py-2"
                >
                  <CandidateAvatar candidate={candidate} />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-semibold text-gray-900">
                      {candidateTitle(candidate)}
                    </p>
                    <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-gray-700">
                      #{candidate.rank || "-"} ·{" "}
                      {candidate.status || "candidate"}
                      {" · "}
                      {candidateSourceLabel(candidate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <EmbeddedDappSurface
          title="Create, inspect, and vote"
          subtitle="The embedded dApp keeps the transaction workflow available for council wallets, while the proposal queue above stays aligned with Neo Community governance data."
          url={dappUrl}
          tone="emerald"
          frameTitle="Council Governance dApp"
          testId="council-governance-dapp-frame"
          heightClass="h-[680px]"
        />
      </div>
    </PlayShell>
  );
}
