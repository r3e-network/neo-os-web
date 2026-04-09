import { NeoCard } from "@shared/components-react";
import "./NetworkInfoCard.scss";

interface NetworkInfoCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  networkName: string;
  chainId: string;
}

export default function NetworkInfoCard({ t, networkName, chainId }: NetworkInfoCardProps) {
  return (
    <NeoCard variant="erobo" className="network-card">
      <div className="network-header">
        <span className="network-name">{networkName}</span>
        <span className="chain-id">{t("chainId")}: {chainId}</span>
      </div>
    </NeoCard>
  );
}
