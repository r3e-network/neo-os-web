import { useEffect, useMemo } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import AlbumGrid from "./components/AlbumGrid";
import { getForeverAlbumLaunchDefaults } from "./launch";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
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

type TxReceipt = {
  txid?: string;
  success?: boolean;
};

function formatBytes(value: number, t: PlayAreaProps["t"]) {
  if (!Number.isFinite(value) || value <= 0) return `0 ${t("sizeUnitByte")}`;
  if (value < 1024) return `${value} ${t("sizeUnitByte")}`;
  return `${(value / 1024).toFixed(1)} ${t("sizeUnitKbyte")}`;
}

function compactTxId(txid: string) {
  if (txid.length <= 18) return txid;
  return `${txid.slice(0, 10)}...${txid.slice(-8)}`;
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { num, bool, str, val } = useStateBindings(state);
  const launchDefaults = useMemo(
    () => getForeverAlbumLaunchDefaults(launchContext),
    [launchContext.signature],
  );

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
  const uploadError = str("uploadError", "");
  const decryptedPreview = str("decryptedPreview", "");
  const totalPayloadSize = num("totalPayloadSize");
  const photos = val<PhotoView[]>("photos") ?? [];
  const viewingPhoto = val<PhotoView | null>("viewingPhoto", null);
  const selectedImages = val<SelectedImage[]>("selectedImages") ?? [];
  const lastTx = val<TxReceipt | null>("lastTx", null);
  const uploadLimit = 60 * 1024;
  const uploadPct = Math.min(
    100,
    Math.round((totalPayloadSize / uploadLimit) * 100),
  );
  const passwordMissing = isEncrypted && password.trim().length === 0;
  const payloadTooLarge = totalPayloadSize > uploadLimit;
  const uploadDisabled =
    selectedImages.length === 0 ||
    uploading ||
    passwordMissing ||
    payloadTooLarge;
  const hasSelection = selectedImages.length > 0;
  const uploadReadiness = uploading
    ? t("uploading")
    : passwordMissing
      ? t("passwordRequired")
      : payloadTooLarge
        ? t("totalTooLarge")
        : selectedImages.length > 0
          ? t("readyToSign")
          : isEncrypted
            ? t("encryptionNote")
            : t("vaultPublicNote");

  useEffect(() => {
    state.isEncrypted?.set(launchDefaults.isEncrypted);
  }, [launchContext.signature, launchDefaults.isEncrypted, state.isEncrypted]);

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
    document
      .querySelector<HTMLInputElement>(".forever-album-file-picker input")
      ?.click();
  };

  return (
    <div className="album-play-area">
      <div className="forever-album-shell">
        <section
          className="forever-album-hero"
          aria-labelledby="forever-album-title"
        >
          <div className="forever-album-hero-head">
            <span className="forever-album-hero-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.6" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </span>
            <div className="forever-album-hero-copy">
              <span className="forever-album-kicker">{t("title")}</span>
              <h1 id="forever-album-title">{t("vaultHeroTitle")}</h1>
              <p>{t("vaultHeroSubtitle")}</p>
              <div className="forever-album-hero-facts">
                <span>
                  {t("vaultTimelineOne")} » {t("vaultTimelineTwo")} »{" "}
                  {t("vaultTimelineThree")}
                </span>
              </div>
            </div>
          </div>
          <div className="forever-album-actions">
            <NeoButton variant="primary" onClick={openFilePicker}>
              {t("emptyAction")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              disabled={loadingPhotos}
              onClick={() => dispatch("refreshPhotos")}
            >
              {t("refreshAlbum")}
            </NeoButton>
          </div>
        </section>

        <div
          className="forever-album-vault-strip"
          aria-label={t("vaultStatsTitle")}
        >
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

        <NeoCard
          title={t("vaultUploadTitle")}
          className="forever-album-workspace"
        >
          <AlbumGrid
            t={t}
            photos={photos}
            loading={loadingPhotos}
            onView={(photo) => dispatch("viewPhoto", photo)}
            onUpload={openFilePicker}
          />

          <div className="forever-album-uploader">
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

            <p className="forever-album-uploader-cap">
              {t("sizeHint", {
                size: formatBytes(totalPayloadSize, t),
                max: "60 KB",
              })}
            </p>

            {(hasSelection || totalPayloadSize > 0) && (
              <>
                <div className="forever-album-upload-meta">
                  <span>
                    {t("selectedCount")}: {selectedImages.length}
                  </span>
                  <span>
                    {t("payloadSize")}: {formatBytes(totalPayloadSize, t)}
                  </span>
                </div>

                <div className="forever-album-upload-meter">
                  <span style={{ width: `${Math.max(4, uploadPct)}%` }} />
                </div>
              </>
            )}

            {uploadError && (
              <div
                className="forever-album-upload-error"
                role="alert"
                aria-live="polite"
              >
                <strong>{t("uploadNeedsAttention")}</strong>
                <span>{uploadError}</span>
              </div>
            )}

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

            {hasSelection && (
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
              <span>{uploadReadiness}</span>
              <NeoButton
                variant="primary"
                disabled={uploadDisabled}
                loading={uploading}
                onClick={() => dispatch("uploadPhotos")}
              >
                {t("upload")}
              </NeoButton>
            </div>

            {lastTx?.txid && (
              <div
                className="forever-album-tx-receipt"
                role="status"
                aria-live="polite"
              >
                <span>{t("lastTransaction")}</span>
                <strong title={lastTx.txid}>{compactTxId(lastTx.txid)}</strong>
                <em>
                  {lastTx.success === false
                    ? t("transactionPending")
                    : t("transactionConfirmed")}
                </em>
              </div>
            )}
          </div>
        </NeoCard>

        <details className="forever-album-howto">
          <summary>{t("vaultPrivacyTitle")}</summary>
          <div className="forever-album-howto-body">
            <div className="forever-album-howto-steps">
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
            </div>
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
          </div>
        </details>
      </div>

      {showViewer && viewingPhoto && (
        <NeoCard variant="erobo" className="viewer-card">
          <div className="viewer-header">
            <span className="viewer-title">{t("photoViewer")}</span>
            <NeoButton
              variant="secondary"
              onClick={() => dispatch("closeViewer")}
              aria-label={t("close")}
            >
              {t("close")}
            </NeoButton>
          </div>
          {viewingPhoto.encrypted ? (
            <div className="encrypted-notice">
              <span>{t("photoEncrypted")}</span>
              <NeoButton
                variant="primary"
                onClick={() => dispatch("openDecrypt")}
                aria-label={t("decrypt")}
              >
                {t("decrypt")}
              </NeoButton>
            </div>
          ) : (
            <img
              src={viewingPhoto.data}
              className="viewer-img"
              alt={t("albumPhoto")}
            />
          )}
          <div className="viewer-meta">
            <span className="meta-label">
              {t("photoId")}: {viewingPhoto.id}
            </span>
            <span className="meta-label">
              {t("createdAt")}:{" "}
              {new Date(viewingPhoto.createdAt).toLocaleDateString()}
            </span>
          </div>
        </NeoCard>
      )}

      {showDecrypt && (
        <NeoCard variant="erobo" className="decrypt-card">
          <div className="decrypt-header">
            <span className="decrypt-title">{t("decryptTitle")}</span>
            <NeoButton
              variant="secondary"
              onClick={() => dispatch("closeDecrypt")}
              aria-label={t("close")}
            >
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
            <img
              src={decryptedPreview}
              className="decrypted-img"
              alt={t("decryptedPhoto")}
            />
          )}
        </NeoCard>
      )}
    </div>
  );
}
