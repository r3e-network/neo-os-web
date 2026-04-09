import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ContractList from "./pages/index/components/ContractList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const contracts = (state.contracts?.get() ?? []) as unknown[];
  const address = state.address?.get() as string | null;
  const activeCount = num("activeCount");
  const pendingCount = num("pendingCount");
  const contractCount = num("contractCount");

  return (
    <div className="breakup-play-area">
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">{activeCount}</span><span className="hero-stat-label">{t("active")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{pendingCount}</span><span className="hero-stat-label">{t("pending")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{contractCount}</span><span className="hero-stat-label">{t("total")}</span></div>
      </div>
      <ContractList contracts={contracts} address={address} onSign={(c: unknown) => dispatch("signContract", c)} onBreak={(c: unknown) => dispatch("breakContract", c)} t={t} />
    </div>
  );
}
