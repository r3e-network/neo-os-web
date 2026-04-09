import { NeoCard } from "@shared/components-react";
import "./AlbumGrid.scss";

interface PhotoItem {
  id: string;
  data: string;
  encrypted: boolean;
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
    <NeoCard variant="erobo" className="gallery-card">
      {loading ? (
        <div className="loading-state">
          <span>{t("loading")}</span>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="photo-item"
              aria-label={photo.encrypted ? t("encrypted") : t("albumPhoto")}
              onClick={() => onView(photo)}
            >
              {!photo.encrypted ? (
                <img src={photo.data} className="photo-img" alt={t("albumPhoto")} />
              ) : (
                <div className="photo-locked">
                  <span className="lock-label">{t("encrypted")}</span>
                </div>
              )}
              {photo.encrypted && (
                <div className="lock-icon" aria-hidden="true">{t("encrypted")}</div>
              )}
            </button>
          ))}

          <button
            type="button"
            className="photo-item placeholder"
            aria-label={t("addPhoto")}
            onClick={onUpload}
          >
            <span className="plus-icon" aria-hidden="true">+</span>
            <span className="add-label">{t("addPhoto")}</span>
          </button>
        </div>
      )}

      {!loading && photos.length === 0 && (
        <div className="empty-state">
          <span className="empty-title">{t("emptyTitle")}</span>
          <span className="empty-desc">{t("emptyDesc")}</span>
        </div>
      )}
    </NeoCard>
  );
}
