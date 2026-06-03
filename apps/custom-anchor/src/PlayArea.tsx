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

export default function PlayArea({ t, state, status, dispatch }: PlayAreaProps) {
  const { str, num, bool } = useStateBindings(state);
  const anchorAppId = str("anchorAppId");
  const isLoading = bool("isLoading");
  const agentCount = num("agentCount");
  const lastTxid = str("lastTxid");
  const workflowStatus = str("workflowStatus", t("workflowReady"));
  const lastError = str("lastError");
  const anchorStatus = anchorAppId ? t("anchorLinked") : t("anchorMissing");
  const displayedAnchor = anchorAppId ? truncate(anchorAppId) : t("anchorAwaitingLaunch");
  const displayedTx = lastTxid ? truncate(lastTxid) : "—";

  const [anchorInput, setAnchorInput] = useState(anchorAppId || "custom-anchor:team:nonce");
  const [amountInput, setAmountInput] = useState("1");
  const [busyAction, setBusyAction] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (anchorAppId && anchorAppId !== anchorInput) setAnchorInput(anchorAppId);
    // Only sync fresh launch/read state into the form. User edits should stay editable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorAppId]);

  const anchorInputValid = useMemo(() => isValidAnchorId(anchorInput), [anchorInput]);
  const amountValid = useMemo(() => isPositiveWholeNeo(amountInput), [amountInput]);
  const actionDisabled = isLoading || Boolean(busyAction) || !anchorInputValid;
  const amountActionDisabled = actionDisabled || !amountValid;
  const statusText = formError || lastError || status?.msg || workflowStatus;

  const runAction = async (
    event: SyntheticEvent,
    action: "stake" | "withdraw" | "claimRewards" | "refreshAnchor",
  ) => {
    event.preventDefault();
    setFormError("");
    if (!anchorInputValid) {
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
              {t("agentCount")}: <strong>{agentCount || 21}</strong>
            </span>
            <span>
              {t("lastTxid")}: <strong>{displayedTx}</strong>
            </span>
          </div>
        </div>
        <div className="custom-anchor-orbit" aria-hidden="true">
          <span>{agentCount || 21}</span>
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
              disabled={amountActionDisabled}
            >
              {busyAction === "stake" ? t("submitting") : t("stakeAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={amountActionDisabled}
              onClick={(event) => runAction(event, "withdraw")}
            >
              {busyAction === "withdraw" ? t("submitting") : t("withdrawAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={actionDisabled}
              onClick={(event) => runAction(event, "claimRewards")}
            >
              {busyAction === "claimRewards" ? t("submitting") : t("claimAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button"
              disabled={actionDisabled}
              onClick={(event) => runAction(event, "refreshAnchor")}
            >
              {busyAction === "refreshAnchor" ? t("submitting") : t("refreshStatus")}
            </button>
          </div>
        </form>

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
