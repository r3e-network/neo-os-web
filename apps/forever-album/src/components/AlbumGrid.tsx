import { NeoCard } from "@shared/components-react";
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
        <div className="forever-album-empty" role="status">
          <div className="forever-album-empty-frame" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.6" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span className="forever-album-empty-frame-caption">
              {t("emptySampleCaption")}
            </span>
          </div>
          <p className="forever-album-empty-warm">{t("emptyWarmLine")}</p>
          <p className="forever-album-empty-hint">{t("emptyDesc")}</p>
          {/* No competing primary CTA here: the single upload affordance is the
              "Choose images" dropzone rendered directly below this empty state.
              This illustrative panel guides the eye there instead of stacking a
              second first-run prompt for the same action. */}
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
