import { Coins } from "lucide-react";
import { NeoCard, NeoButton } from "@shared/components-react";

export interface RoundItem {
  id: string;
  creator: string;
  assetSymbol: string;
  matchingPool: bigint;
  matchingRemaining: bigint;
  totalContributed: bigint;
  projectCount: bigint;
  startTime: number;
  endTime: number;
  status: string;
  title: string;
  description: string;
  finalized?: boolean;
  cancelled?: boolean;
}

interface RoundListProps {
  rounds: Array<Record<string, unknown>>;
  selectedRoundId: string;
  isRefreshing: boolean;
  roundStatusLabel: (round: Record<string, unknown>) => string;
  formatAmount: (v: unknown) => string;
  formatSchedule: (v: unknown) => string;
  formatAddress: (addr: string) => string;
  onRefresh: () => void;
  onSelect: (round: Record<string, unknown>) => void;
  t: (key: string) => string;
}

export default function RoundList({
  rounds,
  selectedRoundId,
  isRefreshing,
  roundStatusLabel,
  formatAmount,
  formatSchedule,
  formatAddress,
  onRefresh,
  onSelect,
  t,
}: RoundListProps) {
  return (
    <NeoCard
      title={t("roundsTitle")}
      className="qf-round-panel"
      header={
        <NeoButton
          size="sm"
          variant="secondary"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          {t("refresh")}
        </NeoButton>
      }
    >
      {rounds.length === 0 ? (
        <div className="qf-empty-ledger">
          <span className="qf-empty-ledger__icon" aria-hidden="true">
            <Coins />
          </span>
          <strong>{t("qfNoRoundTitle")}</strong>
          <span>{t("qfNoRoundBody")}</span>
          <span className="qf-empty-ledger__preview">
            {t("qfRoundsEmptyPreview")}
          </span>
        </div>
      ) : (
        <div className="qf-round-list">
          {rounds.map((round) => {
            const isSelected = selectedRoundId === String(round.id);
            return (
              <button
                key={String(round.id)}
                type="button"
                className={`qf-round-card${isSelected ? " is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(round)}
              >
                <span className="qf-round-card-top">
                  <strong>{String(round.title || `#${round.id}`)}</strong>
                  <span
                    className={`qf-status-pill ${String(round.status || "active")}`}
                  >
                    {roundStatusLabel(round)}
                  </span>
                </span>
                <span className="qf-round-card-copy">
                  {String(
                    round.description || t("roundDescriptionPlaceholder"),
                  )}
                </span>
                <span className="qf-round-card-grid">
                  <span>
                    <small>{t("matchingRemaining")}</small>
                    <b>
                      {formatAmount(
                        round.matchingRemaining ?? round.matchingPool,
                      )}
                    </b>
                  </span>
                  <span>
                    <small>{t("totalContributed")}</small>
                    <b>{formatAmount(round.totalContributed)}</b>
                  </span>
                  <span>
                    <small>{t("roundSchedule")}</small>
                    <b>
                      {formatSchedule(round.startTime)} -{" "}
                      {formatSchedule(round.endTime)}
                    </b>
                  </span>
                  <span>
                    <small>{t("roundCreator")}</small>
                    <b>{formatAddress(String(round.creator || ""))}</b>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </NeoCard>
  );
}
