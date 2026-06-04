import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { CategoryIcon } from "@shared/components-react/illustrations";
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

  const gasBalance = str("gasBalance", "0");
  const gasBalanceDisplay = str("gasBalanceDisplay", "0.0000");
  const isEligible = bool("isEligible");
  const fuelLevelPercent = num("fuelLevelPercent");
  const remainingQuota = num("remainingQuota");
  const remainingQuotaDisplay = str("remainingQuotaDisplay", "0");
  const isRequesting = bool("isRequesting");
  const requestAmount = str("requestAmount", "0.01");
  const maxRequestAmount = num("maxRequestAmount", 0.1);
  const quickAmounts = (state.quickAmounts?.get() ?? [0.005, 0.01, 0.02, 0.05]) as number[];
  const loading = bool("loading");
  const userAddress = str("userAddress");
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
  const eligibleDisplay = str("eligibleDisplay");

  // Donate & Send move GAS the wallet already holds. For the app's target user
  // (eligible, low-balance) these are "pay it forward" actions that only work
  // once funded — frame and gate them so they don't fail at the chain.
  const recipientTouched = recipientAddress.length > 0;
  const donateTouched = donateAmount !== "0" && donateAmount !== "";
  const sendTouched = sendAmount !== "0" && sendAmount !== "";

  // Field-level error copy, only shown once the user has typed something so the
  // forms don't open in an error state. Mirrors the composable's guards exactly.
  const donateError = donateTouched && !donateAmountValid ? t("donateInvalid") : "";
  const recipientError = recipientTouched && !recipientValid ? t("invalidAddress") : "";
  const sendAmountError = sendTouched && !sendAmountValid ? t("sendAmountInvalid") : "";

  return (
    <div className="gas-sponsor-play-area">
      {/* Hero — headline gauge folds balance, tank level, eligibility & quota into one block */}
      <div className="gas-hero">
        <div className="gas-hero-lead">
          <span className="gas-hero-badge">
            <CategoryIcon name="finance" size={40} title={t("title")} />
          </span>
          <div className="gas-hero-copy">
            <h2 className="gas-hero-title">{t("title")}</h2>
            <p className="gas-hero-subtitle">{t("subtitle")}</p>
          </div>
        </div>

        <div className="gas-hero-gauge">
          <GasTank fuelLevelPercent={fuelLevelPercent} gasBalance={gasBalance} isEligible={isEligible} t={t} />
          <dl className="gas-hero-facts">
            <div className="gas-hero-fact">
              <dt>{t("gasBalance")}</dt>
              <dd>{gasBalanceDisplay}</dd>
            </div>
            <div className="gas-hero-fact">
              <dt>{t("sidebarTankLevel")}</dt>
              <dd>{tankLevelDisplay}</dd>
            </div>
            <div className="gas-hero-fact">
              <dt>{t("remaining")}</dt>
              <dd>{remainingQuotaDisplay}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Primary action — request sponsored GAS */}
      <NeoCard title={t("requestGas")}>
        <RequestGasCard
          isEligible={isEligible}
          remainingQuota={remainingQuota}
          requestAmount={requestAmount}
          maxRequestAmount={String(maxRequestAmount)}
          isRequesting={isRequesting}
          quickAmounts={quickAmounts}
          onRequestAmountChange={(val: string) => state.requestAmount?.set(val)}
          onRequest={() => dispatch("requestSponsorship", requestAmount)}
          t={t}
        />
        <div className="quota-info">
          <div className="quota-bar-container">
            <div className="quota-bar" style={{ width: `${Math.min(quotaPercent, 100)}%` }} />
          </div>
          <div className="quota-details">
            <span className="quota-text">
              <span className="quota-text-label">{t("used")}</span>
              <span className="quota-text-value">{usedQuota} / {dailyLimit}</span>
            </span>
            <span className="quota-reset">
              <span className="quota-reset-label">{t("resetsAt")}</span>
              <span className="quota-reset-value">{resetTime && resetTime !== "N/A" ? resetTime : "—"}</span>
            </span>
          </div>
        </div>
      </NeoCard>

      {/* Pay it forward — Donate & Send move GAS the wallet already holds, so
          they only work for a funded wallet. The app's target user is an
          eligible, low-balance wallet; showing two live transfer forms they
          can't use (they'd fail at the chain) dilutes the "get free GAS" flow.
          Gate them behind a funded balance and frame them as helping others. */}
      <NeoCard title={t("payItForward")}>
        {!isFunded ? (
          <div className="pay-forward-empty">
            <span className="pay-forward-empty-icon">
              <CategoryIcon name="social" size={36} title={t("payItForward")} />
            </span>
            <span className="pay-forward-empty-title">{t("payForwardLockedTitle")}</span>
            <span className="pay-forward-empty-desc">{t("payForwardLockedDesc")}</span>
          </div>
        ) : (
          <div className="pay-forward">
            <p className="form-hint">{t("payForwardLead")}</p>

            {/* Donate */}
            <div className="donate-form">
              <span className="pay-forward-section-label">{t("donate")}</span>
              <p className="form-hint">{t("donateSubtitle")}</p>
              <NeoInput
                value={donateAmount}
                type="number"
                min={0}
                label={t("donateAmount") || "Amount"}
                placeholder={t("donateAmountPlaceholder") || "0.00"}
                suffix={t("tokenGas")}
                hint={t("balanceAvailable", { amount: gasBalanceDisplay })}
                error={donateError}
                onChange={(val) => state.donateAmount?.set(val)}
              />
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
            </div>

            {/* Send GAS */}
            <div className="send-form">
              <span className="pay-forward-section-label">{t("sendGas")}</span>
              <p className="form-hint">{t("sendSubtitle")}</p>
              <NeoInput
                value={recipientAddress}
                label={t("recipient")}
                placeholder={t("recipientPlaceholder") || "N..."}
                error={recipientError}
                onChange={(val) => state.recipientAddress?.set(val)}
              />
              <NeoInput
                value={sendAmount}
                type="number"
                min={0}
                label={t("sendAmount") || "Amount"}
                placeholder={t("sendAmountPlaceholder") || "0.00"}
                suffix={t("tokenGas")}
                hint={t("balanceAvailable", { amount: gasBalanceDisplay })}
                error={sendAmountError}
                onChange={(val) => state.sendAmount?.set(val)}
              />
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
            </div>
          </div>
        )}
      </NeoCard>
    </div>
  );
}
