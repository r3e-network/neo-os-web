import { useRef } from "react";
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
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
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
  const signaturePreview = signature ? shortValue(signature) : t("noSignatureYet");
  const txHashPreview = txHash
    ? shortValue(txHash)
    : txPending
      ? t("txPending")
      : t("noBroadcastYet");

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
    <div className="sign-play-area">
      <div className="sign-shell">
        <section className="sign-main" aria-label={t("signHeroTitle")}>
          <div className="sign-hero">
            <span className="sign-hero-accent" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </span>
            <div className="sign-hero-copy">
              <span className="sign-hero-eyebrow">{t("signHeroKicker")}</span>
              <h2>{t("signHeroTitle")}</h2>
              <p>{t("signHeroSubtitle")}</p>
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

          <details className="sign-flow-disclosure">
            <summary>
              <span className="sign-flow-disclosure__label">{t("signFlowTitle")}</span>
              <svg className="sign-flow-disclosure__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
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
              <label className="sign-message-field">
                <span>{t("messageLabel")}</span>
                <textarea
                  value={message}
                  placeholder={t("messagePlaceholder")}
                  rows={6}
                  onChange={(event) => dispatch("setMessage", event.currentTarget.value)}
                />
              </label>
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
                  {t("signFileBtn")}
                </NeoButton>
                <span className="sign-file-note">{t("hashedFileNotice")}</span>
              </div>
              <div className="sign-action-grid">
                <NeoButton
                  variant="primary"
                  loading={isSigning}
                  disabled={!canSubmit || isSigning}
                  onClick={() => dispatch("signMessage", message)}
                >
                  {t("signBtn")}
                </NeoButton>
                <NeoButton
                  variant="secondary"
                  loading={isBroadcasting}
                  disabled={!canBroadcast || isBroadcasting}
                  onClick={() => dispatch("broadcastMessage", message)}
                >
                  {t("broadcastBtn")}
                </NeoButton>
              </div>
              {!address && (
                <p className="sign-wallet-note">{t("walletPromptCopy")}</p>
              )}
            </NeoCard>

            <NeoCard variant="erobo" className="sign-result-panel">
              <div className="sign-section-heading">
                <span>{t("resultPanelTitle")}</span>
                <strong>{signature || txHash ? t("ready") : t("awaitingSignature")}</strong>
              </div>
              {!signature && !txHash && (
                <div className="sign-result-placeholder">
                  <span className="sign-result-placeholder__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12.5 11 14.5 15.5 10" />
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <p>{t("proofEmptyHint")}</p>
                </div>
              )}
              <div className="sign-result-stack">
                <div className={`sign-result-box${signature ? "" : " is-empty"}`}>
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
                      {t("copySignature")}
                    </button>
                    <button
                      type="button"
                      disabled={!signature}
                      title={t("verifyBundleHint")}
                      onClick={() => dispatch("copyToClipboard", verifyBundle)}
                    >
                      {t("copyVerifyBundle")}
                    </button>
                  </div>
                  {signature && (
                    <span className="sign-result-meta">{t("verifyBundleHint")}</span>
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
                      {t("copyTxHash")}
                    </button>
                    {txHash && (
                      <a
                        className="sign-result-link"
                        href={explorerTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
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
                <svg className="sign-details__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
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
