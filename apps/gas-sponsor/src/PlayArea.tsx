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
  const tankLevelDisplay = str("tankLevelDisplay", "0%");
  const eligibleDisplay = str("eligibleDisplay");

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
              <span className="quota-text-label">{t("used") || "Used"}</span>
              <span className="quota-text-value">{usedQuota} / {dailyLimit}</span>
            </span>
            <span className="quota-reset">
              <span className="quota-reset-label">{t("resetsAt") || "Resets at"}</span>
              <span className="quota-reset-value">{resetTime && resetTime !== "N/A" ? resetTime : "—"}</span>
            </span>
          </div>
        </div>
      </NeoCard>

      {/* Donate */}
      <NeoCard title={t("donate") || "Donate GAS"}>
        <div className="donate-form">
          <p className="form-hint">{t("donateSubtitle")}</p>
          <NeoInput
            value={donateAmount}
            type="number"
            label={t("donateAmount") || "Amount"}
            placeholder={t("donateAmountPlaceholder") || "0.00"}
            onChange={(val) => state.donateAmount?.set(val)}
          />
          <NeoButton
            variant="success"
            block
            loading={isDonating}
            disabled={loading}
            aria-label={t("donateAction") || "Donate"}
            onClick={() => dispatch("donate", donateAmount)}
          >
            {isDonating ? t("donating") || "Donating..." : t("donateAction") || "Donate"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Send GAS */}
      <NeoCard title={t("sendGas") || "Send GAS"}>
        <div className="send-form">
          <p className="form-hint">{t("sendSubtitle")}</p>
          <NeoInput
            value={recipientAddress}
            label={t("recipient") || "Recipient Address"}
            placeholder={t("recipientPlaceholder") || "N..."}
            onChange={(val) => state.recipientAddress?.set(val)}
          />
          <NeoInput
            value={sendAmount}
            type="number"
            label={t("sendAmount") || "Amount"}
            placeholder={t("sendAmountPlaceholder") || "0.00"}
            onChange={(val) => state.sendAmount?.set(val)}
          />
          <NeoButton
            variant="primary"
            block
            loading={isSending}
            disabled={loading || !recipientAddress}
            aria-label={t("sendAction") || "Send"}
            onClick={() => dispatch("send", recipientAddress, sendAmount)}
          >
            {isSending ? t("sending") || "Sending..." : t("sendAction") || "Send"}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
