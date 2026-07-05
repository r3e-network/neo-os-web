/**
 * PlayArea.tsx — Forever Album (v2 scene-driven rebuild)
 *
 * NFT/social identity (gallery-elegant, platinum/ink, warm-bright). The album IS
 * the scene: a clean album workbench for imports, privacy, and saved memories.
 * Upload is the primary action; viewer/decrypt modals overlay; how-it-works
 * stays tucked into a drawer. Verified logic (useForeverAlbum — local storage +
 * AES-GCM) is untouched.
 */
import { useState } from "react";
import { ImagePlus, Images, LockKeyhole, ShieldCheck, UnlockKeyhole, X } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface PhotoView { id: string; data: string; encrypted: boolean; createdAt: string; }
interface SelectedImage { id: string; dataUrl: string; size: number; }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, str, num, val } = useStateBindings(state);
  const uploading = bool("uploading");
  const showViewer = bool("showViewer");
  const showDecrypt = bool("showDecrypt");
  const decrypting = bool("decrypting");
  const isEncrypted = bool("isEncrypted");
  const photosCount = num("photosCount");
  const encryptedCount = num("encryptedCount");
  const publicCount = num("publicCount");
  const totalPayloadSize = num("totalPayloadSize");
  const maxTotalBytes = num("maxTotalBytes") || 61440;
  const password = str("password", "");
  const uploadError = str("uploadError", "");
  const decryptedPreview = str("decryptedPreview", "");
  const decryptError = str("decryptError", "");
  const photos = (val("photos") ?? []) as PhotoView[];
  const viewingPhoto = val<PhotoView | null>("viewingPhoto", null);
  const selectedImages = (val("selectedImages") ?? []) as SelectedImage[];

  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void dispatch("addFiles", Array.from(files));
  };
  const handleUpload = () => { void dispatch("uploadPhotos"); };

  const draftStatusTitle = uploading
    ? t("stageSealingTitle")
    : selectedImages.length > 0
      ? t("stageReadyTitle")
      : photos.length > 0
        ? t("stageArchiveTitle")
        : t("stageEmptyTitle");
  const draftStatusCopy = uploading
    ? t("stageSealingCopy")
    : selectedImages.length > 0
      ? t("stageReadyCopy")
      : photos.length > 0
        ? t("stageArchiveCopy")
        : t("stageEmptyCopy");
  const privacyModeLabel = isEncrypted ? t("stagePrivateMode") : t("stagePublicMode");
  const PrivacyIcon = isEncrypted ? LockKeyhole : UnlockKeyhole;
  const previewFrames = selectedImages.slice(0, 4);
  const frameLabels = [t("stageEmptyFrameOne"), t("stageEmptyFrameTwo"), t("stageEmptyFrameThree")];

  // ----- The scene: a clean album workbench, not a textured background -----
  const scene = (
    <div className="album-workbench" data-state={uploading ? "sealing" : selectedImages.length > 0 ? "ready" : photos.length > 0 ? "archive" : "empty"} data-private={isEncrypted ? "true" : undefined}>
      <figure className="album-workbench__memory-card" aria-label={t("albumMemoryStageLabel")}>
        <img className="album-workbench__memory-image" src="./forever-album-memory-stage.webp" alt={t("albumMemoryStageAlt")} />
        <figcaption className="album-workbench__memory-caption">
          <span>{t("albumTab")}</span>
          <strong>{draftStatusTitle}</strong>
          <small>{draftStatusCopy}</small>
        </figcaption>
        <div className="album-workbench__memory-strip">
          <span><Images size={15} strokeWidth={2.2} /> {photosCount} {t("albumTab").toLowerCase()}</span>
          <span><PrivacyIcon size={15} strokeWidth={2.2} /> {privacyModeLabel}</span>
        </div>
      </figure>
      <div className="album-workbench__page">
        <div className="album-workbench__frames" aria-label={t("galleryStageTitle")}>
          {previewFrames.map((img, i) => (
            <div key={img.id} className={`album-workbench__frame album-workbench__frame--${i}`} style={{ backgroundImage: `url(${img.dataUrl})` }}>
              {isEncrypted && (
                <span className="album-workbench__lock" aria-label={t("encrypted")}>
                  <LockKeyhole size={14} strokeWidth={2.4} />
                </span>
              )}
            </div>
          ))}
          {previewFrames.length === 0 && frameLabels.map((label, i) => (
            <div key={label} className={`album-workbench__slot album-workbench__slot--${i}`}>
              {i === 0 ? <ImagePlus size={22} strokeWidth={1.8} /> : <span />}
              <strong>{label}</strong>
            </div>
          ))}
        </div>
        <aside className="album-workbench__status" aria-live="polite">
          <span className="album-workbench__mode">
            <PrivacyIcon size={15} strokeWidth={2.2} />
            {privacyModeLabel}
          </span>
          <h3>{draftStatusTitle}</h3>
          <p>{draftStatusCopy}</p>
          <div className="album-workbench__facts">
            <span>{selectedImages.length > 0 ? t("stageDraftCount", { count: selectedImages.length }) : t("stageEmptyCount")}</span>
            <span>{formatBytes(totalPayloadSize)} / {formatBytes(maxTotalBytes)}</span>
          </div>
        </aside>
      </div>
    </div>
  );

  // ----- Upload controls -----
  const controls = (
    <div className="album-controls">
      {uploadError && <p className="album-controls__error" role="alert">{uploadError}</p>}
      <label
        className={["album-import", dragOver ? "album-import--over" : null].filter(Boolean).join(" ")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); }}
      >
        <input type="file" multiple accept="image/*" onChange={(e) => handleFileSelect(e.target.files)} hidden />
        <span className="album-import__icon" aria-hidden="true"><ImagePlus size={20} strokeWidth={2.1} /></span>
        <span className="album-import__copy">
          <strong>{selectedImages.length > 0 ? t("selectMore") : t("startHere")}</strong>
          <small>{t("uploadHint", { count: selectedImages.length, max: 5 })}</small>
        </span>
      </label>
      {selectedImages.length > 0 && (
        <div className="album-controls__preview">
          {selectedImages.map((img) => (
            <div key={img.id} className="album-controls__thumb" style={{ backgroundImage: `url(${img.dataUrl})` }}>
              <button type="button" className="album-controls__thumb-remove" onClick={() => void dispatch("removeImage", img.id)} aria-label={t("remove")}>
                <X size={12} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="album-privacy-toggle" data-active={isEncrypted ? "true" : undefined}>
        <input className="album-privacy-toggle__input" type="checkbox" checked={isEncrypted} onChange={(e) => state.isEncrypted?.set(e.target.checked)} disabled={uploading} />
        <span className="album-privacy-toggle__icon" aria-hidden="true">
          <ShieldCheck size={18} strokeWidth={2.1} />
        </span>
        <span className="album-privacy-toggle__copy">
          <strong>{privacyModeLabel}</strong>
          <small>{isEncrypted ? t("privacyModePrivateHint") : t("privacyModePublicHint")}</small>
        </span>
      </label>
      {isEncrypted && (
        <input className="album-controls__input" type="password" value={password} onChange={(e) => state.password?.set(e.target.value)} placeholder={t("passwordPlaceholder")} disabled={uploading} />
      )}
      {selectedImages.length > 0 && (
        <p className="album-controls__meta">{t("selectedCount", { count: selectedImages.length })} · {formatBytes(totalPayloadSize)} / {formatBytes(maxTotalBytes)}</p>
      )}
    </div>
  );

  // Photo grid (gallery) — rendered inside the scene area when photos exist
  const gallery = photos.length > 0 ? (
    <div className="album-gallery">
      {photos.map((photo) => (
        <button key={photo.id} type="button" className="album-gallery__item" onClick={() => void dispatch("viewPhoto", { id: photo.id, data: photo.data, encrypted: photo.encrypted, createdAt: photo.createdAt })}>
          {photo.encrypted ? (
            <span className="album-gallery__locked" aria-label={t("encrypted")}>
              <LockKeyhole size={24} strokeWidth={1.9} />
            </span>
          ) : (
            <img src={photo.data} alt={t("albumPhoto")} loading="lazy" />
          )}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="album-play-area mx2 mx2-cat-nft">
      <PlayStage
        category="nft"
        stage={{
          eyebrow: t("title"),
          title: uploading ? t("uploading") : t("vaultHeroTitle"),
          subtitle: t("vaultHeroSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {photosCount} {t("albumTab").toLowerCase()}</span>
              {encryptedCount > 0 && <span className="mx2-badge"><LockKeyhole size={12} strokeWidth={2.3} /> {encryptedCount}</span>}
            </>
          ),
        }}
        scene={<div className="album-stage-stack">{scene}{controls}{gallery}</div>}
        score={[
          { label: t("albumTab"), value: String(photosCount), accent: true },
          { label: t("sidebarEncrypted"), value: String(encryptedCount) },
          { label: t("sidebarPublic"), value: String(publicCount) },
        ]}
        actions={{
          primary: {
            label: uploading ? t("uploading") : t("upload"),
            onClick: () => void handleUpload(),
            disabled: uploading || selectedImages.length === 0,
            loading: uploading,
          },
          secondary: [{ label: t("refreshAlbum"), onClick: () => void dispatch("refreshPhotos"), hint: t("refreshAlbum") }],
        }}
        drawerToggleLabel={t("vaultPrivacyTitle")}
        drawer={{ title: t("vaultPrivacyTitle"), children: (
          <>
            <h4>{t("vaultPrivacyTitle")}</h4>
            <p>{t("localStorageNote")}</p>
            <p>{t("step1")}</p>
            <p>{t("step2")}</p>
            <p>{t("step3")}</p>
            <h4>{t("vaultSafetyOne")}</h4>
            <p>{t("vaultSafetyTwo")}</p>
            <p>{t("vaultSafetyThree")}</p>
          </>
        ) }}
      />

      {/* Viewer modal */}
      {showViewer && viewingPhoto && (
        <div className="album-modal" role="dialog" aria-modal="true" onClick={() => void dispatch("closeViewer")}>
          <div className="album-modal__card" onClick={(e) => e.stopPropagation()}>
            {viewingPhoto.encrypted && !decryptedPreview ? (
              <div className="album-modal__encrypted">
                <span><LockKeyhole size={34} strokeWidth={1.8} /></span>
                <p>{t("photoEncrypted")}</p>
                <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => void dispatch("openDecrypt")}>{t("decrypt")}</button>
              </div>
            ) : (
              <img className="album-modal__img" src={decryptedPreview || viewingPhoto.data} alt={t("albumPhoto")} />
            )}
            <div className="album-modal__meta">
              <span>{t("createdAt")}: {viewingPhoto.createdAt}</span>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => { if (window.confirm(t("deletePhoto"))) void dispatch("deletePhoto", viewingPhoto.id); }}>{t("deletePhoto")}</button>
            </div>
            <button type="button" className="album-modal__close" onClick={() => void dispatch("closeViewer")} aria-label={t("close")}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* Decrypt modal */}
      {showDecrypt && (
        <div className="album-modal" role="dialog" aria-modal="true" onClick={() => void dispatch("closeDecrypt")}>
          <div className="album-modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>{t("decryptTitle")}</h3>
            <input className="album-controls__input" type="password" value={password} onChange={(e) => state.password?.set(e.target.value)} placeholder={t("passwordPlaceholder")} disabled={decrypting} />
            {decryptError && <p className="album-controls__error" role="alert">{decryptError}</p>}
            <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => void dispatch("handleDecrypt", password)} disabled={decrypting || !password}>{decrypting ? t("decrypting") : t("decrypt")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
