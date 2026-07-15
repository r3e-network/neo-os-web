/**
 * PlayArea.tsx -- Quadratic Funding (v2 scene-driven rebuild)
 *
 * The matching desk IS the product: donors pick a real project card, pledge a
 * GAS tile, and watch the contribution flow into the public-goods pool. Manual
 * IDs, memo, project registration, match review, and admin tools stay tucked in
 * the drawer. Chain logic is untouched.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FilePlus2,
  HandCoins,
  HeartHandshake,
  Landmark,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Users,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { CoinArt } from "@shared/art";
import { OpenUiPanel, OpenUiSegmented, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
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

function safeProjectUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function roundStatusLabel(t: PlayAreaProps["t"], status: unknown): string {
  const keyByStatus: Record<string, string> = {
    upcoming: "roundStatusUpcoming",
    active: "roundStatusActive",
    ended: "roundStatusEnded",
    finalized: "roundStatusFinalized",
    cancelled: "roundStatusCancelled",
  };
  const normalized = String(status ?? "").trim().toLowerCase();
  return keyByStatus[normalized] ? t(keyByStatus[normalized]!) : normalized || t("notAvailable");
}

function formatBaseUnits(value: unknown, asset: FundingAsset): string {
  let amount: bigint;
  try {
    amount = BigInt(String(value ?? "0"));
  } catch {
    return "-";
  }
  if (asset === "NEO") return amount.toString();
  const padded = amount.toString().padStart(9, "0");
  const whole = padded.slice(0, -8) || "0";
  const fraction = padded.slice(-8).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function TokenBurst({ asset }: { asset: FundingAsset }) {
  return (
    <div className="mx2-burst" aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => {
        const style = {
          "--mx2-burst-angle": `${(index / 10) * 360}deg`,
          "--mx2-burst-dist": `${50 + ((index * 37) % 30)}px`,
          animationDelay: `${(index % 4) * 40}ms`,
        } as CSSProperties;
        return (
          <CoinArt
            key={index}
            size={22}
            className="mx2-spark"
            variant={asset.toLowerCase() as "neo" | "gas"}
            decorative
            style={style}
          />
        );
      })}
    </div>
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);

  const rounds = val<Array<Record<string, unknown>>>("rounds") ?? [];
  const selectedRound = val<Record<string, unknown>>("selectedRound");
  const isRefreshingRounds = bool("isRefreshingRounds");
  const isContributing = bool("isContributing");
  const isRegisteringProject = bool("isRegisteringProject");
  const isCreatingRound = bool("isCreatingRound");
  const isAddingMatching = bool("isAddingMatching");
  const isFinalizing = bool("isFinalizing");
  const isClaimingUnused = bool("isClaimingUnused");
  const isCancelling = bool("isCancelling");
  const isAdmin = bool("isAdmin");
  const canManageSelectedRound = bool("canManageSelectedRound");
  const canFinalizeSelectedRound = bool("canFinalizeSelectedRound");
  const canClaimUnused = bool("canClaimUnused");
  const canCancelSelectedRound = bool("canCancelSelectedRound");
  const suggestedMatches = val<Array<{ id: string; name: string; contributedDisplay: string; donors: string; matchDisplay: string }>>("suggestedMatches") ?? [];
  const projectsValue = val<Array<Record<string, unknown>>>("projects");
  const projects = useMemo(() => projectsValue ?? [], [projectsValue]);
  const projectsComplete = bool("projectsComplete");
  const claimableProjectIds = val<string[]>("claimableProjectIds") ?? [];
  const claimingProjectId = str("claimingProjectId", "");
  const matchingPoolDisplay = str("matchingPoolDisplay", "-");
  const matchingRemainingDisplay = str("matchingRemainingDisplay", matchingPoolDisplay);
  const matchPreviewMode = str("matchPreviewMode", "estimate");
  const selectedRoundDisplay = str("selectedRoundDisplay", "-");
  const roundCount = num("roundCount", rounds.length);
  const projectCount = num("projectCount", projects.length);
  const roundsStatus = val<Record<string, unknown>>("roundsStatus");
  const statusMessage = roundsStatus ? String(roundsStatus.msg ?? roundsStatus.message ?? "") : "";
  const statusType = roundsStatus ? String(roundsStatus.type ?? "info") : "info";
  const fundingWritesEnabled = bool("fundingWritesEnabled");
  const isCheckingDeployment = bool("isCheckingDeployment");
  const deploymentStatus = str("deploymentStatus", "checking");
  const deploymentMessage = str("deploymentMessage", t("fundingSafetyChecking"));
  const address = str("address", "");
  const hasPendingOperation = bool("hasPendingOperation");
  const pendingTxid = str("pendingTxid", "");
  const pendingPhase = str("pendingPhase", "");
  const pendingTxidDisplay = pendingTxid.length > 18
    ? `${pendingTxid.slice(0, 10)}…${pendingTxid.slice(-6)}`
    : pendingTxid;
  const pendingMessage = pendingPhase === "deposit"
    ? t("pendingDepositRecovery", { txid: pendingTxidDisplay })
    : pendingPhase === "prepared"
      ? t("pendingIntentUncertain")
      : t("pendingStillWaiting", { txid: pendingTxidDisplay });
  const hasWriteInFlight = isContributing
    || isRegisteringProject
    || isCreatingRound
    || isAddingMatching
    || isFinalizing
    || isClaimingUnused
    || isCancelling
    || Boolean(claimingProjectId);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectLink, setProjectLink] = useState("");
  const [contributeProjectId, setContributeProjectId] = useState("");
  const [contributeAmount, setContributeAmount] = useState("2");
  const [contributionMemo, setContributionMemo] = useState("");
  const [contributePreview, setContributePreview] = useState(false);
  const [roundTitle, setRoundTitle] = useState("");
  const [roundDescription, setRoundDescription] = useState("");
  const [roundAsset, setRoundAsset] = useState<FundingAsset>("GAS");
  const [roundPool, setRoundPool] = useState("10");
  const [roundStart, setRoundStart] = useState("");
  const [roundEnd, setRoundEnd] = useState("");
  const [matchingTopUp, setMatchingTopUp] = useState("5");

  const hasRound = Boolean(selectedRound);
  const contributionAsset = normalizeFundingAsset(selectedRound?.assetSymbol ?? selectedRound?.asset);
  const contributionAssetIcon = contributionAsset.toLowerCase() as "gas" | "neo";
  const contributableProjects = useMemo(
    () => projects.filter((project) => project.active !== false && String(project.status ?? "active") !== "inactive"),
    [projects],
  );
  const hasFundingChoices = contributableProjects.length > 0;
  const normalizedProjectId = contributeProjectId.trim();
  const selectedProject = contributableProjects.find((p) => String(p.id) === normalizedProjectId);
  const selectedProjectLabel = selectedProject ? projectLabel(selectedProject, "-") : hasFundingChoices ? t("qfPickProject") : "-";
  const roundAcceptsContributions = !selectedRound?.status
    || String(selectedRound.status) === "active";
  const roundAcceptsProjects = !selectedRound?.status
    || ["upcoming", "active"].includes(String(selectedRound.status));
  const selfContribution = Boolean(selectedProject && address && (
    ownerMatchesAddress(selectedProject.owner, address)
    || ownerMatchesAddress(selectedRound?.creator, address)
  ));
  const canContribute = fundingWritesEnabled
    && !hasPendingOperation
    && hasRound
    && roundAcceptsContributions
    && Boolean(selectedProject)
    && !selfContribution
    && isValidAmountForAsset(contributeAmount, contributionAsset);
  const donationPrepared = hasRound
    && roundAcceptsContributions
    && Boolean(selectedProject)
    && !selfContribution
    && isValidAmountForAsset(contributeAmount, contributionAsset);
  const canRegisterProject = fundingWritesEnabled
    && hasRound
    && roundAcceptsProjects
    && !hasPendingOperation
    && projectName.trim() !== "";
  const contributeAnimating = isContributing || contributePreview;
  const canCreateRound = fundingWritesEnabled
    && !hasPendingOperation
    && roundTitle.trim() !== ""
    && isValidAmountForAsset(roundPool, roundAsset)
    && Boolean(roundStart)
    && Boolean(roundEnd)
    && new Date(roundStart).getTime() < new Date(roundEnd).getTime();
  const setupBlocked = !hasRound || !hasFundingChoices;
  const setupTitle = !hasRound ? t("qfFundingNeedsRoundTitle") : !hasFundingChoices ? t("qfFundingNeedsProjectsTitle") : t("qfDonationDeskReady");
  const setupBody = !hasRound ? t("qfFundingNeedsRoundBody") : !hasFundingChoices ? t("qfFundingNeedsProjectsBody") : t("qfAmplifyCopy");
  const setupSteps = [
    { key: "round", label: t("tabRounds"), ready: hasRound },
    { key: "projects", label: t("tabProjects"), ready: hasRound && hasFundingChoices },
    { key: "donate", label: t("quickContribute"), ready: donationPrepared },
  ];
  // "awaiting-context" is the pre-connect state, not a fault: no contract has
  // been resolved, so nothing failed to verify. It gets plain browsing copy
  // rather than the "live funding status is unavailable" line, which described
  // a read that never happened.
  const compactAvailabilityMessage = fundingWritesEnabled
    ? t("fundingReadyShort")
    : isCheckingDeployment
      ? t("fundingCheckingShort")
      : deploymentStatus === "awaiting-context"
        ? t("fundingAwaitingContextShort")
        : deploymentStatus === "paused"
          ? t("fundingPausedShort")
          : deploymentStatus === "unavailable"
            ? t("fundingUnavailableShort")
            : t("fundingBrowseShort");

  useEffect(() => {
    if (contributableProjects.length === 0) {
      if (contributeProjectId) setContributeProjectId("");
      return;
    }

    const stillAvailable = contributableProjects.some((project) => String(project.id) === normalizedProjectId);
    if (!stillAvailable && contributableProjects[0]?.id != null) {
      setContributeProjectId(String(contributableProjects[0].id));
    }
  }, [contributableProjects, contributeProjectId, normalizedProjectId]);

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
  const submitCreateRound = async () => {
    if (!canCreateRound || isCreatingRound) return;
    const ok = (await dispatch("createRound", {
      title: roundTitle,
      description: roundDescription,
      asset: roundAsset,
      matchingPool: normalizeAmountForAsset(roundPool, roundAsset),
      startTime: roundStart.replace("T", " "),
      endTime: roundEnd.replace("T", " "),
    })) as unknown as boolean;
    if (ok) {
      setRoundTitle("");
      setRoundDescription("");
      setRoundStart("");
      setRoundEnd("");
    }
  };
  const selectRound = (round: Record<string, unknown>) => {
    state.selectedRoundId?.set(String(round.id ?? ""));
    void dispatch("selectRound", round);
  };

  const setupCard = (
    <figure className="qf-setup-card">
      <img src={FUNDING_DESK_IMAGE} alt="" aria-hidden="true" loading="eager" decoding="async" />
      <figcaption>
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
      <div className="qf-setup-card__safety" data-status={deploymentStatus}>
        {fundingWritesEnabled ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
        <span>{compactAvailabilityMessage}</span>
      </div>
      {hasPendingOperation && (
        <div className="qf-pending-note" role="status">
          <ShieldAlert size={15} />
          <span>{pendingMessage}</span>
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
          <div className="qf-scene__artboard">
            <img
              className="qf-scene__art"
              src={FUNDING_DESK_IMAGE}
              alt={t("qfFundingDeskAlt")}
              loading="eager"
              decoding="async"
            />
            <div className="qf-scene__round-snapshot">
              <span>{t("qfSelectedRound")}</span>
              <strong>{selectedRoundDisplay}</strong>
              <em>{matchingPoolDisplay}</em>
            </div>
          </div>

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
              <strong>{matchingRemainingDisplay}</strong>
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

          <div className="qf-integrity-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{t("qfSybilDisclosure")}</span>
          </div>

          <div className="qf-deployment-note" data-status={deploymentStatus} role="status">
            {fundingWritesEnabled ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
            <span>{compactAvailabilityMessage}</span>
          </div>

          {hasPendingOperation && (
            <div className="qf-pending-note" role="status">
              <ShieldAlert size={16} />
              <span>{pendingMessage}</span>
            </div>
          )}

          {contributeAnimating && <TokenBurst asset={contributionAsset} />}
          <p className="qf-scene__status" aria-live="polite">
            {contributeAnimating
              ? t("contributing")
              : selfContribution
                ? t("selfContributionBlocked")
                : t("qfDonationDeskReady")}
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
          {rounds.map((round) => (
            <button
              key={String(round.id)}
              type="button"
              className={["qf-round-chip", String(selectedRound?.id) === String(round.id) ? "qf-round-chip--active" : null].filter(Boolean).join(" ")}
              onClick={() => selectRound(round)}
              disabled={isRefreshingRounds}
            >
              <span>{String(round.title ?? round.id)}</span>
              <strong>{roundStatusLabel(t, round.status)}</strong>
            </button>
          ))}
        </div>
      )}

      {hasRound && hasFundingChoices && (
        <>
          <div className="qf-project-board" aria-label={t("qfPickProject")}>
            {projects.slice(0, 6).map((project) => {
              const id = String(project.id);
              const active = contributeProjectId === id;
              const projectAcceptsContributions = project.active !== false
                && String(project.status ?? "active") !== "inactive";
              return (
                <button
                  key={id}
                  type="button"
                  className={["qf-project-card", active ? "qf-project-card--active" : null].filter(Boolean).join(" ")}
                  onClick={() => setContributeProjectId(id)}
                  disabled={contributeAnimating || !projectAcceptsContributions}
                  aria-pressed={active}
                >
                  <span className="qf-project-card__image" aria-hidden="true">
                    <Sprout size={20} />
                  </span>
                  <span className="qf-project-card__copy">
                    <strong>{projectLabel(project, id)}</strong>
                    <span className="qf-project-card__summary">
                      {String(project.description ?? "").trim() || t("qfNoProjectDescription")}
                    </span>
                    <em>{formatBaseUnits(project.totalContributed, contributionAsset)} {contributionAsset}</em>
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
              <button type="button" onClick={() => setContributeAmount((v) => clampPledge(v, -1, contributionAsset))} disabled={contributeAnimating} aria-label={t("qfDecreaseAmount")}>-</button>
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
              <button type="button" onClick={() => setContributeAmount((v) => clampPledge(v, 1, contributionAsset))} disabled={contributeAnimating} aria-label={t("qfIncreaseAmount")}>+</button>
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
          { label: t("qfMatchingAvailable"), value: matchingRemainingDisplay, accent: true },
          { label: t("projectCount"), value: String(projectCount) },
          { label: t("tabRounds"), value: String(roundCount) },
        ]}
        actions={{
          primary: {
            label: !hasRound
              ? isRefreshingRounds ? t("qfDonationDeskWaiting") : t("refresh")
              : hasPendingOperation
                ? t("pendingReviewTitle")
              : !fundingWritesEnabled
                ? isRefreshingRounds || isCheckingDeployment ? t("qfRefreshingFundingData") : t("qfRefreshFundingData")
                : contributeAnimating ? t("contributing") : t("quickContribute"),
            onClick: () => {
              if (!hasRound || !fundingWritesEnabled) {
                void dispatch("refreshRounds");
                return;
              }
              void submitContribute();
            },
            disabled: !hasRound
              ? isRefreshingRounds
              : !fundingWritesEnabled
                ? isRefreshingRounds || isCheckingDeployment
                : contributeAnimating || !canContribute || hasPendingOperation,
            loading: !hasRound || !fundingWritesEnabled
              ? isRefreshingRounds || isCheckingDeployment
              : contributeAnimating,
          },
        }}
        drawerToggleLabel={t("qfExploreAndManage")}
        drawer={{
          title: t("tabProjects"),
          children: (
            <div className="qf-drawer-shell">
              {hasPendingOperation && (
                <OpenUiPanel
                  className="qf-drawer-panel qf-drawer-panel--pending"
                  icon={<ShieldAlert size={16} />}
                  title={t("pendingReviewTitle")}
                  subtitle={t("pendingClearHint")}
                  titleId="qf-drawer-pending"
                >
                  <div className="qf-pending-review">
                    <code title={pendingTxid}>{pendingTxidDisplay || t("notAvailable")}</code>
                    <div className="qf-pending-review__actions">
                      <button type="button" className="qf-drawer-action" onClick={() => void dispatch("refreshRounds")} disabled={isRefreshingRounds}>
                        {isRefreshingRounds ? t("qfDonationDeskWaiting") : t("pendingRefreshAction")}
                      </button>
                      <button
                        type="button"
                        className="qf-drawer-action qf-drawer-action--danger"
                        onClick={() => void dispatch("clearPending")}
                        disabled={hasWriteInFlight || pendingPhase === "deposit"}
                      >
                        {pendingPhase === "deposit" ? t("pendingRecoveryRequiredAction") : t("pendingClearAction")}
                      </button>
                    </div>
                  </div>
                </OpenUiPanel>
              )}

              {!fundingWritesEnabled && (
                <OpenUiPanel
                  className="qf-drawer-panel qf-drawer-panel--availability"
                  icon={<ShieldAlert size={16} />}
                  title={t("qfBrowseModeTitle")}
                  subtitle={deploymentMessage}
                  titleId="qf-drawer-availability"
                >
                  <div className="qf-availability-panel">
                    <p>{t("qfBrowseModeBody")}</p>
                    <button
                      type="button"
                      className="qf-drawer-action"
                      onClick={() => void dispatch("refreshRounds")}
                      disabled={isRefreshingRounds || isCheckingDeployment}
                    >
                      {isRefreshingRounds || isCheckingDeployment ? t("qfRefreshingFundingData") : t("qfRefreshFundingData")}
                    </button>
                  </div>
                </OpenUiPanel>
              )}

              {fundingWritesEnabled && <OpenUiPanel
                className="qf-drawer-panel qf-drawer-panel--round-builder"
                icon={<CalendarDays size={16} />}
                title={t("qfRoundBlueprint")}
                subtitle={t("qfCreateDeskIntro")}
                titleId="qf-drawer-round-builder"
              >
                <div className="qf-round-builder">
                  <OpenUiTextField
                    className="qf-drawer-field qf-round-builder__title"
                    label={t("roundTitle")}
                    value={roundTitle}
                    maxLength={60}
                    onChange={(event) => setRoundTitle(event.target.value)}
                    placeholder={t("roundTitlePlaceholder")}
                    disabled={isCreatingRound}
                  />
                  <OpenUiSegmented
                    className="qf-round-builder__asset"
                    label={t("assetSelect")}
                    value={roundAsset}
                    onChange={(value) => {
                      const asset = normalizeFundingAsset(value);
                      setRoundAsset(asset);
                      setRoundPool((current) => normalizeAmountForAsset(current, asset));
                    }}
                    options={[
                      { value: "GAS", label: t("assetGas") },
                      { value: "NEO", label: t("assetNeo") },
                    ]}
                    disabled={isCreatingRound}
                  />
                  <OpenUiTextField
                    className="qf-drawer-field qf-round-builder__pool"
                    label={t("matchingPool")}
                    value={roundPool}
                    inputMode={roundAsset === "NEO" ? "numeric" : "decimal"}
                    onChange={(event) => setRoundPool(normalizeAmountForAsset(event.target.value, roundAsset))}
                    placeholder={t("matchingPoolPlaceholder")}
                    disabled={isCreatingRound}
                  />
                  <OpenUiTextField
                    className="qf-drawer-field qf-round-builder__start"
                    label={t("roundStart")}
                    type="datetime-local"
                    value={roundStart}
                    onChange={(event) => setRoundStart(event.target.value)}
                    disabled={isCreatingRound}
                  />
                  <OpenUiTextField
                    className="qf-drawer-field qf-round-builder__end"
                    label={t("roundEnd")}
                    type="datetime-local"
                    value={roundEnd}
                    onChange={(event) => setRoundEnd(event.target.value)}
                    disabled={isCreatingRound}
                  />
                  <OpenUiTextArea
                    className="qf-drawer-field qf-round-builder__description mx2-open-field--compact"
                    label={t("roundDescription")}
                    value={roundDescription}
                    maxLength={240}
                    onChange={(event) => setRoundDescription(event.target.value)}
                    placeholder={t("roundDescriptionPlaceholder")}
                    disabled={isCreatingRound}
                    rows={2}
                  />
                </div>
                <div className="qf-round-builder__footer">
                  <span>{fundingWritesEnabled ? t("fundingSafetyReady") : deploymentMessage}</span>
                  <button
                    type="button"
                    className="qf-drawer-action"
                    onClick={() => void submitCreateRound()}
                    disabled={!canCreateRound || isCreatingRound}
                  >
                    {isCreatingRound ? t("creatingRound") : t("createRound")}
                  </button>
                </div>
              </OpenUiPanel>}

              {fundingWritesEnabled && <OpenUiPanel
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
              </OpenUiPanel>}

              {fundingWritesEnabled && <OpenUiPanel
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
                    maxLength={200}
                    type="url"
                    onChange={(e) => setProjectLink(e.target.value)}
                    placeholder={t("projectLinkPlaceholder")}
                    disabled={isRegisteringProject}
                  />
                </div>
                <button type="button" className="qf-drawer-action" onClick={() => void submitRegisterProject()} disabled={!canRegisterProject || isRegisteringProject}>{isRegisteringProject ? t("registeringProject") : t("registerProject")}</button>
              </OpenUiPanel>}

              <OpenUiPanel
                className="qf-drawer-panel qf-drawer-panel--ledger"
                icon={<ClipboardList size={16} />}
                title={t("projectsList")}
                subtitle={`${projects.length} ${t("projectCount").toLowerCase()}`}
                titleId="qf-drawer-projects"
              >
                {projects.length > 0 ? (
                  <ul className="qf-drawer-list">
                    {projects.map((p) => (
                      <li key={String(p.id)} className="qf-drawer-list__item">
                        <button
                          type="button"
                          className={["qf-project-list__select", contributeProjectId === String(p.id) ? "qf-project-list__select--active" : null].filter(Boolean).join(" ")}
                          onClick={() => setContributeProjectId(String(p.id))}
                          disabled={contributeAnimating}
                        >
                          <span className="qf-drawer-list__face">{String(p.name ?? p.id)}</span>
                          <span className="qf-drawer-list__stake">{formatBaseUnits(p.totalContributed, contributionAsset)} {contributionAsset}</span>
                        </button>
                        {safeProjectUrl(p.link) ? (
                          <a
                            className="qf-project-list__link"
                            href={safeProjectUrl(p.link)!}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t("qfVisitProject", { name: String(p.name ?? p.id) })}
                            title={t("qfVisitProject", { name: String(p.name ?? p.id) })}
                          >
                            <ExternalLink size={15} />
                          </a>
                        ) : <span className="qf-project-list__link-spacer" aria-hidden="true" />}
                        {claimableProjectIds.includes(String(p.id)) && (
                          <button type="button" className="qf-drawer-action qf-drawer-action--small" onClick={() => void dispatch("claimProject", p)} disabled={!fundingWritesEnabled || hasPendingOperation || claimingProjectId === String(p.id)}>{t("claimProject")}</button>
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
                  title={suggestedMatches.length > 0
                    ? t(matchPreviewMode === "finalized" ? "qfFinalAllocationsTitle" : "qfMatchPreviewTitle")
                    : t("adminTools")}
                  subtitle={suggestedMatches.length > 0
                    ? t(matchPreviewMode === "finalized" ? "qfFinalAllocationsHint" : "qfMatchPreviewHint")
                    : t("adminTools")}
                  titleId="qf-drawer-admin"
                >
                  {suggestedMatches.length > 0 && (
                    <>
                      <p className="qf-match-caveat">
                        {t(matchPreviewMode === "finalized" ? "matchFinalizedCaveat" : "matchApproxCaveat")}
                      </p>
                      <ul className="qf-drawer-list">
                        {suggestedMatches.map((m) => (
                          <li key={m.id} className="qf-drawer-list__item">
                            <span className="qf-drawer-list__face">{m.name}</span>
                            <span className="qf-drawer-list__stake">{m.contributedDisplay}</span>
                            <span className="qf-drawer-list__result">{m.matchDisplay}</span>
                          </li>
                        ))}
                      </ul>
                      {isAdmin && canFinalizeSelectedRound && (
                        <button type="button" className="qf-drawer-action" onClick={() => void dispatch("finalizeSuggested")} disabled={!fundingWritesEnabled || !projectsComplete || hasPendingOperation}>{t("finalizeSuggested")}</button>
                      )}
                    </>
                  )}
                  {canManageSelectedRound && (
                    <div className="qf-admin-actions">
                      {!selectedRound?.finalized && !selectedRound?.cancelled && (
                        <div className="qf-matching-topup">
                          <OpenUiTextField
                            className="qf-drawer-field"
                            label={t("addMatching")}
                            value={matchingTopUp}
                            inputMode={contributionAsset === "NEO" ? "numeric" : "decimal"}
                            onChange={(event) => setMatchingTopUp(normalizeAmountForAsset(event.target.value, contributionAsset))}
                            disabled={isAddingMatching}
                          />
                          <button
                            type="button"
                            className="qf-drawer-action qf-drawer-action--small"
                            onClick={() => void dispatch("addMatching", matchingTopUp)}
                            disabled={!fundingWritesEnabled || hasPendingOperation || isAddingMatching || !isValidAmountForAsset(matchingTopUp, contributionAsset)}
                          >
                            <PlusCircle size={14} />
                            {isAddingMatching ? t("addingMatching") : t("addMatching")}
                          </button>
                        </div>
                      )}
                      {canClaimUnused && <button type="button" className="qf-drawer-action" onClick={() => void dispatch("claimUnused")} disabled={!fundingWritesEnabled || hasPendingOperation}>{t("claimUnused")}</button>}
                      {canCancelSelectedRound && <button type="button" className="qf-drawer-action qf-drawer-action--danger" onClick={() => void dispatch("cancelRound")} disabled={!fundingWritesEnabled || hasPendingOperation}>{t("cancelRound")}</button>}
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
