/**
 * PlayArea.tsx — Quadratic Funding
 *
 * Full interactive UI with tabs for Rounds, Projects, and Contributions.
 * Uses all state keys and actions from main.tsx setup().
 */

import { useState } from "react";
import { NeoCard, NeoButton, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatAddress } from "@shared/utils/format";
import FundingHero from "./components/FundingHero";
import RoundForm from "./pages/index/components/RoundForm";
import RoundList from "./pages/index/components/RoundList";
import RoundAdminPanel from "./pages/index/components/RoundAdminPanel";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  // Round state
  const rounds = val<Array<Record<string, unknown>>>("rounds") ?? [];
  const selectedRoundId = val<number>("selectedRoundId");
  const selectedRound = val<Record<string, unknown>>("selectedRound");
  const isRefreshingRounds = bool("isRefreshingRounds");
  const isAddingMatching = bool("isAddingMatching");
  const isFinalizing = bool("isFinalizing");
  const isClaimingUnused = bool("isClaimingUnused");
  const canManageSelectedRound = bool("canManageSelectedRound");
  const canFinalizeSelectedRound = bool("canFinalizeSelectedRound");
  const canClaimUnused = bool("canClaimUnused");

  // Project state
  const projects = val<Array<Record<string, unknown>>>("projects") ?? [];
  const isRefreshingProjects = bool("isRefreshingProjects");
  const claimingProjectId = str("claimingProjectId");

  // Contribution state
  const contributeForm = val<Record<string, unknown>>("contributeForm");

  // Display state
  const activeTab = str("activeTab", "rounds");
  const matchingPoolDisplay = str("matchingPoolDisplay", t("notAvailable") || "N/A");
  const selectedRoundDisplay = str("selectedRoundDisplay");
  const roundCount = num("roundCount");
  const projectCount = num("projectCount");

  // Status
  const roundsStatus = val<Record<string, unknown>>("roundsStatus");
  const projectsStatus = val<Record<string, unknown>>("projectsStatus");
  const contributionStatus = val<Record<string, unknown>>("contributionStatus");

  // Local form state for project registration
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLink, setProjectLink] = useState("");

  // Local form state for contributions
  const [contributeProjectId, setContributeProjectId] = useState("");
  const [contributeAmount, setContributeAmount] = useState("");

  // Computed
  const activeRounds = rounds.filter((r) => r.status === "active").length;
  const roundProgressPct = rounds.length === 0 ? 0 : Math.round((activeRounds / rounds.length) * 100);

  const roundStatusLabel = (round: Record<string, unknown>) =>
    String(round.statusLabel ?? round.status ?? "");
  const formatAmount = (v: unknown) => String(v ?? "0");
  const formatSchedule = (v: unknown) => String(v ?? "");

  const switchTab = (tab: string) => {
    if (state.activeTab) state.activeTab.set(tab);
  };

  const statusMessage = roundsStatus
    ? String((roundsStatus as Record<string, unknown>).message ?? "")
    : "";
  const statusType = roundsStatus
    ? String((roundsStatus as Record<string, unknown>).type ?? "")
    : "";

  return (
    <div className="qf-play-area">
      <FundingHero
        t={t}
        progressPct={roundProgressPct}
        matchingPoolDisplay={matchingPoolDisplay}
        projectCount={projects.length}
      />

      {/* Status Banner */}
      {statusMessage && (
        <div className={`status-banner status-${statusType}`}>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-bar">
        <NeoButton
          size="sm"
          variant={activeTab === "rounds" ? "primary" : "secondary"}
          onClick={() => switchTab("rounds")}
        >
          {t("tabRounds") || "Rounds"} ({rounds.length})
        </NeoButton>
        <NeoButton
          size="sm"
          variant={activeTab === "projects" ? "primary" : "secondary"}
          onClick={() => switchTab("projects")}
        >
          {t("tabProjects") || "Projects"} ({projects.length})
        </NeoButton>
        <NeoButton
          size="sm"
          variant={activeTab === "contribute" ? "primary" : "secondary"}
          onClick={() => switchTab("contribute")}
        >
          {t("tabContribute") || "Contribute"}
        </NeoButton>
      </div>

      {/* Rounds Tab */}
      {activeTab === "rounds" && (
        <>
          <RoundForm
            onSubmit={(...args: unknown[]) => dispatch("createRound", ...args)}
            t={t}
          />
          <RoundList
            rounds={rounds}
            selectedRoundId={String(selectedRoundId ?? "")}
            isRefreshing={isRefreshingRounds}
            roundStatusLabel={roundStatusLabel}
            formatAmount={formatAmount}
            formatSchedule={formatSchedule}
            formatAddress={formatAddress}
            onRefresh={() => {}}
            onSelect={(round: Record<string, unknown>) => {
              if (state.selectedRoundId) state.selectedRoundId.set(round.id as number);
            }}
            t={t}
          />
          {selectedRound && (
            <RoundAdminPanel
              round={selectedRound}
              canManage={canManageSelectedRound}
              canFinalize={canFinalizeSelectedRound}
              canClaimUnused={canClaimUnused}
              isAddingMatching={isAddingMatching}
              isFinalizing={isFinalizing}
              isClaimingUnused={isClaimingUnused}
              onAddMatching={(...args: unknown[]) => dispatch("addMatching", ...args)}
              onFinalize={(...args: unknown[]) => dispatch("finalize", ...args)}
              onClaimUnused={() => dispatch("claimUnused")}
              t={t}
            />
          )}
        </>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <>
          <NeoCard title={t("registerProject") || "Register Project"}>
            <div className="field-stack">
              <NeoInput
                value={projectName}
                label={t("projectName") || "Project Name"}
                placeholder={t("projectNamePlaceholder") || "Enter project name"}
                onChange={(v) => setProjectName(v)}
              />
              <NeoInput
                value={projectDescription}
                label={t("projectDescription") || "Description"}
                placeholder={t("projectDescriptionPlaceholder") || "Describe your project"}
                onChange={(v) => setProjectDescription(v)}
              />
              <NeoInput
                value={projectLink}
                label={t("projectLink") || "Link"}
                placeholder={t("projectLinkPlaceholder") || "https://..."}
                onChange={(v) => setProjectLink(v)}
              />
              <NeoButton
                variant="primary"
                onClick={() =>
                  dispatch("registerProject", {
                    name: projectName,
                    description: projectDescription,
                    link: projectLink,
                  })
                }
              >
                {t("registerProject") || "Register Project"}
              </NeoButton>
            </div>
          </NeoCard>

          <NeoCard title={t("projectsList") || "Projects"}>
            {isRefreshingProjects && (
              <div className="loading-indicator">
                <span>{t("loading") || "Loading..."}</span>
              </div>
            )}
            {projects.length === 0 && !isRefreshingProjects ? (
              <span className="empty-text">{t("emptyProjects") || "No projects registered yet."}</span>
            ) : (
              <div className="project-list">
                {projects.map((project) => (
                  <div key={String(project.id)} className="project-card">
                    <div className="project-header">
                      <span className="project-name">{String(project.name || `#${project.id}`)}</span>
                      <span className={`status-pill ${project.active ? "active" : "inactive"}`}>
                        {project.active ? (t("active") || "Active") : (t("inactive") || "Inactive")}
                      </span>
                    </div>
                    <span className="project-desc">{String(project.description || "")}</span>
                    <div className="project-stats">
                      <span>{t("totalContributed") || "Contributed"}: {formatAmount(project.totalContributed)}</span>
                      <span>{t("contributors") || "Contributors"}: {String(project.contributorCount ?? 0)}</span>
                      <span>{t("matched") || "Matched"}: {formatAmount(project.matchedAmount)}</span>
                    </div>
                    {project.link && (
                      <span className="project-link">{String(project.link)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </NeoCard>
        </>
      )}

      {/* Contribute Tab */}
      {activeTab === "contribute" && (
        <NeoCard title={t("quickContribute") || "Contribute"}>
          <div className="field-stack">
            {selectedRound ? (
              <div className="selected-round-info">
                <span className="info-label">{t("sidebarSelectedRound") || "Selected Round"}</span>
                <span className="info-value">
                  {String(selectedRound.title || `#${selectedRound.id}`)}
                </span>
              </div>
            ) : (
              <div className="empty-state-text">
                <span>{t("selectRoundFirst") || "Please select a round from the Rounds tab first."}</span>
              </div>
            )}
            <NeoInput
              value={contributeProjectId}
              label={t("projectId") || "Project ID"}
              placeholder={t("projectIdPlaceholder") || "Enter project ID"}
              onChange={(v) => setContributeProjectId(v)}
            />
            <NeoInput
              value={contributeAmount}
              label={t("contributionAmount") || "Amount"}
              placeholder={t("contributionAmountPlaceholder") || "0.0"}
              onChange={(v) => setContributeAmount(v)}
            />
            <NeoButton
              variant="primary"
              disabled={!selectedRound}
              onClick={() =>
                dispatch("contribute", {
                  projectId: contributeProjectId,
                  amount: contributeAmount,
                })
              }
            >
              {t("contribute") || "Contribute"}
            </NeoButton>
          </div>
        </NeoCard>
      )}
    </div>
  );
}
