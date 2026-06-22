import { NeoCard } from "@shared/components-react";
import "./RecentTransactions.scss";

interface RecentTransactionsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  transactions: Array<{ hash: string; vmState: string; blockTime: unknown }>;
  formatTime: (time: unknown) => string;
  truncateHash: (hash: unknown) => string;
  onViewTx: (hash: string) => void;
}

export default function RecentTransactions({ t, transactions, formatTime, truncateHash, onViewTx }: RecentTransactionsProps) {
  return (
    <div className="recent-section">
      <span className="section-title">{t("recentTransactions")}</span>
      {transactions.length === 0 ? (
        <NeoCard variant="erobo" className="recent-empty-state">
          <picture className="recent-empty-state__beacon" aria-hidden="true">
            <source srcSet="./logo.avif" type="image/avif" />
            <source srcSet="./logo.webp" type="image/webp" />
            <img src="./logo.jpg" alt="" loading="lazy" decoding="async" />
          </picture>
          <div>
            <span>{t("explorerRecentEmptyTitle")}</span>
            <strong>{t("explorerRecentEmptyDesc")}</strong>
          </div>
          <div className="recent-empty-state__types">
            <span>{t("explorerSearchableTypes")}</span>
            <ul aria-label={t("explorerSearchableTypes")}>
              <li>{t("explorerTipTx")}</li>
              <li>{t("explorerTipAddress")}</li>
              <li>{t("explorerTipContract")}</li>
            </ul>
          </div>
        </NeoCard>
      ) : (
        transactions.map((tx) => (
          <NeoCard
            key={tx.hash}
            variant="erobo"
          className="tx-card"
          hoverable
          onClick={() => onViewTx(tx.hash)}
        >
          <div className="tx-content">
              <span className="tx-node" aria-hidden="true">TX</span>
            <div className="tx-info">
              <span className="tx-hash mono">{truncateHash(tx.hash)}</span>
                {(() => {
                  // Only HALT/FAULT carry the green/red styling + label; an
                  // unknown state (e.g. the RPC-only fallback's "state
                  // unavailable") gets a neutral pill, not a false "Fault".
                  const s = String(tx.vmState || "").toUpperCase();
                  const known = s === "HALT" || s === "FAULT";
                  const label =
                    s === "HALT" ? t("vmHalt") : s === "FAULT" ? t("vmFault") : t("vmUnknown");
                  return <span className={`vm-state ${known ? s : ""}`}>{label}</span>;
                })()}
              </div>
              <span className="tx-time">{formatTime(tx.blockTime)}</span>
            </div>
          </NeoCard>
        ))
      )}
    </div>
  );
}
