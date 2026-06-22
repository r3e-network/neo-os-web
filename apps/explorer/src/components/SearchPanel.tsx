import type { KeyboardEvent } from "react";
import { Network, Search, ShieldCheck } from "lucide-react";
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
        <span className="search-card__icon" aria-hidden="true">
          <Search size={18} />
        </span>
        <div>
          <span>{t("explorerSearchDeck")}</span>
          <strong>{selectedNetwork === "mainnet" ? t("mainnet") : t("testnet")}</strong>
        </div>
      </div>

      <div className="search-console">
        <div className="search-console__stage" aria-hidden="true">
          <picture>
            <source srcSet="./logo.avif" type="image/avif" />
            <source srcSet="./logo.webp" type="image/webp" />
            <img src="./logo.jpg" alt="" loading="lazy" decoding="async" />
          </picture>
          <span className="search-console__pulse search-console__pulse--one" />
          <span className="search-console__pulse search-console__pulse--two" />
          <span className="search-console__pulse search-console__pulse--three" />
        </div>
        <div className="search-box" onKeyDown={handleKeyDown}>
          <p className="search-card__copy">{t("explorerSearchDeckCopy")}</p>
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
      </div>

      <div
        className="network-toggle"
        role="radiogroup"
        aria-label={t("sidebarNetwork")}
      >
        <button
          type="button"
          role="radio"
          aria-checked={selectedNetwork === "mainnet"}
          className={`network-option${selectedNetwork === "mainnet" ? " is-active" : ""}`}
          onClick={() => onUpdateSelectedNetwork("mainnet")}
        >
          <span className="network-option__icon" aria-hidden="true">
            <ShieldCheck size={16} />
          </span>
          <span>
            <strong>{t("mainnet")}</strong>
            <small>{t("explorerMainnetHint")}</small>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={selectedNetwork === "testnet"}
          className={`network-option${selectedNetwork === "testnet" ? " is-active" : ""}`}
          onClick={() => onUpdateSelectedNetwork("testnet")}
        >
          <span className="network-option__icon" aria-hidden="true">
            <Network size={16} />
          </span>
          <span>
            <strong>{t("testnet")}</strong>
            <small>{t("explorerTestnetHint")}</small>
          </span>
        </button>
      </div>
    </NeoCard>
  );
}
