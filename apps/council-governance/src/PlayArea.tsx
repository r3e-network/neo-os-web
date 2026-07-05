/**
 * PlayArea.tsx -- Council Governance proposal cockpit
 *
 * The proposal is the primary surface: inspect quorum, choose for/against, and
 * send one wallet-backed vote. Drafting on the stage is a compact council
 * motion card; proposal type/policy controls stay in the drawer so the first
 * screen does not read like a questionnaire.
 */
import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  PlayCircle,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  UsersRound,
  Vote,
  XCircle,
} from "lucide-react";
import {
  OpenUiNotice,
  OpenUiPanel,
  OpenUiProvider,
  OpenUiSegmented,
  OpenUiTextArea,
  OpenUiTextField,
  PlayStage,
} from "@shared/components-react/v2";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type { Proposal, VoteChoice } from "./composables/useGovernance";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DraftType = "text" | "policy";
type FloorMode = "review" | "draft";
type DrawerMode = "draft" | "active" | "history";

const DURATION_OPTIONS = [
  { labelKey: "duration3Days", days: 3 },
  { labelKey: "duration7Days", days: 7 },
  { labelKey: "duration14Days", days: 14 },
];

const POLICY_METHODS = [
  { key: "setFeePerByte", labelKey: "methodFeePerByte" },
  { key: "setExecFeeFactor", labelKey: "methodExecFeeFactor" },
  { key: "setStoragePrice", labelKey: "methodStoragePrice" },
  { key: "setMaxBlockSize", labelKey: "methodMaxBlockSize" },
  { key: "setMaxTransactionsPerBlock", labelKey: "methodMaxTransactions" },
  { key: "setMaxSystemFee", labelKey: "methodMaxSystemFee" },
];

const DEFAULT_POLICY_METHOD = "setFeePerByte";
const EMPTY_PROPOSALS: Proposal[] = [];
const COUNCIL_CHAMBER_IMAGE = "./council-chamber.webp";

function formatTime(value: number | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  } catch {
    return fallback;
  }
}

function statusKey(proposal: Proposal | null): string {
  return proposal?.statusKey ?? "active";
}

function statusLabel(t: PlayAreaProps["t"], proposal: Proposal | null): string {
  return t(statusKey(proposal));
}

function passNeed(proposal: Proposal | null): { needed: number; total: number } {
  const total = Math.max(Number(proposal?.quorumRequired || 0), 21);
  return { needed: Math.floor(total / 2) + 1, total };
}

