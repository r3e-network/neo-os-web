import { NeoCard } from "@shared/components-react";
import "./SignResultCards.scss";

interface SignResultCardsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  signature: string;
  txHash: string;
  onCopy: (text: string) => void;
}

export default function SignResultCards({ t, signature, txHash, onCopy }: SignResultCardsProps) {
  return (
    <>
      {signature && (
        <div className="result-card" role="status" aria-live="polite">
          <NeoCard variant="erobo">
            <div className="result-header">
              <span className="result-title">{t("signatureResult")}</span>
              <button
                type="button"
                className="copy-btn"
                aria-label={t("copySignature")}
                onClick={() => onCopy(signature)}
              >
                <span className="copy-text">{t("copy")}</span>
              </button>
            </div>
            <span className="result-text">{signature}</span>
          </NeoCard>
        </div>
      )}

      {txHash && (
        <div className="result-card" role="status" aria-live="polite">
          <NeoCard variant="erobo">
            <div className="result-header">
              <span className="result-title">{t("broadcastResult")}</span>
              <button
                type="button"
                className="copy-btn"
                aria-label={t("copyTxHash")}
                onClick={() => onCopy(txHash)}
              >
                <span className="copy-text">{t("copy")}</span>
              </button>
            </div>
            <span className="result-text">{txHash}</span>
            <span className="success-msg">{t("broadcastSuccess")}</span>
          </NeoCard>
        </div>
      )}
    </>
  );
}
