interface GasTankProps {
  fuelLevelPercent: number;
  gasBalance: string;
  tankLevelDisplay: string;
  isEligible: boolean;
  isConnected: boolean;
  t: (key: string) => string;
}

export default function GasTank({
  fuelLevelPercent,
  gasBalance,
  tankLevelDisplay,
  isEligible,
  isConnected,
  t,
}: GasTankProps) {
  const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
  // Clamp to a sane 0–100 band and keep a small visible cap so the fill never
  // collapses to an invisible sliver — an empty tank still reads as a gauge.
  const pct = Math.max(0, Math.min(100, Number.isFinite(fuelLevelPercent) ? fuelLevelPercent : 0));
  // Keep a clearly visible fuel floor at the base so an empty tank still reads
  // as an intentional gauge with a baseline, not a hollow white box.
  const fillHeight = pct <= 0 ? 16 : Math.max(pct, 16);

  return (
    <div className="gas-tank-container">
      <div className="gas-tank">
        <div className="tank-body">
          <div className="tank-track" aria-hidden="true" />
          <div
            className="fuel-level"
            style={{ height: `${fillHeight}%` }}
            role="meter"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("sidebarTankLevel")}
          />
          <div className="tank-gauge">
            <span className="gauge-value">{formatBalance(gasBalance)}</span>
            <span className="gauge-label">{t("tokenGas")}</span>
          </div>
        </div>
      </div>
      <div className="tank-status">
        <div className={`status-indicator ${isEligible ? "eligible" : "full"}`}>
          <span className="status-text">{isEligible ? t("needsFuel") : t("tankFull")}</span>
        </div>
        <span className="tank-pct">{isConnected ? tankLevelDisplay : t("tankAwaiting")}</span>
      </div>
    </div>
  );
}
