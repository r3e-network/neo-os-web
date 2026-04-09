/**
 * PlayArea.tsx — React version of the Forever Album PlayArea.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import AlbumGrid from "./components/AlbumGrid";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, bool, val } = useStateBindings(state);

  const photosCount = num("photosCount");
  const encryptedCount = num("encryptedCount");
  const loadingPhotos = bool("loadingPhotos");
  const photos = val<unknown[]>("photos") ?? [];

  const handleViewPhoto = async (photo: unknown) => {
    await dispatch("viewPhoto", photo);
  };

  const handleOpenUpload = async () => {
    await dispatch("openUpload");
  };

  return (
    <div className="album-play-area">
      <div className="hero-container">
        <div className="photo-grid-scene" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`photo-thumb thumb-${i}`} />
          ))}
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{photosCount}</span>
            <span className="hero-stat-label">{t("albumTab")}</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{encryptedCount}</span>
            <span className="hero-stat-label">{t("sidebarEncrypted")}</span>
          </div>
        </div>
      </div>

      <div className="header">
        <span className="title">{t("title")}</span>
        <span className="subtitle">{t("subtitle")}</span>
      </div>

      <AlbumGrid
        t={t}
        photos={photos as Array<{ id: string; data: string; encrypted: boolean }>}
        loading={loadingPhotos}
        onView={handleViewPhoto}
        onUpload={handleOpenUpload}
      />

      <div className="helper-note">
        <span>{t("tapToSelect")}</span>
      </div>
    </div>
  );
}
