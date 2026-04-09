import type { ReactNode } from "react";
import { NeoButton } from "@shared/components-react";
import "./StationPanel.scss";

interface StationPanelProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  mode: "burger" | "jazz";
  onSetMode: (mode: "burger" | "jazz") => void;
  walletConnected: boolean;
  canSubmit: boolean;
  loading: boolean;
  onPrimaryAction: () => void;
  onJazzAction: () => void;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  children?: ReactNode;
}

export default function StationPanel({ t, mode, onSetMode, walletConnected, canSubmit, loading, onPrimaryAction, onJazzAction, children }: StationPanelProps) {
  return (
    <div className="station">
      <div className="station-tabs">
        <NeoButton variant={mode === "burger" ? "primary" : "secondary"} onClick={() => onSetMode("burger")}>{t("burgerStation")}</NeoButton>
        <NeoButton variant={mode === "jazz" ? "primary" : "secondary"} onClick={() => onSetMode("jazz")}>{t("jazzUp")}</NeoButton>
      </div>

      {mode === "burger" ? (
        <div className="station-card">
          <div className="station-header">
            <span className="station-title">{t("burgerStation")}</span>
          </div>
          {children}
          <span className="station-tip">{t("burgerTip")}</span>
          <NeoButton variant="primary" loading={loading} disabled={walletConnected ? !canSubmit : false} onClick={onPrimaryAction}>
            {loading ? t("processing") : t("swap")}
          </NeoButton>
        </div>
      ) : (
        <div className="station-card jazz-card">
          <div className="station-header">
            <span className="station-title">{t("jazzUp")}</span>
            <span className="station-subtitle">{t("jazzSubtitle")}</span>
          </div>
          <NeoButton variant="primary" onClick={onJazzAction}>{t("claimRewards")}</NeoButton>
        </div>
      )}
    </div>
  );
}
