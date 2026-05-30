import { useState } from "react";
import { NeoButton, NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
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
  const [message, setMessage] = useState("");

  const address = str("address", "");
  const signature = str("signature", "");
  const txHash = str("txHash", "");
  const isSigning = bool("isSigning");
  const isBroadcasting = bool("isBroadcasting");
  const signCount = num("signCount");
  const broadcastCount = num("broadcastCount");
  const messageBytes = messageByteLength(message);
  const canSubmit = message.trim().length > 0 && messageBytes <= 1024;
  const canBroadcast = canSubmit;
  const signaturePreview = signature ? shortValue(signature) : t("noSignatureYet");
  const txHashPreview = txHash ? shortValue(txHash) : t("noBroadcastYet");

  return (
    <div className="sign-play-area">
      <div className="sign-shell">
        <section className="sign-main" aria-label={t("signHeroTitle")}>
          <div className="sign-hero">
            <div className="sign-hero-copy">
              <span className="sign-hero-accent" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
              </span>
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
              <div>
                <span>{t("walletAddress")}</span>
                <strong>{address ? shortValue(address) : t("walletPrompt")}</strong>
              </div>
            </div>
          </div>

          <div className="sign-flow-strip" aria-label={t("signFlowTitle")}>
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

          <div className="sign-workspace">
            <NeoCard variant="erobo" className="sign-message-panel">
              <div className="sign-section-heading">
                <span>{t("signatureDeskTitle")}</span>
                <strong>{messageBytes}/1024 bytes</strong>
              </div>
              <label className="sign-message-field">
                <span>{t("messageLabel")}</span>
                <textarea
                  value={message}
                  placeholder={t("messagePlaceholder")}
                  rows={6}
                  onChange={(event) => setMessage(event.currentTarget.value)}
                />
              </label>
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
              <div className="sign-result-stack">
                <div className="sign-result-box">
                  <span>{t("signatureResult")}</span>
                  <strong>{signaturePreview}</strong>
                  <button
                    type="button"
                    disabled={!signature}
                    onClick={() => dispatch("copyToClipboard", signature)}
                  >
                    {t("copySignature")}
                  </button>
                </div>
                <div className="sign-result-box">
                  <span>{t("broadcastResult")}</span>
                  <strong>{txHashPreview}</strong>
                  <button
                    type="button"
                    disabled={!txHash}
                    onClick={() => dispatch("copyToClipboard", txHash)}
                  >
                    {t("copyTxHash")}
                  </button>
                </div>
              </div>
            </NeoCard>
          </div>
        </section>

        <aside className="sign-side" aria-label={t("safetyPanelTitle")}>
          <NeoCard variant="erobo" className="sign-safety-panel">
            <div className="sign-section-heading">
              <span>{t("safetyPanelTitle")}</span>
              <strong>{address ? t("connected") : t("disconnected")}</strong>
            </div>
            <p>{t("safetyPanelCopy")}</p>
            <div className="sign-signal-row">
              <span>{t("signRouteLabel")}</span>
              <strong>{t("signContractRoute")}</strong>
            </div>
            <div className="sign-signal-row">
              <span>{t("broadcastRouteLabel")}</span>
              <strong>{t("broadcastContractRoute")}</strong>
            </div>
            <div className="sign-signal-row">
              <span>{t("privacyLabel")}</span>
              <strong>{t("privacyValue")}</strong>
            </div>
          </NeoCard>

          <NeoCard variant="erobo" className="sign-broadcast-panel">
            <div className="sign-section-heading">
              <span>{t("broadcastPanelTitle")}</span>
              <strong>{t("walletReviewed")}</strong>
            </div>
            <p>{t("broadcastPanelCopy")}</p>
            <div className="sign-signal-row">
              <span>{t("gasAmountLabel")}</span>
              <strong>0 GAS</strong>
            </div>
            <div className="sign-signal-row">
              <span>{t("messageBytesLabel")}</span>
              <strong>{messageBytes}/1024</strong>
            </div>
          </NeoCard>
        </aside>
      </div>
    </div>
  );
}
