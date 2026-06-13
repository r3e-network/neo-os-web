import type { KeyboardEvent } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import "./SearchPanel.scss";

interface SearchPanelProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  searchQuery: string;
  selectedNetwork: "mainnet" | "testnet";
  isSearching: boolean;
  onUpdateSearchQuery: (value: string) => void;
  onUpdateSelectedNetwork: (value: "mainnet" | "testnet") => void;
  onSearch: () => void;
}

export default function SearchPanel({
  t,
  searchQuery,
  selectedNetwork,
  isSearching,
  onUpdateSearchQuery,
  onUpdateSelectedNetwork,
  onSearch,
}: SearchPanelProps) {
  // An empty query is a no-op on the composable side and only surfaces an error
  // through the host channel — so communicate the requirement inline here by
  // disabling the action and showing an aria-live hint before any dispatch.
  const isEmptyQuery = searchQuery.trim().length === 0;

  // Enter-to-submit for the most search-shaped input in the fleet. The shared
  // NeoInput renders a real <input>, so its keydown bubbles to this wrapper —
  // catch it here (instead of touching the shared component) and run the search
  // when there is a query and one is not already in flight.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    if (isEmptyQuery || isSearching) return;
    event.preventDefault();
    onSearch();
  };

  return (
    <NeoCard variant="erobo" className="search-card">
      <div className="search-card__header">
        <span>{t("explorerSearchScope")}</span>
        <strong>{selectedNetwork === "mainnet" ? t("mainnet") : t("testnet")}</strong>
      </div>

      <div className="search-box" onKeyDown={handleKeyDown}>
        <NeoInput
          value={searchQuery}
          placeholder={t("searchPlaceholder")}
          onChange={onUpdateSearchQuery}
          className="search-input"
        />
        <NeoButton
          variant="primary"
          block
          loading={isSearching}
          disabled={isEmptyQuery}
          onClick={onSearch}
        >
          {t("search")}
        </NeoButton>
        <p className="search-hint" role="status" aria-live="polite">
          {isEmptyQuery ? t("pleaseEnterQuery") : t("explorerSearchHint")}
        </p>
      </div>

      <div className="network-toggle" role="group" aria-label={t("sidebarNetwork")}>
        <NeoButton
          variant={selectedNetwork === "mainnet" ? "success" : "secondary"}
          size="sm"
          className={`toggle-btn${selectedNetwork === "mainnet" ? " is-active" : ""}`}
          onClick={() => onUpdateSelectedNetwork("mainnet")}
        >
          {t("mainnet")}
        </NeoButton>
        <NeoButton
          variant={selectedNetwork === "testnet" ? "success" : "secondary"}
          size="sm"
          className={`toggle-btn${selectedNetwork === "testnet" ? " is-active" : ""}`}
          onClick={() => onUpdateSelectedNetwork("testnet")}
        >
          {t("testnet")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
