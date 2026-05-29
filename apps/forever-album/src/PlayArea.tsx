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

type PhotoView = {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
};

type SelectedImage = {
  id: string;
  dataUrl?: string;
  size?: number;
};

function formatBytes(value: number, t: PlayAreaProps["t"]) {
  if (!Number.isFinite(value) || value <= 0) return `0 ${t("sizeUnitByte")}`;
  if (value < 1024) return `${value} ${t("sizeUnitByte")}`;
  return `${(value / 1024).toFixed(1)} ${t("sizeUnitKbyte")}`;
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
  const decrypting = bool("decrypting");
  const isEncrypted = bool("isEncrypted");
  const password = str("password", "");
  const decryptedPreview = str("decryptedPreview", "");
  const totalPayloadSize = num("totalPayloadSize");
  const photos = val<PhotoView[]>("photos") ?? [];
  const viewingPhoto = val<PhotoView | null>("viewingPhoto", null);
  const selectedImages = val<SelectedImage[]>("selectedImages") ?? [];
  const uploadLimit = 60 * 1024;
  const uploadPct = Math.min(100, Math.round((totalPayloadSize / uploadLimit) * 100));

  const setPassword = (value: string) => {
    state.password?.set(value);
  };

  const setIsEncrypted = (value: boolean) => {
    state.isEncrypted?.set(value);
  };

  const selectFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      void dispatch("addFiles", Array.from(files));
    }
  };

  const openFilePicker = () => {
    document.querySelector<HTMLInputElement>(".forever-album-file-picker input")?.click();
  };

  const uploadDisabled = selectedImages.length === 0 || uploading;

  return (
    <div className="album-play-area">
      <div className="forever-album-shell">
        <main className="forever-album-main">
          <section className="forever-album-hero" aria-labelledby="forever-album-title">
            <div className="forever-album-hero-copy">
              <span className="forever-album-kicker">{t("title")}</span>
              <h1 id="forever-album-title">{t("vaultHeroTitle")}</h1>
              <p>{t("vaultHeroSubtitle")}</p>
              <div className="forever-album-actions">
                <NeoButton variant="primary" onClick={openFilePicker}>
                  {t("emptyAction")}
                </NeoButton>
                <NeoButton variant="secondary" disabled={loadingPhotos} onClick={() => dispatch("refreshPhotos")}>
                  {t("refreshAlbum")}
                </NeoButton>
              </div>
            </div>

            <div className="forever-album-device" aria-label={t("vaultRouteTitle")}>
              <div className="forever-album-device-head">
                <span>{t("vaultRouteTitle")}</span>
                <strong>{formatBytes(totalPayloadSize, t)}</strong>
              </div>
              <div className="forever-album-progress" aria-label={t("sizeHint", { size: formatBytes(totalPayloadSize, t), max: "60 KB" })}>
                <span style={{ width: `${Math.max(4, uploadPct)}%` }} />
              </div>
              <div className="forever-album-device-grid">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </section>

          <div className="forever-album-vault-strip" aria-label={t("vaultStatsTitle")}>
            <div className="forever-album-vault-item">
              <span>{t("albumTab")}</span>
              <strong>{photosCount}</strong>
            </div>
            <div className="forever-album-vault-item">
              <span>{t("sidebarEncrypted")}</span>
              <strong>{encryptedCount}</strong>
            </div>
            <div className="forever-album-vault-item">
              <span>{t("sidebarPublic")}</span>
              <strong>{publicCount}</strong>
            </div>
            <div className="forever-album-vault-item">
              <span>{t("payloadSize")}</span>
              <strong>{formatBytes(totalPayloadSize, t)}</strong>
            </div>
          </div>

          <div className="forever-album-content-grid">
            <AlbumGrid
              t={t}
              photos={photos}
              loading={loadingPhotos}
              onView={(photo) => dispatch("viewPhoto", photo)}
              onUpload={openFilePicker}
            />

            <NeoCard title={t("vaultUploadTitle")} className="forever-album-upload-panel">
              <label className="forever-album-file-picker">
                <span>{t("chooseFiles")}</span>
                <small>{t("tapToSelect")}</small>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    selectFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>

              <div className="forever-album-upload-meta">
                <span>{t("selectedCount")}: {selectedImages.length}</span>
                <span>{t("payloadSize")}: {formatBytes(totalPayloadSize, t)}</span>
              </div>

              <div className="forever-album-upload-meter">
                <span style={{ width: `${Math.max(4, uploadPct)}%` }} />
              </div>

              <label className="forever-album-encrypt-toggle">
                <input
                  type="checkbox"
                  checked={isEncrypted}
                  onChange={(event) => setIsEncrypted(event.target.checked)}
                />
                <span>{t("encryptPhotos")}</span>
              </label>

              {isEncrypted && (
                <NeoInput
                  value={password}
                  type="password"
                  label={t("password")}
                  placeholder={t("encryptionPassword")}
                  onChange={setPassword}
                />
              )}

              {selectedImages.length > 0 && (
                <div className="forever-album-selected-preview">
                  {selectedImages.map((image) => (
                    <div key={image.id} className="forever-album-preview-thumb">
                      {image.dataUrl ? (
                        <img src={image.dataUrl} alt={t("albumPhoto")} />
                      ) : (
                        <span>{formatBytes(image.size ?? 0, t)}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => dispatch("removeImage", image.id)}
                        aria-label={t("remove")}
                      >
                        {t("remove")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="forever-album-panel-footer">
                <span>{isEncrypted ? t("encryptionNote") : t("vaultPublicNote")}</span>
                <NeoButton
                  variant="primary"
                  disabled={uploadDisabled}
                  loading={uploading}
                  onClick={() => dispatch("uploadPhotos")}
                >
                  {t("upload")}
                </NeoButton>
              </div>
            </NeoCard>
          </div>
        </main>

        <aside className="forever-album-side" aria-label={t("vaultPrivacyTitle")}>
          <NeoCard title={t("vaultPrivacyTitle")} className="forever-album-timeline">
            <div>
              <strong>{t("vaultTimelineOne")}</strong>
              <span>{t("step1")}</span>
            </div>
            <div>
              <strong>{t("vaultTimelineTwo")}</strong>
              <span>{t("step2")}</span>
            </div>
            <div>
              <strong>{t("vaultTimelineThree")}</strong>
              <span>{t("step3")}</span>
            </div>
          </NeoCard>

          <div className="forever-album-safety-strip">
            <div>
              <strong>{t("vaultSafetyOne")}</strong>
              <span>{t("feature1Desc")}</span>
            </div>
            <div>
              <strong>{t("vaultSafetyTwo")}</strong>
              <span>{t("feature2Desc")}</span>
            </div>
            <div>
              <strong>{t("vaultSafetyThree")}</strong>
              <span>{t("feature3Desc")}</span>
            </div>
          </div>
        </aside>
      </div>

      {showViewer && viewingPhoto && (
        <NeoCard variant="erobo" className="viewer-card">
          <div className="viewer-header">
            <span className="viewer-title">{t("photoViewer")}</span>
            <NeoButton variant="secondary" onClick={() => dispatch("closeViewer")} aria-label={t("close")}>
              {t("close")}
            </NeoButton>
          </div>
          {viewingPhoto.encrypted ? (
            <div className="encrypted-notice">
              <span>{t("photoEncrypted")}</span>
              <NeoButton variant="primary" onClick={() => dispatch("openDecrypt")} aria-label={t("decrypt")}>
                {t("decrypt")}
              </NeoButton>
            </div>
          ) : (
            <img src={viewingPhoto.data} className="viewer-img" alt={t("albumPhoto")} />
          )}
          <div className="viewer-meta">
            <span className="meta-label">{t("photoId")}: {viewingPhoto.id}</span>
            <span className="meta-label">{t("createdAt")}: {new Date(viewingPhoto.createdAt).toLocaleDateString()}</span>
          </div>
        </NeoCard>
      )}

      {showDecrypt && (
        <NeoCard variant="erobo" className="decrypt-card">
          <div className="decrypt-header">
            <span className="decrypt-title">{t("decryptTitle")}</span>
            <NeoButton variant="secondary" onClick={() => dispatch("closeDecrypt")} aria-label={t("close")}>
              {t("close")}
            </NeoButton>
          </div>
          <NeoInput
            value={password}
            type="password"
            label={t("password")}
            placeholder={t("passwordPlaceholder")}
            onChange={setPassword}
          />
          <NeoButton
            variant="primary"
            loading={decrypting}
            onClick={() => dispatch("handleDecrypt", password)}
            aria-label={t("decrypt")}
          >
            {t("decrypt")}
          </NeoButton>
          {decryptedPreview && (
            <img src={decryptedPreview} className="decrypted-img" alt={t("decryptedPhoto")} />
          )}
        </NeoCard>
      )}
    </div>
  );
}
