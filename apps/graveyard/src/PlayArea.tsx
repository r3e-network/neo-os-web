import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import HistoryTab from "./pages/index/components/HistoryTab";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const totalDestroyed = num("totalDestroyed");
  const gasReclaimed = num("gasReclaimed");
  const historyItems = (state.history?.get() ?? []) as unknown[];
  const forgettingId = state.forgettingId?.get() as string | null;

  return (
    <div className="graveyard-play-area">
      <div className="hero-stats">
        <div className="hero-stat"><span className="hero-stat-value">{totalDestroyed}</span><span className="hero-stat-label">{t("itemsDestroyed")}</span></div>
        <div className="hero-stat"><span className="hero-stat-value">{gasReclaimed}</span><span className="hero-stat-label">{t("gasReclaimed")}</span></div>
      </div>
      <HistoryTab history={historyItems} forgettingId={forgettingId} onForget={(item: unknown) => dispatch("forgetMemory", item)} t={t} />
    </div>
  );
}
