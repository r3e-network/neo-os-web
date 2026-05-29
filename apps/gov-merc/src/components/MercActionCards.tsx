import { NeoButton, NeoInput } from "@shared/components-react";
import "./MercActionCards.scss";

export type AmountField = "depositAmount" | "withdrawAmount" | "bidAmount";

interface MercActionCardsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isBusy: boolean;
  depositAmount: string;
  withdrawAmount: string;
  bidAmount: string;
  onAmountChange: (key: AmountField, value: string) => void;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function isPositiveAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export default function MercActionCards({
  t,
  isBusy,
  depositAmount,
  withdrawAmount,
  bidAmount,
  onAmountChange,
  dispatch,
}: MercActionCardsProps) {
  return (
    <>
      <div className="gov-merc-action-card">
        <div>
          <span>{t("depositNeo")}</span>
          <p>{t("actionDepositHint")}</p>
        </div>
        <NeoInput
          value={depositAmount}
          type="number"
          min={0}
          suffix="NEO"
          placeholder={t("enterAmount")}
          label={t("depositAmount")}
          onChange={(value) => onAmountChange("depositAmount", value)}
        />
        <NeoButton
          variant="primary"
          loading={isBusy}
          disabled={isBusy || !isPositiveAmount(depositAmount)}
          onClick={() => dispatch("depositNeo")}
        >
          {t("depositNeo")}
        </NeoButton>
      </div>

      <div className="gov-merc-action-card">
        <div>
          <span>{t("withdrawNeo")}</span>
          <p>{t("actionWithdrawHint")}</p>
        </div>
        <NeoInput
          value={withdrawAmount}
          type="number"
          min={0}
          suffix="NEO"
          placeholder={t("enterAmount")}
          label={t("withdrawAmount")}
          onChange={(value) => onAmountChange("withdrawAmount", value)}
        />
        <NeoButton
          variant="secondary"
          loading={isBusy}
          disabled={isBusy || !isPositiveAmount(withdrawAmount)}
          onClick={() => dispatch("withdrawNeo")}
        >
          {t("withdrawNeo")}
        </NeoButton>
      </div>

      <div className="gov-merc-action-card">
        <div>
          <span>{t("placeBid")}</span>
          <p>{t("actionBidHint")}</p>
        </div>
        <NeoInput
          value={bidAmount}
          type="number"
          min={0}
          suffix="GAS"
          placeholder={t("enterAmount")}
          label={t("bidAmount")}
          onChange={(value) => onAmountChange("bidAmount", value)}
        />
        <NeoButton
          variant="primary"
          loading={isBusy}
          disabled={isBusy || !isPositiveAmount(bidAmount)}
          onClick={() => dispatch("placeBid")}
        >
          {t("placeBid")}
        </NeoButton>
      </div>
    </>
  );
}
