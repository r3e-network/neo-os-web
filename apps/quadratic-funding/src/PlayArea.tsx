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

function formatTokenAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  const raw = String(value);
  if (raw.includes(".")) return raw;
  try {
    const amount = typeof value === "bigint" ? value : BigInt(raw);
    if (amount < 100000000n) return amount.toString();
    const padded = amount.toString().padStart(9, "0");
    const whole = padded.slice(0, -8) || "0";
    const fraction = padded.slice(-8).replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole;
  } catch (_error) {
    return raw;
  }
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const rounds = val<Array<Record<string, unknown>>>("rounds") ?? [];
  const selectedRoundId = val<string>("selectedRoundId") ?? "";
  const selectedRound = val<Record<string, unknown>>("selectedRound");
  const isRefreshingRounds = bool("isRefreshingRounds");
  const isAddingMatching = bool("isAddingMatching");
  const isFinalizing = bool("isFinalizing");
  const isClaimingUnused = bool("isClaimingUnused");
  const canManageSelectedRound = bool("canManageSelectedRound");
  const canFinalizeSelectedRound = bool("canFinalizeSelectedRound");
  const canClaimUnused = bool("canClaimUnused");

  const projects = val<Array<Record<string, unknown>>>("projects") ?? [];
  const isRefreshingProjects = bool("isRefreshingProjects");
  const activeTab = str("activeTab", "rounds");
  const matchingPoolDisplay = str("matchingPoolDisplay", "—");
  const selectedRoundDisplay = str("selectedRoundDisplay", "—");
  const roundCount = num("roundCount", rounds.length);
  const projectCount = num("projectCount", projects.length);
  const activeRoundCount = num("activeRoundCount", rounds.filter((r) => r.status === "active").length);

  const roundsStatus = val<Record<string, unknown>>("roundsStatus");
  const statusMessage = roundsStatus ? String(roundsStatus.message ?? "") : "";
  const statusType = roundsStatus ? String(roundsStatus.type ?? "") : "info";

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [contributeProjectId, setContributeProjectId] = useState("");
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributionMemo, setContributionMemo] = useState("");

  const roundProgressPct =
    roundCount === 0 ? 0 : Math.round((activeRoundCount / roundCount) * 100);

  const switchTab = (tab: string) => {
    state.activeTab?.set(tab);
    void dispatch("switchTab", tab);
  };

  const selectRound = (round: Record<string, unknown>) => {
    state.selectedRoundId?.set(String(round.id ?? ""));
    void dispatch("selectRound", round);
  };

  const roundStatusLabel = (round: Record<string, unknown>) =>
    String(round.statusLabel ?? round.status ?? t("roundStatusActive"));

  const formatSchedule = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && value > 0) {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(value * 1000),
      );
    }
    return t("dateUnknown");
  };

  return (
    <div className="qf-play-area">
      <div className="qf-shell">
        <div className="qf-main-column">
          <FundingHero
            t={t}
            progressPct={roundProgressPct}
            matchingPoolDisplay={matchingPoolDisplay}
            roundCount={roundCount}
            activeRoundCount={activeRoundCount}
            selectedRoundDisplay={selectedRoundDisplay}
            hasSelectedRound={Boolean(selectedRound)}
            isRefreshing={isRefreshingRounds}
            onRefresh={() => dispatch("refreshRounds")}
            onContribute={() => switchTab("contribute")}
          />

          {statusMessage && (
            <div className={`qf-status-banner qf-status-${statusType}`}>
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="qf-action-tabs" role="tablist" aria-label={t("qfTabsLabel")}>
            {["rounds", "projects", "contribute"].map((tab) => (
              <NeoButton
                key={tab}
                size="sm"
                variant={activeTab === tab ? "primary" : "secondary"}
                onClick={() => switchTab(tab)}
              >
                {tab === "rounds" && `${t("tabRounds")} (${roundCount})`}
                {tab === "projects" && `${t("tabProjects")} (${projectCount})`}
                {tab === "contribute" && t("tabContribute")}
              </NeoButton>
            ))}
          </div>

          {activeTab === "rounds" && (
            <div className="qf-content-grid">
              <RoundForm onSubmit={(...args: unknown[]) => dispatch("createRound", ...args)} t={t} />
              <div className="qf-side-stack">
                <RoundList
                  rounds={rounds}
                  selectedRoundId={selectedRoundId}
                  isRefreshing={isRefreshingRounds}
                  roundStatusLabel={roundStatusLabel}
                  formatAmount={formatTokenAmount}
                  formatSchedule={formatSchedule}
                  formatAddress={formatAddress}
                  onRefresh={() => dispatch("refreshRounds")}
                  onSelect={selectRound}
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
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="qf-content-grid">
              <NeoCard title={t("registerProject")} className="qf-form-panel">
                <p className="qf-panel-hint">
                  {selectedRound ? selectedRoundDisplay : t("qfSelectRoundBeforeProject")}
                </p>
                <div className="qf-form-grid">
                  <NeoInput
                    value={projectName}
                    label={t("projectName")}
                    placeholder={t("projectNamePlaceholder")}
                    onChange={setProjectName}
                  />
                  <NeoInput
                    value={projectDescription}
                    label={t("projectDescription")}
                    placeholder={t("projectDescriptionPlaceholder")}
                    onChange={setProjectDescription}
                  />
                  <NeoInput
                    value={projectLink}
                    label={t("projectLink")}
                    placeholder={t("projectLinkPlaceholder")}
                    onChange={setProjectLink}
                  />
                </div>
                <div className="qf-panel-footer">
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
                    {t("registerProject")}
                  </NeoButton>
                </div>
              </NeoCard>

              <NeoCard title={t("projectsList") || t("tabProjects")} className="qf-project-panel">
                {isRefreshingProjects && (
                  <div className="qf-loading-row">{t("loading") || "Loading..."}</div>
                )}
                {projects.length === 0 && !isRefreshingProjects ? (
                  <div className="qf-empty-ledger">
                    <strong>{t("qfNoProjectsTitle")}</strong>
                    <span>{t("qfNoProjectsBody")}</span>
                  </div>
                ) : (
                  <div className="qf-project-grid">
                    {projects.map((project) => (
                      <div key={String(project.id)} className="qf-project-card">
                        <div className="qf-project-header">
                          <strong>{String(project.name || `#${project.id}`)}</strong>
                          <span className={`qf-status-pill ${project.active ? "active" : "inactive"}`}>
                            {project.active ? t("projectStatusActive") : t("projectStatusInactive")}
                          </span>
                        </div>
                        <span>{String(project.description || t("projectDescriptionPlaceholder"))}</span>
                        <div className="qf-project-stats">
                          <span>{t("totalContributed")}: {formatTokenAmount(project.totalContributed)}</span>
                          <span>{t("donors")}: {String(project.contributorCount ?? 0)}</span>
                          <span>{t("matchedAmount")}: {formatTokenAmount(project.matchedAmount)}</span>
                        </div>
                        {project.link && <span className="qf-project-link">{String(project.link)}</span>}
                        <NeoButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setContributeProjectId(String(project.id ?? ""));
                            switchTab("contribute");
                          }}
                        >
                          {t("contributeNow")}
                        </NeoButton>
                      </div>
                    ))}
                  </div>
                )}
              </NeoCard>
            </div>
          )}

          {activeTab === "contribute" && (
            <NeoCard title={t("quickContribute")} className="qf-contribute-panel">
              <div className="qf-contribute-summary">
                <span>{t("sidebarSelectedRound")}</span>
                <strong>{selectedRound ? selectedRoundDisplay : t("qfNoRoundTitle")}</strong>
              </div>
              <p className="qf-panel-hint">
                {selectedRound ? t("qfContributionHint") : t("selectRoundFirst")}
              </p>
              <div className="qf-form-grid">
                <NeoInput
                  value={contributeProjectId}
                  label={t("contributionProjectId")}
                  placeholder={t("selectProjectHint")}
                  onChange={setContributeProjectId}
                />
                <NeoInput
                  value={contributeAmount}
                  label={t("contributionAmount")}
                  placeholder={t("contributionAmountPlaceholder")}
                  onChange={setContributeAmount}
                />
                <NeoInput
                  value={contributionMemo}
                  label={t("contributionMemo")}
                  placeholder={t("contributionMemoPlaceholder")}
                  onChange={setContributionMemo}
                />
              </div>
              <div className="qf-panel-footer">
                <NeoButton
                  variant="primary"
                  disabled={!selectedRound}
                  onClick={() =>
                    dispatch("contribute", {
                      projectId: contributeProjectId,
                      amount: contributeAmount,
                      memo: contributionMemo,
                    })
                  }
                >
                  {t("contribute")}
                </NeoButton>
              </div>
            </NeoCard>
          )}
        </div>
      </div>
    </div>
  );
}
