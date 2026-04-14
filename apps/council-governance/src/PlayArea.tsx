/**
 * PlayArea.tsx -- Council Governance
 *
 * Full UI: stats bar, proposal list with vote buttons, create proposal form.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: "active" | "passed" | "rejected" | "pending";
  votesFor: number;
  votesAgainst: number;
  creator: string;
  endTime?: number;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isVoting = bool("isVoting");
  const isCreating = bool("isCreating");
  const totalProposals = num("totalProposals");
  const activeProposals = num("activeProposals");
  const historyProposals = num("historyProposals");
  const userVotingPower = str("userVotingPower", "0");
  const proposals = val<Proposal[]>("proposals") ?? [];
  const selectedProposal = val<Proposal>("selectedProposal");

  // Local form state for creating a proposal
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleVote = async (proposalId: string, support: boolean) => {
    await dispatch("vote", { proposalId, support });
  };

  const handleCreateProposal = async () => {
    if (!newTitle.trim()) return;
    await dispatch("createProposal", {
      title: newTitle,
      description: newDescription,
    });
    setNewTitle("");
    setNewDescription("");
    setShowCreateForm(false);
  };

  const statusClass = (status: string) => {
    switch (status) {
      case "active": return "council-status--active";
      case "passed": return "council-status--passed";
      case "rejected": return "council-status--rejected";
      default: return "council-status--pending";
    }
  };

  if (isLoading) {
    return (
      <div className="council-play-area">
        <div className="council-loading">
          <div className="council-loading-spinner" />
          <span>{t("loading") || "Loading..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="council-play-area">
      {/* Stats Bar */}
      <div className="council-hero-stats">
        <div className="council-hero-stat">
          <span className="council-hero-stat-value">{totalProposals}</span>
          <span className="council-hero-stat-label">{t("totalProposals")}</span>
        </div>
        <div className="council-hero-stat">
          <span className="council-hero-stat-value">{activeProposals}</span>
          <span className="council-hero-stat-label">{t("active")}</span>
        </div>
        <div className="council-hero-stat">
          <span className="council-hero-stat-value">{historyProposals}</span>
          <span className="council-hero-stat-label">{t("history")}</span>
        </div>
        <div className="council-hero-stat">
          <span className="council-hero-stat-value">{userVotingPower}</span>
          <span className="council-hero-stat-label">{t("yourPower")}</span>
        </div>
      </div>

      {/* Proposal List */}
      <NeoCard variant="erobo" className="council-proposals-card">
        <div className="council-proposals-header">
          <h3 className="council-section-title">{t("proposals")}</h3>
          <NeoButton
            variant="secondary"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? t("cancel") : t("createProposal")}
          </NeoButton>
        </div>

        {/* Create Proposal Form */}
        {showCreateForm && (
          <div className="council-create-form">
            <NeoInput
              value={newTitle}
              placeholder={t("proposalTitlePlaceholder")}
              label={t("proposalTitle")}
              onChange={setNewTitle}
            />
            <NeoInput
              type="textarea"
              value={newDescription}
              placeholder={t("proposalDescPlaceholder")}
              label={t("proposalDescription")}
              onChange={setNewDescription}
            />
            <NeoButton
              variant="primary"
              size="md"
              block
              loading={isCreating}
              disabled={isCreating || !newTitle.trim()}
              onClick={handleCreateProposal}
            >
              {t("submitProposal")}
            </NeoButton>
          </div>
        )}

        {/* Proposal Items */}
        {proposals.length === 0 ? (
          <div className="council-empty">{t("noProposals")}</div>
        ) : (
          <div className="council-proposal-list">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="council-proposal-item">
                <div className="council-proposal-top">
                  <span className={`council-status-badge ${statusClass(proposal.status)}`}>
                    {t(proposal.status)}
                  </span>
                  <span className="council-proposal-id">#{proposal.id}</span>
                </div>
                <h4 className="council-proposal-title">{proposal.title}</h4>
                {proposal.description && (
                  <p className="council-proposal-desc">{proposal.description}</p>
                )}
                <div className="council-vote-bar">
                  <div className="council-vote-bar-track">
                    <div
                      className="council-vote-bar-fill council-vote-bar-for"
                      style={{
                        width: `${proposal.votesFor + proposal.votesAgainst > 0
                          ? (proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                  <div className="council-vote-counts">
                    <span className="council-vote-for">{proposal.votesFor} {t("for")}</span>
                    <span className="council-vote-against">{proposal.votesAgainst} {t("against")}</span>
                  </div>
                </div>
                {proposal.status === "active" && (
                  <div className="council-vote-actions">
                    <NeoButton
                      variant="success"
                      size="sm"
                      loading={isVoting}
                      disabled={isVoting}
                      onClick={() => handleVote(proposal.id, true)}
                    >
                      {t("voteFor")}
                    </NeoButton>
                    <NeoButton
                      variant="danger"
                      size="sm"
                      loading={isVoting}
                      disabled={isVoting}
                      onClick={() => handleVote(proposal.id, false)}
                    >
                      {t("voteAgainst")}
                    </NeoButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </NeoCard>
    </div>
  );
}
