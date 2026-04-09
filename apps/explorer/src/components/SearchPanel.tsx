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
  return (
    <NeoCard variant="erobo" className="search-card">
      <div className="search-box">
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
          onClick={onSearch}
        >
          {t("search")}
        </NeoButton>
      </div>

      <div className="network-toggle">
        <NeoButton
          variant={selectedNetwork === "mainnet" ? "success" : "secondary"}
          size="sm"
          className="toggle-btn"
          onClick={() => onUpdateSelectedNetwork("mainnet")}
        >
          {t("mainnet")}
        </NeoButton>
        <NeoButton
          variant={selectedNetwork === "testnet" ? "warning" : "secondary"}
          size="sm"
          className="toggle-btn"
          onClick={() => onUpdateSelectedNetwork("testnet")}
        >
          {t("testnet")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
