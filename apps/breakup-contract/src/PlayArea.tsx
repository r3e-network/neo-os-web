import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ContractList from "./pages/index/components/ContractList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const contracts = val<unknown[]>("contracts") ?? [];
  const address = str("address");
  const contractCount = num("contractCount");
  const activeCount = num("activeCount");
  const pendingCount = num("pendingCount");
  const brokenCount = num("brokenCount");
  const isLoading = bool("isLoading");

  const [partner, setPartner] = useState("");
  const [stake, setStake] = useState("");
  const [days, setDays] = useState("90");
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");

  const canSubmit =
    partner.trim().length > 0 && stake.trim().length > 0 && title.trim().length > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;
    await dispatch("createContract", {
      partnerAddress: partner,
      stakeAmount: stake,
      duration: days,
      title,
      terms,
    });
    setPartner("");
    setStake("");
    setDays("90");
    setTitle("");
    setTerms("");
  };

  return (
    <div className="breakup-play-area">
      {/* Stats Bar */}
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{activeCount}</span>
          <span className="hero-stat-label">{t("active") || "Active"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{pendingCount}</span>
          <span className="hero-stat-label">{t("pending") || "Pending"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{brokenCount}</span>
          <span className="hero-stat-label">{t("broken") || "Broken"}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{contractCount}</span>
          <span className="hero-stat-label">{t("total") || "Total"}</span>
        </div>
      </div>

      {/* Create Contract */}
      <NeoCard title={t("newContract") || "New Contract"}>
        <div className="create-contract-section">
          <p className="contract-description">
            {t("contractDescription") || "Create an on-chain breakup contract. Both parties stake tokens as commitment."}
          </p>
          <NeoInput
            label={t("partnerAddress") || "Partner Address"}
            placeholder="N..."
            value={partner}
            onChange={setPartner}
          />
          <NeoInput
            label={t("stakeAmount") || "Stake (GAS)"}
            placeholder="10"
            type="number"
            value={stake}
            onChange={setStake}
          />
          <NeoInput
            label={t("durationDays") || "Duration (days)"}
            placeholder="90"
            type="number"
            value={days}
            onChange={setDays}
          />
          <NeoInput
            label={t("contractTitle") || "Title"}
            placeholder={t("contractTitlePlaceholder") || "Our covenant"}
            value={title}
            onChange={setTitle}
          />
          <NeoInput
            label={t("contractTerms") || "Terms"}
            placeholder={t("contractTermsPlaceholder") || "Optional notes (max 2000 chars)"}
            value={terms}
            onChange={setTerms}
          />
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isLoading}
            disabled={!canSubmit}
            aria-label={t("createContract") || "Create Contract"}
            onClick={handleCreate}
          >
            {t("createContract") || "Create Contract"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Contract List */}
      <NeoCard title={t("contracts") || "Contracts"}>
        <ContractList
          contracts={contracts}
          address={address || null}
          onSign={(c: unknown) => dispatch("signContract", c)}
          onBreak={(c: unknown) => dispatch("breakContract", c)}
          t={t}
        />
        {contracts.length === 0 && !isLoading && (
          <div className="empty-state">
            <span>{t("noContracts") || "No contracts yet"}</span>
          </div>
        )}
      </NeoCard>
    </div>
  );
}
