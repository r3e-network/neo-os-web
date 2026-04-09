/**
 * MercActionCards.tsx -- Deposit/Withdraw/Bid forms for Gov Merc.
 */

import { useState } from "react";
import { NeoButton, NeoInput, NeoCard } from "@shared/components-react";
import "./MercActionCards.scss";

interface MercActionCardsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isBusy: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function MercActionCards({ t, isBusy, dispatch }: MercActionCardsProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bidAmount, setBidAmount] = useState("");

  const handleDeposit = async () => {
    await dispatch("depositNeo");
    setDepositAmount("");
  };

  const handleWithdraw = async () => {
    await dispatch("withdrawNeo");
    setWithdrawAmount("");
  };

  const handleBid = async () => {
    await dispatch("placeBid");
    setBidAmount("");
  };

  return (
    <>
      {/* Deposit Card */}
      <NeoCard variant="erobo">
        <div className="form-group-neo">
          <NeoInput
            value={depositAmount}
            type="number"
            placeholder={t("enterAmount")}
            label={t("depositAmount")}
            onChange={(val) => setDepositAmount(val)}
          />
          <NeoButton
            variant="primary"
            loading={isBusy}
            onClick={handleDeposit}
          >
            {t("depositNeo")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Withdraw Card */}
      <NeoCard variant="erobo">
        <div className="form-group-neo">
          <NeoInput
            value={withdrawAmount}
            type="number"
            placeholder={t("enterAmount")}
            label={t("withdrawAmount")}
            onChange={(val) => setWithdrawAmount(val)}
          />
          <NeoButton
            variant="secondary"
            loading={isBusy}
            onClick={handleWithdraw}
          >
            {t("withdrawNeo")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Bid Card */}
      <NeoCard variant="erobo">
        <div className="form-group-neo">
          <NeoInput
            value={bidAmount}
            type="number"
            placeholder={t("enterAmount")}
            label={t("bidAmount")}
            onChange={(val) => setBidAmount(val)}
          />
          <NeoButton
            variant="primary"
            loading={isBusy}
            onClick={handleBid}
          >
            {t("placeBid")}
          </NeoButton>
        </div>
      </NeoCard>
    </>
  );
}
