import { useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import "./PlayArea.scss";

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

export default function PlayArea({ t, state, status, dispatch }: PlayAreaProps) {
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
  const discoveredAnchors = val<DiscoveredAnchor[]>("discoveredAnchors") ?? [];
  const anchorLinked = Boolean(anchorAppId);
  const anchorNotRegistered = anchorLinked && anchorMode === 0;
  const anchorStatus = !anchorLinked
    ? t("anchorMissing")
    : anchorNotRegistered
      ? t("anchorNotRegisteredBadge")
      : t("anchorLinked");
  const displayedAnchor = anchorAppId ? truncate(anchorAppId) : t("anchorAwaitingLaunch");
  const displayedTx = lastTxid ? truncate(lastTxid) : "—";
  // Show the real on-chain agent count (0 is a valid value for an unconfigured anchor).
  // Only fall back to a neutral placeholder before an anchor is linked, never mask a real 0.
  const displayedAgentCount = anchorLinked && !anchorNotRegistered ? String(agentCount) : "—";
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
  const [busyAction, setBusyAction] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (anchorAppId && anchorAppId !== anchorInput) setAnchorInput(anchorAppId);
    // Only sync fresh launch/read state into the form. User edits should stay editable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorAppId]);

  const anchorInputValid = useMemo(() => isValidAnchorId(anchorInput), [anchorInput]);
  const amountValid = useMemo(() => isPositiveWholeNeo(amountInput), [amountInput]);
  // Redeem / claim / refresh use the contract's looser id rule (1-64 chars) so a
  // script-registered anchor stays reachable for reclaiming staked NEO; only a
  // NEW stake requires the strict slug:nonce shape.
  const looseAnchorValid = useMemo(() => {
    const v = anchorInput.trim();
    return v.length >= 1 && v.length <= 64;
  }, [anchorInput]);
  const busy = isLoading || Boolean(busyAction);
  // Stake mints into an anchor (strict shape); other actions accept any valid id.
  const stakeDisabled = busy || !anchorInputValid || !amountValid;
  const redeemDisabled = busy || !looseAnchorValid || !amountValid;
  const looseActionDisabled = busy || !looseAnchorValid;
  const statusText = formError || lastError || status?.msg || workflowStatus;

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
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction("");
    }
  };

  const registerInputValid = useMemo(() => isValidAnchorId(registerInput), [registerInput]);

  const handleRegister = async (event: SyntheticEvent) => {
    event.preventDefault();
    setFormError("");
    if (!registerInputValid) {
      setFormError(t("invalidAnchorId"));
      return;
    }
    setBusyAction("register");
    try {
      await dispatch("register", { anchorAppId: registerInput.trim(), mode: registerMode });
      setAnchorInput(registerInput.trim());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
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
      setFormError(error instanceof Error ? error.message : String(error));
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
      setFormError(error instanceof Error ? error.message : String(error));
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
      {/* Hero — headline state plus the few facts that matter (anchor id, status, agents, last tx) folded inline */}
      <section className="custom-anchor-hero">
        <div className="custom-anchor-hero__body">
          <span className="custom-anchor-kicker">{t("title")}</span>
          <h2>{anchorAppId ? t("readyForAnchor") : t("noAnchorTitle")}</h2>
          <p>{anchorAppId ? truncate(anchorAppId) : t("noAnchorBody")}</p>
          <div className="custom-anchor-hero__facts">
            <span>
              {t("anchorStatus")}: <strong>{anchorStatus}</strong>
            </span>
            <span>
              {t("agentCount")}: <strong>{displayedAgentCount}</strong>
            </span>
            <span>
              {t("lastTxid")}: <strong>{displayedTx}</strong>
            </span>
          </div>
        </div>
        <div className="custom-anchor-orbit" aria-hidden="true">
          <span>{displayedAgentCount}</span>
          <small>AA</small>
        </div>
      </section>

      {/* Primary action — surfaced immediately after the hero */}
      <section className="custom-anchor-action-panel" aria-label={t("actionPanelTitle")}>
        <div className="custom-anchor-section-head">
          <span>{t("actionPanelLabel")}</span>
          <h3>{t("actionPanelTitle")}</h3>
          <p>{t("actionPanelBody")}</p>
        </div>

        <form className="custom-anchor-form" onSubmit={(event) => runAction(event, "stake")}>
          <label>
            <span>{t("anchorAppId")}</span>
            <input
              value={anchorInput}
              onChange={(event) => setAnchorInput(event.currentTarget.value)}
              placeholder="custom-anchor:team:nonce"
              autoComplete="off"
              aria-invalid={!anchorInputValid}
            />
          </label>
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
          <div className="custom-anchor-action-grid">
            <button
              type="submit"
              className="custom-anchor-button custom-anchor-button--primary"
              disabled={stakeDisabled}
            >
              {busyAction === "stake" ? t("submitting") : t("stakeAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={redeemDisabled}
              onClick={(event) => runAction(event, "withdraw")}
            >
              {busyAction === "withdraw" ? t("submitting") : t("withdrawAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={looseActionDisabled}
              onClick={(event) => runAction(event, "claimRewards")}
            >
              {busyAction === "claimRewards" ? t("submitting") : t("claimAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={looseActionDisabled}
              onClick={(event) => runAction(event, "refreshAnchor")}
            >
              {busyAction === "refreshAnchor" ? t("submitting") : t("refreshStatus")}
            </button>
          </div>
        </form>

        {anchorNotRegistered && (
          <div className="custom-anchor-status-strip error" role="status">
            <span>{t("anchorNotRegistered")}</span>
          </div>
        )}

        <div className={`custom-anchor-status-strip${formError || lastError ? " error" : ""}`}>
          <span>{statusText}</span>
        </div>
      </section>

      {/* Carded metrics group — tiles wrapped so they stay off the viewport edge, consistent with the rest of the suite */}
      <section className="custom-anchor-metrics-card" aria-label={t("totalStaked")}>
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

      {/* Stranded contract-credit recovery — shown only when there is something to reclaim. */}
      {hasAnyCredit && (
        <section className="custom-anchor-credit-card" aria-label={t("creditTitle")}>
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
                  {busyAction === "recover-NEO" ? t("submitting") : t("recoverNeo")}
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
                  {busyAction === "recover-GAS" ? t("submitting") : t("recoverGas")}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Anchor discovery — browse registered anchors and use one. */}
      <details className="custom-anchor-discover">
        <summary>{t("discoverTitle")}</summary>
        <div className="custom-anchor-discover__body">
          <div className="custom-anchor-discover__head">
            <span>{t("discoverLabel")}</span>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={busy}
              onClick={handleDiscover}
            >
              {busyAction === "discoverAnchors" ? t("submitting") : t("discoverRefresh")}
            </button>
          </div>
          {discoveredAnchors.length === 0 ? (
            <p className="custom-anchor-discover__empty">{t("discoverEmpty")}</p>
          ) : (
            <ul className="custom-anchor-discover__list">
              {discoveredAnchors.map((entry) => (
                <li key={entry.appId}>
                  <span className="custom-anchor-discover__id">{truncate(entry.appId)}</span>
                  <span className="custom-anchor-discover__mode">
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
      <details className="custom-anchor-register">
        <summary>{t("registerPanelTitle")}</summary>
        <div className="custom-anchor-register__body">
          <div className="custom-anchor-section-head">
            <span>{t("registerPanelLabel")}</span>
            <p>{t("registerPanelBody")}</p>
          </div>
          <form className="custom-anchor-form" onSubmit={handleRegister}>
            <label>
              <span>{t("registerAnchorAppId")}</span>
              <input
                value={registerInput}
                onChange={(event) => setRegisterInput(event.currentTarget.value)}
                placeholder="custom-anchor:team:nonce"
                autoComplete="off"
                aria-invalid={registerInput.length > 0 && !registerInputValid}
              />
            </label>
            <div className="custom-anchor-mode-toggle" role="radiogroup" aria-label={t("registerPanelTitle")}>
              <button
                type="button"
                role="radio"
                aria-checked={registerMode === 1}
                className={`custom-anchor-mode${registerMode === 1 ? " active" : ""}`}
                onClick={() => setRegisterMode(1)}
              >
                {t("registerModeTrust")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={registerMode === 2}
                className={`custom-anchor-mode${registerMode === 2 ? " active" : ""}`}
                onClick={() => setRegisterMode(2)}
              >
                {t("registerModeProfit")}
              </button>
            </div>
            <button
              type="submit"
              className="custom-anchor-button custom-anchor-button--primary"
              disabled={busy || !registerInputValid}
            >
              {busyAction === "register" ? t("submitting") : t("registerAction")}
            </button>
          </form>
          <p className="custom-anchor-register__note">{t("registerAgentsNote")}</p>
        </div>
      </details>

      {/* Routing model — expanded by default; launch source folded into the metadata row */}
      <details className="custom-anchor-model" open>
        <summary>{t("routingDetails")}</summary>
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
