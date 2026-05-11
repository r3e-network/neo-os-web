import { useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  retryLoad: () => Promise<void>;
}

interface Proposal {
  id: number;
  type: number;
  title: string;
  description: string;
  statusKey: "active" | "passed" | "rejected" | "revoked" | "expired" | "executed" | "pending";
  statusString?: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  quorumRequired: number;
  quorumReached: boolean;
  creator: string;
  createTime: number;
  expiryTime: number;
  policyMethod?: string;
  policyValue?: string;
}

const DURATION_OPTIONS = [
  { labelKey: "duration3Days", value: 3 * 24 * 60 * 60 * 1000 },
  { labelKey: "duration7Days", value: 7 * 24 * 60 * 60 * 1000 },
  { labelKey: "duration14Days", value: 14 * 24 * 60 * 60 * 1000 },
];

const POLICY_METHODS = [
  { key: "FeePerByte", labelKey: "methodFeePerByte" },
  { key: "ExecFeeFactor", labelKey: "methodExecFeeFactor" },
  { key: "StoragePrice", labelKey: "methodStoragePrice" },
  { key: "MaxBlockSize", labelKey: "methodMaxBlockSize" },
  { key: "MaxTransactionsPerBlock", labelKey: "methodMaxTransactions" },
  { key: "MaxSystemFee", labelKey: "methodMaxSystemFee" },
];

