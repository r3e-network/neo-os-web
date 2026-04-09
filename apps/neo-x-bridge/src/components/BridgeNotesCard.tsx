import { NeoCard } from "@shared/components-react";
import "./BridgeNotesCard.scss";

interface BridgeNotesCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function BridgeNotesCard({ t }: BridgeNotesCardProps) {
  return (
    <NeoCard variant="erobo" className="notes-card">
      <span className="notes-title">{t("bridgeNotes")}</span>
      <p className="notes-text">{t("bridgeNotesText")}</p>
      <p className="notes-text">{t("walletNoticeText")}</p>
    </NeoCard>
  );
}
