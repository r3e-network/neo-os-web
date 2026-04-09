import "./ResultOverlay.scss";

interface ResultOverlayProps {
  visible: boolean;
  winAmount: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClose: () => void;
}

export default function ResultOverlay({ visible, winAmount, t, onClose }: ResultOverlayProps) {
  if (!visible) return null;
  const isWin = Number(winAmount) > 0;

  return (
    <button type="button" className="cinematic-overlay" aria-label={t("close")} onClick={onClose}>
      <div className="overlay-backdrop" />
      <div className={`overlay-content${isWin ? " is-win" : ""}`} aria-live="polite" role="status">
        <div className="congrats-text">{isWin ? t("overlayWinLabel") : t("overlayUnlucky")}</div>
        <div className="reward-circle">
          <div className="glow-ring" />
          <div className="content">
            <span className="amount">{isWin ? `+${winAmount}` : "0"}</span>
            <span className="unit">{t("tokenGas")}</span>
          </div>
        </div>
        <div className="win-label">{isWin ? t("overlayWinLabel") : t("overlayLoseLabel")}</div>
        <div className="tap-hint">{t("overlayTapContinue")}</div>
      </div>
    </button>
  );
}
