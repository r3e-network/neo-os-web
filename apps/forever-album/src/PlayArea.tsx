import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  HardDrive,
  ImagePlus,
  Images,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
  WalletCards,
  X,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface PhotoView {
  id: string;
  data: string;
  encrypted: boolean;
  createdAt: number;
}

interface SelectedImage {
  id: string;
  dataUrl: string;
  size: number;
  payloadBytes: number;
}

interface FrameItem {
  id: string;
  dataUrl: string;
  encrypted: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function compactWallet(address: string, disconnected: string): string {
  if (!address) return disconnected;
  if (address.length <= 16) return address;
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, str, num, val } = useStateBindings(state);
  const loadingPhotos = bool("loadingPhotos");
  const processingFiles = bool("processingFiles");
  const uploading = bool("uploading");
  const showViewer = bool("showViewer");
  const showDecrypt = bool("showDecrypt");
  const decrypting = bool("decrypting");
  const isEncrypted = bool("isEncrypted");
  const photosCount = num("photosCount");
  const encryptedCount = num("encryptedCount");
  const totalPayloadSize = num("totalPayloadSize");
  const maxTotalBytes = num("maxTotalBytes") || 2 * 1024 * 1024;
  const albumPayloadSize = num("albumPayloadSize");
  const maxAlbumBytes = num("maxAlbumBytes") || 3 * 1024 * 1024;
  const password = str("password", "");
  const passwordConfirm = str("passwordConfirm", "");
  const decryptPassword = str("decryptPassword", "");
  const walletAddress = str("walletAddress", "");
  const uploadError = str("uploadError", "");
  const storageIssue = str("storageIssue", "");
  const storageMessage = str("storageMessage", "");
  const storageNotice = str("storageNotice", "");
  const decryptedPreview = str("decryptedPreview", "");
  const decryptError = str("decryptError", "");
  const photos = (val("photos") ?? []) as PhotoView[];
  const viewingPhoto = val<PhotoView | null>("viewingPhoto", null);
  const selectedImages = (val("selectedImages") ?? []) as SelectedImage[];

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showViewer && !showDecrypt) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      void dispatch(showDecrypt ? "closeDecrypt" : "closeViewer");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dispatch, showDecrypt, showViewer]);

  const draftBusy = uploading || processingFiles;
  const handleFileSelect = (files: FileList | File[] | null) => {
    if (draftBusy || !files || files.length === 0) return;
    void dispatch("addFiles", Array.from(files));
  };

  const batchTooLarge = totalPayloadSize > maxTotalBytes;
  const missingPassword = isEncrypted && password.length === 0;
  const passwordMismatch = isEncrypted && password !== passwordConfirm;
  const canSave = selectedImages.length > 0
    && !processingFiles
    && !batchTooLarge
    && !missingPassword
    && !passwordMismatch;
  const capacityPercent = Math.min(100, (albumPayloadSize / Math.max(1, maxAlbumBytes)) * 100);
  const walletLabel = compactWallet(walletAddress, t("walletNotConnected"));

  const primaryLabel = processingFiles
    ? t("preparingPhotos")
    : uploading
    ? t("savingLocally")
    : selectedImages.length === 0
      ? t("selectPhotos")
      : batchTooLarge
        ? t("reduceSelection")
        : missingPassword || passwordMismatch
          ? t("reviewPassword")
          : t("saveToDevice");

  const handlePrimary = () => {
    if (selectedImages.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    void dispatch("uploadPhotos");
  };

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
  const privacyModeLabel = isEncrypted ? t("stagePrivateMode") : t("stageOpenMode");
  const PrivacyIcon = isEncrypted ? LockKeyhole : UnlockKeyhole;
  const frameLabels = [t("stageEmptyFrameOne"), t("stageEmptyFrameTwo"), t("stageEmptyFrameThree")];
  const frameItems: FrameItem[] = selectedImages.length > 0
    ? selectedImages.slice(0, 4).map((image) => ({
        id: image.id,
        dataUrl: image.dataUrl,
        encrypted: isEncrypted,
      }))
    : photos.slice(0, 4).map((photo) => ({
        id: photo.id,
        dataUrl: photo.encrypted ? "" : photo.data,
        encrypted: photo.encrypted,
      }));

  const scene = (
    <div
      className="album-workbench"
      data-state={uploading ? "sealing" : selectedImages.length > 0 ? "ready" : photos.length > 0 ? "archive" : "empty"}
      data-private={isEncrypted ? "true" : undefined}
    >
      <figure className="album-workbench__memory-card" aria-label={t("albumMemoryStageLabel")}>
        <img
          className="album-workbench__memory-image"
          src="./forever-album-memory-stage.webp"
          alt={t("albumMemoryStageAlt")}
        />
        <figcaption className="album-workbench__memory-caption">
          <span>{t("deviceAlbumEyebrow")}</span>
          <strong>{draftStatusTitle}</strong>
          <small>{draftStatusCopy}</small>
        </figcaption>
        <div className="album-workbench__memory-strip">
          <span><Images size={15} strokeWidth={2.2} /> {photosCount} {t("memories")}</span>
          <span><WalletCards size={15} strokeWidth={2.2} /> {walletLabel}</span>
        </div>
      </figure>

      <div className="album-workbench__page">
        <div className="album-workbench__frames" aria-label={t("galleryStageTitle")}>
          {frameItems.map((item, index) => (
            <div
              key={item.id}
              className={`album-workbench__frame album-workbench__frame--${index}`}
              style={item.dataUrl ? { backgroundImage: `url(${item.dataUrl})` } : undefined}
              data-locked={item.encrypted ? "true" : undefined}
            >
              {item.encrypted && (
                <span className="album-workbench__lock" aria-label={t("encrypted")}>
                  <LockKeyhole size={16} strokeWidth={2.4} />
                </span>
              )}
            </div>
          ))}
          {frameItems.length === 0 && frameLabels.map((label, index) => (
            <div key={label} className={`album-workbench__slot album-workbench__slot--${index}`}>
              {index === 0 ? <ImagePlus size={22} strokeWidth={1.8} /> : <span />}
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
            <span>
              {selectedImages.length > 0
                ? t("stageDraftCount", { count: selectedImages.length })
                : t("stageSavedCount", { count: photosCount })}
            </span>
            <span>{formatBytes(totalPayloadSize)} / {formatBytes(maxTotalBytes)}</span>
          </div>
        </aside>
      </div>
    </div>
  );

  const controls = (
    <div className="album-controls">
      <div className="album-device-note">
        <span className="album-device-note__icon"><HardDrive size={19} strokeWidth={2.1} /></span>
        <span className="album-device-note__copy">
          <strong>{t("deviceOnlyTitle")}</strong>
          <small>{t("durabilityWarning")}</small>
        </span>
        <span className="album-device-note__capacity">
          <span>{formatBytes(albumPayloadSize)} / {formatBytes(maxAlbumBytes)}</span>
          <span className="album-device-note__meter" aria-hidden="true">
            <span style={{ width: `${capacityPercent}%` }} />
          </span>
        </span>
      </div>

      {storageMessage && (
        <div className="album-recovery" role="alert">
          <AlertTriangle size={18} strokeWidth={2.1} />
          <span><strong>{t("storageNeedsAttention")}</strong><small>{storageMessage}</small></span>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("refreshPhotos")}>
            <RefreshCw size={14} strokeWidth={2.2} /> {t("retry")}
          </button>
          {storageIssue === "corrupt" && (
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost album-recovery__reset"
              onClick={() => {
                if (window.confirm(t("resetAlbumConfirm"))) void dispatch("resetDamagedAlbum");
              }}
            >
              <Trash2 size={14} strokeWidth={2.2} /> {t("resetAlbum")}
            </button>
          )}
        </div>
      )}
      {storageNotice && <p className="album-controls__notice" role="status">{storageNotice}</p>}
      {uploadError && <p className="album-controls__error" role="alert">{uploadError}</p>}

      <label
        className={["album-import", dragOver ? "album-import--over" : null].filter(Boolean).join(" ")}
        data-disabled={draftBusy ? "true" : undefined}
        onDragOver={(event) => { event.preventDefault(); if (!draftBusy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (draftBusy) return;
          handleFileSelect(event.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          disabled={draftBusy}
          onChange={(event) => {
            handleFileSelect(event.target.files);
            event.target.value = "";
          }}
          hidden
        />
        <span className="album-import__icon" aria-hidden="true"><ImagePlus size={20} strokeWidth={2.1} /></span>
        <span className="album-import__copy">
          <strong>{selectedImages.length > 0 ? t("selectMore") : t("chooseMemories")}</strong>
          <small>{t("uploadHint", { count: selectedImages.length, max: 5 })}</small>
        </span>
      </label>

      <label className="album-privacy-toggle" data-active={isEncrypted ? "true" : undefined}>
        <input
          className="album-privacy-toggle__input"
          type="checkbox"
          checked={isEncrypted}
          onChange={(event) => state.isEncrypted?.set(event.target.checked)}
          disabled={draftBusy}
        />
        <span className="album-privacy-toggle__icon" aria-hidden="true">
          <ShieldCheck size={18} strokeWidth={2.1} />
        </span>
        <span className="album-privacy-toggle__copy">
          <strong>{privacyModeLabel}</strong>
          <small>{isEncrypted ? t("privacyModePrivateHint") : t("privacyModeOpenHint")}</small>
        </span>
      </label>

      {selectedImages.length > 0 && (
        <div className="album-controls__preview" aria-label={t("selectedMemories")}>
          {selectedImages.map((image) => (
            <div key={image.id} className="album-controls__thumb" style={{ backgroundImage: `url(${image.dataUrl})` }}>
              <button
                type="button"
                className="album-controls__thumb-remove"
                onClick={() => void dispatch("removeImage", image.id)}
                aria-label={t("remove")}
                disabled={draftBusy}
              >
                <X size={12} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isEncrypted && (
        <div className="album-passwords">
          <span className="album-passwords__icon" aria-hidden="true"><KeyRound size={18} strokeWidth={2.1} /></span>
          <label>
            <span>{t("encryptionPassword")}</span>
            <input
              className="album-controls__input"
              type="password"
              value={password}
              onChange={(event) => state.password?.set(event.target.value)}
              placeholder={t("passwordPlaceholder")}
              autoComplete="new-password"
              disabled={draftBusy}
            />
          </label>
          <label>
            <span>{t("confirmPasswordLabel")}</span>
            <input
              className="album-controls__input"
              type="password"
              value={passwordConfirm}
              onChange={(event) => state.passwordConfirm?.set(event.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              autoComplete="new-password"
              disabled={draftBusy}
            />
          </label>
          <small data-error={password && passwordConfirm && passwordMismatch ? "true" : undefined}>
            {password && passwordConfirm && passwordMismatch
              ? t("passwordMismatch")
              : t("passwordRecoveryWarning")}
          </small>
        </div>
      )}

      {selectedImages.length > 0 && (
        <div className="album-controls__batch" data-over={batchTooLarge ? "true" : undefined}>
          <span>{t("selectedCount", { count: selectedImages.length })}</span>
          <strong>{formatBytes(totalPayloadSize)} / {formatBytes(maxTotalBytes)}</strong>
          <span className="album-controls__batch-meter" aria-hidden="true">
            <span style={{ width: `${Math.min(100, totalPayloadSize / Math.max(1, maxTotalBytes) * 100)}%` }} />
          </span>
        </div>
      )}
    </div>
  );

  const gallery = photos.length > 0 || loadingPhotos ? (
    <section className="album-library" aria-labelledby="album-library-title">
      <header className="album-library__header">
        <span><Images size={17} strokeWidth={2.1} /></span>
        <div>
          <h3 id="album-library-title">{t("yourMemories")}</h3>
          <p>{loadingPhotos ? t("loading") : t("savedOnThisDevice", { count: photosCount })}</p>
        </div>
      </header>
      {loadingPhotos ? (
        <div className="album-library__loading" role="status">{t("loading")}</div>
      ) : (
        <div className="album-gallery">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="album-gallery__item"
              onClick={() => void dispatch("viewPhoto", photo)}
              aria-label={photo.encrypted ? t("openEncryptedMemory") : t("openMemory")}
            >
              <span className="album-gallery__visual">
                {photo.encrypted ? (
                  <span className="album-gallery__locked">
                    <LockKeyhole size={25} strokeWidth={1.9} />
                    <small>{t("encrypted")}</small>
                  </span>
                ) : (
                  <img src={photo.data} alt="" loading="lazy" />
                )}
              </span>
              <span className="album-gallery__caption">
                <strong>{photo.encrypted ? t("privateMemory") : t("openMemoryLabel")}</strong>
                <small>{formatDate(photo.createdAt)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  ) : null;

  return (
    <div className="album-play-area mx2 mx2-cat-social">
      <PlayStage
        category="social"
        stage={{
          eyebrow: t("deviceAlbumEyebrow"),
          title: t("vaultHeroTitle"),
          subtitle: t("vaultHeroSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent"><HardDrive size={12} strokeWidth={2.3} /> {t("deviceOnlyBadge")}</span>
              {encryptedCount > 0 && <span className="mx2-badge"><LockKeyhole size={12} strokeWidth={2.3} /> {encryptedCount} {t("encrypted")}</span>}
            </>
          ),
        }}
        scene={<div className="album-stage-stack">{scene}{controls}{gallery}</div>}
        score={[
          { label: t("memories"), value: String(photosCount), accent: true },
          { label: t("sidebarEncrypted"), value: String(encryptedCount) },
          { label: t("deviceStorage"), value: formatBytes(albumPayloadSize) },
        ]}
        actions={{
          primary: {
            label: primaryLabel,
            onClick: handlePrimary,
            disabled: draftBusy || (selectedImages.length > 0 && !canSave),
            loading: draftBusy,
          },
          secondary: [{
            label: t("refreshAlbum"),
            onClick: () => void dispatch("refreshPhotos"),
            disabled: loadingPhotos,
            hint: t("refreshAlbum"),
          }],
        }}
        drawerToggleLabel={t("privacyAndStorage")}
        drawer={{
          title: t("privacyAndStorage"),
          children: (
            <div className="album-privacy-drawer">
              <h4>{t("walletPartitionTitle")}</h4>
              <p>{t("localStorageNote")}</p>
              <h4>{t("encryptionTitle")}</h4>
              <p>{t("encryptionNote")}</p>
              <h4>{t("noSyncTitle")}</h4>
              <p>{t("durabilityWarning")}</p>
            </div>
          ),
        }}
      />

      {showViewer && viewingPhoto && (
        <div className="album-modal" role="dialog" aria-modal="true" aria-labelledby="album-viewer-title" onClick={() => void dispatch("closeViewer")}>
          <div className="album-modal__card" onClick={(event) => event.stopPropagation()}>
            <h3 id="album-viewer-title" className="album-modal__title">{t("memoryPreview")}</h3>
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
              <span>{formatDate(viewingPhoto.createdAt)}</span>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost album-modal__delete"
                onClick={() => {
                  if (window.confirm(t("deletePhotoConfirm"))) void dispatch("deletePhoto", viewingPhoto.id);
                }}
              >
                <Trash2 size={14} strokeWidth={2.2} /> {t("deletePhoto")}
              </button>
            </div>
            <button type="button" className="album-modal__close" onClick={() => void dispatch("closeViewer")} aria-label={t("close")}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {showDecrypt && (
        <div className="album-modal" role="dialog" aria-modal="true" aria-labelledby="album-decrypt-title" onClick={() => void dispatch("closeDecrypt")}>
          <form
            className="album-modal__card album-modal__card--decrypt"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void dispatch("handleDecrypt", decryptPassword);
            }}
          >
            <span className="album-modal__key" aria-hidden="true"><KeyRound size={22} strokeWidth={2} /></span>
            <h3 id="album-decrypt-title">{t("decryptTitle")}</h3>
            <p>{t("decryptHelp")}</p>
            <label className="album-modal__field">
              <span>{t("password")}</span>
              <input
                className="album-controls__input"
                type="password"
                value={decryptPassword}
                onChange={(event) => state.decryptPassword?.set(event.target.value)}
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
                autoFocus
                disabled={decrypting}
              />
            </label>
            {decryptError && <p className="album-controls__error" role="alert">{decryptError}</p>}
            <div className="album-modal__actions">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("closeDecrypt")}>{t("cancel")}</button>
              <button type="submit" className="mx2-btn mx2-btn--primary" disabled={decrypting || !decryptPassword}>
                {decrypting ? t("decrypting") : t("decrypt")}
              </button>
            </div>
            <button type="button" className="album-modal__close" onClick={() => void dispatch("closeDecrypt")} aria-label={t("close")}>
              <X size={18} strokeWidth={2.5} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
