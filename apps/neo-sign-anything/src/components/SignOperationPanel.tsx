import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import "./SignOperationPanel.scss";

interface SignOperationPanelProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  message: string;
  address: string;
  isSigning: boolean;
  isBroadcasting: boolean;
  onUpdateMessage: (value: string) => void;
  onSign: () => void;
  onBroadcast: () => void;
}

export default function SignOperationPanel({
  t,
  message,
  address,
  isSigning,
  isBroadcasting,
  onUpdateMessage,
  onSign,
  onBroadcast,
}: SignOperationPanelProps) {
  return (
    <>
      {!address && (
        <div className="connect-prompt">
          <span className="connect-text">{t("connectWallet")}</span>
        </div>
      )}

      <NeoCard variant="erobo" className="operation-card">
        <div className="input-group">
          <NeoInput
            type="textarea"
            value={message}
            label={t("messageLabel")}
            placeholder={t("messagePlaceholder")}
            onChange={onUpdateMessage}
          />
          <div className="char-count">{message.length}/1000</div>
        </div>

        <div className="actions">
          <NeoButton
            variant="primary"
            loading={isSigning}
            onClick={onSign}
            disabled={!message || !address}
          >
            {t("signBtn")}
          </NeoButton>
          <NeoButton
            variant="ghost"
            loading={isBroadcasting}
            onClick={onBroadcast}
            disabled={!message || !address}
            className="broadcast-btn"
          >
            {t("broadcastBtn")}
          </NeoButton>
        </div>
      </NeoCard>
    </>
  );
}