function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);
  const activeProposals = val<Proposal[]>("activeProposals", EMPTY_PROPOSALS) ?? EMPTY_PROPOSALS;
  const historyProposals = val<Proposal[]>("historyProposals", EMPTY_PROPOSALS) ?? EMPTY_PROPOSALS;
  const selectedProposal = val<Proposal | null>("selectedProposal", null);
  const activeCount = num("activeCount");
  const historyCount = num("historyCount");
  const isVoting = bool("isVoting");
  const isCreating = bool("isCreating");
  const isLoading = bool("isLoading");
  const isCandidate = bool("isCandidate");
  const candidateLoaded = bool("candidateLoaded");
  const votingPower = str("votingPower", "0");
  const address = str("address", "");
  const hasVotedMap = val<Record<number, boolean>>("hasVotedMap", {}) ?? {};

  const [voteChoice, setVoteChoice] = useState<VoteChoice>("for");
  const [draftType, setDraftType] = useState<DraftType>("text");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftDurationDays, setDraftDurationDays] = useState(7);
  const [policyMethod, setPolicyMethod] = useState(DEFAULT_POLICY_METHOD);
  const [policyValue, setPolicyValue] = useState("");

  const proposal = selectedProposal ?? activeProposals[0] ?? historyProposals[0] ?? null;
  const [floorMode, setFloorMode] = useState<FloorMode>(proposal ? "review" : "draft");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(proposal ? "active" : "draft");
  const stageMode: FloorMode = proposal ? floorMode : "draft";
  const proposalActive = proposal?.statusKey === "active";
  const proposalExternal = proposal?.source === "neo-community";
  const alreadyVoted = proposal ? Boolean(hasVotedMap[proposal.id]) : false;
  const canVote = Boolean(proposal && proposalActive && !proposalExternal && !alreadyVoted && !isVoting);
  const draftReady =
    draftTitle.trim().length > 0 &&
    draftDescription.trim().length > 0 &&
    (draftType === "text" || (policyMethod.trim().length > 0 && policyValue.trim().length > 0));
  const policyMethodLabel = t(POLICY_METHODS.find((method) => method.key === policyMethod)?.labelKey ?? "policyMethod");
  const draftDurationLabel = t(DURATION_OPTIONS.find((option) => option.days === draftDurationDays)?.labelKey ?? "duration7Days");
  const draftTitlePreview = draftTitle.trim() || t("proposalDraftEmpty");
  const draftDescriptionPreview = draftDescription.trim() || t("proposalDescPlaceholder");
  const draftScopePreview = draftType === "policy"
    ? policyValue.trim()
      ? `${policyMethodLabel} · ${policyValue.trim()}`
      : t("needsPolicyDetails")
    : t("textProposalScope");
  const passLine = passNeed(proposal);
  const yesVotes = Number(proposal?.yesVotes ?? 0);
  const noVotes = Number(proposal?.noVotes ?? 0);
  const totalVotes = Math.max(Number(proposal?.totalVotes ?? yesVotes + noVotes), yesVotes + noVotes, 1);
  const yesPercent = percent(yesVotes, totalVotes);
  const noPercent = percent(noVotes, totalVotes);
  const passPercent = percent(passLine.needed, passLine.total);
  const expiry = formatTime(proposal?.expiryTime, t("votingEnds"));
  const voteReadiness = !address
    ? t("connectWallet")
    : candidateLoaded && !isCandidate
      ? t("notCandidate")
      : proposalExternal
        ? t("externalProposalReadOnly")
        : alreadyVoted
          ? t("alreadyVoted")
          : proposalActive
            ? t("castYourVote")
            : t("proposalNotActive");

  const handleVote = () => {
    if (!proposal || isVoting) return;
    void dispatch("vote", {
      proposalId: proposal.id,
      vote: voteChoice,
    });
  };

  const handleCreate = () => {
    if (!draftReady || isCreating) return;
    void dispatch("createProposal", {
      type: draftType === "policy" ? 1 : 0,
      title: draftTitle,
      description: draftDescription,
      policyMethod: draftType === "policy" ? policyMethod : undefined,
      policyValue: draftType === "policy" ? policyValue : undefined,
      duration: draftDurationDays * 24 * 60 * 60 * 1000,
    });
  };

  const sceneTitle = proposal?.title || t("noActiveProposals");
  const proposalRows = useMemo(
    () => activeProposals.slice(0, 5),
    [activeProposals],
  );
  const switchFloorMode = (mode: FloorMode) => {
    setFloorMode(mode);
    setDrawerMode(mode === "draft" ? "draft" : "active");
  };

  const draftComposer = (surface: "stage" | "drawer") => (
    <section
      className={`council-draft council-draft--${surface}`}
      data-ready={draftReady ? "true" : "false"}
    >
      {surface === "stage" && (
        <header className="council-draft__masthead">
          <div>
            <span>{t("proposalDossier")}</span>
            <strong>{draftReady ? t("readyToSubmit") : t("needsBrief")}</strong>
          </div>
          <em>{draftType === "policy" ? t("policyType") : t("textType")}</em>
        </header>
      )}
      {surface === "drawer" && (
        <div className="council-draft-type" role="radiogroup" aria-label={t("motionType")}>
          <button
            type="button"
            className={draftType === "text" ? "is-active" : undefined}
            onClick={() => setDraftType("text")}
            aria-pressed={draftType === "text"}
          >
            <FileText size={16} />
            <span>{t("textType")}</span>
            <em>{t("textProposalScope")}</em>
          </button>
          <button
            type="button"
            className={draftType === "policy" ? "is-active" : undefined}
            onClick={() => setDraftType("policy")}
            aria-pressed={draftType === "policy"}
          >
            <ShieldCheck size={16} />
            <span>{t("policyType")}</span>
            <em>{t("policyProposalScope")}</em>
          </button>
        </div>
      )}
      {surface === "stage" ? (
        <div className="council-motion-paper council-motion-paper--stage">
          <div className="council-motion-paper__title">
            <span>{t("proposalTitle")}</span>
            <strong>{draftTitlePreview}</strong>
          </div>
          <div className="council-motion-paper__brief">
            <span>{t("proposalBrief")}</span>
            <p>{draftDescriptionPreview}</p>
          </div>
          <div className="council-motion-paper__summary-grid" aria-label={t("proposalDossier")}>
            <span className="council-motion-paper__summary-card">
              <FileText size={15} />
              <em>{t("proposalType")}</em>
              <strong>{draftType === "policy" ? t("policyType") : t("textType")}</strong>
            </span>
            <span className="council-motion-paper__summary-card">
              <Clock3 size={15} />
              <em>{t("reviewWindow")}</em>
              <strong>{draftDurationLabel}</strong>
            </span>
            <span className="council-motion-paper__summary-card">
              <ShieldCheck size={15} />
              <em>{draftType === "policy" ? t("policyDetails") : t("proposalBrief")}</em>
              <strong>{draftScopePreview}</strong>
            </span>
          </div>
          <footer className="council-motion-paper__seal">
            <span>{t("proposalDossierHelp")}</span>
            <strong>{draftReady ? t("readyToSubmit") : t("needsBrief")}</strong>
          </footer>
        </div>
      ) : (
        <div className="council-drawer-fields">
          <OpenUiTextField
            className="council-drawer__field"
            label={t("proposalTitle")}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={t("proposalTitlePlaceholder")}
          />
          <OpenUiTextArea
            className="council-drawer__field council-drawer__field--brief mx2-open-field--compact"
            label={t("proposalDescription")}
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            placeholder={t("proposalDescPlaceholder")}
            rows={3}
          />
        </div>
      )}
      {surface === "drawer" && draftType === "policy" && (
        <div className="council-policy-fields" aria-label={t("policyDetails")}>
          <OpenUiSegmented
            className="council-drawer__field council-policy-methods"
            label={t("policyMethod")}
            value={policyMethod}
            onChange={(value) => setPolicyMethod(value)}
            options={POLICY_METHODS.map((method) => ({ value: method.key, label: t(method.labelKey) }))}
          />
          <OpenUiTextField
            className="council-drawer__field council-policy-value"
            label={t("policyValue")}
            value={policyValue}
            onChange={(event) => setPolicyValue(event.target.value)}
            placeholder={t("policyValuePlaceholder")}
            inputMode="numeric"
          />
        </div>
      )}
      {surface === "drawer" && (
        <div className="council-window-rail">
          <div>
            <span>{t("reviewWindow")}</span>
            <strong>{t("reviewWindowHelp")}</strong>
          </div>
          <div className="council-duration-grid">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                className={draftDurationDays === option.days ? "is-active" : undefined}
                onClick={() => setDraftDurationDays(option.days)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
      {surface === "drawer" && (
        <button
          type="button"
          className="council-submit-draft"
          onClick={handleCreate}
          disabled={!draftReady || isCreating}
        >
          <Send size={15} />
          {isCreating ? t("submittingProposal") : t("submitProposal")}
        </button>
      )}
    </section>
  );

  const scene = (
    <div
      className="council-scene"
      data-state={isVoting ? "voting" : proposal ? "proposal" : "empty"}
      data-choice={voteChoice}
      aria-label={t("floorStageLabel")}
    >
      <figure className="council-chamber-visual">
        <img
          src={COUNCIL_CHAMBER_IMAGE}
          alt={t("heroImageAlt")}
          loading="eager"
          decoding="async"
          draggable={false}
        />
      </figure>

      <div className="council-quorum">
        <div
          className="council-quorum__ring"
          style={{
            "--yes": `${yesPercent}%`,
            "--no": `${noPercent}%`,
            "--pass": `${passPercent}%`,
          } as CSSProperties}
        >
          <span className="council-quorum__seat council-quorum__seat--one" />
          <span className="council-quorum__seat council-quorum__seat--two" />
          <span className="council-quorum__seat council-quorum__seat--three" />
          <span className="council-quorum__seat council-quorum__seat--four" />
          <span className="council-quorum__core"><Landmark size={30} /></span>
        </div>
        <div className="council-quorum__caption">
          <span>{t("quorum")}</span>
          <strong>{yesVotes} {t("for")} / {noVotes} {t("against")}</strong>
        </div>
      </div>

      <article className="council-proposal-card">
        <div className="council-proposal-card__head">
          <span className="council-proposal-card__icon"><ScrollText size={22} /></span>
          <div>
            <span>{proposal ? `#${proposal.id}` : t("proposalDossier")}</span>
            <strong>{sceneTitle}</strong>
          </div>
        </div>
        <p>{proposal?.description || t("emptyProposalHelp")}</p>
        <div className="council-proposal-card__meta">
          <span><Clock3 size={14} /> {expiry}</span>
          <span><UsersRound size={14} /> {t("passThreshold", { needed: passLine.needed, total: passLine.total })}</span>
          <span><ShieldCheck size={14} /> {statusLabel(t, proposal)}</span>
        </div>
      </article>
    </div>
  );

  const floorTabs = (
    <div className="council-floor-tabs" role="tablist" aria-label={t("proposalTabs")}>
      <button
        type="button"
        role="tab"
        aria-selected={stageMode === "review"}
        className={stageMode === "review" ? "is-active" : undefined}
        onClick={() => switchFloorMode("review")}
        disabled={!proposal}
      >
        <Vote size={16} />
        <span>{t("reviewFloor")}</span>
        <em>{proposal ? statusLabel(t, proposal) : t("noActiveProposals")}</em>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={stageMode === "draft"}
        className={stageMode === "draft" ? "is-active" : undefined}
        onClick={() => switchFloorMode("draft")}
      >
        <Send size={16} />
        <span>{t("draftFloor")}</span>
        <em>{draftReady ? t("readyToSubmit") : t("needsBrief")}</em>
      </button>
    </div>
  );

  const voteControls = proposal ? (
    <div className="council-ticket council-ticket--vote">
      <section className="council-ticket__decision">
        <div className="council-ticket__label">
          <span>{t("castYourVote")}</span>
          <strong>{votingPower} {t("tokenNeo")}</strong>
        </div>
        <div className="council-choice" role="radiogroup" aria-label={t("castYourVote")}>
          <button
            type="button"
            className={voteChoice === "for" ? "is-active" : undefined}
            onClick={() => setVoteChoice("for")}
            disabled={isVoting}
            aria-pressed={voteChoice === "for"}
          >
            <CheckCircle2 size={18} />
            {t("voteFor")}
          </button>
          <button
            type="button"
            className={voteChoice === "against" ? "is-active" : undefined}
            onClick={() => setVoteChoice("against")}
            disabled={isVoting}
            aria-pressed={voteChoice === "against"}
          >
            <XCircle size={18} />
            {t("voteAgainst")}
          </button>
        </div>
      </section>

      <section className="council-ticket__proposal">
        <div className="council-ticket__label">
          <span>{t("activeProposals")}</span>
          <strong>{activeCount}</strong>
        </div>
        {proposalRows.length > 0 ? (
          <div className="council-proposal-list">
            {proposalRows.map((item) => (
              <button
                key={item.id}
                type="button"
                className={proposal?.id === item.id ? "is-active" : undefined}
                onClick={() => void dispatch("selectProposal", item)}
                disabled={isVoting}
              >
                <span>#{item.id}</span>
                <strong>{item.title || t("proposalDraftEmpty")}</strong>
                <em>{item.yesVotes} / {item.noVotes}</em>
              </button>
            ))}
          </div>
        ) : (
          <p className="council-empty">{t("noActiveProposals")}</p>
        )}
      </section>

      <div className="council-ticket__review">
        <span><Vote size={15} /> {voteReadiness}</span>
        <span><FileText size={15} /> {proposal?.source === "neo-community" ? t("externalProposalReadOnly") : t("majorityPreview")}</span>
        <span><ShieldCheck size={15} /> {isCandidate ? t("eligibleToVote") : t("connectWalletReadOnly")}</span>
      </div>
    </div>
  ) : (
    <OpenUiNotice className="council-empty council-empty--floor" icon={<Vote size={17} />} title={t("noActiveProposals")}>
      {t("emptyProposalHelp")}
    </OpenUiNotice>
  );

  const draftControls = (
    <div className="council-ticket council-ticket--draft">
      {draftComposer("stage")}
      <div className="council-ticket__review">
        <span><Send size={15} /> {draftReady ? t("readyToSubmit") : t("draftReadinessHelp")}</span>
        <span><FileText size={15} /> {t("textProposalScope")}</span>
        <span><ShieldCheck size={15} /> {isCandidate ? t("eligibleToVote") : t("connectWalletReadOnly")}</span>
      </div>
    </div>
  );

  const stageScene = (
    <div className="council-workbench" data-mode={stageMode}>
      {floorTabs}
      <div className="council-workbench__body">
        {stageMode === "review" ? <>{scene}{voteControls}</> : draftControls}
      </div>
    </div>
  );

  const proposalList = (title: string, rows: Proposal[], empty: string, icon: ReactElement) => (
    <OpenUiPanel className="council-drawer__panel" icon={icon} title={title} subtitle={rows.length > 0 ? String(rows.length) : empty}>
      {rows.length > 0 ? (
        <ul className="council-history">
          {rows.slice(0, 10).map((item) => (
            <li key={`${title}-${item.id}`}>
              <button type="button" onClick={() => void dispatch("selectProposal", item)}>
                <span>#{item.id}</span>
                <strong>{item.title || t("proposalDraftEmpty")}</strong>
                <em>{statusLabel(t, item)}</em>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <OpenUiNotice className="council-empty" icon={icon} title={title}>
          {empty}
        </OpenUiNotice>
      )}
    </OpenUiPanel>
  );

  const drawerPanel = (() => {
    if (drawerMode === "draft") {
      return (
        <OpenUiPanel
          className="council-drawer__panel council-drawer__panel--draft"
          icon={<Send size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("proposalDossier")}
          subtitle={draftReady ? t("readyToSubmit") : t("needsBrief")}
        >
          {draftComposer("drawer")}
        </OpenUiPanel>
      );
    }
    if (drawerMode === "history") {
      return proposalList(t("historyProposals"), historyProposals, t("noHistory"), <Clock3 size={17} strokeWidth={2.35} aria-hidden="true" />);
    }
    return proposalList(t("activeProposals"), activeProposals, t("noActiveProposals"), <Vote size={17} strokeWidth={2.35} aria-hidden="true" />);
  })();

  const drawer = (
    <div className="council-drawer">
      <div className="council-drawer-tabs" role="tablist" aria-label={t("proposalTabs")}>
        {[
          { mode: "draft" as const, label: t("proposalDossier"), meta: draftReady ? t("readyToSubmit") : t("needsBrief"), icon: <Send size={15} /> },
          { mode: "active" as const, label: t("activeProposals"), meta: `${activeCount} ${t("active")}`, icon: <Vote size={15} /> },
          { mode: "history" as const, label: t("historyProposals"), meta: `${historyCount} ${t("history")}`, icon: <Clock3 size={15} /> },
        ].map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : undefined}
            onClick={() => setDrawerMode(item.mode)}
          >
            {item.icon}
            <span>{item.label}</span>
            <em>{item.meta}</em>
          </button>
        ))}
      </div>
      <div className="council-drawer__active" data-mode={drawerMode}>
        {drawerPanel}
      </div>
    </div>
  );

  const primaryLabel = stageMode === "review" && proposal
    ? voteChoice === "against"
      ? t("voteAgainst")
      : t("voteFor")
    : t("submitProposal");

  return (
    <OpenUiProvider>
      <div className="council-gov-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("liveGovernance"),
            title: proposal?.title || t("title"),
            subtitle: t("governanceSummary"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {activeCount} {t("active")}</span>,
          }}
          scene={stageScene}
          actions={{
            primary: {
              label: primaryLabel,
              icon: stageMode === "review" ? <Vote size={17} /> : <Send size={17} />,
              onClick: stageMode === "review" ? handleVote : handleCreate,
              disabled: stageMode === "review" ? !canVote : !draftReady || isCreating,
              loading: isVoting || isCreating,
            },
            secondary: stageMode === "review" && proposal && proposal.source !== "neo-community"
              ? [
                {
                  label: t("finalizeProposal"),
                  icon: <CheckCircle2 size={15} />,
                  onClick: () => void dispatch("finalizeProposal", proposal.id),
                  disabled: isVoting,
                },
                {
                  label: t("executeProposal"),
                  icon: <PlayCircle size={15} />,
                  onClick: () => void dispatch("executeProposal", proposal.id),
                  disabled: isVoting,
                },
              ]
              : stageMode === "review" ? [
                {
                  label: t("refresh"),
                  icon: <RefreshCw size={15} />,
                  onClick: () => void dispatch("refresh"),
                  disabled: isLoading,
                },
              ] : undefined,
          }}
          drawerToggleLabel={t("proposalTabs")}
          drawer={{ title: t("proposalTabs"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
