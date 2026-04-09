import { NeoButton } from "@shared/components-react";
import "./BridgeActions.scss";

interface BridgeActionsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  onOpenBridge: () => void;
  onAddWallet: () => void;
  onOpenExplorer: () => void;
  onOpenDocs: () => void;
}

export default function BridgeActions({ t, onOpenBridge, onAddWallet, onOpenExplorer, onOpenDocs }: BridgeActionsProps) {
  return (
    <div className="action-row">
      <NeoButton variant="primary" block onClick={onOpenBridge}>
        {t("officialBridge")}
      </NeoButton>
      <NeoButton variant="secondary" block onClick={onAddWallet}>
        {t("addWallet")}
      </NeoButton>
      <NeoButton variant="secondary" block onClick={onOpenExplorer}>
        {t("openExplorer")}
      </NeoButton>
      <NeoButton variant="secondary" block onClick={onOpenDocs}>
        {t("openDocs")}
      </NeoButton>
    </div>
  );
}
