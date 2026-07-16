/**
 * PlayArea.tsx -- Council Governance proposal cockpit
 *
 * The proposal is the primary surface: inspect quorum, choose for/against, and
 * send one wallet-backed vote. Drafting on the stage is a compact council
 * motion card; proposal type/policy controls stay in the drawer so the first
 * screen does not read like a questionnaire.
 */
import { useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Landmark,
  PlayCircle,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  UsersRound,
  Vote,
  WalletCards,
  XCircle,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2/DataPhase";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { ownerMatchesAddress } from "@shared/utils/neo";
import type {
  CouncilCandidate,
  GovernanceConfirmation,
  GovernanceOverview,
  Proposal,
  VoteChoice,
} from "./composables/useGovernance";
import type { PendingGovernanceOperation } from "./governance-operation";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DraftType = "text" | "policy";
type FloorMode = "review" | "draft";
type DrawerMode = "draft" | "active" | "history" | "council";

const DURATION_OPTIONS = [
  { labelKey: "duration2Minutes", durationMs: 120_000 },
  { labelKey: "duration15Minutes", durationMs: 900_000 },
  { labelKey: "duration30Minutes", durationMs: 1_800_000 },
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
const EMPTY_CANDIDATES: CouncilCandidate[] = [];
const EMPTY_OVERVIEW: GovernanceOverview = {
  loaded: false,
  verifiedAt: 0,
  network: null,
  contract: "",
  paused: null,
  committeeSize: 0,
  quorumPercent: 0,
  thresholdPercent: 0,
  minDurationMs: 0,
  maxDurationMs: 0,
  totalProposals: 0,
  totalVotes: 0,
  passedProposals: 0,
  totalMembers: 0,
};
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

function shortTxid(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function shortIdentity(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function proposalKey(proposal: Proposal): string {
  return `${proposal.source ?? "contract"}:${proposal.externalId ?? proposal.id}`;
}

function proposalDisplayId(proposal: Proposal): string {
  return proposal.externalId || `#${proposal.id}`;
}

function operationLabelKey(operation: GovernanceConfirmation["operation"]): string {
  if (operation === "createProposal") return "operationCreate";
  if (operation === "vote") return "operationVote";
  if (operation === "finalizeProposal") return "operationFinalize";
  if (operation === "executeProposal") return "operationExecute";
  return "operationRevoke";
}

function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);
  const dispatchSafely = useCallback((name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  }, [dispatch]);
  const activeProposals = val<Proposal[]>("activeProposals", EMPTY_PROPOSALS) ?? EMPTY_PROPOSALS;
  const historyProposals = val<Proposal[]>("historyProposals", EMPTY_PROPOSALS) ?? EMPTY_PROPOSALS;
  const selectedProposal = val<Proposal | null>("selectedProposal", null);
  const activeCount = num("activeCount");
  const historyCount = num("historyCount");
  const isVoting = bool("isVoting");
  const isCreating = bool("isCreating");
  const isLoading = bool("isLoading");
  const isRecovering = bool("isRecovering");
  const isCandidate = bool("isCandidate");
  const candidateLoaded = bool("candidateLoaded");
  const votingPower = str("votingPower", "0");
  const address = str("address", "");
  const hasVotedMap = val<Record<number, boolean>>("hasVotedMap", {}) ?? {};
  const hasVotedKnownMap = val<Record<number, boolean>>("hasVotedKnownMap", {}) ?? {};
  const loadError = str("loadError", "");
  const candidateError = str("candidateError", "");
  const pendingWrite = val<PendingGovernanceOperation | null>("pendingWrite", null);
  const pendingStorageHealthy = bool("pendingStorageHealthy");
  const governanceOverview = val<GovernanceOverview>("governanceOverview", EMPTY_OVERVIEW) ?? EMPTY_OVERVIEW;
  const governanceOverviewError = str("governanceOverviewError", "");
  const governanceOverviewSettled = bool("governanceOverviewSettled");
  const councilCandidates = val<CouncilCandidate[]>("councilCandidates", EMPTY_CANDIDATES) ?? EMPTY_CANDIDATES;
  const councilRosterLoaded = bool("councilRosterLoaded");
  const councilRosterError = str("councilRosterError", "");
  const neoBalance = str("neoBalance", "");
  const gasBalance = str("gasBalance", "");
  const balancesLoaded = bool("balancesLoaded");
  const balancesSettled = bool("balancesSettled");
  const balancesError = str("balancesError", "");
  const currentNetwork = str("currentNetwork", "unknown");
  const lastConfirmation = val<GovernanceConfirmation | null>("lastConfirmation", null);

  const [voteChoice, setVoteChoice] = useState<VoteChoice>("for");
  const [draftType, setDraftType] = useState<DraftType>("text");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftDurationMs, setDraftDurationMs] = useState(900_000);
  const [policyMethod, setPolicyMethod] = useState(DEFAULT_POLICY_METHOD);
  const [policyValue, setPolicyValue] = useState("");

  const proposal = selectedProposal ?? activeProposals[0] ?? historyProposals[0] ?? null;
  const [floorMode, setFloorMode] = useState<FloorMode>(proposal ? "review" : "draft");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(proposal ? "active" : "draft");
  const stageMode: FloorMode = proposal ? floorMode : "draft";
  const proposalActive = proposal?.statusKey === "active";
  const proposalExternal = proposal?.source === "neo-community";
  const alreadyVoted = proposal ? Boolean(hasVotedMap[proposal.id]) : false;
  const voteStatusKnown = Boolean(proposalExternal || (proposal && hasVotedKnownMap[proposal.id]));
  // ── Honest read phases ───────────────────────────────────────────────────
  // The council rules are contract config: their read starts for every visitor,
  // wallet or not. Until it settles, "no rules" means "still asking" — so the
  // tiles shimmer rather than print an em-dash that reads like a blank rule.
  // Once settled without data the adjacent notice already names the reason, and
  // the tile says so plainly too.
  const rulesPhase = resolvePhase({
    loading: !governanceOverviewSettled,
    settled: governanceOverviewSettled,
    hasData: governanceOverview.loaded,
  });
  // Balances are wallet-scoped: with no wallet the answer is known and the
  // placeholder names the visitor's next step; with a wallet the read is in
  // flight and a shimmer is the honest picture.
  const balancesPhase = resolvePhase({
    loading: Boolean(address) && !balancesSettled,
    settled: balancesSettled,
    hasData: balancesLoaded,
  });
  const balancePlaceholder = address ? t("rulesUnread") : t("balanceConnect");
  const eligibilityReady = Boolean(address && candidateLoaded && !candidateError && isCandidate);
  const governanceWritable = Boolean(governanceOverview.loaded && governanceOverview.paused === false);
  const canVote = Boolean(
    proposal &&
    proposalActive &&
    !proposalExternal &&
    voteStatusKnown &&
    !alreadyVoted &&
    eligibilityReady &&
    governanceWritable &&
    !pendingWrite &&
    !isVoting,
  );
  const numericPolicyValue = policyValue.trim();
  const policyValueReady = /^\d+$/.test(numericPolicyValue) && Number.isSafeInteger(Number(numericPolicyValue));
  const draftReady =
    draftTitle.trim().length > 0 &&
    draftTitle.trim().length <= 80 &&
    draftDescription.trim().length > 0 &&
    draftDescription.trim().length <= 1_000 &&
    (draftType === "text" || (policyMethod.trim().length > 0 && policyValueReady));
  const durationInRange = Boolean(
    governanceOverview.loaded &&
    draftDurationMs >= governanceOverview.minDurationMs &&
    draftDurationMs <= governanceOverview.maxDurationMs,
  );
  const canCreate = Boolean(
    draftReady && durationInRange && eligibilityReady && governanceWritable && !pendingWrite && !isCreating,
  );
  const proposalOwnedByWallet = Boolean(
    proposal &&
    address &&
    (ownerMatchesAddress(proposal.creator, address) || ownerMatchesAddress(proposal.creatorDisplay, address)),
  );
  const canFinalize = Boolean(
    proposal && proposal.source === "contract" && proposal.statusKey === "expired" && address && governanceWritable && !pendingWrite,
  );
  const canExecute = Boolean(
    proposal && proposal.source === "contract" && proposal.statusKey === "passed" && proposal.type === 1 && address && governanceWritable && !pendingWrite,
  );
  const canRevoke = Boolean(
    proposal && proposal.source === "contract" && proposal.statusKey === "active" && proposalOwnedByWallet && governanceWritable && !pendingWrite,
  );
  const policyMethodLabel = t(POLICY_METHODS.find((method) => method.key === policyMethod)?.labelKey ?? "policyMethod");
  const draftDurationLabel = t(DURATION_OPTIONS.find((option) => option.durationMs === draftDurationMs)?.labelKey ?? "duration15Minutes");
  const draftTitlePreview = draftTitle.trim() || t("proposalDraftEmpty");
  const draftDescriptionPreview = draftDescription.trim() || t("proposalDescPlaceholder");
  // A summary tile holds a value, not a paragraph: the full scope sentence
  // belongs to the review rail, which states it in one line at full width.
  const draftScopePreview = draftType === "policy"
    ? policyValue.trim()
      ? `${policyMethodLabel} · ${policyValue.trim()}`
      : t("needsPolicyDetails")
    : t("textProposalScopeShort");
  const draftScopeCopy = draftType === "policy" ? t("policyProposalScope") : t("textProposalScope");
  const yesVotes = Number(proposal?.yesVotes ?? 0);
  const noVotes = Number(proposal?.noVotes ?? 0);
  const castVotes = Math.max(Number(proposal?.totalVotes ?? yesVotes + noVotes), yesVotes + noVotes, 0);
  const shareDenominator = Math.max(castVotes, 1);
  const yesPercent = percent(yesVotes, shareDenominator);
  const noPercent = percent(noVotes, shareDenominator);
  const committeeSize = governanceOverview.committeeSize || 21;
  const quorumNeeded = Math.max(
    1,
    Number(proposal?.quorumRequired || 0) ||
      Math.floor(committeeSize * (governanceOverview.quorumPercent || 30) / 100),
  );
  const quorumProgress = percent(castVotes, quorumNeeded);
  const thresholdPercent = governanceOverview.thresholdPercent || 50;
  const committeeMembers = councilCandidates.filter((candidate) => candidate.isCommittee).slice(0, committeeSize);
  const expiry = formatTime(proposal?.expiryTime, t("votingEnds"));
  const voteReadiness = !address
    ? t("connectWallet")
    : proposalExternal
      ? t("externalProposalReadOnly")
    : governanceOverview.paused
      ? t("governancePaused")
    : !governanceOverview.loaded
      ? t("governanceRulesUnavailable")
    : candidateError
      ? t("eligibilityUnavailable")
    : candidateLoaded && !isCandidate
      ? t("notCandidate")
      : alreadyVoted
          ? t("alreadyVoted")
          : !voteStatusKnown
            ? t("voteStatusUnavailable")
          : proposalActive
            ? t("castYourVote")
            : t("proposalNotActive");

  const handleVote = () => {
    if (!proposal || !canVote) return;
    dispatchSafely("vote", {
      proposalId: proposal.id,
      vote: voteChoice,
    });
  };

  const handleCreate = () => {
    if (!canCreate) return;
    dispatchSafely("createProposal", {
      type: draftType === "policy" ? 1 : 0,
      title: draftTitle,
      description: draftDescription,
      policyMethod: draftType === "policy" ? policyMethod : undefined,
      policyValue: draftType === "policy" ? policyValue : undefined,
      duration: draftDurationMs,
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
              {/* Not proposalBrief: the tile above already owns that label, so
                  the two sat side by side under one heading. */}
              <em>{draftType === "policy" ? t("policyDetails") : t("proposalScope")}</em>
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
                key={option.durationMs}
                type="button"
                className={draftDurationMs === option.durationMs ? "is-active" : undefined}
                onClick={() => setDraftDurationMs(option.durationMs)}
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
          onClick={address ? handleCreate : () => dispatchSafely("connectWallet")}
          disabled={Boolean(address) && !canCreate}
        >
          <Send size={15} />
          {!address ? t("connectWalletCreate") : isCreating ? t("submittingProposal") : t("submitProposal")}
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
        <figcaption className="council-chamber-visual__identity">
          <CoinArt size={54} variant="neo" decorative />
          <span>
            <strong>{t("neoCouncil")}</strong>
            <em>{currentNetwork === "testnet" ? t("testnet") : currentNetwork === "mainnet" ? t("mainnet") : t("networkUnavailable")}</em>
          </span>
        </figcaption>
        <div className="council-chamber-visual__rules" aria-label={t("governanceRules") }>
          <span><UsersRound size={14} /> {t("committeeSeats", { count: committeeSize })}</span>
          <span><ShieldCheck size={14} /> {t("quorumPercentValue", { count: governanceOverview.quorumPercent || 30 })}</span>
        </div>
      </figure>

      <section className="council-quorum" aria-label={t("quorumProgress") }>
        <header className="council-quorum__head">
          <span><UsersRound size={19} /></span>
          <div>
            <span>{t("quorumProgress")}</span>
            <strong>{t("quorumCount", { current: castVotes, needed: quorumNeeded })}</strong>
          </div>
        </header>
        <div
          className="council-quorum__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={quorumNeeded}
          aria-valuenow={Math.min(castVotes, quorumNeeded)}
        >
          <span style={{ width: `${quorumProgress}%` }} />
        </div>
        <div className="council-quorum__split">
          <article data-choice="for">
            <span><CheckCircle2 size={15} /> {t("for")}</span>
            <strong>{yesVotes}</strong>
            <div><span style={{ width: `${yesPercent}%` }} /></div>
          </article>
          <article data-choice="against">
            <span><XCircle size={15} /> {t("against")}</span>
            <strong>{noVotes}</strong>
            <div><span style={{ width: `${noPercent}%` }} /></div>
          </article>
        </div>
        <p>{t("supportThreshold", { count: thresholdPercent })}</p>
      </section>

      <article className="council-proposal-card">
        <div className="council-proposal-card__head">
          <span className="council-proposal-card__icon"><ScrollText size={22} /></span>
          <div>
            <span>{proposal ? proposalDisplayId(proposal) : t("proposalDossier")}</span>
            <strong>{sceneTitle}</strong>
          </div>
        </div>
        <p>{proposal?.description || t("emptyProposalHelp")}</p>
        <div className="council-proposal-card__meta">
          <span><Clock3 size={14} /> {expiry}</span>
          <span><UsersRound size={14} /> {t("quorumRequirement", { needed: quorumNeeded })}</span>
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
          <strong>{votingPower} {t("councilVote")}</strong>
        </div>
        <div className="council-choice" role="radiogroup" aria-label={t("castYourVote")}>
          <button
            type="button"
            className={voteChoice === "for" ? "is-active" : undefined}
            onClick={() => setVoteChoice("for")}
            disabled={isVoting || Boolean(pendingWrite)}
            aria-pressed={voteChoice === "for"}
          >
            <CheckCircle2 size={18} />
            {t("voteFor")}
          </button>
          <button
            type="button"
            className={voteChoice === "against" ? "is-active" : undefined}
            onClick={() => setVoteChoice("against")}
            disabled={isVoting || Boolean(pendingWrite)}
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
                key={proposalKey(item)}
                type="button"
                className={proposal && proposalKey(proposal) === proposalKey(item) ? "is-active" : undefined}
                onClick={() => dispatchSafely("selectProposal", item)}
                disabled={isVoting}
              >
                <span>{proposalDisplayId(item)}</span>
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
        <span><FileText size={15} /> {draftScopeCopy}</span>
        <span><ShieldCheck size={15} /> {isCandidate ? t("eligibleToVote") : t("connectWalletReadOnly")}</span>
      </div>
    </div>
  );

  const transactionNotice = pendingWrite ? (
    <OpenUiNotice
      className="council-transaction council-transaction--pending"
      icon={<RefreshCw size={17} />}
      title={t("governanceRecoveryTitle")}
      type="warning"
    >
      <span>{t("governanceRecoveryBody", { txid: shortTxid(pendingWrite.txid) })}</span>
      {!pendingStorageHealthy && <strong>{t("governanceRecoveryStorageWarning")}</strong>}
      <button
        type="button"
        className="mx2-btn mx2-btn--ghost"
        onClick={() => dispatchSafely("recoverPendingGovernance")}
        disabled={isRecovering}
      >
        <RefreshCw size={14} />
        {isRecovering ? t("governanceRecoveryChecking") : t("governanceRecoveryAction")}
      </button>
    </OpenUiNotice>
  ) : lastConfirmation ? (
    <OpenUiNotice
      className="council-transaction council-transaction--confirmed"
      icon={<CheckCircle2 size={17} />}
      title={t("governanceConfirmationTitle")}
    >
      <span>{t("governanceConfirmationBody", {
          operation: t(operationLabelKey(lastConfirmation.operation)),
          txid: shortTxid(lastConfirmation.txid),
        })}</span>
      {!pendingStorageHealthy && <strong>{t("governanceConfirmationStorageWarning")}</strong>}
    </OpenUiNotice>
  ) : null;

  const stageScene = (
    <div className="council-workbench" data-mode={stageMode}>
      {transactionNotice}
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
            <li key={`${title}-${proposalKey(item)}`}>
              <button type="button" onClick={() => dispatchSafely("selectProposal", item)}>
                <span>{proposalDisplayId(item)}</span>
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

  const councilPanel = (
    <OpenUiPanel
      className="council-drawer__panel council-drawer__panel--council"
      icon={<Landmark size={17} strokeWidth={2.35} aria-hidden="true" />}
      title={t("councilOverview")}
      subtitle={t("candidateCount", { count: councilCandidates.length })}
    >
      <section className="council-wallet" aria-label={t("walletAndVotingPower") }>
        <div className="council-wallet__identity">
          <span><WalletCards size={18} /></span>
          <div>
            <strong>{address ? shortIdentity(address) : t("seatNotConnected")}</strong>
            <em>{address ? (isCandidate ? t("seatVerified") : t("seatReadOnly")) : t("seatCaptionConnect")}</em>
          </div>
        </div>
        <div className="council-wallet__balances">
          <span><CoinArt size={25} variant="neo" decorative /><strong><PhaseValue phase={balancesPhase} placeholder={balancePlaceholder} skeletonWidth="2.5em">{neoBalance}</PhaseValue></strong><em>NEO</em></span>
          <span><CoinArt size={25} variant="gas" decorative /><strong><PhaseValue phase={balancesPhase} placeholder={balancePlaceholder} skeletonWidth="3.5em">{gasBalance}</PhaseValue></strong><em>GAS</em></span>
          <span><Vote size={22} /><strong>{isCandidate ? "1" : "0"}</strong><em>{t("councilVote")}</em></span>
        </div>
        {balancesError && <p>{balancesError}</p>}
      </section>

      <section className="council-rules" aria-label={t("governanceRules") }>
        <article><UsersRound size={17} /><span>{t("committee")}</span><strong><PhaseValue phase={rulesPhase} placeholder={t("rulesUnread")} skeletonWidth="1.5em">{governanceOverview.committeeSize}</PhaseValue></strong></article>
        <article><ShieldCheck size={17} /><span>{t("quorum")}</span><strong><PhaseValue phase={rulesPhase} placeholder={t("rulesUnread")} skeletonWidth="2.5em">{`${governanceOverview.quorumPercent}%`}</PhaseValue></strong></article>
        <article><CheckCircle2 size={17} /><span>{t("support")}</span><strong><PhaseValue phase={rulesPhase} placeholder={t("rulesUnread")} skeletonWidth="2.5em">{`${governanceOverview.thresholdPercent}%`}</PhaseValue></strong></article>
        <article><Clock3 size={17} /><span>{t("votingWindow")}</span><strong><PhaseValue phase={rulesPhase} placeholder={t("rulesUnread")} skeletonWidth="5em">{t("durationRangeMinutes", {
          min: Math.ceil(governanceOverview.minDurationMs / 60_000),
          max: Math.floor(governanceOverview.maxDurationMs / 60_000),
        })}</PhaseValue></strong></article>
      </section>

      {governanceOverviewError && (
        <OpenUiNotice className="council-source-notice" icon={<RefreshCw size={17} />} title={governanceOverviewError} type="warning" />
      )}
      {councilRosterError ? (
        <OpenUiNotice className="council-source-notice" icon={<KeyRound size={17} />} title={councilRosterError} type="warning" />
      ) : !councilRosterLoaded ? (
        <OpenUiNotice className="council-source-notice" icon={<RefreshCw size={17} />} title={t("loadingCouncilRoster")} />
      ) : (
        <section className="council-roster" aria-label={t("committeeAndCandidates") }>
          <header>
            <div><span>{t("committeeAndCandidates")}</span><strong>{t("committeeSeats", { count: committeeMembers.length })}</strong></div>
            <em>{t("nativeNeoVotes")}</em>
          </header>
          <ol>
            {committeeMembers.map((candidate) => (
              <li key={candidate.publicKey}>
                <span>#{candidate.rank}</span>
                <span className="council-roster__key"><KeyRound size={15} /><strong>{shortIdentity(candidate.publicKey)}</strong></span>
                <span className="council-roster__votes"><CoinArt size={17} variant="neo" decorative /><strong>{candidate.votes.toLocaleString()}</strong></span>
              </li>
            ))}
          </ol>
        </section>
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
    if (drawerMode === "council") return councilPanel;
    return proposalList(t("activeProposals"), activeProposals, t("noActiveProposals"), <Vote size={17} strokeWidth={2.35} aria-hidden="true" />);
  })();

  const drawer = (
    <div className="council-drawer">
      {loadError && (
        <OpenUiNotice
          className="council-source-notice"
          icon={<RefreshCw size={17} />}
          title={loadError}
          type="warning"
        />
      )}
      {candidateError && address && (
        <OpenUiNotice
          className="council-source-notice"
          icon={<ShieldCheck size={17} />}
          title={candidateError}
          type="warning"
        />
      )}
      <div className="council-drawer-tabs" role="tablist" aria-label={t("proposalTabs")}>
        {[
          { mode: "draft" as const, label: t("proposalDossier"), meta: draftReady ? t("readyToSubmit") : t("needsBrief"), icon: <Send size={15} /> },
          { mode: "active" as const, label: t("activeProposals"), meta: `${activeCount} ${t("active")}`, icon: <Vote size={15} /> },
          { mode: "history" as const, label: t("historyProposals"), meta: `${historyCount} ${t("history")}`, icon: <Clock3 size={15} /> },
          { mode: "council" as const, label: t("council"), meta: `${committeeMembers.length}/${committeeSize}`, icon: <Landmark size={15} /> },
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

  const primaryAction = !address
    ? {
          label: t("connectWallet"),
          icon: <ShieldCheck size={17} />,
          onClick: () => dispatchSafely("connectWallet"),
        }
    : pendingWrite
      ? {
          label: isRecovering ? t("governanceRecoveryChecking") : t("governanceRecoveryAction"),
          icon: <RefreshCw size={17} />,
          onClick: () => dispatchSafely("recoverPendingGovernance"),
          loading: isRecovering,
        }
      : !governanceOverview.loaded || governanceOverview.paused !== false
        ? {
            label: governanceOverview.paused ? t("governancePaused") : t("refreshGovernance"),
            icon: <RefreshCw size={17} />,
            onClick: () => dispatchSafely("refresh"),
            loading: isLoading,
          }
      : stageMode === "review" && proposalExternal
        ? {
            label: t("externalReadOnlyAction"),
            icon: <FileText size={17} />,
            onClick: () => dispatchSafely("refresh"),
            loading: isLoading,
          }
      : candidateError
        ? {
            label: t("refreshEligibility"),
            icon: <RefreshCw size={17} />,
            onClick: () => dispatchSafely("refresh"),
            loading: isLoading,
          }
        : {
            label: primaryLabel,
            icon: stageMode === "review" ? <Vote size={17} /> : <Send size={17} />,
            onClick: stageMode === "review" ? handleVote : handleCreate,
            disabled: stageMode === "review" ? !canVote : !canCreate,
            loading: isVoting || isCreating,
          };

  const secondaryActions: Array<{
    label: string;
    icon: ReactElement;
    onClick: () => void;
    disabled?: boolean;
  }> = [];
  if (stageMode === "review" && proposal) {
    if (canFinalize) {
      secondaryActions.push({
        label: t("finalizeProposal"),
        icon: <CheckCircle2 size={15} />,
        onClick: () => dispatchSafely("finalizeProposal", proposal.id),
      });
    }
    if (canExecute) {
      secondaryActions.push({
        label: t("executeProposal"),
        icon: <PlayCircle size={15} />,
        onClick: () => dispatchSafely("executeProposal", proposal.id),
      });
    }
    if (canRevoke) {
      secondaryActions.push({
        label: t("revokeProposal"),
        icon: <XCircle size={15} />,
        onClick: () => dispatchSafely("revokeProposal", proposal.id),
      });
    }
  }
  if (secondaryActions.length === 0 && stageMode === "review") {
    secondaryActions.push({
      label: t("refresh"),
      icon: <RefreshCw size={15} />,
      onClick: () => dispatchSafely("refresh"),
      disabled: isLoading,
    });
  }

  return (
    <OpenUiProvider>
      <div className="council-gov-play-area mx2 mx2-cat-governance">
        <PlayStage
          category="governance"
          stage={{
            eyebrow: t("liveGovernance"),
            title: proposal?.title || t("title"),
            subtitle: t("governanceSummary"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {activeCount} {t("active")}</span>
                <span className="mx2-badge"><CoinArt size={14} variant="neo" decorative /> {currentNetwork === "testnet" ? t("testnet") : currentNetwork === "mainnet" ? t("mainnet") : t("networkUnavailable")}</span>
              </>
            ),
          }}
          scene={stageScene}
          actions={{
            primary: primaryAction,
            secondary: secondaryActions.length > 0 ? secondaryActions : undefined,
          }}
          drawerToggleLabel={t("councilDetails")}
          drawer={{ title: t("councilDetails"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
