import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import TombstoneCard from "./pages/index/components/TombstoneCard";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const memorials = (state.memorials?.get() ?? []) as Array<{ id: number; [key: string]: unknown }>;
  const memorialCount = memorials.length;
  const tributeCount = num("tributeCount");
  const recentObituaries = (state.recentObituaries?.get() ?? []) as Array<{ id: number; name: string; text: string }>;

  return (
    <div className="memorial-play-area">
      <div className="hero-stats">
        <div className="hero-stat">
          <span className="hero-stat-value">{memorialCount}</span>
          <span className="hero-stat-label">{t("memorials")}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-stat-value">{tributeCount}</span>
          <span className="hero-stat-label">{t("myTributes")}</span>
        </div>
      </div>

      <div className="header" aria-hidden="true">
        <span className="title">{t("title")}</span>
        <span className="tagline">{t("tagline")}</span>
        <span className="subtitle">{t("subtitle")}</span>
      </div>

      {recentObituaries.length > 0 && (
        <div className="obituary-banner">
          <span className="banner-title">{t("obituaries")}</span>
          <div className="banner-scroll">
            {recentObituaries.map((ob) => (
              <button key={ob.id} type="button" className="obituary-item" aria-label={ob.name}
                onClick={() => dispatch("openMemorial", ob.id)}>
                <span className="name">{ob.name}</span>
                <span className="text">{ob.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {memorials.length > 0 ? (
        <div className="memorials-grid">
          {memorials.map((memorial) => (
            <TombstoneCard key={memorial.id} memorial={memorial} onClick={() => dispatch("openMemorial", memorial.id)} t={t} />
          ))}
        </div>
      ) : (
        <div className="empty-memorials"><p>{t("noMemorials")}</p></div>
      )}
    </div>
  );
}
