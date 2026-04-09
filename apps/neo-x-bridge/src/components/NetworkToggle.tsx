import "./NetworkToggle.scss";

interface NetworkToggleProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedNetwork: string;
  onSelect: (network: string) => void;
}

export default function NetworkToggle({ t, selectedNetwork, onSelect }: NetworkToggleProps) {
  return (
    <div className="network-toggle">
      <button
        className={`toggle-btn ${selectedNetwork === "mainnet" || selectedNetwork === "Neo X MainNet" ? "active" : ""}`}
        onClick={() => onSelect("mainnet")}
      >
        {t("mainnet")}
      </button>
      <button
        className={`toggle-btn ${selectedNetwork === "testnet" || selectedNetwork === "Neo X TestNet" ? "active" : ""}`}
        onClick={() => onSelect("testnet")}
      >
        {t("testnet")}
      </button>
    </div>
  );
}
