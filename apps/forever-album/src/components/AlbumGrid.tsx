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
        <div className="forever-album-loading">
          <span>{t("loading")}</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="forever-album-empty">
          <span className="forever-album-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.6" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </span>
          <strong>{t("emptyTitle")}</strong>
          <span className="forever-album-empty-desc">{t("emptyDesc")}</span>
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
