import { useState } from "react";
import {
  ArrowRight,
  Fuel,
  Gauge,
  Gift,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import GasTank from "./pages/index/components/GasTank";
import RequestGasCard from "./pages/index/components/RequestGasCard";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);

  const userAddress = str("userAddress");
  const isConnected = userAddress.trim().length > 0;
  const gasBalance = str("gasBalance", "0");
  const gasBalanceDisplay = str("gasBalanceDisplay", "0.0000");
  const chainGasBalanceDisplay = str("chainGasBalanceDisplay", "0.0000");
  // Defaults to available unless the state explicitly reports otherwise.
  const serviceAvailable = state.serviceAvailable
    ? bool("serviceAvailable")
    : true;
  const serviceNotice = str("serviceNotice");
  const isEligible = bool("isEligible");
  const fuelLevelPercent = num("fuelLevelPercent");
  const remainingQuota = num("remainingQuota");
  const remainingQuotaDisplay = str("remainingQuotaDisplay", "0");
  const isRequesting = bool("isRequesting");
  const requestAmount = str("requestAmount", "0.01");
  const maxRequestAmount = num("maxRequestAmount", 0.1);
  const quickAmounts = (state.quickAmounts?.get() ?? [
    0.005, 0.01, 0.02, 0.05,
  ]) as number[];
  const loading = bool("loading");
  const usedQuota = num("usedQuota");
  const dailyLimit = num("dailyLimit");
  const quotaPercent = num("quotaPercent");
  const resetTime = str("resetTime");
  const donateAmount = str("donateAmount", "0");
  const sendAmount = str("sendAmount", "0");
  const recipientAddress = str("recipientAddress");
  const isDonating = bool("isDonating");
  const isSending = bool("isSending");
  const isFunded = bool("isFunded");
  const donateAmountValid = bool("donateAmountValid");
  const recipientValid = bool("recipientValid");
  const sendAmountValid = bool("sendAmountValid");
  const canSend = bool("canSend");
  const tankLevelDisplay = str("tankLevelDisplay", "0%");
  const poolAddress = str("poolAddress");
  const refillState = !serviceAvailable
    ? "offline"
    : !isConnected
      ? "wallet"
      : !isEligible || remainingQuota <= 0
        ? "blocked"
        : isRequesting
          ? "requesting"
          : "ready";

  // Track "touched" from real user interaction — never infer it from a
  // pre-filled default value (which would open the form already showing an
  // error for a wallet holding under the default amount).
  const [donateTouched, setDonateTouched] = useState(false);
  const [sendTouched, setSendTouched] = useState(false);
  const recipientTouched = recipientAddress.length > 0;

  // Field-level error copy, only shown once the user has typed something so the
  // forms don't open in an error state. Mirrors the composable's guards exactly.
  const donateError =
    donateTouched && !donateAmountValid ? t("donateInvalid") : "";
  const recipientError =
    recipientTouched && !recipientValid ? t("invalidAddress") : "";
  const sendAmountError =
    sendTouched && !sendAmountValid ? t("sendAmountInvalid") : "";

  return (
    <div className="gas-sponsor-play-area">
      <section className="gas-refill-hero" aria-label={t("title")}>
        <div className="gas-refill-hero__copy">
          <span className="gas-eyebrow">
            <Fuel size={15} aria-hidden="true" />
            {t("sponsorLane")}
          </span>
          <h2>{t("title")}</h2>
          <p>{serviceAvailable ? t("subtitle") : t("subtitleOffline")}</p>
          <div className="gas-hero-status" aria-label={t("statusSnapshot")}>
            <span
              className={
                isConnected
                  ? "gas-status-pill gas-status-pill--ready"
                  : "gas-status-pill"
              }
            >
              <WalletCards size={15} aria-hidden="true" />
              {isConnected ? t("walletReady") : t("walletNeeded")}
            </span>
            <span
              className={
                isEligible
                  ? "gas-status-pill gas-status-pill--ready"
                  : "gas-status-pill"
              }
            >
              <ShieldCheck size={15} aria-hidden="true" />
              {isEligible ? t("eligible") : t("notEligible")}
            </span>
          </div>
        </div>
        <div className="gas-refill-hero__media" aria-hidden="true">
          <img src="./gas-sponsor-refill-station.jpg" alt="" />
          <div className="gas-refill-hero__station-card">
            <span>{t("stationCardLabel")}</span>
            <strong>
              {remainingQuotaDisplay} {t("tokenGas")}
            </strong>
            <small>{t("stationCardCopy")}</small>
          </div>
        </div>
      </section>

      <section
        className={`gas-command-deck gas-command-deck--${refillState}`}
        aria-label={t("requestGas")}
      >
        <div className="gas-refill-pipeline" aria-hidden="true">
          <span className="gas-refill-pipeline__track" />
          <span className="gas-refill-pipeline__packet gas-refill-pipeline__packet--one" />
          <span className="gas-refill-pipeline__packet gas-refill-pipeline__packet--two" />
          <span className="gas-refill-pipeline__packet gas-refill-pipeline__packet--three" />
        </div>
        <div className="gas-tank-panel">
          <GasTank
            fuelLevelPercent={fuelLevelPercent}
            gasBalance={gasBalance}
            tankLevelDisplay={tankLevelDisplay}
            isEligible={isEligible}
            isConnected={isConnected}
            t={t}
          />
          <div className="gas-meter-list">
            <div className="gas-meter-item">
              <span>{t("gasBalance")}</span>
              <strong>{gasBalanceDisplay}</strong>
            </div>
            <div className="gas-meter-item">
              <span>{t("sidebarTankLevel")}</span>
              <strong>{tankLevelDisplay}</strong>
            </div>
            <div className="gas-meter-item">
              <span>{t("remaining")}</span>
              <strong>{remainingQuotaDisplay}</strong>
            </div>
          </div>
        </div>

        <div className="gas-request-panel">
          <div className="gas-request-panel__head">
            <span className="gas-request-panel__icon">
              <Gauge size={20} aria-hidden="true" />
            </span>
            <div>
              <h3>{t("gasPumpReadyTitle")}</h3>
              <p>{t("gasPumpReadyDesc")}</p>
            </div>
          </div>
          <RequestGasCard
            serviceAvailable={serviceAvailable}
            serviceNotice={serviceNotice}
            isConnected={isConnected}
            isEligible={isEligible}
            remainingQuota={remainingQuota}
            requestAmount={requestAmount}
            maxRequestAmount={String(maxRequestAmount)}
            isRequesting={isRequesting}
            quickAmounts={quickAmounts}
            onRequestAmountChange={(val: string) =>
              state.requestAmount?.set(val)
            }
            onRequest={() => dispatch("requestSponsorship", requestAmount)}
            t={t}
          />
          {serviceAvailable && (
            <div className="quota-info">
              <div className="quota-info__head">
                <span>{t("dailyQuota")}</span>
                <strong>
                  {usedQuota} / {dailyLimit}
                </strong>
              </div>
              <div className="quota-bar-container">
                <div
                  className="quota-bar"
                  style={{ width: `${Math.min(quotaPercent, 100)}%` }}
                />
              </div>
              <div className="quota-details">
                <span className="quota-text">
                  <span className="quota-text-label">{t("remaining")}</span>
                  <span className="quota-text-value">
                    {remainingQuotaDisplay} {t("tokenGas")}
                  </span>
                </span>
                <span className="quota-reset">
                  <span className="quota-reset-label">{t("resetsAt")}</span>
                  <span className="quota-reset-value">{resetTime || "—"}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Service-state notice — honest banner when the sponsorship API is down */}
      {!serviceAvailable && serviceNotice && (
        <div className="gas-service-notice" role="status">
          <span className="gas-service-notice-title">
            {t("sponsorServiceTitle")}
          </span>
          <span className="gas-service-notice-desc">{serviceNotice}</span>
        </div>
      )}

      <section className="gas-route-strip" aria-label={t("howItWorks")}>
        <div className="gas-route-step">
          <WalletCards size={18} aria-hidden="true" />
          <span>{t("routeConnect")}</span>
        </div>
        <ArrowRight size={16} aria-hidden="true" className="gas-route-arrow" />
        <div className="gas-route-step">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{t("routeCheck")}</span>
        </div>
        <ArrowRight size={16} aria-hidden="true" className="gas-route-arrow" />
        <div className="gas-route-step">
          <Fuel size={18} aria-hidden="true" />
          <span>{t("routeFuel")}</span>
        </div>
      </section>

      {/* Pay it forward — Donate & Send move GAS the wallet already holds, so
          they only work for a funded wallet. The app's target user is an
          eligible, low-balance wallet; showing two live transfer forms they
          can't use (they'd fail at the chain) dilutes the "get free GAS" flow.
          Gate them behind a funded balance and frame them as helping others. */}
      <NeoCard title={t("payItForward")}>
        {!isFunded ? (
          <div className="pay-forward-empty">
            <span className="pay-forward-empty-icon" aria-hidden="true">
              <Gift size={28} />
            </span>
            <span className="pay-forward-empty-title">
              {t("payForwardLockedTitle")}
            </span>
            <span className="pay-forward-empty-desc">
              {t("payForwardLockedDesc")}
            </span>
          </div>
        ) : (
          <div className="pay-forward">
            <div className="pay-forward__intro">
              <span className="pay-forward__mark" aria-hidden="true">
                <Gift size={22} />
              </span>
              <div>
                <p>{t("payForwardLead")}</p>
                <strong>
                  {t("balanceAvailable", { amount: chainGasBalanceDisplay })}
                </strong>
              </div>
            </div>

            <div className="pay-forward-actions">
              {/* Donate */}
              <section className="pay-forward-card pay-forward-card--pool">
                <header className="pay-forward-card__head">
                  <span className="pay-forward-card__icon" aria-hidden="true">
                    <Gift size={18} />
                  </span>
                  <div>
                    <span className="pay-forward-section-label">
                      {t("donate")}
                    </span>
                    <p>{t("donateSubtitle")}</p>
                  </div>
                </header>
                {poolAddress && (
                  <div className="pool-address">
                    <span>{t("poolAddressLabel")}</span>
                    <code>{poolAddress}</code>
                  </div>
                )}
                <NeoInput
                  value={donateAmount}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  label={t("donateAmount")}
                  placeholder={t("donateAmountPlaceholder")}
                  suffix={t("tokenGas")}
                  hint={t("balanceAvailable", { amount: chainGasBalanceDisplay })}
                  error={donateError}
                  onChange={(val) => {
                    setDonateTouched(true);
                    state.donateAmount?.set(val);
                  }}
                />
                <p className="pay-forward-card__note">{t("donateLoopNote")}</p>
                <NeoButton
                  variant="success"
                  block
                  loading={isDonating}
                  disabled={loading || !donateAmountValid}
                  aria-label={t("donateAction")}
                  onClick={() => dispatch("donate", donateAmount)}
                >
                  {isDonating ? t("donating") : t("donateAction")}
                </NeoButton>
              </section>

              {/* Send GAS */}
              <section className="pay-forward-card pay-forward-card--wallet">
                <header className="pay-forward-card__head">
                  <span className="pay-forward-card__icon" aria-hidden="true">
                    <Send size={18} />
                  </span>
                  <div>
                    <span className="pay-forward-section-label">
                      {t("sendGas")}
                    </span>
                    <p>{t("sendSubtitle")}</p>
                  </div>
                </header>
                <div className="pay-forward-card__fields">
                  <NeoInput
                    value={recipientAddress}
                    label={t("recipient")}
                    placeholder={t("recipientPlaceholder")}
                    error={recipientError}
                    onChange={(val) => state.recipientAddress?.set(val)}
                  />
                  <NeoInput
                    value={sendAmount}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    label={t("sendAmount")}
                    placeholder={t("sendAmountPlaceholder")}
                    suffix={t("tokenGas")}
                    hint={t("balanceAvailable", {
                      amount: chainGasBalanceDisplay,
                    })}
                    error={sendAmountError}
                    onChange={(val) => {
                      setSendTouched(true);
                      state.sendAmount?.set(val);
                    }}
                  />
                </div>
                <p className="pay-forward-card__note">{t("sendDirectNote")}</p>
                <NeoButton
                  variant="primary"
                  block
                  loading={isSending}
                  disabled={loading || !canSend}
                  aria-label={t("sendAction")}
                  onClick={() => dispatch("send", recipientAddress, sendAmount)}
                >
                  {isSending ? t("sending") : t("sendAction")}
                </NeoButton>
              </section>
            </div>
          </div>
        )}
      </NeoCard>
    </div>
  );
}
