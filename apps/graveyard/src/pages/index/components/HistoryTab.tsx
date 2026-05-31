import type { TFunction } from "@shared/react";
import { CategoryIcon } from "@shared/components-react/illustrations";

interface MemorialRecord {
  name: string;
  epitaph: string;
  amount: number;
  timestamp: number;
}

interface HistoryTab {
  t: TFunction;
  records: MemorialRecord[];
  formatGas: (amount: number) => string;
}

export default function HistoryTab({ t, records, formatGas }: { t: TFunction; records: MemorialRecord[]; formatGas: (amount: number) => string }) {
  const safeRecords = Array.isArray(records) ? records : [];

  if (safeRecords.length === 0) {
    return (
      <div className="memorial-empty">
        <span className="memorial-empty-icon">
          <CategoryIcon name="identity" size={48} title={t("noMemorials")} />
        </span>
        <p>{t("noMemorials")}</p>
      </div>
    );
  }

  return (
    <div className="memorial-history">
      {safeRecords.map((m, i) => (
        <div key={i} className="memorial-record">
          <span className="memorial-rank">#{i + 1}</span>
          <div className="memorial-info">
            <span className="memorial-name">{m.name}</span>
            <span className="memorial-detail">
              {m.epitaph || t("noEpitaph")}
            </span>
          </div>
          <span className="memorial-amount">{formatGas(m.amount)} GAS</span>
        </div>
      ))}
    </div>
  );
}
</content>
