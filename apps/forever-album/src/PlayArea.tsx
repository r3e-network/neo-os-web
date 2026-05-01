/**
 * PlayArea.tsx — Forever Album
 *
 * Full interactive album console: stats bar with photo/encrypted/public counts,
 * hero section, album grid, upload trigger, viewer/decrypt modals.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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
  const { num, bool, str, val } = useStateBindings(state);

  const photosCount = num("photosCount");
  const encryptedCount = num("encryptedCount");
  const publicCount = num("publicCount");
  const loadingPhotos = bool("loadingPhotos");
  const uploading = bool("uploading");
  const showViewer = bool("showViewer");
  const showDecrypt = bool("showDecrypt");
  const showUpload = bool("showUpload");
  const decrypting = bool("decrypting");
  const isEncrypted = bool("isEncrypted");
  const password = str("password", "");
  const decryptedPreview = str("decryptedPreview", "");
  const totalPayloadSize = num("totalPayloadSize");
  const photos = val<unknown[]>("photos") ?? [];
  const viewingPhoto = val<{ id: string; data: string; encrypted: boolean; createdAt: number } | null>("viewingPhoto", null);
  const decryptTarget = val<unknown>("decryptTarget", null);
  const selectedImages = val<unknown[]>("selectedImages") ?? [];

  const handleViewPhoto = async (photo: unknown) => {
    await dispatch("viewPhoto", photo);
  };

  const handleOpenUpload = async () => {
    await dispatch("openUpload");
  };

  const setPassword = (v: string) => {
    if (state.password) state.password.set(v);
  };

  const setIsEncrypted = (v: boolean) => {
    if (state.isEncrypted) state.isEncrypted.set(v);
  };

  return (
    <div className="album-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{photosCount}</span>
          <span className="stat-label">{t("albumTab") || "Photos"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{encryptedCount}</span>
          <span className="stat-label">{t("sidebarEncrypted") || "Encrypted"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{publicCount}</span>
          <span className="stat-label">{t("publicPhotos") || "Public"}</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero-container">
        <div className="photo-grid-scene" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`photo-thumb thumb-${i}`} />
          ))}
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-value">{photosCount}</span>
            <span className="hero-stat-label">{t("albumTab") || "Photos"}</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">{encryptedCount}</span>
            <span className="hero-stat-label">{t("sidebarEncrypted") || "Encrypted"}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="header">
        <span className="title">{t("title") || "Forever Album"}</span>
        <span className="subtitle">{t("subtitle") || "Permanent on-chain photo storage"}</span>
      </div>

      {/* Album Grid */}
      <AlbumGrid
        t={t}
        photos={photos as Array<{ id: string; data: string; encrypted: boolean }>}
        loading={loadingPhotos}
        onView={handleViewPhoto}
        onUpload={handleOpenUpload}
      />

      {/* Viewer Modal */}
      {showViewer && viewingPhoto && (
        <NeoCard variant="erobo" className="viewer-card">
          <div className="viewer-header">
            <span className="viewer-title">{t("photoViewer") || "Photo Viewer"}</span>
            <NeoButton variant="secondary" onClick={() => dispatch("closeViewer")} aria-label={t("close") || "Close"}>
              {t("close") || "Close"}
            </NeoButton>
          </div>
          {viewingPhoto.encrypted ? (
            <div className="encrypted-notice">
              <span>{t("photoEncrypted") || "This photo is encrypted."}</span>
              <NeoButton variant="primary" onClick={() => dispatch("openDecrypt")} aria-label={t("decrypt") || "Decrypt"}>
                {t("decrypt") || "Decrypt"}
              </NeoButton>
            </div>
          ) : (
            <img src={viewingPhoto.data} className="viewer-img" alt={t("albumPhoto") || "Photo"} />
          )}
          <div className="viewer-meta">
            <span className="meta-label">{t("photoId") || "ID"}: {viewingPhoto.id}</span>
            <span className="meta-label">{t("createdAt") || "Created"}: {new Date(viewingPhoto.createdAt).toLocaleDateString()}</span>
          </div>
        </NeoCard>
      )}

      {/* Decrypt Modal */}
      {showDecrypt && (
        <NeoCard variant="erobo" className="decrypt-card">
          <div className="decrypt-header">
            <span className="decrypt-title">{t("decryptPhoto") || "Decrypt Photo"}</span>
            <NeoButton variant="secondary" onClick={() => dispatch("closeDecrypt")} aria-label={t("close") || "Close"}>
              {t("close") || "Close"}
            </NeoButton>
          </div>
          <NeoInput value={password} label={t("password") || "Password"} placeholder={t("passwordPlaceholder") || "Enter decryption password"} onChange={setPassword} />
          <NeoButton variant="primary" loading={decrypting} onClick={() => dispatch("handleDecrypt", password)} aria-label={t("decrypt") || "Decrypt"}>
            {t("decrypt") || "Decrypt"}
          </NeoButton>
          {decryptedPreview && (
            <img src={decryptedPreview} className="decrypted-img" alt={t("decryptedPhoto") || "Decrypted"} />
          )}
        </NeoCard>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <NeoCard variant="erobo" className="upload-card">
          <div className="upload-header">
            <span className="upload-title">{t("uploadPhotos") || "Upload Photos"}</span>
            <NeoButton variant="secondary" onClick={() => dispatch("closeUpload")} aria-label={t("close") || "Close"}>
              {t("close") || "Close"}
            </NeoButton>
          </div>
          <label className="file-picker">
            <span className="file-picker-label">{t("chooseFiles") || "Choose photos"}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length) dispatch("addFiles", Array.from(files));
                e.target.value = "";
              }}
            />
          </label>
          <div className="upload-info">
            <span>{t("selectedCount") || "Selected"}: {selectedImages.length}</span>
            <span>{t("payloadSize") || "Size"}: {totalPayloadSize} bytes</span>
          </div>
          <label className="encrypt-toggle">
            <input type="checkbox" checked={isEncrypted} onChange={(e) => setIsEncrypted(e.target.checked)} />
            <span>{t("encryptPhotos") || "Encrypt photos"}</span>
          </label>
          {isEncrypted && (
            <NeoInput value={password} label={t("password") || "Password"} placeholder={t("encryptionPassword") || "Encryption password"} onChange={setPassword} />
          )}
          {selectedImages.length > 0 && (
            <div className="selected-preview">
              {(selectedImages as Array<{ id: string; dataUrl?: string }>).map((img) => (
                <div key={img.id} className="preview-thumb">
                  {img.dataUrl && (
                    <img src={img.dataUrl} alt={t("albumPhoto") || "Photo"} className="preview-thumb-img" />
                  )}
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => dispatch("removeImage", img.id)}
                    aria-label={t("remove") || "Remove"}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <NeoButton
            variant="primary"
            loading={uploading}
            disabled={selectedImages.length === 0}
            onClick={() => dispatch("uploadPhotos")}
            aria-label={t("upload") || "Upload"}
          >
            {t("upload") || "Upload"}
          </NeoButton>
        </NeoCard>
      )}

      <div className="helper-note">
        <span>{t("tapToSelect") || "Tap a photo to view"}</span>
      </div>
    </div>
  );
}
