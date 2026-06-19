import { useEffect, useRef, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { ownerMatchesAddress } from "@shared/utils/neo";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  retryLoad: () => Promise<void>;
}

interface Proposal {
  id: number;
  externalId?: string;
  source?: "contract" | "neo-community";
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
  creatorDisplay?: string;
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

const DEFAULT_POLICY_METHOD = POLICY_METHODS[0]?.key ?? "FeePerByte";
const DEFAULT_DURATION_MS = DURATION_OPTIONS[1]?.value ?? 7 * 24 * 60 * 60 * 1000;

// Neo's council is the top-21 candidates. Used as the quorum denominator when
// the contract returns no explicit quorumRequired so the pass bar stays legible.
const COUNCIL_SIZE = 21;

const TAB_ICONS: Record<"active" | "create" | "history", JSX.Element> = {
  active: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  create: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  history: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M15 3v5h5" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  ),
};

function shortAddress(value?: string) {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatDate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Voting is time-sensitive: flag an active window closing within 24h so members
// see urgency at a glance. Read-only / display-only — no logic depends on it.
const ENDING_SOON_MS = 24 * 60 * 60 * 1000;
function isEndingSoon(proposal: Proposal): boolean {
  if (proposal.statusKey !== "active") return false;
  if (!Number.isFinite(proposal.expiryTime) || proposal.expiryTime <= 0) return false;
  const remaining = proposal.expiryTime - Date.now();
  return remaining > 0 && remaining <= ENDING_SOON_MS;
}

// The quorum denominator. When the contract returns no explicit quorumRequired
// (0/empty), fall back to the known council size so the pass bar reads as
// "X/21" instead of "X/—". Returns the value and whether it's the fallback.
function quorumDenominator(proposal: Proposal): { value: number; isFallback: boolean } {
  if (proposal.quorumRequired > 0) return { value: proposal.quorumRequired, isFallback: false };
  // When the contract reports no explicit quorum we fall back to the council
  // size, but never let the denominator read below the actual vote count — an
  // unbounded tally would otherwise render a nonsensical "30/21".
  return { value: Math.max(COUNCIL_SIZE, proposal.totalVotes), isFallback: true };
}

// A proposal passes on a strict majority of the council seats voting For — the
// same majority the contract uses for quorum (>= half + 1 of the denominator).
// This only LABELS the existing threshold; it changes no vote math.
function passThreshold(proposal: Proposal): number {
  return Math.floor(quorumDenominator(proposal).value / 2) + 1;
}

// Vote-bar geometry. The For and Against segments are sized against the council
// denominator (not just cast votes) so the pass-line tick stays at a fixed,
// readable position and a split vote reads as for / against / undecided rather
// than "red = failing".
function voteBarGeometry(proposal: Proposal) {
  const denominator = Math.max(quorumDenominator(proposal).value, 1);
  const forPct = Math.min(100, (proposal.yesVotes / denominator) * 100);
  const againstPct = Math.min(100 - forPct, (proposal.noVotes / denominator) * 100);
  const thresholdPct = Math.min(100, (passThreshold(proposal) / denominator) * 100);
  return { forPct, againstPct, thresholdPct };
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
  const proposals = val<Proposal[]>("proposals", []) ?? [];
  const activeProposals = val<Proposal[]>("activeProposals", []) ?? [];
  const historyProposals = val<Proposal[]>("historyProposals", []) ?? [];
  const hasVotedMap = val<Record<number, boolean>>("hasVotedMap", {}) ?? {};

  // The board settles into an empty/connect state — the skeleton is shown ONLY
  // during the very first read, never as a terminal state. Once that first read
  // resolves (with or without data, with or without a wallet), the empty
  // archetype state with its visible primary action takes over so a viewer can
  // always tell "no proposals yet" from "still loading".
  const hasResolvedRef = useRef(false);
  if (!isLoading) hasResolvedRef.current = true;
  // Display-only safety net: if the first read is still in flight after a short
  // window (e.g. no reachable RPC in a standalone preview), settle the board to
  // its empty/connect state instead of holding the skeleton indefinitely. This
  // never mutates load state or dispatch — it only stops the skeleton from being
  // the terminal impression.
  const [settleTimedOut, setSettleTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading || hasResolvedRef.current) return;
    const timer = window.setTimeout(() => setSettleTimedOut(true), 2500);
    return () => window.clearTimeout(timer);
  }, [isLoading]);
  const isFirstLoad = isLoading && !hasResolvedRef.current && !settleTimedOut;

