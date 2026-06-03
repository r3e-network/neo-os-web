import { NeoCard, NeoButton } from "@shared/components-react";
import "./AlbumGrid.scss";

interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt?: number;
}

interface AlbumGridProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  photos: PhotoItem[];
  loading: boolean;
  onView: (photo: PhotoItem) => void;
  onUpload: () => void;
}

export default function AlbumGrid({ t, photos, loading, onView, onUpload }: AlbumGridProps) {
  return (
    <NeoCard title={t("albumTab")} className="forever-album-grid-card">
      {loading ? (
        <div className="forever-album-loading" role="status" aria-live="polite" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="forever-album-skeleton-row">
              <span className="forever-album-skeleton-thumb" aria-hidden="true" />
              <span className="forever-album-skeleton-lines" aria-hidden="true">
                <span className="forever-album-skeleton-bar is-wide" />
                <span className="forever-album-skeleton-bar is-narrow" />
              </span>
            </div>
          ))}
          <span className="forever-album-skeleton-label">{t("loading")}</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="forever-album-empty-line" role="status">
          <span>
            {t("emptyTitle")} · {t("emptyDesc")}
          </span>
          <NeoButton variant="secondary" size="sm" onClick={onUpload}>
            {t("emptyAction")}
          </NeoButton>
        </div>
      ) : (
        <div className="forever-album-gallery-grid">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="forever-album-photo-button"
              aria-label={photo.encrypted ? t("encrypted") : t("albumPhoto")}
              onClick={() => onView(photo)}
            >
              {!photo.encrypted ? (
                <img src={photo.data} className="forever-album-photo-img" alt={t("albumPhoto")} />
              ) : (
                <div className="forever-album-photo-locked">
                  <span>{t("encrypted")}</span>
                </div>
              )}
              <span className="forever-album-photo-meta">
                {photo.encrypted ? t("sidebarEncrypted") : t("sidebarPublic")}
              </span>
            </button>
          ))}

          <button
            type="button"
            className="forever-album-add-card"
            aria-label={t("addPhoto")}
            onClick={onUpload}
          >
            <span aria-hidden="true">+</span>
            <strong>{t("addPhoto")}</strong>
            <small>{t("emptyAction")}</small>
          </button>
        </div>
      )}
    </NeoCard>
  );
}
