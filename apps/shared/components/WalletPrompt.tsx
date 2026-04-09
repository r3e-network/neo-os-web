import { useState, useCallback } from "react";
import { ActionModal } from "./ActionModal";
import { NeoButton } from "@shared/components-react";
import { AppIcon } from "./AppIcon";
import { useI18n } from "@shared/react";
import "./WalletPrompt.scss";

export interface WalletPromptProps {
  visible: boolean;
  message?: string | null;
  onClose?: () => void;
  onConnect?: () => void;
}

export function WalletPrompt({ visible, message, onClose, onConnect }: WalletPromptProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleConnect = useCallback(async () => {
    setLoading(true);
    try {
      onConnect?.();
    } finally {
      setLoading(false);
    }
  }, [onConnect]);

  return (
    <ActionModal
      visible={visible}
      title={t("wpTitle")}
      variant="warning"
      closeable
      onClose={onClose}
      actions={
        <NeoButton variant="ghost" size="sm" onClick={() => onClose?.()} aria-label={t("wpCancel")}>
          {t("wpCancel")}
        </NeoButton>
      }
    >
      <div className="wallet-prompt" role="status" aria-live="polite">
        <span className="wallet-prompt__desc">{message || t("wpDescription")}</span>
        <NeoButton
          variant="primary"
          size="lg"
          loading={loading}
          onClick={handleConnect}
          aria-label={t("wpConnect")}
          className="wallet-prompt__btn"
        >
          <AppIcon name="wallet" size={18} />
          {t("wpConnect")}
        </NeoButton>
      </div>
    </ActionModal>
  );
}

export default WalletPrompt;
