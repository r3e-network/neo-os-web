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
  const displayedTx = lastTxid ? truncate(lastTxid) : t("notAvailable");

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
      <section className="custom-anchor-hero">
        <div>
          <span className="custom-anchor-kicker">{t("title")}</span>
          <h2>{anchorAppId ? t("readyForAnchor") : t("noAnchorTitle")}</h2>
          <p>{anchorAppId ? truncate(anchorAppId) : t("noAnchorBody")}</p>
        </div>
        <div className="custom-anchor-orbit" aria-hidden="true">
          <span>21</span>
          <small>AA</small>
        </div>
      </section>

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
      </div>

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
              className="custom-anchor-button custom-anchor-button--success"
              disabled={actionDisabled}
              onClick={(event) => runAction(event, "claimRewards")}
            >
              {busyAction === "claimRewards" ? t("submitting") : t("claimAction")}
            </button>
            <button
              type="button"
              className="custom-anchor-button custom-anchor-button--ghost"
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

      <section className="custom-anchor-workspace" aria-label={t("anchorWorkspaceTitle")}>
        <div className="custom-anchor-status-card">
          <div className="custom-anchor-section-head">
            <span>{t("anchorWorkspaceLabel")}</span>
            <h3>{t("anchorWorkspaceTitle")}</h3>
            <p>{t("anchorWorkspaceBody")}</p>
          </div>

          <div className="custom-anchor-flow" aria-label={t("anchorFlowTitle")}>
            <div>
              <span className="custom-anchor-flow__number">01</span>
              <strong>{t("anchorFlowOpen")}</strong>
            </div>
            <div>
              <span className="custom-anchor-flow__number">02</span>
              <strong>{t("anchorFlowAction")}</strong>
            </div>
            <div>
              <span className="custom-anchor-flow__number">03</span>
              <strong>{t("anchorFlowSign")}</strong>
            </div>
          </div>

          <div className="custom-anchor-guidance-grid">
            <div>
              <span>{t("userRoute")}</span>
              <strong>{t("userRouteBody")}</strong>
            </div>
            <div>
              <span>{t("adminRoute")}</span>
              <strong>{t("adminRouteBody")}</strong>
            </div>
            <div>
              <span>{t("safetyRail")}</span>
              <strong>{t("safetyRailBody")}</strong>
            </div>
          </div>
        </div>

        <aside className="custom-anchor-id-card" aria-label={t("anchorStatus")}>
          <span>{t("launchSource")}</span>
          <strong>{displayedAnchor}</strong>
          <dl>
            <div>
              <dt>{t("anchorStatus")}</dt>
              <dd>{anchorStatus}</dd>
            </div>
            <div>
              <dt>{t("agentCount")}</dt>
              <dd>{agentCount || 21}</dd>
            </div>
            <div>
              <dt>{t("lastTxid")}</dt>
              <dd>{displayedTx}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <details className="custom-anchor-model" open>
        <summary>{t("routingDetails")}</summary>
        <div className="custom-anchor-model__body">
          <p>{t("agentModelBody")}</p>
        </div>
        <dl>
          <div>
            <dt>{t("totalStaked")}</dt>
            <dd>{str("totalStaked")} NEO</dd>
          </div>
          <div>
            <dt>{t("agentCount")}</dt>
            <dd>{agentCount || 21}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
