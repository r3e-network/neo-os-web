/**
 * PlayArea.tsx - Custom Anchor
 *
 * User-facing NEO staking surface. The main stage keeps the wallet action,
 * anchor id, amount, rewards, and agent safety state visible without exposing
 * low-level provisioning controls as the first thing users see.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  Anchor,
  BadgeCheck,
  CircleAlert,
  Coins,
  Compass,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { PhaseValue, Skeleton, type DataPhase } from "@shared/components-react/v2/DataPhase";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import type { PendingAnchorOperation } from "./anchor-production";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface DiscoveredAnchor {
  appId: string;
  mode: number;
}

type AnchorDrawerMode = "settings" | "discover" | "register" | "safety";

const STAGE_IMAGE = new URL("../public/custom-anchor-stage.webp", import.meta.url).href;
const STAKE_PRESETS = ["1", "5", "10"];

function cleanNumber(value: string) {
  return String(value || "0").replace(/,/g, "").trim();
}

function normalizeWholeNeoAmount(value: string) {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

function hasPositiveAmount(value: string) {
  return Number(cleanNumber(value)) > 0;
}

function compact(value: string, empty = "-") {
  const text = value.trim();
  if (!text) return empty;
  return text.length > 34 ? `${text.slice(0, 18)}...${text.slice(-10)}` : text;
}

function validCandidateCount(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^0[23][0-9a-fA-F]{64}$/.test(line)).length;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);

  const anchorAppId = str("anchorAppId");
  const totalStaked = str("totalStaked", "");
  const rewardReserve = str("rewardReserve", "");
  const userStake = str("userStake", "");
  const pendingRewards = str("pendingRewards", "");
  const rewardPerNeo = str("rewardPerNeo", "");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const errorDetail = str("errorDetail");
  const lastTxid = str("lastTxid");
  const neoCredit = str("neoCredit", "");
  const gasCredit = str("gasCredit", "");
  const dataStatus = str("dataStatus", "idle");
  const creditStatus = str("creditStatus", "idle");
  const networkStatus = str("networkStatus", "bound");
  const storageStatus = str("storageStatus", "ready");
  const pendingState = str("pendingState", "none");
  const pendingOperation = val<PendingAnchorOperation | null>("pendingOperation", null);
  const anchorMode = num("anchorMode", -1);
  const agentCount = num("agentCount");
  const isLoading = bool("isLoading");
  const submitting = bool("submitting");
  const discoveredAnchors = val<DiscoveredAnchor[]>("discoveredAnchors", []) ?? [];

  // ── Honest read phases ───────────────────────────────────────────────────
  // The console cannot show anchor numbers until the visitor picks an anchor,
  // and cannot show *their* stake until a wallet is connected. Both are normal
  // states, so each renders as a skeleton (read in flight) or as inviting
  // zero-state copy — never an em-dash. `dataStatus` already models this; these
  // two helpers just map it onto the shared DataPhase vocabulary.
  const dataPhase: DataPhase =
    dataStatus === "loading"
      ? "loading"
      : dataStatus === "ready" || dataStatus === "missing"
        ? "ready"
        : "unavailable";
  // "idle" means no anchor is chosen yet — that is a call to action, not a
  // fault. Any other unresolved state is the network not being reachable.
  const dataPlaceholder = dataStatus === "idle" ? t("valuePickAnchor") : t("valueAwaitingNetwork");
  /** Phase for one anchor-scoped value: resolved reads with no value need a wallet. */
  const valuePhase = (raw: string): DataPhase =>
    dataPhase === "ready" && !raw ? "unavailable" : dataPhase;
  const valuePlaceholder = (raw: string): string =>
    dataPhase === "ready" && !raw ? t("valueConnectWallet") : dataPlaceholder;

  const [anchorDraft, setAnchorDraft] = useState(anchorAppId);
  const [amountDraft, setAmountDraft] = useState("1");
  const [agentAcknowledged, setAgentAcknowledged] = useState(false);
  const [registerDraft, setRegisterDraft] = useState(anchorAppId);
  const [registerMode, setRegisterMode] = useState<1 | 2>(2);
  const [candidateDraft, setCandidateDraft] = useState("");
  const [pulseAction, setPulseAction] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<AnchorDrawerMode>("settings");
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (anchorAppId) {
      setAnchorDraft(anchorAppId);
      setRegisterDraft(anchorAppId);
    }
  }, [anchorAppId]);

  useEffect(() => () => {
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
  }, []);

  const anchorReady = anchorDraft.trim().length > 0 && anchorDraft.trim().length <= 64;
  const wholeNeoReady = /^[1-9]\d*$/.test(amountDraft.trim());
  const registered = anchorMode > 0;
  const unregistered = anchorMode === 0;
  const noAgents = registered && agentCount === 0;
  const hasPending = Boolean(pendingOperation);
  const busy = isLoading || submitting || Boolean(pulseAction);
  const writesBlocked = busy || hasPending || networkStatus === "mismatch" || storageStatus === "unavailable";
  const stakeBlockedByAgents = noAgents && !agentAcknowledged;
  const canStake = anchorReady && wholeNeoReady && registered && !stakeBlockedByAgents && !writesBlocked;
  const canWithdraw = anchorReady && wholeNeoReady && registered && hasPositiveAmount(userStake) && !writesBlocked;
  const canClaim = anchorReady && registered && hasPositiveAmount(pendingRewards) && !writesBlocked;
  const candidateCount = validCandidateCount(candidateDraft);
  const canRegister = registerDraft.trim().length > 0 && candidateCount === 21 && !writesBlocked;
  const creditAvailable = hasPositiveAmount(neoCredit) || hasPositiveAmount(gasCredit);

  const modeLabel = anchorMode === 2 ? t("modeProfit") : anchorMode === 1 ? t("modeTrust") : t("anchorMissing");
  const drawerModes: Array<{ mode: AnchorDrawerMode; label: string; meta: string; icon: ReactElement }> = [
    { mode: "settings", label: t("actionPanelLabel"), meta: t("anchorLaneStateReady"), icon: <Anchor size={15} aria-hidden="true" /> },
    { mode: "discover", label: t("discoverTitle"), meta: String(discoveredAnchors.length), icon: <Compass size={15} aria-hidden="true" /> },
    { mode: "register", label: t("registerPanelLabel"), meta: `${candidateCount}/21`, icon: <BadgeCheck size={15} aria-hidden="true" /> },
    { mode: "safety", label: t("docSafety"), meta: creditAvailable ? t("creditTitle") : workflowStatus, icon: <ShieldCheck size={15} aria-hidden="true" /> },
  ];
  const readinessLabel = useMemo(() => {
    if (hasPending) return t("pendingOperationActive");
    if (dataStatus === "unavailable") return t("anchorDataUnavailable");
    if (!anchorReady) return t("anchorLaneAnchorPending");
    if (!wholeNeoReady) return t("anchorLaneAmountPending");
    if (unregistered) return t("anchorNotRegisteredBadge");
    if (noAgents) return t("anchorLaneStateBlocked");
    if (registered) return t("anchorLaneStateReady");
    return t("anchorLaneStateDraft");
  }, [anchorReady, dataStatus, hasPending, noAgents, registered, t, unregistered, wholeNeoReady]);

  const runAction = (name: "stake" | "withdraw" | "claimRewards") => {
    if (name === "stake" && !canStake) return;
    if (name === "withdraw" && !canWithdraw) return;
    if (name === "claimRewards" && !canClaim) return;
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    setPulseAction(name);
    pulseTimeout.current = setTimeout(() => {
      setPulseAction(null);
      pulseTimeout.current = null;
    }, 950);
    const payload = { anchorAppId: anchorDraft.trim(), amount: normalizeWholeNeoAmount(amountDraft).trim() };
    void dispatch(name, payload);
  };

  const refresh = () => {
    void dispatch("refreshAnchor", { anchorAppId: anchorDraft.trim() });
  };

  const selectAnchor = (appId: string) => {
    setAnchorDraft(appId);
    setAgentAcknowledged(false);
    void dispatch("selectAnchor", appId);
  };

  const adjustStake = (delta: number) => {
    const next = Math.max(1, Math.floor(Number(normalizeWholeNeoAmount(amountDraft)) || 1) + delta);
    setAmountDraft(String(next));
  };

  const pendingLabel = pendingOperation
    ? t(`pendingStage_${pendingOperation.stage.replace(/-/g, "_")}`)
    : "";
  const pendingPrimary = pendingOperation?.phase === "prepared"
    ? { label: t("pendingContinue"), action: "resumePending" }
    : { label: t("pendingCheck"), action: "recoverPending" };

  const scene = (
    <div className="anchor-workspace" data-state={pulseAction ? "submitting" : noAgents ? "blocked" : registered ? "ready" : "draft"}>
      <section className="anchor-console" aria-label={t("actionPanelLabel")}>
        <div className="anchor-console__head">
          <span><Anchor size={16} />{t("anchorWorkspaceLabel")}</span>
          <strong>{readinessLabel}</strong>
        </div>

        {pendingOperation && (
          <div className="anchor-pending" role="status" data-phase={pendingOperation.phase}>
            <RefreshCw size={18} aria-hidden="true" />
            <div>
              <strong>{pendingLabel}</strong>
              <p>{t("pendingOperationBody")}</p>
              {pendingOperation.txid && <small>{compact(pendingOperation.txid)}</small>}
            </div>
            <span>{t(`pendingState_${pendingState}`)}</span>
          </div>
        )}

        <div className="anchor-console__mobile-art" aria-hidden="true">
          <img src={STAGE_IMAGE} alt="" />
          <span><Sparkles size={13} />{t("agentModel")}</span>
        </div>

        <div className="anchor-stake-console anchor-control-deck">
          <div className="anchor-pass-card" data-ready={anchorReady ? "true" : undefined}>
            <span className="anchor-pass-card__icon"><Anchor size={20} /></span>
            <div>
              <span>{t("anchorAppId")}</span>
              <strong>{compact(anchorDraft, t("anchorLaneAnchorPending"))}</strong>
              <em>{modeLabel}</em>
            </div>
          </div>

          <div className="anchor-stake-dial" data-ready={wholeNeoReady ? "true" : undefined}>
            <button type="button" aria-label="- 1 NEO" onClick={() => adjustStake(-1)} disabled={busy}>
              <span aria-hidden="true">-</span>
            </button>
            <div className="anchor-stake-dial__readout">
              <CoinArt size={38} variant="neo" />
              <span>{t("neoAmount")}</span>
              <strong>{wholeNeoReady ? amountDraft : t("anchorLaneAmountPending")}</strong>
              <em>NEO</em>
            </div>
            <button type="button" aria-label="+ 1 NEO" onClick={() => adjustStake(1)} disabled={busy}>
              <span aria-hidden="true">+</span>
            </button>
          </div>

          <div className="anchor-stake-presets" role="radiogroup" aria-label={t("neoAmount")}>
            {STAKE_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                role="radio"
                aria-checked={amountDraft === amount}
                className={amountDraft === amount ? "is-active" : undefined}
                onClick={() => setAmountDraft(amount)}
                disabled={busy}
              >
                <CoinArt size={16} variant="neo" decorative />
                {amount} NEO
              </button>
            ))}
          </div>
        </div>

        <div className="anchor-route" aria-label={t("anchorLaneAria")}>
          <div className="anchor-route__step" data-ready={anchorReady ? "true" : undefined}>
            <Anchor size={17} />
            <span>{t("anchorLaneAnchor")}</span>
            <strong>{compact(anchorDraft, t("anchorLaneAnchorPending"))}</strong>
          </div>
          <div className="anchor-route__step" data-ready={wholeNeoReady ? "true" : undefined}>
            <CoinArt size={19} variant="neo" />
            <span>{t("anchorLaneStepStake")}</span>
            <strong>{wholeNeoReady ? `${amountDraft} NEO` : t("anchorLaneAmountPending")}</strong>
          </div>
          <div className="anchor-route__step" data-ready={agentCount > 0 ? "true" : undefined}>
            <UsersRound size={17} />
            <span>{t("anchorLaneStepAgents")}</span>
            <strong>
              <PhaseValue
                phase={agentCount < 0 ? dataPhase : "ready"}
                placeholder={dataPlaceholder}
                skeletonWidth="3.2em"
              >
                {`${agentCount}/21`}
              </PhaseValue>
            </strong>
          </div>
          <div className="anchor-route__step" data-ready={hasPositiveAmount(pendingRewards) ? "true" : undefined}>
            <Coins size={17} />
            <span>{t("anchorLaneStepRewards")}</span>
            <strong>
              <PhaseValue
                phase={valuePhase(pendingRewards)}
                placeholder={valuePlaceholder(pendingRewards)}
                skeletonWidth="4em"
              >
                {`${pendingRewards} GAS`}
              </PhaseValue>
            </strong>
          </div>
        </div>

        {noAgents && (
          <div className="anchor-warning" role="status">
            <CircleAlert size={18} />
            <div>
              <strong>{t("noAgentsTitle")}</strong>
              <p>{t("noAgentsBody")}</p>
              <label className="anchor-confirm">
                <input
                  type="checkbox"
                  checked={agentAcknowledged}
                  onChange={(event) => setAgentAcknowledged(event.target.checked)}
                />
                <span>{agentAcknowledged ? t("noAgentsConfirmActive") : t("noAgentsConfirm")}</span>
              </label>
            </div>
          </div>
        )}

        {unregistered && (
          <div className="anchor-notice" role="status">
            <CircleAlert size={17} />
            <p>{t("anchorNotRegistered")}</p>
          </div>
        )}

        {lastError && (
          <div className="anchor-error" role="alert">
            <CircleAlert size={17} />
            <p>{lastError}</p>
          </div>
        )}

        <div className="anchor-insight">
          <ShieldCheck size={18} />
          <div>
            <strong>{t("whatIsAnchorTitle")}</strong>
            <p>{t("whatIsAnchorBody")}</p>
          </div>
        </div>
      </section>

      <section className="anchor-visual" aria-label={t("anchorLaneLabel")}>
        <div className="anchor-visual__media">
          <img className="anchor-visual__image" src={STAGE_IMAGE} alt="" aria-hidden="true" />
          {/* The chip names the model; the staked total is an addendum that only
            * exists once an anchor resolves. Suffixing it with a zero-state
            * phrase ("21-AGENT AA MODEL · PICK AN ANCHOR") reads as a broken
            * label, so the addendum simply drops until there is a number. */}
          <span className="anchor-visual__chip">
            <Sparkles size={14} />
            {t("agentModel")}
            {valuePhase(totalStaked) === "loading" ? (
              <> · <Skeleton width="4em" /></>
            ) : totalStaked ? (
              <> · {`${totalStaked} NEO`}</>
            ) : null}
          </span>
        </div>
        <div className="anchor-visual__stats">
          <div>
            <span>{t("userStake")}</span>
            <strong>
              <PhaseValue
                phase={valuePhase(userStake)}
                placeholder={valuePlaceholder(userStake)}
                skeletonWidth="4em"
              >
                {`${userStake} NEO`}
              </PhaseValue>
            </strong>
          </div>
          <div>
            <span>{t("rewardReserve")}</span>
            <strong>
              <PhaseValue
                phase={valuePhase(rewardReserve)}
                placeholder={valuePlaceholder(rewardReserve)}
                skeletonWidth="4em"
              >
                {`${rewardReserve} GAS`}
              </PhaseValue>
            </strong>
          </div>
          <div>
            <span>{t("rewardPerNeoLabel")}</span>
            <strong>
              <PhaseValue
                phase={valuePhase(rewardPerNeo)}
                placeholder={valuePlaceholder(rewardPerNeo)}
                skeletonWidth="4em"
              >
                {rewardPerNeo}
              </PhaseValue>
            </strong>
          </div>
        </div>
      </section>
    </div>
  );

  const drawer = (
    <div className="anchor-drawer" data-mode={drawerMode}>
      <div className="anchor-drawer-tabs" role="tablist" aria-label={t("discoverLabel")}>
        {drawerModes.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : undefined}
            onClick={() => setDrawerMode(item.mode)}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {drawerMode === "settings" && (
        <OpenUiPanel
          className="anchor-drawer__panel anchor-drawer__panel--settings"
          icon={<Anchor size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("actionPanelLabel")}
          subtitle={readinessLabel}
        >
          <div className="anchor-settings-grid">
            <OpenUiTextField
              className="anchor-field anchor-field--id"
              inputClassName="anchor-input anchor-input--id"
              label={t("anchorAppId")}
              value={anchorDraft}
              onChange={(event) => {
                setAnchorDraft(event.target.value);
                setAgentAcknowledged(false);
              }}
              placeholder="custom-anchor:team:nonce"
              spellCheck={false}
              mono
            />
            <OpenUiTextField
              className="anchor-field anchor-field--amount"
              inputClassName="anchor-input anchor-input--amount"
              label={t("neoAmount")}
              value={amountDraft}
              onChange={(event) => setAmountDraft(normalizeWholeNeoAmount(event.target.value))}
              placeholder="1"
              inputMode="numeric"
              pattern="[0-9]*"
              hint={t("invalidAmount")}
            />
          </div>
          <div className="anchor-drawer__summary">
            <span>{t("userStake")} <strong>
              <PhaseValue phase={valuePhase(userStake)} placeholder={valuePlaceholder(userStake)} skeletonWidth="4em">
                {`${userStake} NEO`}
              </PhaseValue>
            </strong></span>
            <span>{t("pendingRewards")} <strong>
              <PhaseValue phase={valuePhase(pendingRewards)} placeholder={valuePlaceholder(pendingRewards)} skeletonWidth="4em">
                {`${pendingRewards} GAS`}
              </PhaseValue>
            </strong></span>
            <span>{t("agentCount")} <strong>
              <PhaseValue phase={agentCount < 0 ? dataPhase : "ready"} placeholder={dataPlaceholder} skeletonWidth="3.2em">
                {`${agentCount}/21`}
              </PhaseValue>
            </strong></span>
          </div>
          <div className="anchor-drawer__action-strip">
            <button type="button" onClick={refresh} disabled={busy}>
              <RefreshCw size={14} aria-hidden="true" />
              {t("refreshStatus")}
            </button>
          </div>
        </OpenUiPanel>
      )}

      {drawerMode === "discover" && (
        <OpenUiPanel
          className="anchor-drawer__panel anchor-drawer__panel--discover"
          icon={<Compass size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("discoverTitle")}
          subtitle={`${discoveredAnchors.length}`}
        >
          <div className="anchor-drawer__action-strip anchor-drawer__action-strip--top">
            <button type="button" onClick={() => void dispatch("discoverAnchors")} disabled={busy}>
              <RefreshCw size={14} aria-hidden="true" />
              {t("discoverRefresh")}
            </button>
          </div>
          {discoveredAnchors.length > 0 ? (
            <ul className="anchor-list">
              {discoveredAnchors.slice(0, 8).map((anchor) => (
                <li key={anchor.appId} className="anchor-list__item">
                  <span>
                    <strong>{compact(anchor.appId)}</strong>
                    <em>{anchor.mode === 2 ? t("modeProfit") : t("modeTrust")}</em>
                  </span>
                  <button type="button" onClick={() => selectAnchor(anchor.appId)}>{t("discoverUse")}</button>
                </li>
              ))}
            </ul>
          ) : (
            <OpenUiNotice className="anchor-drawer__empty" icon={<Compass size={17} aria-hidden="true" />} title={t("discoverEmpty")}>
              {t("onboardBrowse")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>
      )}

      {drawerMode === "register" && (
        <OpenUiPanel
          className="anchor-drawer__panel anchor-drawer__panel--register"
          icon={<BadgeCheck size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("registerPanelTitle")}
          subtitle={`${candidateCount}/21`}
        >
          <OpenUiNotice className="anchor-drawer__notice" icon={<BadgeCheck size={17} aria-hidden="true" />} title={t("registerPanelLabel")}>
            {t("registerPanelBody")}
          </OpenUiNotice>
          <div className="anchor-register">
            <OpenUiTextField
              className="anchor-field"
              inputClassName="anchor-input"
              label={t("registerAnchorAppId")}
              value={registerDraft}
              onChange={(event) => setRegisterDraft(event.target.value)}
              placeholder="custom-anchor:team:nonce"
              spellCheck={false}
              mono
            />
            <OpenUiSegmented
              className="anchor-mode"
              label={t("registerPanelLabel")}
              value={String(registerMode)}
              onChange={(value) => setRegisterMode(value === "1" ? 1 : 2)}
              options={[
                { value: "1", label: t("registerModeTrust") },
                { value: "2", label: t("registerModeProfit") },
              ]}
            />
            <p className="anchor-mode-hint">{registerMode === 1 ? t("registerModeTrustDesc") : t("registerModeProfitDesc")}</p>
            <OpenUiTextArea
              className="anchor-field anchor-field--candidates"
              textareaClassName="anchor-candidates-input"
              label={t("registerCandidatesLabel")}
              value={candidateDraft}
              onChange={(event) => setCandidateDraft(event.target.value)}
              placeholder={t("registerCandidatesPlaceholder")}
              rows={4}
              hint={t("registerCandidatesHint")}
            />
            <div className="anchor-register__foot">
              <span>{t("registerCandidatesCount", { count: candidateCount })}</span>
              <button
                type="button"
                disabled={!canRegister}
                onClick={() => void dispatch("register", { anchorAppId: registerDraft.trim(), mode: registerMode, candidates: candidateDraft })}
              >
                {t("registerAction")}
              </button>
            </div>
          </div>
        </OpenUiPanel>
      )}

      {drawerMode === "safety" && (
        <OpenUiPanel
          className="anchor-drawer__panel anchor-drawer__panel--safety"
          icon={<ShieldCheck size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("docSafety")}
          subtitle={workflowStatus}
        >
          <OpenUiNotice className="anchor-drawer__notice" icon={<ShieldCheck size={17} aria-hidden="true" />} title={t("safetyRail")}>
            {t("docSafetyBody")}
          </OpenUiNotice>
          {creditStatus === "ready" && creditAvailable && (
            <div className="anchor-credit-card">
              <span><WalletCards size={15} />{t("creditTitle")}</span>
              <p>{t("creditBody")}</p>
              <div className="anchor-credit">
                <span>{t("creditNeo")}: <strong>{neoCredit}</strong></span>
                <button type="button" onClick={() => void dispatch("recoverCredit", "NEO")} disabled={!hasPositiveAmount(neoCredit) || writesBlocked}>{t("recoverNeo")}</button>
                <span>{t("creditGas")}: <strong>{gasCredit}</strong></span>
                <button type="button" onClick={() => void dispatch("recoverCredit", "GAS")} disabled={!hasPositiveAmount(gasCredit) || writesBlocked}>{t("recoverGas")}</button>
              </div>
            </div>
          )}
          {creditStatus !== "ready" && (
            <OpenUiNotice
              className="anchor-credit-unavailable"
              icon={<WalletCards size={17} aria-hidden="true" />}
              title={t("creditUnavailableTitle")}
              type="warning"
            >
              {creditStatus === "disconnected" ? t("creditDisconnectedBody") : t("creditUnavailableBody")}
            </OpenUiNotice>
          )}
          <div className="anchor-context-grid">
            <span>{t("networkBindingLabel")}<strong>{t(`networkState_${networkStatus}`)}</strong></span>
            <span>{t("recoveryStorageLabel")}<strong>{t(`storageState_${storageStatus}`)}</strong></span>
          </div>
          <p className="anchor-drawer-status" role="status">{workflowStatus}</p>
          {lastTxid && <p className="anchor-tx">{t("lastTxid")}: {compact(lastTxid)}</p>}
          {pendingOperation?.phase === "attempted" && !pendingOperation.txid && (
            <div className="anchor-drawer__action-strip anchor-drawer__action-strip--recovery">
              <button type="button" onClick={() => void dispatch("clearUnbroadcastPending")} disabled={busy}>
                {t("pendingClearRejected")}
              </button>
            </div>
          )}
          {errorDetail && <p className="anchor-error-detail">{errorDetail}</p>}
        </OpenUiPanel>
      )}
    </div>
  );

  return (
    <div className="custom-anchor-play-area mx2 mx2-cat-defi">
      <OpenUiProvider>
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("civicEyebrow"),
            title: t("title"),
            subtitle: t("subtitle"),
            badges: (
              <>
                <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" />{modeLabel}</span>
                {/* The agent-count badge only means something once an anchor is
                  * chosen. Before that the header already says "Waiting for
                  * anchor" — a second badge reading "Pick an anchor Agents"
                  * would be noise, not information. */}
                {agentCount >= 0 ? (
                  <span className="mx2-badge">{`${agentCount}/21`} {t("agentCount")}</span>
                ) : dataPhase === "loading" ? (
                  <span className="mx2-badge"><Skeleton width="4.5em" /></span>
                ) : null}
              </>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: hasPending
                ? pendingPrimary.label
                : submitting || pulseAction === "stake" ? t("stakeSubmitting") : t("stakeAction"),
              onClick: hasPending
                ? () => void dispatch(pendingPrimary.action)
                : () => runAction("stake"),
              loading: submitting || (!hasPending && pulseAction === "stake"),
              disabled: hasPending ? busy || pendingState === "corrupted" : !canStake,
              icon: hasPending ? <RefreshCw size={17} /> : <LockKeyhole size={17} />,
            },
            secondary: hasPending ? [] : [
              {
                label: t("withdrawAction"),
                onClick: () => runAction("withdraw"),
                loading: pulseAction === "withdraw",
                disabled: !canWithdraw,
                icon: <RefreshCw size={16} />,
              },
              {
                label: t("claimAction"),
                onClick: () => runAction("claimRewards"),
                loading: pulseAction === "claimRewards",
                disabled: !canClaim,
                icon: <Coins size={16} />,
              },
            ],
          }}
          drawerToggleLabel={t("discoverLabel")}
          drawer={{ title: t("discoverLabel"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
