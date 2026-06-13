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

  // ── Contract result projection ────────────────────────────────────────
  // The search API returns contract identity at the response top level
  // (contract_hash / call_count) and, when it falls back to an RPC
  // getcontractstate, a nested `data` carrying the manifest + updatecounter.
  const contractHash = String(
    data?.contractHash ?? data?.contract_hash ?? data?.hash ?? result.contract_hash ?? "",
  );
  const manifest = (data?.manifest as Record<string, unknown> | undefined) ?? undefined;
  const abi = (manifest?.abi as Record<string, unknown> | undefined) ?? undefined;
  const methods = Array.isArray(abi?.methods) ? (abi!.methods as unknown[]) : null;
  const contractName = typeof manifest?.name === "string" ? manifest.name : "";
  const contractMethodCount = methods ? methods.length : null;
  const updateCounter = data?.updatecounter ?? data?.update_counter;
  const contractUpdateCounter =
    typeof updateCounter === "number" || typeof updateCounter === "string"
      ? String(updateCounter)
      : null;
  const rawCallCount = result.call_count ?? data?.call_count;
  const contractCallCount =
    typeof rawCallCount === "number" || typeof rawCallCount === "string" ? String(rawCallCount) : "0";

  // A valid-shaped identifier that the indexer/RPC couldn't resolve comes back
  // as {type:'transaction'|'block'|'address', found:false} with no `data`, which
  // would otherwise render a card of entirely blank rows. Surface an explicit,
  // type-aware not-found notice instead so the result never looks broken.
  const notFound = result.found === false;
  const notFoundMessage =
    result.type === "transaction"
      ? t("transactionNotFound")
      : result.type === "block"
        ? t("blockNotFound")
        : result.type === "address"
          ? t("addressNoActivity")
          : t("noResults");

  return (
    <div className="result-section">
      <span className="section-title">{t("searchResult")}</span>

      {result.type === "none" && (
        <NeoCard variant="erobo" className="result-card result-card--empty">
          <span className="result-empty">{t("noResults")}</span>
        </NeoCard>
      )}

      {/* The API returns {type:'unknown'} for a malformed identifier — guide the
          user back to a recognized format rather than rendering an empty card. */}
      {result.type === "unknown" && (
        <NeoCard variant="erobo" className="result-card result-card--empty">
          <span className="result-empty-title">{t("searchUnknownTitle")}</span>
          <span className="result-empty">{t("searchUnknownDesc")}</span>
        </NeoCard>
      )}

      {/* Valid-shaped-but-missing tx/block/address: one calm not-found card. The
          contract branch keeps its own found:false handling (it still surfaces
          the looked-up hash), so it is excluded here. */}
      {notFound && result.type !== "contract" && result.type !== "unknown" && result.type !== "none" && (
        <NeoCard variant="erobo" className="result-card result-card--empty">
          <span className="result-empty">{notFoundMessage}</span>
        </NeoCard>
      )}

      {result.type === "block" && !notFound && (
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

      {result.type === "transaction" && !notFound && (
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

      {result.type === "address" && !notFound && (
        <NeoCard variant="erobo" className="result-card">
          <div className="result-rows">
            <div className="result-row">
              <span className="label">{t("addressLabel")}</span>
              <span className="value mono">
                {String(data?.address ?? result.address ?? "")}
              </span>
            </div>
            <div className="result-row">
              <span className="label">{t("transactionsLabel")}</span>
              <span className="value mono">
                {String(data?.txCount ?? data?.tx_count ?? result.tx_count ?? "")}
              </span>
            </div>
          </div>
        </NeoCard>
      )}

      {result.type === "contract" && (
        <NeoCard variant="erobo" className="result-card">
          <div className="result-rows">
            {/* Contract identity — fields live at the top level of the search
                response (contract_hash/call_count); manifest metadata, when the
                indexer falls back to an RPC getcontractstate, is nested in data. */}
            <div className="result-row">
              <span className="label">{t("contract")}</span>
              <span className="value mono">{contractHash}</span>
            </div>
            {result.found === false ? (
              <div className="result-row">
                <span className="label">{t("contractName")}</span>
                <span className="value">{t("contractNotFound")}</span>
              </div>
            ) : (
              <>
                {contractName && (
                  <div className="result-row">
                    <span className="label">{t("contractName")}</span>
                    <span className="value">{contractName}</span>
                  </div>
                )}
                {contractMethodCount !== null && (
                  <div className="result-row">
                    <span className="label">{t("contractMethods")}</span>
                    <span className="value mono">{contractMethodCount}</span>
                  </div>
                )}
                {contractUpdateCounter !== null && (
                  <div className="result-row">
                    <span className="label">{t("contractUpdates")}</span>
                    <span className="value mono">{contractUpdateCounter}</span>
                  </div>
                )}
                <div className="result-row">
                  <span className="label">{t("contractCalls")}</span>
                  <span className="value mono">{contractCallCount}</span>
                </div>
              </>
            )}
          </div>
        </NeoCard>
      )}
    </div>
  );
}
