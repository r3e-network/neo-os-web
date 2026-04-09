import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);
  const isLoading = bool("isLoading");

  return (
    <div className="play-area">
      <NeoCard variant="erobo" className="main-card">
        <h2 className="play-area-title">{t("title")}</h2>
        <div className="play-area-content">
          {isLoading ? (
            <div className="loading-state">{t("loading") || "Loading..."}</div>
          ) : (
            <div className="ready-state">{t("description") || t("title")}</div>
          )}
        </div>
      </NeoCard>
    </div>
  );
}
