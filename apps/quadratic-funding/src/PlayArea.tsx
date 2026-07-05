/**
 * PlayArea.tsx -- Quadratic Funding (v2 scene-driven rebuild)
 *
 * The matching desk IS the product: donors pick a real project card, pledge a
 * GAS tile, and watch the contribution flow into the public-goods pool. Manual
 * IDs, memo, project registration, match review, and admin tools stay tucked in
 * the drawer. Chain logic is untouched.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardList, FilePlus2, HandCoins, HeartHandshake, Landmark, ShieldCheck, Sprout, Users } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiPanel, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const AMOUNT_PRESETS = ["1", "2", "5", "10"];
const FUNDING_DESK_IMAGE = "funding-desk.webp";
type FundingAsset = "GAS" | "NEO";

function normalizeFundingAsset(value: unknown): FundingAsset {
  return String(value ?? "").toUpperCase() === "NEO" ? "NEO" : "GAS";
}

function normalizeAmountForAsset(value: string, asset: FundingAsset): string {
  if (asset === "NEO") {
    const whole = value.split(/[.,]/)[0] ?? "";
    return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function isValidAmountForAsset(raw: string, asset: FundingAsset): boolean {
  const value = raw.trim();
  if (asset === "NEO") return /^[1-9]\d*$/.test(value);
  return /^(?:\d+(?:\.\d{0,8})?|\.\d{1,8})$/.test(value) && Number(value) > 0;
}

function clampPledge(raw: string, delta: number, asset: FundingAsset): string {
  if (asset === "NEO") {
    const current = Number.parseInt(normalizeAmountForAsset(raw, asset), 10);
    return String(Math.max(1, (Number.isFinite(current) && current > 0 ? current : 1) + delta));
  }
  const current = Number.parseFloat(raw);
  const next = Math.max(0.00000001, (Number.isFinite(current) && current > 0 ? current : 1) + delta);
  return next.toFixed(8).replace(/\.?0+$/, "");
}

function projectLabel(project: Record<string, unknown> | undefined, fallback: string) {
  if (!project) return fallback;
  return String(project.name ?? project.id ?? fallback);
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const rounds = val<Array<Record<string, unknown>>>("rounds") ?? [];
  const selectedRound = val<Record<string, unknown>>("selectedRound");
  const isRefreshingRounds = bool("isRefreshingRounds");
  const isContributing = bool("isContributing");
  const isRegisteringProject = bool("isRegisteringProject");
  const isAdmin = bool("isAdmin");
  const canManageSelectedRound = bool("canManageSelectedRound");
  const canFinalizeSelectedRound = bool("canFinalizeSelectedRound");
  const canClaimUnused = bool("canClaimUnused");
  const canCancelSelectedRound = bool("canCancelSelectedRound");
  const suggestedMatches = val<Array<{ id: string; name: string; contributedDisplay: string; donors: string; matchDisplay: string }>>("suggestedMatches") ?? [];
  const projectsValue = val<Array<Record<string, unknown>>>("projects");
  const projects = useMemo(() => projectsValue ?? [], [projectsValue]);
  const claimableProjectIds = val<string[]>("claimableProjectIds") ?? [];
  const claimingProjectId = str("claimingProjectId", "");
  const matchingPoolDisplay = str("matchingPoolDisplay", "-");
  const selectedRoundDisplay = str("selectedRoundDisplay", "-");
  const roundCount = num("roundCount", rounds.length);
  const projectCount = num("projectCount", projects.length);
  const roundsStatus = val<Record<string, unknown>>("roundsStatus");
  const statusMessage = roundsStatus ? String(roundsStatus.msg ?? roundsStatus.message ?? "") : "";
  const statusType = roundsStatus ? String(roundsStatus.type ?? "info") : "info";

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [contributeProjectId, setContributeProjectId] = useState("");
  const [contributeAmount, setContributeAmount] = useState("2");
  const [contributionMemo, setContributionMemo] = useState("");
  const [contributePreview, setContributePreview] = useState(false);

  const hasRound = Boolean(selectedRound);
  const contributionAsset = normalizeFundingAsset(selectedRound?.assetSymbol ?? selectedRound?.asset);
  const contributionAssetIcon = contributionAsset.toLowerCase() as "gas" | "neo";
  const hasProjects = projects.length > 0;
  const normalizedProjectId = contributeProjectId.trim();
  const selectedProject = projects.find((p) => String(p.id) === normalizedProjectId);
  const selectedProjectLabel = selectedProject ? projectLabel(selectedProject, "-") : hasProjects ? t("qfPickProject") : "-";
  const canContribute = hasRound && Boolean(selectedProject) && isValidAmountForAsset(contributeAmount, contributionAsset);
  const canRegisterProject = hasRound && projectName.trim() !== "";
  const contributeAnimating = isContributing || contributePreview;
  const setupBlocked = !hasRound || !hasProjects;
  const setupTitle = !hasRound ? t("qfFundingNeedsRoundTitle") : !hasProjects ? t("qfFundingNeedsProjectsTitle") : t("qfDonationDeskReady");
  const setupBody = !hasRound ? t("qfFundingNeedsRoundBody") : !hasProjects ? t("qfFundingNeedsProjectsBody") : t("qfAmplifyCopy");
  const setupSteps = [
    { key: "round", label: t("tabRounds"), ready: hasRound },
    { key: "projects", label: t("tabProjects"), ready: hasRound && hasProjects },
    { key: "donate", label: t("quickContribute"), ready: canContribute },
  ];

  useEffect(() => {
    if (projects.length === 0) {
      if (contributeProjectId) setContributeProjectId("");
      return;
    }

    const stillAvailable = projects.some((project) => String(project.id) === normalizedProjectId);
    if (!stillAvailable && projects[0]?.id != null) {
      setContributeProjectId(String(projects[0].id));
    }
  }, [contributeProjectId, normalizedProjectId, projects]);

  useEffect(() => {
    setContributeAmount((value) => normalizeAmountForAsset(value, contributionAsset));
  }, [contributionAsset]);

  const submitContribute = async () => {
    if (!canContribute || isContributing || !selectedProject) return;
    setContributePreview(true);
    const ok = (await dispatch("contribute", {
      projectId: String(selectedProject.id),
      amount: normalizeAmountForAsset(contributeAmount, contributionAsset).trim(),
      memo: contributionMemo,
    })) as unknown as boolean;
    setContributePreview(false);
    if (ok) {
      setContributionMemo("");
    }
  };
  const submitRegisterProject = async () => {
    if (!canRegisterProject) return;
    const ok = (await dispatch("registerProject", { name: projectName, description: projectDescription, link: projectLink })) as unknown as boolean;
    if (ok) { setProjectName(""); setProjectDescription(""); setProjectLink(""); }
  };
  const selectRound = (round: Record<string, unknown>) => {
    state.selectedRoundId?.set(String(round.id ?? ""));
    void dispatch("selectRound", round);
  };

  const setupCard = (
    <figure className="qf-setup-card">
      <img src={FUNDING_DESK_IMAGE} alt="" aria-hidden="true" loading="eager" decoding="async" />
      <figcaption>
        <span>{t("qfFundingGateEyebrow")}</span>
        <strong>{setupTitle}</strong>
        <em>{setupBody}</em>
      </figcaption>
      {!hasRound && (
        <button type="button" className="qf-setup-card__action" onClick={() => void dispatch("refreshRounds")} disabled={isRefreshingRounds}>
          {isRefreshingRounds ? t("qfDonationDeskWaiting") : t("refresh")}
        </button>
      )}
      {statusMessage && (
        <div className="qf-setup-card__notice" data-type={statusType}>
          <span>{t("qfSetupStatus")}</span>
          <strong>{statusMessage}</strong>
        </div>
      )}
      <div className="qf-setup-card__lane" aria-label={t("qfSetupLaneLabel")}>
        {setupSteps.map((step) => (
          <span key={step.key} className={step.ready ? "qf-setup-card__step qf-setup-card__step--ready" : "qf-setup-card__step"}>
            <i aria-hidden="true" />
            {step.label}
          </span>
        ))}
      </div>
    </figure>
  );

  const scene = (
    <div className={["qf-scene", setupBlocked ? "qf-scene--setup" : null].filter(Boolean).join(" ")} data-state={contributeAnimating ? "contributing" : canContribute ? "ready" : "idle"}>
      {setupBlocked ? (
        setupCard
      ) : (
        <>
          <div className="qf-scene__desk">
            <section className="qf-scene__node qf-scene__node--donor" aria-label={t("qfDonationTicket")}>
              <span className="qf-scene__icon"><HandCoins size={22} /></span>
              <span>{t("qfDonationTicket")}</span>
              <strong>{contributeAmount || "-"} {contributionAsset}</strong>
            </section>

            <ArrowRight className="qf-scene__arrow qf-scene__arrow--left" size={24} aria-hidden="true" />

            <section className="qf-scene__pool" aria-label={t("qfGasPoolLabel")}>
              <span className="qf-scene__pool-ring" aria-hidden="true" />
              <Landmark size={28} />
              <span>{t("qfGasPoolLabel")}</span>
              <strong>{matchingPoolDisplay}</strong>
              {contributeAnimating && (
                <span className="qf-scene__flow" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </section>

            <ArrowRight className="qf-scene__arrow qf-scene__arrow--right" size={24} aria-hidden="true" />

            <section className="qf-scene__node qf-scene__node--project" aria-label={t("qfPickProject")}>
              <span className="qf-scene__icon"><Sprout size={22} /></span>
              <span>{t("qfPickProject")}</span>
              <strong>{selectedProjectLabel}</strong>
            </section>
          </div>

          <div className="qf-scene__amplifier">
            <HeartHandshake size={16} />
            <span>{contributeAnimating ? t("contributing") : t("qfAmplifyTitle")}</span>
          </div>

          {contributeAnimating && <ParticleBurst coins count={10} />}
          <p className="qf-scene__status" aria-live="polite">
            {contributeAnimating ? t("contributing") : t("qfDonationDeskReady")}
          </p>
        </>
      )}
    </div>
  );

  const controls = (
    <div className="qf-controls">
      {statusMessage && !setupBlocked && <p className="qf-controls__status" data-type={statusType}>{statusMessage}</p>}

      {rounds.length > 0 && (
        <div className="qf-round-strip" aria-label={t("tabRounds")}>
          {rounds.slice(0, 5).map((round) => (
            <button
              key={String(round.id)}
              type="button"
              className={["qf-round-chip", String(selectedRound?.id) === String(round.id) ? "qf-round-chip--active" : null].filter(Boolean).join(" ")}
              onClick={() => selectRound(round)}
              disabled={isRefreshingRounds}
            >
              <span>{String(round.title ?? round.id)}</span>
              <strong>{String(round.status ?? selectedRoundDisplay)}</strong>
            </button>
          ))}
        </div>
      )}

      {hasRound && hasProjects && (
        <>
          <div className="qf-project-board" aria-label={t("qfPickProject")}>
            {projects.slice(0, 6).map((project) => {
              const id = String(project.id);
              const active = contributeProjectId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={["qf-project-card", active ? "qf-project-card--active" : null].filter(Boolean).join(" ")}
                  onClick={() => setContributeProjectId(id)}
                  disabled={contributeAnimating}
                  aria-pressed={active}
                >
                  <span className="qf-project-card__image" aria-hidden="true">
                    <Sprout size={20} />
                  </span>
                  <span className="qf-project-card__copy">
                    <strong>{projectLabel(project, id)}</strong>
                    <em>{String(project.totalContributedDisplay ?? project.totalContributed ?? t("qfProjectMatchHint"))}</em>
                  </span>
                  <span className="qf-project-card__donors">
                    <Users size={13} />
                    {String(project.contributorCount ?? project.donors ?? "-")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="qf-pledge" aria-label={t("qfAmountPresets")}>
            <div className="qf-pledge__tiles">
              {AMOUNT_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={["qf-amount-tile", contributeAmount === amount ? "qf-amount-tile--active" : null].filter(Boolean).join(" ")}
                  onClick={() => setContributeAmount(normalizeAmountForAsset(amount, contributionAsset))}
                  disabled={contributeAnimating}
                >
                  <CoinArt size={18} variant={contributionAssetIcon} />
                  <span>{amount}</span>
                  <em>{contributionAsset}</em>
                </button>
              ))}
            </div>
            <div className="qf-pledge-stepper">
              <button type="button" onClick={() => setContributeAmount((v) => clampPledge(v, -1, contributionAsset))} disabled={contributeAnimating} aria-label={t("contributionAmount")}>-</button>
              <label className="qf-pledge-stepper__amount">
                <span className="qf-pledge-stepper__label">{t("contributionAmount")}</span>
                <input
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(normalizeAmountForAsset(e.target.value, contributionAsset))}
                  inputMode={contributionAsset === "NEO" ? "numeric" : "decimal"}
                  placeholder={t("contributionAmountPlaceholder")}
                  disabled={contributeAnimating}
                  aria-label={t("contributionAmount")}
                />
                <span className="qf-pledge-stepper__unit">{contributionAsset}</span>
              </label>
              <button type="button" onClick={() => setContributeAmount((v) => clampPledge(v, 1, contributionAsset))} disabled={contributeAnimating} aria-label={t("contributionAmount")}>+</button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="qf-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: t("qfHeroTitle"),
          title: hasRound ? t("qfDonorDeskTitle") : t("selectRoundFirst"),
          subtitle: t("qfHeroSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {selectedRoundDisplay}</span>
              <span className="mx2-badge">{matchingPoolDisplay}</span>
            </>
          ),
        }}
        scene={<>{scene}{controls}</>}
        score={[
          { label: t("qfGasPoolLabel"), value: matchingPoolDisplay, accent: true },
          { label: t("projectCount"), value: String(projectCount) },
          { label: t("tabRounds"), value: String(roundCount) },
        ]}
        actions={{
          primary: {
            label: !hasRound
              ? isRefreshingRounds ? t("qfDonationDeskWaiting") : t("refresh")
              : contributeAnimating ? t("contributing") : t("quickContribute"),
            onClick: () => {
              if (!hasRound) {
                void dispatch("refreshRounds");
                return;
              }
              void submitContribute();
            },
            disabled: !hasRound ? isRefreshingRounds : contributeAnimating || !canContribute,
            loading: !hasRound ? isRefreshingRounds : contributeAnimating,
          },
        }}
        drawerToggleLabel={t("tabProjects")}
        drawer={{
          title: t("tabProjects"),
          children: (
            <div className="qf-drawer-shell">
              <OpenUiPanel
                className="qf-drawer-panel qf-drawer-panel--donation"
                icon={<HandCoins size={16} />}
                title={t("qfDonationDetails")}
                subtitle={t("qfDonationDetailsHint")}
                titleId="qf-drawer-donation"
              >
                <div className="qf-drawer-grid qf-drawer-grid--donation">
                  <OpenUiTextField
                    className="qf-drawer-field"
                    label={t("qfPickProject")}
                    value={contributeProjectId}
                    onChange={(e) => setContributeProjectId(e.target.value)}
                    placeholder={t("contributionProjectId")}
                    disabled={contributeAnimating}
                  />
                  <OpenUiTextField
                    className="qf-drawer-field"
                    label={t("contributionMemo")}
                    value={contributionMemo}
                    onChange={(e) => setContributionMemo(e.target.value)}
                    placeholder={t("contributionMemoPlaceholder")}
                    disabled={contributeAnimating}
                  />
                </div>
              </OpenUiPanel>

              <OpenUiPanel
                className="qf-drawer-panel qf-drawer-panel--register"
                icon={<FilePlus2 size={16} />}
                title={t("registerProject")}
                subtitle={hasRound ? t("qfRegisterProjectHint") : t("qfFundingNeedsRoundTitle")}
                titleId="qf-drawer-register"
              >
                <div className="qf-project-form">
                  <OpenUiTextField
                    className="qf-drawer-field"
                    label={t("projectName")}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={t("projectNamePlaceholder")}
                    disabled={isRegisteringProject}
                  />
                  <OpenUiTextArea
                    className="qf-drawer-field qf-drawer-field--description mx2-open-field--compact"
                    label={t("projectDescription")}
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder={t("projectDescriptionPlaceholder")}
                    disabled={isRegisteringProject}
                    rows={2}
                  />
                  <OpenUiTextField
                    className="qf-drawer-field"
                    label={t("projectLink")}
                    value={projectLink}
                    onChange={(e) => setProjectLink(e.target.value)}
                    placeholder={t("projectLinkPlaceholder")}
                    disabled={isRegisteringProject}
                  />
                </div>
                <button type="button" className="qf-drawer-action" onClick={() => void submitRegisterProject()} disabled={!canRegisterProject || isRegisteringProject}>{isRegisteringProject ? t("registeringProject") : t("registerProject")}</button>
              </OpenUiPanel>

              <OpenUiPanel
                className="qf-drawer-panel qf-drawer-panel--ledger"
                icon={<ClipboardList size={16} />}
                title={t("projectsList")}
                subtitle={`${projects.length} ${t("projectCount").toLowerCase()}`}
                titleId="qf-drawer-projects"
              >
                {projects.length > 0 ? (
                  <ul className="qf-drawer-list">
                    {projects.slice(0, 8).map((p) => (
                      <li key={String(p.id)} className="qf-drawer-list__item">
                        <button
                          type="button"
                          className={["qf-project-list__select", contributeProjectId === String(p.id) ? "qf-project-list__select--active" : null].filter(Boolean).join(" ")}
                          onClick={() => setContributeProjectId(String(p.id))}
                          disabled={contributeAnimating}
                        >
                          <span className="qf-drawer-list__face">{String(p.name ?? p.id)}</span>
                          <span className="qf-drawer-list__stake">{String(p.totalContributedDisplay ?? p.totalContributed ?? "0")}</span>
                        </button>
                        {claimableProjectIds.includes(String(p.id)) && (
                          <button type="button" className="qf-drawer-action qf-drawer-action--small" onClick={() => void dispatch("claimProject", p)} disabled={claimingProjectId === String(p.id)}>{t("claimProject")}</button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="qf-drawer-empty">{t("emptyProjects")}</p>}
              </OpenUiPanel>

              {(suggestedMatches.length > 0 || canManageSelectedRound) && (
                <OpenUiPanel
                  className="qf-drawer-panel qf-drawer-panel--admin"
                  icon={<ShieldCheck size={16} />}
                  title={suggestedMatches.length > 0 ? t("finalizeSuggested") : t("adminTools")}
                  subtitle={canManageSelectedRound ? t("adminTools") : t("finalizeSuggested")}
                  titleId="qf-drawer-admin"
                >
                  {suggestedMatches.length > 0 && (
                    <>
                      <ul className="qf-drawer-list">
                        {suggestedMatches.slice(0, 6).map((m) => (
                          <li key={m.id} className="qf-drawer-list__item">
                            <span className="qf-drawer-list__face">{m.name}</span>
                            <span className="qf-drawer-list__stake">{m.contributedDisplay}</span>
                            <span className="qf-drawer-list__result">{m.matchDisplay}</span>
                          </li>
                        ))}
                      </ul>
                      {isAdmin && canFinalizeSelectedRound && (
                        <button type="button" className="qf-drawer-action" onClick={() => void dispatch("finalizeSuggested")}>{t("finalizeSuggested")}</button>
                      )}
                    </>
                  )}
                  {canManageSelectedRound && (
                    <div className="qf-admin-actions">
                      {canClaimUnused && <button type="button" className="qf-drawer-action" onClick={() => void dispatch("claimUnused")}>{t("claimUnused")}</button>}
                      {canCancelSelectedRound && <button type="button" className="qf-drawer-action qf-drawer-action--danger" onClick={() => void dispatch("cancelRound")}>{t("cancelRound")}</button>}
                    </div>
                  )}
                </OpenUiPanel>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}
