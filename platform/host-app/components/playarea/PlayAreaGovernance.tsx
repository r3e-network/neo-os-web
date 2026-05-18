import { useEffect, useState } from "react";
import { FileSignature, Vote } from "lucide-react";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  EmbeddedDappSurface,
  MetricGrid,
  PlayShell,
  buildEmbeddedDappUrl,
  getMetric,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

type ExplorerCouncilProposal = {
  id?: string;
  number?: number;
  title?: string;
  status?: string;
  type?: string;
  createdAt?: string;
  endTime?: string;
  proposerName?: string;
  proposerOrganizationId?: string;
  councilVotes?: {
    for?: number;
    against?: number;
    neutral?: number;
  };
  communityVotes?: {
    for?: number;
    against?: number;
    neutral?: number;
  };
  messageCount?: number;
};

type ExplorerCouncilCandidate = {
  id?: string;
  candidate?: string;
  displayName?: string;
  logoUrl?: string;
  location?: string;
  website?: string;
  rank?: number;
  status?: string;
  votes?: number;
  supplySharePercent?: number;
};

type ExplorerCouncilGovernance = {
  source?: string;
  network?: "mainnet" | "testnet";
  totalCount?: number;
  totalVotes?: number;
  candidates?: ExplorerCouncilCandidate[];
  proposals?: ExplorerCouncilProposal[];
};

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
  const [explorerGovernance, setExplorerGovernance] =
    useState<ExplorerCouncilGovernance | null>(null);

  useEffect(() => {
    const fetcher = globalThis.fetch;
    if (typeof fetcher !== "function") return undefined;
    let cancelled = false;
    fetcher(`/api/explorer/council-governance?network=${network}&limit=21`)
      .then((response) => (response.ok ? response.json() : null))
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
  const rows = explorerProposals.length
    ? explorerProposals.slice(0, 6).map((proposal) => {
        const yes = readCouncilVotes(proposal, "for");
        const no = readCouncilVotes(proposal, "against");
        const neutral = readCouncilVotes(proposal, "neutral");
        const ends = formatCouncilDate(proposal.endTime);
        const proposer =
          proposal.proposerName ||
          proposal.proposerOrganizationId ||
          "neo.community";
        return {
          label:
            proposal.title ||
            `Proposal #${proposal.number ?? proposal.id ?? "-"}`,
          detail: `${proposer} · ${councilStatusLabel(proposal.status)}${
            ends ? ` · ends ${ends}` : ""
          }`,
          value: `${yes}/${no}/${neutral}`,
          valueLabel: "for/against/neutral",
          active:
            councilStatusLabel(proposal.status).toLowerCase() === "active",
          icon: <Vote className="h-4 w-4" />,
        };
      })
    : activity?.rows.length
      ? activity.rows.slice(0, 5).map((row) => ({
          label: row.primary,
          detail: row.secondary,
          value: row.amount,
          valueLabel: row.accent ? "active" : undefined,
          active: row.accent,
          icon: <Vote className="h-4 w-4" />,
        }))
      : [
          {
            label: "No proposals on this network yet",
            detail:
              "Use Create Proposal with a council wallet to submit the first real proposal.",
            value: status,
            valueLabel: network,
            active: false,
            icon: <FileSignature className="h-4 w-4" />,
          },
        ];

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
                <h3 className="m-0 text-sm font-black text-gray-950">
                  Council nodes
                </h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                  Neo profile
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
                    {candidate.logoUrl ? (
                      <img
                        src={candidate.logoUrl}
                        alt=""
                        className="h-8 w-8 rounded-full border border-gray-200 bg-white object-cover"
                      />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
                        {candidate.rank || "N"}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-black text-gray-950">
                        {candidate.displayName || "Council node"}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-gray-700">
                        #{candidate.rank || "-"} ·{" "}
                        {candidate.status || "candidate"}
                        {candidate.location ? ` · ${candidate.location}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-black tabular-nums text-emerald-700">
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
            <p className="m-0 text-[10px] font-black uppercase tracking-wide text-gray-600">
              Total proposals
            </p>
            <p className="m-0 mt-1 text-xl font-black text-gray-950">{total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 shadow-sm shadow-emerald-900/5">
            <p className="m-0 text-[10px] font-black uppercase tracking-wide text-emerald-700">
              Active
            </p>
            <p className="m-0 mt-1 text-xl font-black text-emerald-700">
              {active}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm shadow-gray-950/5">
            <p className="m-0 text-[10px] font-black uppercase tracking-wide text-gray-600">
              Finalized
            </p>
            <p className="m-0 mt-1 text-xl font-black text-gray-950">
              {finalized}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 shadow-sm shadow-sky-900/5">
            <p className="m-0 text-[10px] font-black uppercase tracking-wide text-sky-700">
              Quorum target
            </p>
            <p className="m-0 mt-1 text-xl font-black text-sky-700">{quorum}</p>
          </div>
        </div>

        <ActionBoard
          title="Proposal queue"
          subtitle={
            explorerProposals.length
              ? "Neo Community proposal governance, aligned with Neo Explorer data."
              : "Latest contract proposals with vote split and quorum progress."
          }
          tone="emerald"
          rows={rows}
        />

        {explorerCandidates.length > 0 && (
          <section className="rounded-[16px] border border-emerald-100 bg-white p-3 shadow-sm shadow-emerald-900/5 sm:rounded-[20px] sm:p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-black text-gray-950">
                  Council node identity
                </h3>
                <p className="m-0 mt-1 text-xs font-semibold leading-5 text-gray-700">
                  Node names and logos are resolved from Neo governance
                  profiles.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
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
                  {candidate.logoUrl ? (
                    <img
                      src={candidate.logoUrl}
                      alt=""
                      className="h-8 w-8 rounded-full border border-gray-200 bg-white object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
                      {candidate.rank || "N"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-black text-gray-950">
                      {candidate.displayName || "Council node"}
                    </p>
                    <p className="m-0 mt-0.5 truncate text-[11px] font-semibold text-gray-700">
                      #{candidate.rank || "-"} ·{" "}
                      {candidate.status || "candidate"}
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