function shortAddress(value?: string) {
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatDate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function voteShare(proposal: Proposal) {
  const total = proposal.yesVotes + proposal.noVotes;
  if (total <= 0) return 0;
  return Math.round((proposal.yesVotes / total) * 100);
}

export default function PlayArea({ t, state, dispatch, retryLoad }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isVoting = bool("isVoting");
  const isCreating = bool("isCreating");
  const isCandidate = bool("isCandidate");
  const candidateLoaded = bool("candidateLoaded");
  const walletAddress = str("address");
  const totalProposals = num("totalProposals");
  const activeCount = num("activeCount");
  const historyCount = num("historyCount");
  const votingPower = num("votingPower");
  const proposals = val<Proposal[]>("proposals", []) ?? [];
  const activeProposals = val<Proposal[]>("activeProposals", []) ?? [];
  const historyProposals = val<Proposal[]>("historyProposals", []) ?? [];
  const hasVotedMap = val<Record<number, boolean>>("hasVotedMap", {}) ?? {};

  const [tab, setTab] = useState<"active" | "create" | "history">("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [proposalType, setProposalType] = useState("0");
  const [policyMethod, setPolicyMethod] = useState(POLICY_METHODS[0].key);
  const [policyValue, setPolicyValue] = useState("");
  const [duration, setDuration] = useState(String(DURATION_OPTIONS[1].value));

  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === selectedId) ?? null,
    [proposals, selectedId],
  );
  const visibleProposals = tab === "history" ? historyProposals : activeProposals;
  const canWrite = Boolean(walletAddress && isCandidate);
  const showPolicyFields = proposalType === "1";

  const statusLabel = (proposal: Proposal) => {
    const key = proposal.statusKey || "pending";
    return t(key);
  };

  const openDetails = async (proposal: Proposal) => {
    setSelectedId(proposal.id);
    await dispatch("selectProposal", proposal);
  };

  const handleVote = async (proposalId: number, vote: "for" | "against") => {
    await dispatch("vote", { proposalId, vote });
  };

  const handleCreateProposal = async () => {
    await dispatch("createProposal", {
      type: Number(proposalType),
      title: newTitle,
      description: newDescription,
      policyMethod: showPolicyFields ? policyMethod : undefined,
      policyValue: showPolicyFields ? policyValue : undefined,
      duration: Number(duration),
    });
    setNewTitle("");
    setNewDescription("");
    setProposalType("0");
    setPolicyValue("");
    setTab("active");
  };

  return (
    <div className="council-play-area">
      <section className="council-hero">
        <div>
          <p className="council-eyebrow">{t("liveGovernance")}</p>
          <h2>{t("title")}</h2>
          <p className="council-hero-copy">{t("governanceSummary")}</p>
        </div>
        <NeoButton variant="ghost" size="sm" disabled={isLoading} onClick={() => retryLoad()}>
          {t("refresh")}
        </NeoButton>
      </section>

      <div className="council-stats" aria-label={t("governanceStats")}>
        <div className="council-stat">
          <span>{totalProposals}</span>
          <label>{t("totalProposals")}</label>
        </div>
        <div className="council-stat council-stat--accent">
          <span>{activeCount}</span>
          <label>{t("activeProposals")}</label>
        </div>
        <div className="council-stat">
          <span>{historyCount}</span>
          <label>{t("historyProposals")}</label>
        </div>
        <div className="council-stat">
          <span>{votingPower}</span>
          <label>{t("votingPower")}</label>
        </div>
      </div>

      <div className={`council-access ${canWrite ? "council-access--ok" : ""}`}>
        <span className="council-access-dot" />
        <span>
          {!walletAddress
            ? t("connectWalletReadOnly")
            : candidateLoaded && !isCandidate
              ? t("readOnlyReason")
              : t("eligibleToVote")}
        </span>
        {walletAddress && <strong>{shortAddress(walletAddress)}</strong>}
      </div>

      <div className="council-tabs" role="tablist" aria-label={t("proposalTabs")}>
        {(["active", "create", "history"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            className={tab === entry ? "is-active" : ""}
            onClick={() => setTab(entry)}
          >
            {entry === "active" && t("active")}
            {entry === "create" && t("createProposal")}
            {entry === "history" && t("history")}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <NeoCard variant="erobo" className="council-create-panel">
          <div className="council-panel-heading">
            <h3>{t("createProposal")}</h3>
            <p>{t("createProposalHelp")}</p>
          </div>

          <div className="council-form-grid">
            <label className="council-field">
              <span>{t("proposalType")}</span>
              <select value={proposalType} onChange={(event) => setProposalType(event.target.value)}>
                <option value="0">{t("textType")}</option>
                <option value="1">{t("policyType")}</option>
              </select>
            </label>
            <label className="council-field">
              <span>{t("duration")}</span>
              <select value={duration} onChange={(event) => setDuration(event.target.value)}>
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <NeoInput
            value={newTitle}
            placeholder={t("titlePlaceholder")}
            label={t("proposalTitle")}
            onChange={setNewTitle}
          />
          <NeoInput
            type="textarea"
            value={newDescription}
            placeholder={t("descPlaceholder")}
            label={t("description")}
            onChange={setNewDescription}
          />

          {showPolicyFields && (
            <div className="council-form-grid">
              <label className="council-field">
                <span>{t("policyMethod")}</span>
                <select value={policyMethod} onChange={(event) => setPolicyMethod(event.target.value)}>
                  {POLICY_METHODS.map((method) => (
                    <option key={method.key} value={method.key}>
                      {t(method.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <NeoInput
                type="number"
                value={policyValue}
                placeholder={t("policyValuePlaceholder")}
                label={t("policyValue")}
                onChange={setPolicyValue}
              />
            </div>
          )}

          <NeoButton
            variant="primary"
            size="md"
            block
            loading={isCreating}
            disabled={isCreating || !canWrite || !newTitle.trim() || !newDescription.trim()}
            onClick={handleCreateProposal}
          >
            {t("submitProposal")}
          </NeoButton>
        </NeoCard>
      ) : (
        <section className="council-board">
          {isLoading ? (
            <div className="council-loading">
              <div className="council-loading-spinner" />
              <span>{t("loadingProposals")}</span>
            </div>
          ) : visibleProposals.length === 0 ? (
            <div className="council-empty">
              <h3>{tab === "active" ? t("noActiveProposals") : t("noHistory")}</h3>
              <p>{t("emptyProposalHelp")}</p>
            </div>
          ) : (
            <div className="council-proposal-list">
              {visibleProposals.map((proposal) => {
                const alreadyVoted = Boolean(hasVotedMap[proposal.id]);
                return (
                  <article key={proposal.id} className="council-proposal-item">
                    <div className="council-proposal-top">
                      <span className={`council-status-badge council-status--${proposal.statusKey}`}>
                        {statusLabel(proposal)}
                      </span>
                      <span className="council-proposal-id">#{proposal.id}</span>
                      {alreadyVoted && <span className="council-voted">{t("alreadyVotedLabel")}</span>}
                    </div>

                    <h3 className="council-proposal-title">{proposal.title}</h3>
                    <p className="council-proposal-desc">{proposal.description || t("noDescription")}</p>

                    <div className="council-vote-bar" aria-label={t("voteSplit")}>
                      <div className="council-vote-bar-track">
                        <div
                          className="council-vote-bar-fill"
                          style={{ width: `${voteShare(proposal)}%` }}
                        />
                      </div>
                      <div className="council-vote-counts">
                        <span className="council-vote-for">{proposal.yesVotes} {t("for")}</span>
                        <span className="council-vote-against">{proposal.noVotes} {t("against")}</span>
                      </div>
                    </div>

                    <div className="council-proposal-meta">
                      <span>{t("quorum")}: {proposal.totalVotes}/{proposal.quorumRequired || "-"}</span>
                      <span>{t("creator")}: {shortAddress(proposal.creator)}</span>
                      <span>{t("votingEnds")}: {formatDate(proposal.expiryTime)}</span>
                    </div>

                    <div className="council-proposal-actions">
                      <NeoButton variant="secondary" size="sm" onClick={() => openDetails(proposal)}>
                        {t("viewDetails")}
                      </NeoButton>
                      {proposal.statusKey === "active" && (
                        <>
                          <NeoButton
                            variant="success"
                            size="sm"
                            loading={isVoting}
                            disabled={isVoting || !canWrite || alreadyVoted}
                            onClick={() => handleVote(proposal.id, "for")}
                          >
                            {t("voteFor")}
                          </NeoButton>
                          <NeoButton
                            variant="danger"
                            size="sm"
                            loading={isVoting}
                            disabled={isVoting || !canWrite || alreadyVoted}
                            onClick={() => handleVote(proposal.id, "against")}
                          >
                            {t("voteAgainst")}
                          </NeoButton>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {selectedProposal && (
        <aside className="council-details-panel" aria-label={t("proposalDetails")}>
          <div className="council-details-head">
            <div>
              <span className={`council-status-badge council-status--${selectedProposal.statusKey}`}>
                {statusLabel(selectedProposal)}
              </span>
              <h3>{selectedProposal.title}</h3>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} aria-label={t("close")}>
              x
            </button>
          </div>
          <p>{selectedProposal.description || t("noDescription")}</p>
          <dl className="council-details-grid">
            <div><dt>{t("proposalId")}</dt><dd>#{selectedProposal.id}</dd></div>
            <div><dt>{t("proposalType")}</dt><dd>{selectedProposal.type === 1 ? t("policyType") : t("textType")}</dd></div>
            <div><dt>{t("creator")}</dt><dd>{shortAddress(selectedProposal.creator)}</dd></div>
            <div><dt>{t("proposalCreated")}</dt><dd>{formatDate(selectedProposal.createTime)}</dd></div>
            <div><dt>{t("votingEnds")}</dt><dd>{formatDate(selectedProposal.expiryTime)}</dd></div>
            <div><dt>{t("quorum")}</dt><dd>{selectedProposal.totalVotes}/{selectedProposal.quorumRequired || "-"}</dd></div>
            {selectedProposal.policyMethod && (
              <div><dt>{t("policyMethod")}</dt><dd>{selectedProposal.policyMethod}</dd></div>
            )}
            {selectedProposal.policyValue && (
              <div><dt>{t("policyValue")}</dt><dd>{selectedProposal.policyValue}</dd></div>
            )}
          </dl>
        </aside>
      )}
    </div>
  );
}
