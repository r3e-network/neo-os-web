import { NeoCard } from "@shared/components-react";
import "./SearchResultDisplay.scss";

interface SearchResultDisplayProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  result: Record<string, unknown> | null;
  formatTime: (time: unknown) => string;
}

export default function SearchResultDisplay({ t, result, formatTime }: SearchResultDisplayProps) {
  if (!result) return null;

  const data = result.data as Record<string, unknown> | undefined;
  const read = (camel: string, snake: string = camel) => data?.[camel] ?? data?.[snake] ?? "";

  return (
    <div className="result-section">
      <span className="section-title">{t("searchResult")}</span>

      {result.type === "block" && (
        <NeoCard variant="erobo" className="result-card">
          <div className="result-rows">
            <div className="result-row">
              <span className="label">{t("block")}</span>
              <span className="value mono">{String(read("index"))}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("hash")}</span>
              <span className="value mono">{String(read("hash"))}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("transactionsLabel")}</span>
              <span className="value mono">{String(read("tx_count"))}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("time")}</span>
              <span className="value">{formatTime(read("time"))}</span>
            </div>
          </div>
        </NeoCard>
      )}

      {result.type === "transaction" && (
        <NeoCard variant="erobo" className="result-card">
          <div className="result-rows">
            <div className="result-row">
              <span className="label">{t("hash")}</span>
              <span className="value mono">{String(read("hash"))}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("block")}</span>
              <span className="value mono">{String(read("blockIndex", "block_index"))}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("time")}</span>
              <span className="value">{formatTime(read("blockTime", "block_time"))}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("sender")}</span>
              <span className="value mono">{String(read("sender"))}</span>
            </div>
          </div>
        </NeoCard>
      )}

      {result.type === "address" && (
        <NeoCard variant="erobo" className="result-card">
          <div className="result-rows">
            <div className="result-row">
              <span className="label">{t("addressLabel")}</span>
              <span className="value mono">{String(data?.address ?? "")}</span>
            </div>
            <div className="result-row">
              <span className="label">{t("transactionsLabel")}</span>
              <span className="value mono">{String(data?.txCount ?? "")}</span>
            </div>
          </div>
        </NeoCard>
      )}
    </div>
  );
}
