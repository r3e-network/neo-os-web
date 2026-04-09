import type { Observable } from "@shared/react/context";
import { NeoInput, NeoButton } from "@shared/components-react";
import "./SwapInterface.scss";

interface SwapInterfaceProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  swapMode: string;
  neoBalance: number;
  bNeoBalance: number;
  swapAmount: string;
  swapOutput: string;
  swapUsdText: string;
  state: Record<string, Observable>;
}

export default function SwapInterface({ t, swapMode, neoBalance, bNeoBalance, swapAmount, swapOutput, swapUsdText, state }: SwapInterfaceProps) {
  const updateAmount = (val: string) => { if (state.swapAmount) state.swapAmount.set(val); };
  const toggleMode = () => {
    if (state.swapMode) {
      const current = state.swapMode.get() as string;
      state.swapMode.set(current === "stake" ? "unstake" : "stake");
    }
  };

  const formatAmount = (n: number | null) => n != null ? n.toFixed(4) : "-";

  return (
    <div className="swap-panel">
      <div className="swap-block">
        <div className="swap-row">
          <span className="swap-label">{t("from")}</span>
          <span className="swap-hint">
            {t("balance")}: {formatAmount(swapMode === "stake" ? neoBalance : bNeoBalance)} {swapMode === "stake" ? t("tokenNeo") : t("tokenBneo")}
          </span>
        </div>
        <NeoInput value={swapAmount} type="number" placeholder={t("inputPlaceholder")} onChange={updateAmount} />
        <span className="swap-usd">{swapUsdText}</span>
      </div>

      <NeoButton variant="secondary" onClick={toggleMode} aria-label={t("swapToggleAlt")}>
        {swapMode === "stake" ? t("swapToBneo") : t("swapToNeo")}
      </NeoButton>

      <div className="swap-block">
        <div className="swap-row">
          <span className="swap-label">{t("to")}</span>
          <span className="swap-hint">{t("estimatedOutput")}</span>
        </div>
        <div className="swap-output-value">{swapOutput || "0"}</div>
      </div>
    </div>
  );
}
