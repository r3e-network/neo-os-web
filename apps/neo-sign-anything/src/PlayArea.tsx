import { useRef } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  FileCheck2,
  FileSignature,
  FileText,
  RadioTower,
  ScrollText,
  ShieldCheck,
  Upload,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { explorerTxUrl } from "./utils/explorer";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function shortValue(value: string): string {
  return value.length > 18
    ? `${value.slice(0, 10)}...${value.slice(-6)}`
    : value;
}

function messageByteLength(value: string): number {
  if (typeof TextEncoder === "undefined") return value.length;
  return new TextEncoder().encode(value).length;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const address = str("address", "");
  // The message lives in the composable observable so the file-hash flow (which
  // loads "sha256:<digest>" into it) and the textarea stay in sync.
  const message = str("message", "");
  const signature = str("signature", "");
  const publicKey = str("publicKey", "");
  const txHash = str("txHash", "");
  const txPending = bool("txPending");
  const isSigning = bool("isSigning");
  const isBroadcasting = bool("isBroadcasting");
  const signCount = num("signCount");
  const broadcastCount = num("broadcastCount");
  const messageBytes = messageByteLength(message);
  const canSubmit = message.trim().length > 0 && messageBytes <= 1024;
  const canBroadcast = canSubmit;
  const actionBusy = isSigning || isBroadcasting;
  const signaturePreview = signature
    ? shortValue(signature)
    : t("noSignatureYet");
  const txHashPreview = txHash
    ? shortValue(txHash)
    : txPending
      ? t("txPending")
      : t("noBroadcastYet");
  const trimmedMessage = message.trim();
  const isDigestMessage = /^sha256:[0-9a-f]{64}$/i.test(trimmedMessage);
  const messageKind = isDigestMessage
    ? t("messageTypeDigest")
    : t("messageTypePlain");
  const previewTitle = trimmedMessage
    ? messageKind
    : t("messagePreviewEmptyTitle");
  const previewStatus = canSubmit ? t("ready") : t("awaitingSignature");
  const byteUsage = Math.min(100, Math.round((messageBytes / 1024) * 100));
  const isOverLimit = messageBytes > 1024;
  const routeStageState = isSigning
    ? "signing"
    : isBroadcasting
      ? "broadcasting"
      : txHash
        ? "broadcasted"
        : signature
          ? "signed"
          : canSubmit
            ? "ready"
            : "empty";
  const routeStageTitle =
    routeStageState === "signing"
      ? t("signRouteStageSigning")
      : routeStageState === "broadcasting"
        ? t("signRouteStageBroadcasting")
        : routeStageState === "broadcasted"
          ? t("signRouteStageBroadcasted")
          : routeStageState === "signed"
            ? t("signRouteStageSigned")
            : routeStageState === "ready"
              ? t("signRouteStageReady")
              : t("signRouteStageEmpty");
  const routeStageHint =
    routeStageState === "signing"
      ? t("signRouteStageSigningHint")
      : routeStageState === "broadcasting"
        ? t("signRouteStageBroadcastingHint")
        : routeStageState === "broadcasted"
          ? t("signRouteStageBroadcastedHint")
          : routeStageState === "signed"
            ? t("signRouteStageSignedHint")
            : routeStageState === "ready"
              ? t("signRouteStageReadyHint")
              : t("signRouteStageEmptyHint");
  const playAreaClassName = [
    "sign-play-area",
    canSubmit ? "sign-play-area--ready" : "",
    signature ? "sign-play-area--signed" : "",
    txHash ? "sign-play-area--broadcasted" : "",
    actionBusy ? "sign-play-area--busy" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const documentPreviewClassName = [
    "sign-document-preview",
    "sign-document-preview--editor",
    canSubmit ? "sign-document-preview--ready" : "",
    isOverLimit ? "sign-document-preview--over-limit" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const resultPanelClassName = [
    "sign-result-panel",
    signature || txHash ? "sign-result-panel--ready" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const messageTemplates = [
    {
      key: "release",
      label: t("templateReleaseLabel"),
      body: t("templateReleaseBody"),
      Icon: FileText,
    },
    {
      key: "digest",
      label: t("templateDigestLabel"),
      body: t("templateDigestBody"),
      Icon: FileCheck2,
    },
    {
      key: "approval",
      label: t("templateApprovalLabel"),
      body: t("templateApprovalBody"),
      Icon: ScrollText,
    },
  ];

  // A self-describing verify bundle: everything a third party needs to confirm
  // authorship off-chain (address ⇄ public key ⇄ message ⇄ signature). The
  // signature alone is not enough — the verifier also needs the message and the
  // signer's public key/address.
  const verifyBundle = JSON.stringify(
    {
      address,
      message,
      signature,
      ...(publicKey ? { publicKey } : {}),
    },
    null,
    2,
  );

  return (
    <div className={playAreaClassName}>
      <div className="sign-shell">
        <section className="sign-main" aria-label={t("signHeroTitle")}>
          <div className="sign-hero">
            <div className="sign-hero-content">
              <div className="sign-hero-head">
                <span className="sign-hero-accent" aria-hidden="true">
                  <FileSignature size={24} />
                </span>
                <div className="sign-hero-copy">
                  <span className="sign-hero-eyebrow">
                    {t("signHeroKicker")}
                  </span>
                  <h2>{t("signHeroTitle")}</h2>
                  <p>{t("signHeroSubtitle")}</p>
                </div>
              </div>
              <div className="sign-hero-stats">
                <div>
                  <span>{t("signCount")}</span>
                  <strong>{signCount}</strong>
                </div>
                <div>
                  <span>{t("broadcastCount")}</span>
                  <strong>{broadcastCount}</strong>
                </div>
              </div>
            </div>
            <figure className="sign-hero-stage">
              <img src="./signature-desk.jpg" alt="" />
              <figcaption>
                <span>{t("signStageKicker")}</span>
                <strong>{t("signStageTitle")}</strong>
              </figcaption>
            </figure>
          </div>

          <details className="sign-flow-disclosure">
            <summary>
              <span className="sign-flow-disclosure__label">
                {t("signFlowTitle")}
              </span>
              <ChevronDown
                className="sign-flow-disclosure__chevron"
                size={18}
                aria-hidden="true"
              />
            </summary>
            <div className="sign-flow-strip">
              <div>
                <span>01</span>
                <strong>{t("signFlowStepOne")}</strong>
                <p>{t("signFlowStepOneCopy")}</p>
              </div>
              <div>
                <span>02</span>
                <strong>{t("signFlowStepTwo")}</strong>
                <p>{t("signFlowStepTwoCopy")}</p>
              </div>
              <div>
                <span>03</span>
                <strong>{t("signFlowStepThree")}</strong>
                <p>{t("signFlowStepThreeCopy")}</p>
              </div>
            </div>
          </details>

          <div className="sign-workspace">
            <NeoCard variant="erobo" className="sign-message-panel">
              <div className="sign-section-heading">
                <span>{t("signatureDeskTitle")}</span>
                <strong>
                  {messageBytes}/1024 {t("bytesUnit")}
                </strong>
              </div>
              <div className="sign-composer-shell">
                <div
                  className="sign-template-rail"
                  aria-label={t("messageTemplateLabel")}
                >
                  {messageTemplates.map(({ key, label, body, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void dispatch("setMessage", body)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div
                  className={documentPreviewClassName}
                  aria-label={t("messagePreviewLabel")}
                >
                  <div className="sign-document-preview__paper">
                    <div className="sign-document-preview__toolbar">
                      <span className="sign-document-preview__type">
                        {previewTitle}
                      </span>
                      <span className={canSubmit ? "is-ready" : ""}>
                        <ShieldCheck size={14} aria-hidden="true" />
                        {previewStatus}
                      </span>
                    </div>
                    <span
                      className="sign-document-preview__seal"
                      aria-hidden="true"
                    >
                      <ShieldCheck size={25} />
                    </span>
                    <label className="sign-message-field sign-message-field--paper">
                      <span>
                        {t("messageLabel")}
                        <em>{messageKind}</em>
                      </span>
                      <textarea
                        value={message}
                        placeholder={t("messagePlaceholder")}
                        rows={7}
                        onChange={(event) =>
                          dispatch("setMessage", event.currentTarget.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="sign-document-preview__meta">
                    <span>
                      <small>{t("messageBytesLabel")}</small>
                      <strong>
                        {messageBytes}/1024 {t("bytesUnit")}
                      </strong>
                    </span>
                    <span>
                      <small>{t("walletAddress")}</small>
                      <strong>
                        {address ? shortValue(address) : t("disconnected")}
                      </strong>
                    </span>
                    <span>
                      <small>{t("walletPrompt")}</small>
                      <strong>{previewStatus}</strong>
                    </span>
                  </div>
                </div>
                <section
                  className={`sign-route-stage sign-route-stage--${routeStageState}`}
                  aria-label={t("signRouteStageLabel")}
                  aria-live="polite"
                  aria-busy={actionBusy || undefined}
                >
                  <div className="sign-route-stage__copy">
                    <small>{t("signRouteStageLabel")}</small>
                    <strong>{routeStageTitle}</strong>
                    <span>{routeStageHint}</span>
                  </div>
                  <div className="sign-route-stage__rail" aria-hidden="true">
                    <span className="sign-route-stage__node sign-route-stage__node--message">
                      <FileText size={17} />
                    </span>
                    <span className="sign-route-stage__track sign-route-stage__track--wallet">
                      <span className="sign-route-stage__packet">
                        <FileSignature size={15} />
                      </span>
                    </span>
                    <span className="sign-route-stage__node sign-route-stage__node--wallet">
                      <WalletCards size={17} />
                    </span>
                    <span className="sign-route-stage__track sign-route-stage__track--proof">
                      <span className="sign-route-stage__packet sign-route-stage__packet--proof">
                        <BadgeCheck size={15} />
                      </span>
                    </span>
                    <span className="sign-route-stage__node sign-route-stage__node--proof">
                      <ShieldCheck size={17} />
                    </span>
                  </div>
                  <div className="sign-route-stage__labels" aria-hidden="true">
                    <span>{t("signRouteStageMessage")}</span>
                    <span>{t("signRouteStageWallet")}</span>
                    <span>{t("signRouteStageProof")}</span>
                  </div>
                </section>
                <div
                  className={`sign-byte-meter${isOverLimit ? " is-over" : ""}`}
                  role="progressbar"
                  aria-label={t("messageBytesLabel")}
                  aria-valuemin={0}
                  aria-valuemax={1024}
                  aria-valuenow={Math.min(messageBytes, 1024)}
                >
                  <span style={{ width: `${byteUsage}%` }} />
                </div>
                {isOverLimit && (
                  <p className="sign-composer-alert">{t("messageTooLong")}</p>
                )}
              </div>
              <div className="sign-file-row">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sign-file-input"
                  aria-label={t("signFileBtn")}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void dispatch("loadFileDigest", file);
                    // Allow re-selecting the same file to re-hash it.
                    event.currentTarget.value = "";
                  }}
                />
                <NeoButton
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={15} aria-hidden="true" />
                  {t("signFileBtn")}
                </NeoButton>
                <span className="sign-file-note">{t("hashedFileNotice")}</span>
              </div>
              <div className="sign-action-grid">
                <NeoButton
                  variant="primary"
                  loading={isSigning}
                  disabled={!canSubmit || actionBusy}
                  onClick={() => dispatch("signMessage", message)}
                >
                  <FileSignature size={17} aria-hidden="true" />
                  {t("signBtn")}
                </NeoButton>
                <NeoButton
                  variant="secondary"
                  loading={isBroadcasting}
                  disabled={!canBroadcast || actionBusy}
                  onClick={() => dispatch("broadcastMessage", message)}
                >
                  <RadioTower size={17} aria-hidden="true" />
                  {t("broadcastBtn")}
                </NeoButton>
              </div>
              {!address && (
                <p className="sign-wallet-note">{t("walletPromptCopy")}</p>
              )}
            </NeoCard>

            <NeoCard variant="erobo" className={resultPanelClassName}>
              <div className="sign-section-heading">
                <span>{t("resultPanelTitle")}</span>
                <strong>
                  {signature || txHash ? t("ready") : t("awaitingSignature")}
                </strong>
              </div>
              {!signature && !txHash && (
                <div className="sign-result-placeholder">
                  <span
                    className="sign-result-placeholder__icon"
                    aria-hidden="true"
                  >
                    <BadgeCheck size={26} />
                  </span>
                  <p>{t("proofEmptyHint")}</p>
                </div>
              )}
              <div className="sign-result-stack">
                <div
                  className={`sign-result-box${signature ? "" : " is-empty"}`}
                >
                  <span>{t("signatureResult")}</span>
                  <strong>{signaturePreview}</strong>
                  {publicKey && (
                    <span className="sign-result-meta">
                      {t("publicKeyLabel")}: {shortValue(publicKey)}
                    </span>
                  )}
                  <div className="sign-result-actions">
                    <button
                      type="button"
                      disabled={!signature}
                      onClick={() => dispatch("copyToClipboard", signature)}
                    >
                      <Copy size={14} aria-hidden="true" />
                      {t("copySignature")}
                    </button>
                    <button
                      type="button"
                      disabled={!signature}
                      title={t("verifyBundleHint")}
                      onClick={() => dispatch("copyToClipboard", verifyBundle)}
                    >
                      <FileCheck2 size={14} aria-hidden="true" />
                      {t("copyVerifyBundle")}
                    </button>
                  </div>
                  {signature && (
                    <span className="sign-result-meta">
                      {t("verifyBundleHint")}
                    </span>
                  )}
                </div>
                <div className={`sign-result-box${txHash ? "" : " is-empty"}`}>
                  <span>{t("broadcastResult")}</span>
                  <strong>{txHashPreview}</strong>
                  <div className="sign-result-actions">
                    <button
                      type="button"
                      disabled={!txHash}
                      onClick={() => dispatch("copyToClipboard", txHash)}
                    >
                      <Copy size={14} aria-hidden="true" />
                      {t("copyTxHash")}
                    </button>
                    {txHash && (
                      <a
                        className="sign-result-link"
                        href={explorerTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        {t("viewOnExplorer")}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </NeoCard>
          </div>
        </section>

        <aside className="sign-side" aria-label={t("safetyPanelTitle")}>
          <NeoCard variant="erobo" className="sign-safety-panel">
            <div className="sign-section-heading">
              <span>{t("safetyPanelTitle")}</span>
              <strong className={`sign-status-pill${address ? " is-on" : ""}`}>
                <WalletCards size={14} aria-hidden="true" />
                {address ? t("connected") : t("disconnected")}
              </strong>
            </div>
            <p>{t("safetyPanelCopy")}</p>

            <div className="sign-signal-grid">
              <div className="sign-signal-row">
                <span>{t("signRouteLabel")}</span>
                <strong>{t("signContractRoute")}</strong>
              </div>
              <div className="sign-signal-row">
                <span>{t("broadcastRouteLabel")}</span>
                <strong>{t("broadcastContractRoute")}</strong>
              </div>
              <div className="sign-signal-row">
                <span>{t("gasAmountLabel")}</span>
                <strong>0 GAS</strong>
              </div>
              <div className="sign-signal-row">
                <span>{t("messageBytesLabel")}</span>
                <strong>
                  {messageBytes}/1024 {t("bytesUnit")}
                </strong>
              </div>
              <div className="sign-signal-row">
                <span>{t("privacyLabel")}</span>
                <strong>{t("privacyValue")}</strong>
              </div>
            </div>

            <details className="sign-details">
              <summary>
                <span>{t("broadcastPanelTitle")}</span>
                <ChevronDown
                  className="sign-details__chevron"
                  size={18}
                  aria-hidden="true"
                />
              </summary>
              <div className="sign-details__body">
                <p>{t("broadcastPanelCopy")}</p>
                <p className="sign-fee-note">{t("networkFeeNote")}</p>
              </div>
            </details>
          </NeoCard>
        </aside>
      </div>
    </div>
  );
}