  const [tab, setTab] = useState<"active" | "create" | "history">("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [proposalType, setProposalType] = useState("0");
  const [policyMethod, setPolicyMethod] = useState(DEFAULT_POLICY_METHOD);
  const [policyValue, setPolicyValue] = useState("");
  const [duration, setDuration] = useState(String(DEFAULT_DURATION_MS));

  const selectedProposal = proposals.find((proposal) => proposal.id === selectedId) ?? null;
  const visibleProposals = tab === "history" ? historyProposals : activeProposals;
  const canWrite = Boolean(walletAddress && isCandidate);
  const showPolicyFields = proposalType === "1";
  const selectedDurationLabel =
    t(DURATION_OPTIONS.find((option) => String(option.value) === duration)?.labelKey ?? "duration7Days");
  const selectedPolicyMethodLabel =
    t(POLICY_METHODS.find((method) => method.key === policyMethod)?.labelKey ?? "methodFeePerByte");
  const draftTitle = newTitle.trim() || t("proposalDraftEmpty");
  const draftDescription = newDescription.trim() || t("descPlaceholder");

  const statusLabel = (proposal: Proposal) => {
    const key = proposal.statusKey || "pending";
    return t(key);
  };

  // User-initiated refresh from the settled empty state. Uses a local flag so
  // the affordance shows a brief, self-resolving spinner on click and otherwise
  // stays a clearly-labeled "Refresh" button — never a perpetual loader tied to
  // an in-flight read that may not resolve in a standalone preview.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await retryLoad();
    } finally {
      setIsRefreshing(false);
    }
  };

  const openDetails = async (proposal: Proposal) => {
    setSelectedId(proposal.id);
    await dispatch("selectProposal", proposal);
  };

  const handleVote = async (proposalId: number, vote: "for" | "against") => {
    await dispatch("vote", { proposalId, vote });
  };

  const handleFinalize = async (proposalId: number) => {
    await dispatch("finalizeProposal", proposalId);
  };

  // Execute a finalized, passed POLICY proposal — applies the on-chain
  // PolicyContract change (a distinct step from finalize).
  const handleExecute = async (proposalId: number) => {
    await dispatch("executeProposal", proposalId);
  };

  // Revoke an own, still-active proposal (creator-gated below).
  const handleRevoke = async (proposalId: number) => {
    await dispatch("revokeProposal", proposalId);
  };

  // A proposal is the connected wallet's own when the creator script hash
  // matches — compared via ownerMatchesAddress so the contract's LE hash lines
  // up with the wallet address. neo-community mirror entries are never ownable.
  const isOwnProposal = (proposal: Proposal): boolean =>
    proposal.source !== "neo-community" &&
    ownerMatchesAddress(proposal.creator, walletAddress);

  const handleCreateProposal = async () => {
    // dispatch forwards the action payload at runtime (typed Promise<void>);
    // the createProposal handler resolves to a truthy tx on success and
    // undefined on failure (validation throw, network/gas error). Only clear
    // the form and switch tabs on confirmed success so a failed submit keeps
    // the typed input instead of wiping it.
    const created: unknown = await dispatch("createProposal", {
      type: Number(proposalType),
      title: newTitle,
      description: newDescription,
      policyMethod: showPolicyFields ? policyMethod : undefined,
      policyValue: showPolicyFields ? policyValue : undefined,
      duration: Number(duration),
    });
    if (!created) return;
    setNewTitle("");
    setNewDescription("");
    setProposalType("0");
    setPolicyValue("");
    setTab("active");
  };

  return (
    <div className="council-play-area">
      <section className="council-hero">
        <div className="council-hero-head">
          <div className="council-hero-badge" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V9l7-5 7 5v12" />
              <path d="M9 21v-6h6v6" />
              <path d="M12 9h.01" />
            </svg>
          </div>
          <div className="council-hero-copy">
            <p className="council-eyebrow">{t("liveGovernance")}</p>
            <h2>{t("title")}</h2>
            <p className="council-hero-sub">{t("governanceSummary")}</p>
          </div>
          <NeoButton variant="ghost" size="sm" className="council-refresh" loading={isRefreshing} disabled={isRefreshing} onClick={handleRefresh}>
            {t("refresh")}
          </NeoButton>
        </div>

        <div className="council-stats" aria-label={t("governanceStats")}>
          <div className="council-stat">
            <span>{totalProposals}</span>
            <label>{t("totalProposals")}</label>
          </div>
          <div className="council-stat">
            <span>{activeCount}</span>
            <label>{t("activeProposals")}</label>
          </div>
          <div className="council-stat">
            <span>{historyCount}</span>
            <label>{t("historyProposals")}</label>
          </div>
          <div
            className={`council-stat council-stat--seat council-stat--seat-${
              !walletAddress || !candidateLoaded ? "off" : isCandidate ? "ok" : "read"
            }`}
          >
            <span className="council-seat-state">
              <span className="council-seat-dot" aria-hidden="true" />
              {!walletAddress || !candidateLoaded
                ? t("seatNotConnected")
                : isCandidate
                  ? t("seatVerified")
                  : t("seatReadOnly")}
            </span>
            <label>{t("councilSeat")}</label>
          </div>
        </div>
      </section>

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
            <span className="council-tab-icon" aria-hidden="true">{TAB_ICONS[entry]}</span>
            <span className="council-tab-label">
              {entry === "active" && t("active")}
              {entry === "create" && t("createProposal")}
              {entry === "history" && t("history")}
            </span>
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <NeoCard variant="erobo" className="council-create-panel">
          <div className="council-panel-heading">
            <h3>{t("createProposal")}</h3>
            <p>{t("createProposalHelp")}</p>
          </div>

          <div className="council-create-workbench">
            <section className="council-draft-preview" aria-label={t("proposalDraft")}>
              <div className="council-draft-preview__rail" aria-hidden="true">
                <span>{t("proposalDraft")}</span>
              </div>
              <div className="council-draft-preview__body">
                <div className="council-draft-preview__meta">
                  <span>{showPolicyFields ? t("policyType") : t("textType")}</span>
                  <span>{selectedDurationLabel}</span>
                </div>
                <strong>{draftTitle}</strong>
                <p>{draftDescription}</p>
                {showPolicyFields && (
                  <div className="council-draft-policy">
                    <span>{selectedPolicyMethodLabel}</span>
                    <strong>{policyValue || t("policyValuePlaceholder")}</strong>
                  </div>
                )}
              </div>
            </section>

            <section className="council-create-section" aria-label={t("proposalType")}>
              <span className="council-section-label">{t("proposalType")}</span>
              <div className="council-choice-grid council-choice-grid--type" role="radiogroup">
                {[
                  { value: "0", label: t("textType"), description: t("textProposalScope") },
                  { value: "1", label: t("policyType"), description: t("policyProposalScope") },
                ].map((option) => {
                  const active = proposalType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`council-choice-button${active ? " is-selected" : ""}`}
                      onClick={() => setProposalType(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="council-create-section" aria-label={t("duration")}>
              <span className="council-section-label">{t("duration")}</span>
              <div className="council-duration-row" role="radiogroup">
                {DURATION_OPTIONS.map((option) => {
                  const active = String(option.value) === duration;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`council-duration-chip${active ? " is-selected" : ""}`}
                      onClick={() => setDuration(String(option.value))}
                    >
                      {t(option.labelKey)}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="council-proposal-editor" aria-label={t("proposalBrief")}>
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
            </section>

            {showPolicyFields && (
              <section className="council-policy-group" aria-label={t("policyDetails")}>
                <div className="council-policy-head">
                  <span className="council-section-label">{t("policyDetails")}</span>
                  <p>{t("policyMethodHint")}</p>
                </div>
                <div className="council-policy-methods" role="radiogroup" aria-label={t("policyMethod")}>
                  {POLICY_METHODS.map((method) => {
                    const active = policyMethod === method.key;
                    return (
                      <button
                        key={method.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`council-policy-method${active ? " is-selected" : ""}`}
                        onClick={() => setPolicyMethod(method.key)}
                      >
                        {t(method.labelKey)}
                      </button>
                    );
                  })}
                </div>
                <NeoInput
                  type="number"
                  value={policyValue}
                  placeholder={t("policyValuePlaceholder")}
                  label={t("policyValue")}
                  onChange={setPolicyValue}
                />
              </section>
            )}
          </div>

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
          {isFirstLoad ? (
            <div
              className="council-loading"
              role="status"
              aria-busy="true"
              aria-label={t("loadingProposals")}
            >
              <div className="council-skeleton" aria-hidden="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="council-skeleton-row">
                    <div className="council-skeleton-head">
                      <span className="council-skeleton-pill" />
                      <span className="council-skeleton-tag" />
                    </div>
                    <span className="council-skeleton-line council-skeleton-line--title" />
                    <span className="council-skeleton-line" />
                  </div>
                ))}
              </div>
              <div className="council-loading-note">
                <span className="council-loading-spinner" aria-hidden="true" />
                <div className="council-loading-note-text">
                  <strong>{t("loadingProposals")}</strong>
                  <span>{t("loadingProposalsHint")}</span>
                </div>
              </div>
            </div>
          ) : visibleProposals.length === 0 ? (
            <div className="council-empty">
              <h3>{tab === "active" ? t("noActiveProposals") : t("noHistory")}</h3>
              <p>{t("emptyProposalHelp")}</p>
              <div className="council-empty-actions">
                {tab === "active" && (
                  <NeoButton
                    variant="primary"
                    size="md"
                    onClick={() => setTab("create")}
                  >
                    {t("createProposal")}
                  </NeoButton>
                )}
                <NeoButton
                  variant="ghost"
                  size="md"
                  loading={isRefreshing}
                  disabled={isRefreshing}
                  onClick={handleRefresh}
                >
                  {t("refresh")}
                </NeoButton>
              </div>
            </div>
          ) : (
            <div className="council-proposal-list">
              {visibleProposals.map((proposal) => {
                const alreadyVoted = Boolean(hasVotedMap[proposal.id]);
                const isExternalProposal = proposal.source === "neo-community";
                return (
                  <article key={proposal.id} className="council-proposal-item">
                    <div className="council-proposal-top">
                      <span className={`council-status-badge council-status--${proposal.statusKey}`}>
                        {statusLabel(proposal)}
                      </span>
                      <span className="council-proposal-id">
                        {proposal.externalId ? `#${proposal.id} · neo.community` : `#${proposal.id}`}
                      </span>
                      {alreadyVoted && <span className="council-voted">{t("alreadyVotedLabel")}</span>}
                    </div>

                    <h3 className="council-proposal-title">{proposal.title}</h3>
                    <p className="council-proposal-desc">{proposal.description || t("noDescription")}</p>

                    <div className="council-vote-bar" aria-label={t("voteSplit")}>
                      <div className="council-vote-bar-track">
                        <div
                          className="council-vote-bar-fill"
                          style={{ width: `${voteBarGeometry(proposal).forPct}%` }}
                        />
                        <div
                          className="council-vote-bar-against"
                          style={{ width: `${voteBarGeometry(proposal).againstPct}%` }}
                        />
                        <span
                          className="council-vote-bar-marker"
                          style={{ left: `${voteBarGeometry(proposal).thresholdPct}%` }}
                          title={t("passLine")}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="council-vote-counts">
                        <span className="council-vote-for">{proposal.yesVotes} {t("for")}</span>
                        <span className="council-vote-against">{proposal.noVotes} {t("against")}</span>
                      </div>
                    </div>

                    <p className="council-pass-threshold">
                      {t("passThreshold", {
                        needed: passThreshold(proposal),
                        total: quorumDenominator(proposal).value,
                      })}
                    </p>

                    <div className="council-proposal-meta">
                      <span>
                        {t("quorum")}: {proposal.totalVotes}/{quorumDenominator(proposal).value}
                        {quorumDenominator(proposal).isFallback && ` · ${t("councilOf21")}`}
                      </span>
                      <span>{t("creator")}: {shortAddress(proposal.creatorDisplay ?? proposal.creator)}</span>
                      <span className={isEndingSoon(proposal) ? "council-ending-soon" : ""}>
                        {t("votingEnds")}: {formatDate(proposal.expiryTime)}
                        {isEndingSoon(proposal) && ` · ${t("endingSoon")}`}
                      </span>
                    </div>

                    <div className="council-proposal-actions">
                      <NeoButton variant="secondary" size="md" block onClick={() => openDetails(proposal)}>
                        {t("viewDetails")}
                      </NeoButton>
                      {proposal.statusKey === "active" && !isExternalProposal && (
                        <div className="council-vote-actions">
                          <NeoButton
                            variant="success"
                            size="sm"
                            block
                            loading={isVoting}
                            disabled={isVoting || !canWrite || alreadyVoted}
                            onClick={() => handleVote(proposal.id, "for")}
                          >
                            {t("voteFor")}
                          </NeoButton>
                          <NeoButton
                            variant="danger"
                            size="sm"
                            block
                            loading={isVoting}
                            disabled={isVoting || !canWrite || alreadyVoted}
                            onClick={() => handleVote(proposal.id, "against")}
                          >
                            {t("voteAgainst")}
                          </NeoButton>
                        </div>
                      )}
                      {proposal.statusKey === "active" && isExternalProposal && (
                        <span className="council-readonly-note">{t("externalProposalReadOnly")}</span>
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
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <p>{selectedProposal.description || t("noDescription")}</p>
          <dl className="council-details-grid">
            <div><dt>{t("proposalType")}</dt><dd>{selectedProposal.type === 1 ? t("policyType") : t("textType")}</dd></div>
            <div><dt>{t("votingEnds")}</dt><dd>{formatDate(selectedProposal.expiryTime)}</dd></div>
            <div><dt>{t("proposalCreated")}</dt><dd>{formatDate(selectedProposal.createTime)}</dd></div>
            <div>
              <dt>{t("quorum")}</dt>
              <dd>
                {selectedProposal.totalVotes}/{quorumDenominator(selectedProposal).value}
                {quorumDenominator(selectedProposal).isFallback && ` · ${t("councilOf21")}`}
              </dd>
            </div>
          </dl>

          {selectedProposal.statusKey === "passed" && selectedProposal.source !== "neo-community" && (
            <NeoButton
              variant="primary"
              size="md"
              block
              disabled={!canWrite}
              onClick={() => handleFinalize(selectedProposal.id)}
            >
              {t("finalizeProposal")}
            </NeoButton>
          )}

          {/* Execute the on-chain PolicyContract change for a passed POLICY
              proposal — a distinct step from finalize (previously unreachable,
              the action was aliased to finalize). */}
          {selectedProposal.type === 1 &&
            selectedProposal.statusKey === "passed" &&
            selectedProposal.source !== "neo-community" && (
              <NeoButton
                variant="secondary"
                size="md"
                block
                disabled={!canWrite}
                onClick={() => handleExecute(selectedProposal.id)}
              >
                {t("executeProposal")}
              </NeoButton>
            )}

          {/* Revoke an own, still-active proposal (creator exit path). */}
          {selectedProposal.statusKey === "active" && isOwnProposal(selectedProposal) && (
            <NeoButton
              variant="danger"
              size="md"
              block
              disabled={!walletAddress}
              onClick={() => handleRevoke(selectedProposal.id)}
            >
              {t("revokeProposal")}
            </NeoButton>
          )}

          <details className="council-more-details">
            <summary>{t("proposalDetails")}</summary>
            <dl className="council-details-grid">
              <div>
                <dt>{t("proposalId")}</dt>
                <dd>{selectedProposal.externalId ? `#${selectedProposal.id} · ${selectedProposal.externalId}` : `#${selectedProposal.id}`}</dd>
              </div>
              <div><dt>{t("creator")}</dt><dd>{shortAddress(selectedProposal.creatorDisplay ?? selectedProposal.creator)}</dd></div>
              {selectedProposal.policyMethod && (
                <div><dt>{t("policyMethod")}</dt><dd>{selectedProposal.policyMethod}</dd></div>
              )}
              {selectedProposal.policyValue && (
                <div><dt>{t("policyValue")}</dt><dd>{selectedProposal.policyValue}</dd></div>
              )}
            </dl>
          </details>
        </aside>
      )}
    </div>
  );
}
