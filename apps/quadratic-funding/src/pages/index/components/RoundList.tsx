import { NeoCard, NeoButton } from "@shared/components-react";

export interface RoundItem {
  id: string; creator: string; assetSymbol: string; matchingPool: bigint; matchingRemaining: bigint;
  totalContributed: bigint; projectCount: bigint; startTime: number; endTime: number; status: string; title: string; description: string;
}

interface RoundListProps {
  rounds: Array<Record<string, unknown>>; selectedRoundId: string; isRefreshing: boolean;
  roundStatusLabel: (round: Record<string, unknown>) => string; formatAmount: (v: unknown) => string;
  formatSchedule: (v: unknown) => string; formatAddress: (addr: string) => string;
  onRefresh: () => void; onSelect: (round: Record<string, unknown>) => void; t: (key: string) => string;
}

export default function RoundList({ rounds, selectedRoundId, isRefreshing, roundStatusLabel, formatAmount, formatSchedule, formatAddress, onRefresh, onSelect, t }: RoundListProps) {
  return (
    <NeoCard title={t("roundsTitle")}>
      <div className="rounds-header">
        <NeoButton size="sm" variant="secondary" loading={isRefreshing} onClick={onRefresh}>{t("refresh")}</NeoButton>
      </div>
      {rounds.length === 0 ? <span>{t("emptyRounds")}</span> : rounds.map((round) => (
        <div key={String(round.id)} className="round-card">
          <span className="round-title">{String(round.title || `#${round.id}`)}</span>
          <span className={`status-pill ${round.status}`}>{roundStatusLabel(round)}</span>
          <NeoButton size="sm" variant="secondary" onClick={() => onSelect(round)}>
            {selectedRoundId === String(round.id) ? t("selectedRound") : t("selectRound")}
          </NeoButton>
        </div>
      ))}
    </NeoCard>
  );
}
