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
  const isCreatingRound = bool("isCreatingRound");
  const isRegisteringProject = bool("isRegisteringProject");
  const isContributing = bool("isContributing");
  const isAddingMatching = bool("isAddingMatching");
  const isFinalizing = bool("isFinalizing");
  const isClaimingUnused = bool("isClaimingUnused");
  const isCancelling = bool("isCancelling");
  const isAdmin = bool("isAdmin");
  const canManageSelectedRound = bool("canManageSelectedRound");
  const canFinalizeSelectedRound = bool("canFinalizeSelectedRound");
  const canClaimUnused = bool("canClaimUnused");
  const canCancelSelectedRound = bool("canCancelSelectedRound");
  const suggestedMatches =
    val<
      Array<{
        id: string;
        name: string;
        contributedDisplay: string;
        donors: string;
        matchDisplay: string;
        matchBaseUnits: string;
      }>
    >("suggestedMatches") ?? [];

  const projects = val<Array<Record<string, unknown>>>("projects") ?? [];
  const isRefreshingProjects = bool("isRefreshingProjects");
  const claimableProjectIds = val<string[]>("claimableProjectIds") ?? [];
  const claimingProjectId = str("claimingProjectId", "");
  const activeTab = str("activeTab", "rounds");
  const matchingPoolDisplay = str("matchingPoolDisplay", "—");
  const selectedRoundDisplay = str("selectedRoundDisplay", "—");
  const roundCount = num("roundCount", rounds.length);
  const projectCount = num("projectCount", projects.length);
  const activeRoundCount = num("activeRoundCount", rounds.filter((r) => r.status === "active").length);

  const roundsStatus = val<Record<string, unknown>>("roundsStatus");
  const statusMessage = roundsStatus ? String(roundsStatus.msg ?? roundsStatus.message ?? "") : "";
  const statusType = roundsStatus ? String(roundsStatus.type ?? "info") : "info";

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [contributeProjectId, setContributeProjectId] = useState("");
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributionMemo, setContributionMemo] = useState("");

  const roundProgressPct =
    roundCount === 0 ? 0 : Math.round((activeRoundCount / roundCount) * 100);

  // Form-reset counter handed to RoundForm; bumped only after a successful
  // create so the round inputs clear (RoundForm owns its own field state).
  const [roundResetKey, setRoundResetKey] = useState(0);

  // dispatch is typed Promise<void> but resolves to the handler's runtime
  // payload (see MiniAppRoot.dispatch); handlers return success booleans.
  const submitCreateRound = async (...args: unknown[]) => {
    const ok = (await dispatch("createRound", ...args)) as unknown as boolean;
    if (ok) setRoundResetKey((key) => key + 1);
  };

  const submitRegisterProject = async () => {
    const ok = (await dispatch("registerProject", {
      name: projectName,
      description: projectDescription,
      link: projectLink,
    })) as unknown as boolean;
    if (ok) {
      setProjectName("");
      setProjectDescription("");
      setProjectLink("");
    }
  };

  const submitContribute = async () => {
    const ok = (await dispatch("contribute", {
      projectId: contributeProjectId,
      amount: contributeAmount,
      memo: contributionMemo,
    })) as unknown as boolean;
    if (ok) {
      setContributeProjectId("");
      setContributeAmount("");
      setContributionMemo("");
    }
  };

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
    // Round timestamps are milliseconds on-chain — pass straight to Date.
    if (typeof value === "number" && value > 0) {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(value),
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
            <div
              className={`qf-content-grid${
                rounds.length === 0 && !selectedRound ? " qf-content-grid--single" : ""
              }`}
            >
              <RoundForm onSubmit={submitCreateRound} resetKey={roundResetKey} t={t} loading={isCreatingRound} />
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
                    knownProjectIds={projects
                      .map((project) => String(project.id ?? ""))
                      .filter((id) => id !== "")}
                    suggestedMatches={suggestedMatches}
                    canManage={canManageSelectedRound}
                    canFinalize={canFinalizeSelectedRound}
                    canClaimUnused={canClaimUnused}
                    canCancel={canCancelSelectedRound}
                    isAdmin={isAdmin}
                    isAddingMatching={isAddingMatching}
                    isFinalizing={isFinalizing}
                    isClaimingUnused={isClaimingUnused}
                    isCancelling={isCancelling}
                    onAddMatching={(...args: unknown[]) => dispatch("addMatching", ...args)}
                    onFinalize={(...args: unknown[]) => dispatch("finalize", ...args)}
                    onFinalizeSuggested={() => dispatch("finalizeSuggested")}
                    onClaimUnused={() => dispatch("claimUnused")}
                    onCancel={() => dispatch("cancelRound")}
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
                    loading={isRegisteringProject}
                    disabled={isRegisteringProject || !selectedRound}
                    onClick={submitRegisterProject}
                  >
                    {isRegisteringProject ? t("registeringProject") : t("registerProject")}
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
                        <div className="qf-project-actions">
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
                          {project.claimed ? (
                            <span className="qf-status-pill claimed">{t("projectStatusClaimed")}</span>
                          ) : (
                            claimableProjectIds.includes(String(project.id ?? "")) && (
                              <NeoButton
                                size="sm"
                                variant="primary"
                                loading={claimingProjectId === String(project.id ?? "")}
                                onClick={() => dispatch("claimProject", project)}
                              >
                                {t("claimProject")}
                              </NeoButton>
                            )
                          )}
                        </div>
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
              {/* Donor value-prop at the moment of contributing: the matching pool
                  amplifies donations by donor breadth — surfaced here (not just in
                  the admin panel) so a donor sees WHY many small donations win. */}
              <div className="qf-amplify-note" role="note">
                <strong>{t("qfAmplifyTitle")}</strong>
                <p>{t("qfAmplifyCopy")}</p>
                {(() => {
                  const id = contributeProjectId.trim();
                  if (!id) return null;
                  const match = suggestedMatches.find((m) => m.id === id);
                  if (!match) return null;
                  return (
                    <p className="qf-amplify-estimate">
                      {t("qfProjectMatchEstimate", {
                        id,
                        match: match.matchDisplay,
                      })}
                      <span className="qf-amplify-estimate-hint">
                        {t("qfProjectMatchHint")}
                      </span>
                    </p>
                  );
                })()}
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
                  loading={isContributing}
                  disabled={!selectedRound || isContributing}
                  onClick={submitContribute}
                >
                  {isContributing ? t("contributing") : t("contribute")}
                </NeoButton>
              </div>
            </NeoCard>
          )}
        </div>
      </div>
    </div>
  );
}
