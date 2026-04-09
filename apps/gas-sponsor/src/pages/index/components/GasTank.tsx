interface GasTankProps { fuelLevelPercent: number; gasBalance: string; isEligible: boolean; t: (key: string) => string; }

export default function GasTank({ fuelLevelPercent, gasBalance, isEligible, t }: GasTankProps) {
  const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);
  return (
    <div className="gas-tank-container">
      <div className="gas-tank">
        <div className="tank-body">
          <div className="fuel-level" style={{ height: fuelLevelPercent + "%" }} />
          <div className="tank-gauge">
            <span className="gauge-label">{t("tokenGas")}</span>
            <span className="gauge-value">{formatBalance(gasBalance)}</span>
          </div>
        </div>
      </div>
      <div className="tank-status">
        <div className={`status-indicator ${isEligible ? "eligible" : "full"}`}>
          <span className="status-text">{isEligible ? t("needsFuel") : t("tankFull")}</span>
        </div>
      </div>
    </div>
  );
}
