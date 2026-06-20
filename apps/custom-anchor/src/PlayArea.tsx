import { useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import {
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  Coins,
  Landmark,
  Network,
  Orbit,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import {
  ANCHOR_AGENT_COUNT,
  defaultProfitCandidates,
} from "@shared/utils/anchor-agents";
import "./PlayArea.scss";

const COMPRESSED_PUBLIC_KEY = /^(02|03)[0-9a-fA-F]{64}$/;

/** Split candidate textarea into trimmed, non-empty tokens. */
function splitCandidateKeys(value: string): string[] {
  return String(value || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function truncate(value: string): string {
  if (value.length <= 34) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

function isValidAnchorId(value: string): boolean {
  return /^custom-anchor:[a-z0-9-]{1,24}:[a-z0-9-]{1,24}$/.test(value.trim());
}

function isPositiveWholeNeo(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

interface DiscoveredAnchor {
  appId: string;
  mode: number;
}

export default function PlayArea({
  t,
  state,
  status,
  dispatch,
}: PlayAreaProps) {
  const { str, num, bool, val } = useStateBindings(state);
  const anchorAppId = str("anchorAppId");
  const anchorMode = num("anchorMode");
  const isLoading = bool("isLoading");
  const agentCount = num("agentCount");
  const lastTxid = str("lastTxid");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const neoCredit = str("neoCredit", "0");
  const gasCredit = str("gasCredit", "0");
  const rewardPerNeo = str("rewardPerNeo", "0");
  const discoveredAnchors = val<DiscoveredAnchor[]>("discoveredAnchors") ?? [];
  const anchorLinked = Boolean(anchorAppId);
  const anchorNotRegistered = anchorLinked && anchorMode === 0;
  // A registered anchor with 0 AA agents is inert: staked NEO cannot vote or
  // earn GAS until the operator provisions agents. Surface this before staking
  // and gate the stake action behind an explicit acknowledgement.
  const hasNoAgents =
    anchorLinked && !anchorNotRegistered && anchorMode > 0 && agentCount === 0;
  const anchorStatus = !anchorLinked
    ? t("anchorMissing")
    : anchorNotRegistered
      ? t("anchorNotRegisteredBadge")
      : t("anchorLinked");
  const displayedAnchor = anchorAppId
    ? truncate(anchorAppId)
    : t("anchorAwaitingLaunch");
  const displayedTx = lastTxid ? truncate(lastTxid) : "—";
  // Show the real on-chain agent count (0 is a valid value for an unconfigured anchor).
  // Only fall back to a neutral placeholder before an anchor is linked, never mask a real 0.
  const displayedAgentCount =
    anchorLinked && !anchorNotRegistered ? String(agentCount) : "—";
  const hasNeoCredit = Number(neoCredit) > 0;
  const hasGasCredit = Number(gasCredit) > 0;
  const hasAnyCredit = hasNeoCredit || hasGasCredit;

  // Seed empty: the example "custom-anchor:team:nonce" is shown as a PLACEHOLDER
  // only, never as a real value — a pre-filled fake id passes validation and
  // lets a first-time user submit a NEO transfer to a non-existent anchor.
  const [anchorInput, setAnchorInput] = useState(anchorAppId || "");
  const [amountInput, setAmountInput] = useState("1");
  const [registerInput, setRegisterInput] = useState("");
  const [registerMode, setRegisterMode] = useState(1);
  // Council candidates (one compressed pubkey per line). Defaulted to the
  // ready-to-use Profit candidate set on first switch to Profit so a first-time
  // operator can register a yield-earning anchor without sourcing 21 keys.
  const [candidatesInput, setCandidatesInput] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [formError, setFormError] = useState("");
  // Explicit acknowledgement required to stake into a 0-agent (inert) anchor.
  const [noAgentConfirmed, setNoAgentConfirmed] = useState(false);

  // Onboarding CTAs jump the user straight to the relevant collapsed panel,
  // turning the inert empty state into a clear next step.
  const discoverRef = useRef<HTMLDetailsElement>(null);
  const registerRef = useRef<HTMLDetailsElement>(null);
  const openPanel = (ref: typeof discoverRef) => {
    const el = ref.current;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (anchorAppId && anchorAppId !== anchorInput) setAnchorInput(anchorAppId);
    // Only sync fresh launch/read state into the form. User edits should stay editable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorAppId]);

  const anchorInputValid = useMemo(
    () => isValidAnchorId(anchorInput),
    [anchorInput],
  );
  const amountValid = useMemo(
    () => isPositiveWholeNeo(amountInput),
    [amountInput],
  );
  // Redeem / claim / refresh use the contract's looser id rule (1-64 chars) so a
  // script-registered anchor stays reachable for reclaiming staked NEO; only a
  // NEW stake requires the strict slug:nonce shape.
  const looseAnchorValid = useMemo(() => {
    const v = anchorInput.trim();
    return v.length >= 1 && v.length <= 64;
  }, [anchorInput]);
  const busy = isLoading || Boolean(busyAction);
  // Reset the inert-anchor acknowledgement whenever the typed anchor id changes,
  // so a confirmation for one anchor never silently carries to another.
  useEffect(() => {
    setNoAgentConfirmed(false);
  }, [anchorInput]);
  // Stake mints into an anchor (strict shape); other actions accept any valid id.
  // Additionally gate staking into a 0-agent anchor behind an explicit confirm —
  // such an anchor cannot vote or earn GAS, so a stake there earns nothing.
  const stakeBlockedByNoAgents = hasNoAgents && !noAgentConfirmed;
  const stakeDisabled =
    busy || !anchorInputValid || !amountValid || stakeBlockedByNoAgents;
  const redeemDisabled = busy || !looseAnchorValid || !amountValid;
  const looseActionDisabled = busy || !looseAnchorValid;
  // Only flag the input as invalid once the user has typed something; an empty
  // field on first paint is "not started", not an error (mirrors the register
  // field's pattern). Reserve the red border for a non-empty malformed id.
  const anchorInputTouched = anchorInput.trim().length > 0;
  const anchorInputErrored = anchorInputTouched && !anchorInputValid;
  // The action strip should agree with the hero and the disabled CTA: stay
  // neutral until there is a usable anchor (linked, or a valid id typed), and
  // only paint the green "Ready" once an action can actually be taken.
  const anchorReady = anchorLinked || looseAnchorValid;
  // First-run onboarding: nothing linked and no usable id typed yet, so the
  // action buttons are all disabled. Show a clear next step instead of an inert
  // button grid.
  const showOnboarding = !anchorLinked && !looseAnchorValid;
  const hasStatusError = Boolean(formError || lastError);
  const statusText = hasStatusError
    ? formError || lastError
    : anchorReady
      ? status?.msg || workflowStatus
      : t("anchorAwaitingInput");

  const runAction = async (
    event: SyntheticEvent,
    action: "stake" | "withdraw" | "claimRewards" | "refreshAnchor",
  ) => {
    event.preventDefault();
    setFormError("");
    // Stake mints into an anchor and uses the strict shape; the others accept any
    // valid contract id so already-staked NEO stays redeemable.
    const idOk = action === "stake" ? anchorInputValid : looseAnchorValid;
    if (!idOk) {
      setFormError(t("invalidAnchorId"));
      return;
    }
    if ((action === "stake" || action === "withdraw") && !amountValid) {
      setFormError(t("invalidAmount"));
      return;
    }

    setBusyAction(action);
    try {
      const payload =
        action === "claimRewards" || action === "refreshAnchor"
          ? { anchorAppId: anchorInput.trim() }
          : { anchorAppId: anchorInput.trim(), amount: amountInput.trim() };
      await dispatch(action, payload);
    } catch (error) {
      setFormError(formatErrorMessage(error, t("workflowFailed")));
    } finally {
      setBusyAction("");
    }
  };

  const registerInputValid = useMemo(
    () => isValidAnchorId(registerInput),
    [registerInput],
  );
  const candidateKeys = useMemo(
    () => splitCandidateKeys(candidatesInput),
    [candidatesInput],
  );
  const validCandidateCount = useMemo(
    () => candidateKeys.filter((key) => COMPRESSED_PUBLIC_KEY.test(key)).length,
    [candidateKeys],
  );
  // Provisioning needs EXACTLY 21 valid compressed pubkeys (duplicates allowed —
  // the on-chain RegisterAgents accepts repeats, mirroring the deploy default).
  const candidatesValid =
    candidateKeys.length === ANCHOR_AGENT_COUNT &&
    validCandidateCount === ANCHOR_AGENT_COUNT;
  const registerDisabled = busy || !registerInputValid || !candidatesValid;
  const candidatePreview = candidateKeys.slice(0, 3);
  const remainingCandidateCount = Math.max(
    0,
    candidateKeys.length - candidatePreview.length,
  );
  const candidateStatusLabel = candidatesValid
    ? t("candidateKitReady")
    : candidateKeys.length > 0
      ? t("candidateKitPartial")
      : t("candidateKitEmpty");

  const fillDefaultCandidates = () => {
    setCandidatesInput(defaultProfitCandidates().join("\n"));
  };

  // Switching to Profit seeds the ready-to-use default candidate set when the
  // field is still empty (friction-free yield anchor); Trust leaves it blank so
  // the operator supplies their own governance candidates.
  const handleSelectMode = (mode: number) => {
    setRegisterMode(mode);
    if (mode === 2 && splitCandidateKeys(candidatesInput).length === 0) {
      fillDefaultCandidates();
    }
  };

  const handleRegister = async (event: SyntheticEvent) => {
    event.preventDefault();
    setFormError("");
    if (!registerInputValid) {
      setFormError(t("invalidAnchorId"));
      return;
    }
    if (!candidatesValid) {
      setFormError(t("registerCandidatesInvalid"));
      return;
    }
    setBusyAction("register");
    try {
      await dispatch("register", {
        anchorAppId: registerInput.trim(),
        mode: registerMode,
        candidates: candidateKeys,
      });
      setAnchorInput(registerInput.trim());
    } catch (error) {
      setFormError(formatErrorMessage(error, t("workflowFailed")));
    } finally {
      setBusyAction("");
    }
  };

  const handleRecover = async (asset: "NEO" | "GAS") => {
    setFormError("");
    setBusyAction(`recover-${asset}`);
    try {
      await dispatch("recoverCredit", asset);
    } catch (error) {
      setFormError(formatErrorMessage(error, t("workflowFailed")));
    } finally {
      setBusyAction("");
    }
  };

  const handleSelectAnchor = async (id: string) => {
    setFormError("");
    setAnchorInput(id);
    setBusyAction("selectAnchor");
    try {
      await dispatch("selectAnchor", id);
    } catch (error) {
      setFormError(formatErrorMessage(error, t("workflowFailed")));
    } finally {
      setBusyAction("");
    }
  };

  const handleDiscover = async () => {
    setBusyAction("discoverAnchors");
    try {
      await dispatch("discoverAnchors");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="custom-anchor-playarea">
      {/* Hero — lead with the civic meaning (NEO voting power), then the few facts that matter */}
      <section className="custom-anchor-hero">
        <div className="custom-anchor-hero__body">
          <div className="custom-anchor-hero__heading">
            <span className="custom-anchor-hero__badge" aria-hidden="true">
              <Landmark size={24} />
            </span>
            <div>
              <span className="custom-anchor-kicker">{t("civicEyebrow")}</span>
              <h2>{anchorAppId ? t("readyForAnchor") : t("noAnchorTitle")}</h2>
            </div>
          </div>
          <p>{anchorAppId ? truncate(anchorAppId) : t("noAnchorBody")}</p>
          <p className="custom-anchor-hero__explainer">
            <strong>{t("whatIsAnchorTitle")}</strong> {t("whatIsAnchorBody")}
          </p>
          <div className="custom-anchor-hero__facts">
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              {t("anchorStatus")}: <strong>{anchorStatus}</strong>
            </span>
            <span>
              <Network size={14} aria-hidden="true" />
              {t("agentCount")}: <strong>{displayedAgentCount}</strong>
            </span>
            <span>
              <Sparkles size={14} aria-hidden="true" />
              {t("lastTxid")}: <strong>{displayedTx}</strong>
            </span>
          </div>
        </div>
        <figure className="custom-anchor-hero__stage">
          <img
            src="./custom-anchor-stage.jpg"
            alt={t("anchorStageAlt")}
            loading="eager"
            decoding="async"
          />
          <figcaption>
            <span>{t("anchorStageLabel")}</span>
            <strong>
              {anchorLinked && !anchorNotRegistered
                ? t("anchorStageValueReady")
                : t("anchorStageValueIdle")}
            </strong>
          </figcaption>
        </figure>
      </section>

      {/* Primary action — surfaced immediately after the hero */}
      <section
        className="custom-anchor-action-panel"
        aria-label={t("actionPanelTitle")}
      >
        <div className="custom-anchor-section-head">
          <span>{t("actionPanelLabel")}</span>
          <h3>{t("actionPanelTitle")}</h3>
          <p>{t("actionPanelBody")}</p>
        </div>

        <div
          className="custom-anchor-route-strip"
          aria-label={t("anchorFlowTitle")}
        >
          <span className={anchorReady ? "is-ready" : ""}>
            <Orbit size={17} aria-hidden="true" />
            <small>{t("anchorFlowOpen")}</small>
            <strong>
              {anchorReady ? truncate(anchorInput) : t("anchorAwaitingInput")}
            </strong>
          </span>
          <span className={anchorReady && amountValid ? "is-ready" : ""}>
            <Coins size={17} aria-hidden="true" />
            <small>{t("anchorFlowAction")}</small>
            <strong>
              {amountValid ? `${amountInput} NEO` : t("invalidAmount")}
            </strong>
          </span>
          <span className={anchorReady && amountValid ? "is-ready" : ""}>
            <WalletCards size={17} aria-hidden="true" />
            <small>{t("anchorFlowSign")}</small>
            <strong>
              {stakeDisabled ? t("anchorAwaitingInput") : t("workflowReady")}
            </strong>
          </span>
        </div>

        {showOnboarding && (
          <div className="custom-anchor-onboard" role="note">
            <div className="custom-anchor-onboard__text">
              <strong>{t("onboardTitle")}</strong>
              <p>{t("onboardBody")}</p>
            </div>
            <div className="custom-anchor-onboard__actions">
              <button
                type="button"
                className="custom-anchor-button custom-anchor-button--primary"
                onClick={() => openPanel(discoverRef)}
              >
                {t("onboardBrowse")}
              </button>
              <button
                type="button"
                className="custom-anchor-button"
                onClick={() => openPanel(registerRef)}
              >
                {t("onboardRegister")}
              </button>
            </div>
          </div>
        )}

        <form
          className="custom-anchor-form"
          onSubmit={(event) => runAction(event, "stake")}
        >
          <div className="custom-anchor-field">
            <label>
              <span>{t("anchorAppId")}</span>
              <input
                value={anchorInput}
                onChange={(event) => setAnchorInput(event.currentTarget.value)}
                placeholder="custom-anchor:team:nonce"
                autoComplete="off"
                aria-invalid={anchorInputErrored}
                aria-describedby="custom-anchor-id-hint"
              />
            </label>
            <small
              id="custom-anchor-id-hint"
              className="custom-anchor-field-hint"
            >
              {t("anchorIdHint")}
            </small>
          </div>
          <label>
            <span>{t("neoAmount")}</span>
            <input
              value={amountInput}
              onChange={(event) => setAmountInput(event.currentTarget.value)}
              placeholder="1"
              inputMode="numeric"
              aria-invalid={!amountValid}
            />
          </label>
          {hasNoAgents && (
            <div className="custom-anchor-no-agents" role="alert">
              <strong>{t("noAgentsTitle")}</strong>
              <p>{t("noAgentsBody")}</p>
              <label className="custom-anchor-no-agents__confirm">
                <input
                  type="checkbox"
                  checked={noAgentConfirmed}
                  onChange={(event) =>
                    setNoAgentConfirmed(event.currentTarget.checked)
                  }
                />
                <span>
                  {noAgentConfirmed
                    ? t("noAgentsConfirmActive")
                    : t("noAgentsConfirm")}
                </span>
              </label>
            </div>
          )}
          {/* Write actions — the value-moving operations, each tagged with the
              token it touches so NEO stake vs GAS claim is unmistakable. */}
          <div className="custom-anchor-action-grid">
            <button
              type="submit"
              className="custom-anchor-button custom-anchor-button--primary custom-anchor-button--action"
              disabled={stakeDisabled}
            >
              <span className="custom-anchor-button__label">
                {busyAction === "stake" ? t("submitting") : t("stakeAction")}
              </span>
              {busyAction !== "stake" && (
                <span className="custom-anchor-button__tag" aria-hidden="true">
                  {t("stakeTokenTag")}
                </span>
              )}
            </button>
            <button
              type="button"
              className="custom-anchor-button custom-anchor-button--action"
              disabled={redeemDisabled}
              onClick={(event) => runAction(event, "withdraw")}
            >
              <span className="custom-anchor-button__label">
                {busyAction === "withdraw"
                  ? t("submitting")
                  : t("withdrawAction")}
              </span>
              {busyAction !== "withdraw" && (
                <span className="custom-anchor-button__tag" aria-hidden="true">
                  {t("withdrawTokenTag")}
                </span>
              )}
            </button>
            <button
              type="button"
              className="custom-anchor-button custom-anchor-button--action"
              disabled={looseActionDisabled}
              onClick={(event) => runAction(event, "claimRewards")}
            >
              <span className="custom-anchor-button__label">
                {busyAction === "claimRewards"
                  ? t("submitting")
                  : t("claimAction")}
              </span>
              {busyAction !== "claimRewards" && (
                <span className="custom-anchor-button__tag" aria-hidden="true">
                  {t("claimTokenTag")}
                </span>
              )}
            </button>
          </div>

          {/* Maintenance — a read-only refresh, demoted to a ghost row so the
              value-moving operations above stay visually dominant. */}
          <div className="custom-anchor-maintenance">
            <span className="custom-anchor-maintenance__label">
              {t("maintenanceLabel")}
            </span>
            <button
              type="button"
              className="custom-anchor-button custom-anchor-button--ghost"
              disabled={looseActionDisabled}
              onClick={(event) => runAction(event, "refreshAnchor")}
            >
              {busyAction === "refreshAnchor"
                ? t("submitting")
                : t("refreshStatus")}
            </button>
          </div>
        </form>

        {anchorNotRegistered && (
          <div className="custom-anchor-status-strip error" role="status">
            <span>{t("anchorNotRegistered")}</span>
          </div>
        )}

        <div
          className={`custom-anchor-status-strip${
            hasStatusError ? " error" : anchorReady ? "" : " neutral"
          }`}
          role="status"
        >
          <span>{statusText}</span>
        </div>
      </section>

      {/* Carded metrics group — tiles wrapped so they stay off the viewport edge, consistent with the rest of the suite */}
      <section
        className="custom-anchor-metrics-card"
        aria-label={t("totalStaked")}
      >
        <div className="custom-anchor-metrics" aria-live="polite">
          <div>
            <span>{t("userStake")}</span>
            <strong>{str("userStake")} NEO</strong>
          </div>
          <div>
            <span>{t("pendingRewards")}</span>
            <strong>{str("pendingRewards")} GAS</strong>
          </div>
          <div>
            <span>{t("rewardReserve")}</span>
            <strong>{str("rewardReserve")} GAS</strong>
          </div>
          <div>
            <span>{t("totalStaked")}</span>
            <strong>{str("totalStaked")} NEO</strong>
          </div>
        </div>
      </section>

      {/* Reward model — explain where claimable GAS comes from before users stake. */}
      <section
        className="custom-anchor-reward-model"
        aria-label={t("rewardModelTitle")}
      >
        <div className="custom-anchor-reward-model__head">
          <span>{t("rewardModelTitle")}</span>
          {anchorLinked && !anchorNotRegistered && (
            <span className="custom-anchor-reward-model__rate">
              {t("rewardPerNeoLabel")}: <strong>{rewardPerNeo}</strong>
            </span>
          )}
        </div>
        <p>{t("rewardModelBody")}</p>
        {anchorLinked && !anchorNotRegistered && (
          <p className="custom-anchor-reward-model__caption">
            {t("rewardPerNeoCaption")}
          </p>
        )}
      </section>

      {/* Stranded contract-credit recovery — shown only when there is something to reclaim. */}
      {hasAnyCredit && (
        <section
          className="custom-anchor-credit-card"
          aria-label={t("creditTitle")}
        >
          <div className="custom-anchor-section-head">
            <span>{t("creditTitle")}</span>
            <p>{t("creditBody")}</p>
          </div>
          <div className="custom-anchor-credit-grid">
            {hasNeoCredit && (
              <div className="custom-anchor-credit-row">
                <span>{t("creditNeo")}</span>
                <strong>{neoCredit} NEO</strong>
                <button
                  type="button"
                  className="custom-anchor-button custom-anchor-button--primary"
                  disabled={busy}
                  onClick={() => handleRecover("NEO")}
                >
                  {busyAction === "recover-NEO"
                    ? t("submitting")
                    : t("recoverNeo")}
                </button>
              </div>
            )}
            {hasGasCredit && (
              <div className="custom-anchor-credit-row">
                <span>{t("creditGas")}</span>
                <strong>{gasCredit} GAS</strong>
                <button
                  type="button"
                  className="custom-anchor-button custom-anchor-button--primary"
                  disabled={busy}
                  onClick={() => handleRecover("GAS")}
                >
                  {busyAction === "recover-GAS"
                    ? t("submitting")
                    : t("recoverGas")}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Anchor discovery — browse registered anchors and use one. */}
      <details className="custom-anchor-discover" ref={discoverRef}>
        <summary>
          <span>{t("discoverTitle")}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="custom-anchor-discover__body">
          <div className="custom-anchor-discover__head">
            <span>{t("discoverLabel")}</span>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={busy}
              onClick={handleDiscover}
            >
              {busyAction === "discoverAnchors"
                ? t("submitting")
                : t("discoverRefresh")}
            </button>
          </div>
          {discoveredAnchors.length === 0 ? (
            <p className="custom-anchor-discover__empty">
              {t("discoverEmpty")}
            </p>
          ) : (
            <ul className="custom-anchor-discover__list">
              {discoveredAnchors.map((entry) => (
                <li key={entry.appId}>
                  <span className="custom-anchor-discover__id">
                    {truncate(entry.appId)}
                  </span>
                  <span
                    className="custom-anchor-discover__mode"
                    title={
                      entry.mode === 2
                        ? t("registerModeProfitDesc")
                        : t("registerModeTrustDesc")
                    }
                  >
                    {entry.mode === 2 ? t("modeProfit") : t("modeTrust")}
                  </span>
                  <button
                    type="button"
                    className="custom-anchor-button"
                    disabled={busy}
                    onClick={() => handleSelectAnchor(entry.appId)}
                  >
                    {t("discoverUse")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {/* Register a new custom anchor. */}
      <details className="custom-anchor-register" ref={registerRef}>
        <summary>
          <span>{t("registerPanelTitle")}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="custom-anchor-register__body">
          <div className="custom-anchor-section-head">
            <span>{t("registerPanelLabel")}</span>
            <p>{t("registerPanelBody")}</p>
          </div>
          <form
            className="custom-anchor-form custom-anchor-register-form"
            onSubmit={handleRegister}
          >
            <label>
              <span>{t("registerAnchorAppId")}</span>
              <input
                value={registerInput}
                onChange={(event) =>
                  setRegisterInput(event.currentTarget.value)
                }
                placeholder="custom-anchor:team:nonce"
                autoComplete="off"
                aria-invalid={registerInput.length > 0 && !registerInputValid}
              />
            </label>
            <div
              className="custom-anchor-mode-toggle"
              role="radiogroup"
              aria-label={t("registerPanelTitle")}
            >
              <button
                type="button"
                role="radio"
                aria-checked={registerMode === 1}
                aria-label={t("registerModeTrust")}
                className={`custom-anchor-mode${registerMode === 1 ? " active" : ""}`}
                onClick={() => handleSelectMode(1)}
              >
                <ShieldCheck size={17} aria-hidden="true" />
                <span>
                  <strong>{t("registerModeTrust")}</strong>
                  <small>{t("registerModeTrustDesc")}</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={registerMode === 2}
                aria-label={t("registerModeProfit")}
                className={`custom-anchor-mode${registerMode === 2 ? " active" : ""}`}
                onClick={() => handleSelectMode(2)}
              >
                <Coins size={17} aria-hidden="true" />
                <span>
                  <strong>{t("registerModeProfit")}</strong>
                  <small>{t("registerModeProfitDesc")}</small>
                </span>
              </button>
            </div>
            <div className="custom-anchor-candidate-kit">
              <div className="custom-anchor-candidate-kit__head">
                <div>
                  <span>{t("candidateKitTitle")}</span>
                  <strong>{candidateStatusLabel}</strong>
                </div>
                <span
                  className={`custom-anchor-candidates__count${candidatesValid ? " valid" : ""}`}
                  aria-live="polite"
                >
                  {t("registerCandidatesCount").replace(
                    "{count}",
                    String(validCandidateCount),
                  )}
                </span>
              </div>
              <div className="custom-anchor-candidate-kit__preview">
                <span
                  className="custom-anchor-candidate-kit__icon"
                  aria-hidden="true"
                >
                  {candidatesValid ? (
                    <BadgeCheck size={18} />
                  ) : (
                    <CircleAlert size={18} />
                  )}
                </span>
                <div>
                  <strong>{t("candidatePreviewTitle")}</strong>
                  {candidatePreview.length > 0 ? (
                    <ul>
                      {candidatePreview.map((key) => (
                        <li key={key}>{truncate(key)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("candidatePreviewEmpty")}</p>
                  )}
                  {remainingCandidateCount > 0 && (
                    <small>
                      {t("candidateRemaining").replace(
                        "{count}",
                        String(remainingCandidateCount),
                      )}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="custom-anchor-button custom-anchor-button--ghost"
                  disabled={busy}
                  onClick={fillDefaultCandidates}
                >
                  <Search size={15} aria-hidden="true" />
                  {t("registerCandidatesUseDefault")}
                </button>
              </div>
              <div className="custom-anchor-field">
                <label>
                  <span>{t("registerCandidatesLabel")}</span>
                  <textarea
                    className="custom-anchor-candidates"
                    value={candidatesInput}
                    onChange={(event) =>
                      setCandidatesInput(event.currentTarget.value)
                    }
                    placeholder={t("registerCandidatesPlaceholder")}
                    rows={5}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-invalid={
                      candidatesInput.trim().length > 0 && !candidatesValid
                    }
                    aria-describedby="custom-anchor-candidates-hint"
                  />
                </label>
                <small
                  id="custom-anchor-candidates-hint"
                  className="custom-anchor-field-hint"
                >
                  {t("registerCandidatesHint")}
                </small>
              </div>
            </div>
            <button
              type="submit"
              className="custom-anchor-button custom-anchor-button--primary custom-anchor-submit-button"
              disabled={registerDisabled}
            >
              {busyAction === "register"
                ? t("submitting")
                : t("registerAction")}
            </button>
          </form>
          <p className="custom-anchor-register__note">
            {t("registerAgentsNote")}
          </p>
          <p className="custom-anchor-register__note">
            {t("registerProvisionedNote")}
          </p>
        </div>
      </details>

      {/* Routing model — collapsed by default to keep the surface civic, not operator-dense. */}
      <details className="custom-anchor-model">
        <summary>
          <span>{t("routingDetails")}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="custom-anchor-model__body">
          <p>{t("agentModelBody")}</p>
          <p className="custom-anchor-source-line">
            {t("launchSource")}: <strong>{displayedAnchor}</strong>
          </p>
        </div>
      </details>
    </div>
  );
}
