import { NeoButton } from "@shared/components-react";

interface TarotActionsProps { t: (key: string, params?: Record<string, string | number>) => string; isLoading: boolean; hasDrawn: boolean; onDraw: () => void; onReset: () => void; }

export default function TarotActions({ t, isLoading, hasDrawn, onDraw, onReset }: TarotActionsProps) {
  return (
    <div className="action-buttons" style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 400 }}>
      {!hasDrawn && (
        <NeoButton variant="primary" size="lg" block loading={isLoading} onClick={onDraw}>
          {isLoading ? t("drawingCards") : t("drawCards")}
        </NeoButton>
      )}
      {hasDrawn && <NeoButton variant="secondary" size="lg" block onClick={onReset}>{t("drawAgain")}</NeoButton>}
    </div>
  );
}
