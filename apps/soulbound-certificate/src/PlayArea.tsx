import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TemplateList from "./components/TemplateList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const templatesCount = num("templatesCount");
  const certificatesCount = num("certificatesCount");
  const templates = (state.templates?.get() ?? []) as unknown[];
  const address = state.address?.get() as string | null;
  const isRefreshing = Boolean(state.isRefreshing?.get());
  const togglingId = state.togglingId?.get() as string | null;

  return (
    <div className="certificate-play-area">
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{templatesCount}</span>
          <span className="hero-stat-label">{t("templatesTab")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{certificatesCount}</span>
          <span className="hero-stat-label">{t("certificatesTab")}</span>
        </div>
      </div>
      <TemplateList
        templates={templates}
        refreshing={isRefreshing}
        togglingId={togglingId}
        hasAddress={!!address}
        onRefresh={() => dispatch("refreshTemplates")}
        onConnect={() => dispatch("connectWallet")}
        onIssue={(template: unknown) => dispatch("openIssueModal", template)}
        onToggle={(template: unknown) => dispatch("toggleTemplate", template)}
        onCopyIssueLink={(template: unknown) => dispatch("copyIssueLink", template)}
        onShareIssueLink={(template: unknown) => dispatch("shareIssueLink", template)}
        t={t}
      />
    </div>
  );
}
