import { NeoButton, NeoCard } from "@shared/components-react";
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
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isLoading}
            aria-label={t("createContract") || "Create Contract"}
            onClick={() => dispatch("createContract")}
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
