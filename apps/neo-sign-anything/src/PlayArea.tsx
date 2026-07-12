import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  ClipboardCopy,
  FileCheck2,
  FileUp,
  Fingerprint,
  Hash as HashIcon,
  History,
  KeyRound,
  Settings2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import {
  MAX_FILE_BYTES,
  MAX_SIGNING_BYTES,
  type FileDigestInfo,
  type SignatureHistoryItem,
  type SignatureProofArtifact,
  type SigningMode,
} from "./signing-artifact";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

type DrawerMode = "proof" | "encoding" | "history";

const signatureDeskUrl = new URL("../public/signature-desk.webp", import.meta.url).href;
const EMPTY_HISTORY: SignatureHistoryItem[] = [];

function shortValue(value: string, lead = 12, tail = 8): string {
  if (!value) return "";
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusCopyKey(input: {
  address: string;
  isHashing: boolean;
  lastError: string;
  operationStatus: string;
  payloadStatus: string;
  signature: string;
}): string {
  if (input.isHashing) return "statusHashing";
  if (input.operationStatus === "wallet") return "statusWallet";
  if (input.operationStatus === "connecting") return "statusConnecting";
  if (input.operationStatus === "stale") return "statusStale";
  if (input.lastError) return "statusError";
  if (input.signature) return "statusComplete";
  if (!input.address) return "statusConnect";
  if (input.payloadStatus === "preparing") return "statusPreparing";
  if (input.payloadStatus === "ready") return "statusReady";
  return "statusCompose";
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("proof");

  const address = str("address");
  const network = str("network");
  const message = str("message");
  const signingMode = str("signingMode", "bound") as SigningMode;
  const signingDomain = str("signingDomain");
  const fileInfo = val<FileDigestInfo | null>("fileInfo", null);
  const payloadText = str("payloadText");
  const payloadHash = str("payloadHash");
  const payloadBytes = num("payloadBytes");
  const payloadStatus = str("payloadStatus", "empty");
  const payloadError = str("payloadError");
  const signature = str("signature");
  const signatureEncoding = str("signatureEncoding");
  const publicKey = str("publicKey");
  const artifact = val<SignatureProofArtifact | null>("artifact", null);
  const proofBundle = str("proofBundle");
  const isConnecting = bool("isConnecting");
  const isHashing = bool("isHashing");
  const isSigning = bool("isSigning");
  const operationStatus = str("operationStatus", "idle");
  const lastError = str("lastError");
  const signCount = num("signCount");
  const historyItems = val<SignatureHistoryItem[]>("history", EMPTY_HISTORY) ?? EMPTY_HISTORY;
  const historyStorageHealthy = val<boolean>("historyStorageHealthy", true) ?? true;

  const busy = isConnecting || isHashing || isSigning;
  const activeError = lastError || payloadError;
  const hasMessage = message.trim().length > 0;
  const contextReady = Boolean(address && network);
  const payloadReady = payloadStatus === "ready";
  const modeLabel = signingMode === "bound" ? t("boundModeShort") : t("exactModeShort");
  const kindLabel = fileInfo ? t("fileDigestKind") : t("textKind");
  const currentStatusKey = statusCopyKey({
    address,
    isHashing,
    lastError: activeError,
    operationStatus,
    payloadStatus,
    signature,
  });
  const progress = Math.min(100, Math.round((payloadBytes / MAX_SIGNING_BYTES) * 100));

  const handlePrimary = () => {
    if (!contextReady) {
      void dispatch("connectWallet");
      return;
    }
    void dispatch("signMessage");
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    void dispatch("loadFileDigest", file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const scene = (
    <div
      className="sign-desk"
      data-state={operationStatus}
      data-complete={signature ? "true" : undefined}
    >
      <div className="sign-desk__workspace">
        <section className="sign-desk__paper" aria-label={t("composerTitle")}>
          <header className="sign-desk__paper-head">
            <div>
              <FileCheck2 size={17} aria-hidden="true" />
              <span>{kindLabel}</span>
            </div>
            <span className="sign-desk__mode-chip">{modeLabel}</span>
          </header>

          <OpenUiTextArea
            className="sign-desk__message-field"
            label={t("messageLabel")}
            value={message}
            rows={4}
            maxLength={MAX_SIGNING_BYTES}
            disabled={busy}
            placeholder={t("messagePlaceholder")}
            onChange={(event) => void dispatch("setMessage", event.target.value)}
            hint={fileInfo ? t("fileDigestLoaded") : t("messageHint")}
          />

          {fileInfo ? (
            <div className="sign-desk__file-chip">
              <FileCheck2 size={15} aria-hidden="true" />
              <span>
                <strong>{fileInfo.name}</strong>
                <small>{formatBytes(fileInfo.size)} · SHA-256</small>
              </span>
            </div>
          ) : null}

          <div className="sign-desk__payload-card" data-ready={payloadReady ? "true" : undefined}>
            <div className="sign-desk__payload-head">
              <span><Fingerprint size={15} aria-hidden="true" /> {t("exactPayloadTitle")}</span>
              <strong>{formatBytes(payloadBytes)}</strong>
            </div>
            <pre>{payloadText || (payloadError ? payloadError : t(contextReady ? "payloadWaitingContent" : "payloadWaitingWallet"))}</pre>
            <div className="sign-desk__digest">
              <HashIcon size={14} aria-hidden="true" />
              <code>{payloadHash || t("hashPending")}</code>
            </div>
            <div className="sign-desk__meter" data-error={payloadError ? "true" : undefined}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <div className="sign-desk__handoff" aria-hidden="true">
          <span />
          <ArrowRight size={18} />
        </div>

        <section className="sign-desk__proof" aria-live="polite">
          <div className="sign-desk__photo">
            <img src={signatureDeskUrl} alt={t("deskImageAlt")} loading="eager" decoding="async" />
          </div>
          <div className="sign-desk__proof-status">
            <span className="sign-desk__seal" data-active={signature ? "true" : undefined}>
              {signature ? <BadgeCheck size={22} /> : <ShieldCheck size={22} />}
            </span>
            <div>
              <small>{t("signingRoute")}</small>
              <strong>{t(currentStatusKey)}</strong>
              <p>{activeError || t(`${currentStatusKey}Hint`)}</p>
            </div>
          </div>

          <div className="sign-desk__route" aria-label={t("signingRoute")}>
            <span data-active={hasMessage ? "true" : undefined}>
              <FileCheck2 size={13} /><em>{t("routePrepare")}</em>
            </span>
            <span data-active={operationStatus === "wallet" || signature ? "true" : undefined}>
              <WalletCards size={13} /><em>{t("routeWallet")}</em>
            </span>
            <span data-active={signature ? "true" : undefined}>
              <BadgeCheck size={13} /><em>{t("routeProof")}</em>
            </span>
          </div>

          <dl className="sign-desk__context">
            <div>
              <dt>{t("walletAddress")}</dt>
              <dd>{address ? shortValue(address, 9, 6) : t("notConnected")}</dd>
            </div>
            <div>
              <dt>{t("networkLabel")}</dt>
              <dd>{network || t("networkPending")}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="sign-desk__signature"
            onClick={() => void dispatch("copyToClipboard", signature)}
            disabled={!signature}
          >
            <span>
              <KeyRound size={15} aria-hidden="true" />
              {signature ? t("copySignature") : t("signaturePending")}
            </span>
            <code>{signature ? shortValue(signature, 16, 10) : t("walletReturnsHere")}</code>
          </button>
        </section>
      </div>

      <input
        ref={fileInputRef}
        className="sign-desk__file-input"
        type="file"
        aria-label={t("loadFile")}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );

  const proofPanel = (
    <OpenUiPanel
      className="sign-details__panel sign-details__panel--proof"
      icon={<BadgeCheck size={18} aria-hidden="true" />}
      title={t("proofPanelTitle")}
      subtitle={artifact ? t("proofPanelReady") : t("proofPanelEmpty")}
    >
      {artifact ? (
        <>
          <dl className="sign-details__facts">
            <div><dt>{t("payloadHashLabel")}</dt><dd>{shortValue(artifact.payload.sha256, 18, 12)}</dd></div>
            <div><dt>{t("signatureEncodingLabel")}</dt><dd>{signatureEncoding.toUpperCase()}</dd></div>
            <div><dt>{t("boundAccountLabel")}</dt><dd>{shortValue(artifact.signer.address, 12, 8)}</dd></div>
            <div><dt>{t("publicKeyLabel")}</dt><dd>{publicKey ? shortValue(publicKey, 14, 10) : t("notReturned")}</dd></div>
          </dl>
          <div className="sign-details__actions">
            <button type="button" className="mx2-btn mx2-btn--primary" onClick={() => void dispatch("copyToClipboard", proofBundle)}>
              <ClipboardCopy size={15} /> {t("copyProofBundle")}
            </button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("copyToClipboard", signature)}>
              {t("copySignature")}
            </button>
          </div>
          <OpenUiNotice
            className="sign-details__notice"
            icon={artifact.signer.binding === "signed-envelope"
              ? <ShieldCheck size={17} aria-hidden="true" />
              : <AlertCircle size={17} aria-hidden="true" />}
            title={t(artifact.signer.binding === "signed-envelope" ? "boundAssuranceTitle" : "exactAssuranceTitle")}
            type={artifact.signer.binding === "signed-envelope" ? "info" : "warning"}
          >
            {t(artifact.signer.binding === "signed-envelope" ? "boundAssuranceCopy" : "exactAssuranceCopy")}
          </OpenUiNotice>
        </>
      ) : (
        <div className="sign-details__empty">
          <Fingerprint size={26} aria-hidden="true" />
          <span>{t("proofPanelEmptyCopy")}</span>
        </div>
      )}
    </OpenUiPanel>
  );

  const encodingPanel = (
    <OpenUiPanel
      className="sign-details__panel sign-details__panel--encoding"
      icon={<Settings2 size={18} aria-hidden="true" />}
      title={t("encodingPanelTitle")}
      subtitle={t("encodingPanelCopy")}
    >
      <OpenUiSegmented
        className="sign-details__mode-control"
        label={t("signingModeLabel")}
        value={signingMode}
        onChange={(value) => void dispatch("setSigningMode", value)}
        options={[
          { value: "bound", label: t("boundMode") },
          { value: "exact", label: t("exactMode") },
        ]}
      />
      {signingMode === "bound" ? (
        <OpenUiTextField
          className="sign-details__domain-field"
          label={t("domainLabel")}
          value={signingDomain}
          maxLength={64}
          disabled={busy}
          onChange={(event) => void dispatch("setSigningDomain", event.target.value)}
          hint={t("domainHint")}
          spellCheck={false}
        />
      ) : null}
      <OpenUiNotice
        className="sign-details__notice"
        icon={signingMode === "bound" ? <ShieldCheck size={17} /> : <AlertCircle size={17} />}
        title={t(signingMode === "bound" ? "boundModeNoticeTitle" : "exactModeNoticeTitle")}
        type={signingMode === "bound" ? "info" : "warning"}
      >
        {t(signingMode === "bound" ? "boundModeNoticeCopy" : "exactModeNoticeCopy")}
      </OpenUiNotice>
    </OpenUiPanel>
  );

  const historyPanel = (
    <OpenUiPanel
      className="sign-details__panel sign-details__panel--history"
      icon={<History size={18} aria-hidden="true" />}
      title={t("historyPanelTitle")}
      subtitle={t("historyPanelCopy", { count: historyItems.length })}
    >
      {!historyStorageHealthy ? (
        <OpenUiNotice
          className="sign-details__notice"
          icon={<AlertCircle size={17} />}
          title={t("historyUnavailableTitle")}
          type="warning"
        >
          {t("historyUnavailableCopy")}
        </OpenUiNotice>
      ) : null}
      {historyItems.length ? (
        <div className="sign-history">
          {historyItems.map((item) => (
            <article key={item.id}>
              <span className="sign-history__icon"><Fingerprint size={16} /></span>
              <div>
                <strong>{item.kind === "file-digest" ? t("fileDigestKind") : t("textKind")}</strong>
                <code>{shortValue(item.payloadSha256, 14, 10)}</code>
              </div>
              <small>{formatDate(item.createdAt)} · {formatBytes(item.payloadBytes)}</small>
            </article>
          ))}
          <button type="button" className="mx2-btn mx2-btn--ghost sign-history__clear" onClick={() => void dispatch("clearHistory")}>
            {t("clearHistory")}
          </button>
        </div>
      ) : (
        <div className="sign-details__empty"><History size={25} /><span>{t("historyEmpty")}</span></div>
      )}
    </OpenUiPanel>
  );

  const drawer = (
    <div className="sign-details">
      <div className="sign-details__tabs" role="tablist" aria-label={t("detailsLabel")}>
        {[
          { mode: "proof" as const, icon: <BadgeCheck size={15} />, label: t("proofTab"), meta: artifact ? t("ready") : t("waiting") },
          { mode: "encoding" as const, icon: <Settings2 size={15} />, label: t("encodingTab"), meta: modeLabel },
          { mode: "history" as const, icon: <History size={15} />, label: t("historyTab"), meta: String(historyItems.length) },
        ].map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            aria-controls="sign-details-panel"
            id={`sign-details-tab-${item.mode}`}
            className={drawerMode === item.mode ? "is-active" : undefined}
            onClick={() => setDrawerMode(item.mode)}
          >
            {item.icon}<span>{item.label}</span><em>{item.meta}</em>
          </button>
        ))}
      </div>
      <div
        className="sign-details__active"
        role="tabpanel"
        id="sign-details-panel"
        aria-labelledby={`sign-details-tab-${drawerMode}`}
      >
        {drawerMode === "proof" ? proofPanel : drawerMode === "encoding" ? encodingPanel : historyPanel}
      </div>
    </div>
  );

  const primaryLabel = !contextReady
    ? isConnecting ? t("connectingWallet") : t("connectWalletShort")
    : isSigning ? t("signingNow") : t("signBtn");
  const primaryDisabled = busy || (contextReady && (!hasMessage || !payloadReady));

  return (
    <OpenUiProvider>
      <div className="tool-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("heroKicker"),
            title: t("heroTitle"),
            subtitle: t("heroSubtitle"),
            badges: (
              <>
                <span className="mx2-badge" data-tone={contextReady ? "accent" : undefined}>
                  <span className="mx2-badge__dot" />
                  {contextReady ? t("walletReady") : t("walletNeeded")}
                </span>
                <span className="mx2-badge">{signCount} {t("signedUnit")}</span>
              </>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: primaryLabel,
              onClick: handlePrimary,
              loading: isConnecting || isSigning,
              disabled: primaryDisabled,
              hint: !contextReady ? t("connectHint") : payloadError || t("signHint"),
            },
            secondary: [
              {
                label: isHashing ? t("hashingFile") : t("loadFile"),
                onClick: () => fileInputRef.current?.click(),
                loading: isHashing,
                disabled: busy,
                hint: t("fileHint", { size: Math.round(MAX_FILE_BYTES / (1024 * 1024)) }),
                icon: <FileUp size={16} />,
              },
            ],
          }}
          drawerToggleLabel={t("detailsLabel")}
          drawer={{ title: t("detailsTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
