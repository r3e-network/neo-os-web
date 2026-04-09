import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import GasTank from "./pages/index/components/GasTank";
import RequestGasCard from "./pages/index/components/RequestGasCard";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);
  const gasBalance = str("gasBalance", "0");
  const isEligible = bool("isEligible");
  const fuelLevelPercent = num("fuelLevelPercent");
  const remainingQuota = num("remainingQuota");
  const isRequesting = bool("isRequesting");
  const requestAmount = str("requestAmount", "0.01");
  const maxRequestAmount = num("maxRequestAmount", 0.1);
  const quickAmounts = (state.quickAmounts?.get() ?? [0.005, 0.01, 0.02, 0.05]) as number[];

  return (
    <div className="gas-sponsor-play-area">
      <GasTank fuelLevelPercent={fuelLevelPercent} gasBalance={gasBalance} isEligible={isEligible} t={t} />
      <RequestGasCard
        isEligible={isEligible}
        remainingQuota={remainingQuota}
        requestAmount={requestAmount}
        maxRequestAmount={String(maxRequestAmount)}
        isRequesting={isRequesting}
        quickAmounts={quickAmounts}
        onRequestAmountChange={(val: string) => state.requestAmount?.set(val)}
        onRequest={() => dispatch("requestSponsorship", requestAmount)}
        t={t}
      />
    </div>
  );
}
