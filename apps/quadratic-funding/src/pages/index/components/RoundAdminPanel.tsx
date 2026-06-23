import { useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  Gauge,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { NeoInput, NeoButton, NeoCard } from "@shared/components-react";

interface SuggestedMatch {
  id: string;
  name: string;
  contributedDisplay: string;
  donors: string;
  matchDisplay: string;
  matchBaseUnits: string;
}

interface RoundAdminPanelProps {
  round: Record<string, unknown>;
  canManage: boolean;
  canFinalize: boolean;
  canClaimUnused: boolean;
  canCancel: boolean;
  isAdmin: boolean;
  isAddingMatching: boolean;
  isFinalizing: boolean;
  isClaimingUnused: boolean;
  isCancelling: boolean;
  /** IDs of projects registered in the selected round, for finalize guidance. */
  knownProjectIds?: string[];
  /** Client-computed quadratic match preview for the selected round. */
  suggestedMatches?: SuggestedMatch[];
  onAddMatching: (...args: unknown[]) => void;
  onFinalize: (...args: unknown[]) => void;
  onFinalizeSuggested: () => void;
  onClaimUnused: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}

export default function RoundAdminPanel({
  round,
  canManage,
  canFinalize,
  canClaimUnused,
  canCancel,
  isAdmin,
  isAddingMatching,
  isFinalizing,
  isClaimingUnused,
  isCancelling,
  knownProjectIds: knownProjectIdList = [],
  suggestedMatches = [],
  onAddMatching,
  onFinalize,
  onFinalizeSuggested,
  onClaimUnused,
  onCancel,
  t,
}: RoundAdminPanelProps) {
  const [matchingAmount, setMatchingAmount] = useState("");
  const [projectIds, setProjectIds] = useState("");
  const [matchedAmounts, setMatchedAmounts] = useState("");
  const [showAdvancedFinalize, setShowAdvancedFinalize] = useState(false);

  const knownProjectIds = knownProjectIdList.join(", ");
  const assetSymbol = String(round.assetSymbol || round.asset || "GAS");
  const roundTitle = String(round.title || round.name || t("selectedRound"));
  const matchingPresets = ["5", "10", "25"];

  const prefillProjectIds = () => {
    if (knownProjectIdList.length === 0) return;
    setProjectIds(
      JSON.stringify(knownProjectIdList.map((id) => Number.parseInt(id, 10))),
    );
  };

  return (
    <NeoCard title={t("adminTools")} className="qf-admin-panel">
      <div className="qf-admin-console" aria-label={t("adminTools")}>
        <div className="qf-admin-console__hero">
          <span className="qf-admin-console__badge" aria-hidden="true">
            <SlidersHorizontal />
          </span>
          <div className="qf-admin-console__copy">
            <span>{t("qfOpsControlRoom")}</span>
            <strong>{roundTitle}</strong>
            <p>{t("qfOpsControlRoomHint")}</p>
          </div>
          <div
            className="qf-admin-console__signals"
            aria-label={t("qfOpsStatus")}
          >
            <span className={isAdmin ? "is-ready" : ""}>
              <ShieldCheck aria-hidden="true" />
              {isAdmin ? t("qfOpsAdminReady") : t("qfOpsAdminNeeded")}
            </span>
            <span className={canManage ? "is-ready" : ""}>
              <CircleDollarSign aria-hidden="true" />
              {canManage ? t("qfOpsCreatorReady") : t("qfOpsReadOnly")}
            </span>
          </div>
        </div>

        <section
          className={`qf-ops-module qf-ops-module--reserve${
            matchingAmount.trim() ? " is-funded" : ""
          }`}
          aria-label={t("addMatching")}
        >
          <div className="qf-ops-module__icon" aria-hidden="true">
            <CircleDollarSign />
          </div>
          <div className="qf-ops-module__body">
            <div className="qf-ops-module__head">
              <span>{t("qfOpsReserve")}</span>
              <strong>{t("addMatching")}</strong>
            </div>
            <div className="qf-reserve-desk">
              <NeoInput
                value={matchingAmount}
                type="number"
                label={t("addMatching")}
                placeholder={t("addMatchingPlaceholder")}
                suffix={assetSymbol}
                className="qf-reserve-input"
                onChange={setMatchingAmount}
              />
              <div
                className="qf-reserve-presets"
                aria-label={t("qfOpsReservePresets")}
              >
                {matchingPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={matchingAmount === preset ? "is-selected" : ""}
                    onClick={() => setMatchingAmount(preset)}
                  >
                    {preset} {assetSymbol}
                  </button>
                ))}
              </div>
              <NeoButton
                size="sm"
                variant="secondary"
                loading={isAddingMatching}
                disabled={!canManage}
                onClick={() => onAddMatching(matchingAmount)}
              >
                {t("addMatching")}
              </NeoButton>
            </div>
          </div>
        </section>

        <section
          className="qf-ops-module qf-ops-module--finalize"
          aria-label={t("finalizeRound")}
        >
          <div className="qf-ops-module__icon" aria-hidden="true">
            <Gauge />
          </div>
          <div className="qf-ops-module__body">
            <div className="qf-ops-module__head">
              <span>{t("qfOpsAllocation")}</span>
              <strong>{t("finalizeRound")}</strong>
            </div>
            <p className="qf-finalize-note">{t("finalizeAdminOnly")}</p>
            {suggestedMatches.length > 0 ? (
              <div className="qf-finalize-preview">
                <div className="qf-match-lane" role="list">
                  {suggestedMatches.map((entry, index) => (
                    <article
                      key={entry.id}
                      className="qf-match-card"
                      role="listitem"
                      style={{ "--qf-match-index": index } as CSSProperties}
                    >
                      <span
                        className="qf-match-card__spark"
                        aria-hidden="true"
                      >
                        <Sparkles />
                      </span>
                      <div className="qf-match-card__main">
                        <strong>{entry.name}</strong>
                        <span>
                          {entry.contributedDisplay} · {entry.donors}{" "}
                          {t("matchTableDonors").toLowerCase()}
                        </span>
                      </div>
                      <div className="qf-match-card__amount">
                        <small>{t("matchTableSuggested")}</small>
                        <b>{entry.matchDisplay}</b>
                      </div>
                    </article>
                  ))}
                </div>
                <p className="qf-finalize-note qf-match-approx-caveat">
                  {t("matchApproxCaveat")}
                </p>
                <NeoButton
                  size="sm"
                  variant="primary"
                  loading={isFinalizing}
                  disabled={!canFinalize}
                  onClick={onFinalizeSuggested}
                >
                  {t("finalizeSuggested")}
                </NeoButton>
              </div>
            ) : (
              <p className="qf-finalize-note">{t("finalizeNoProjects")}</p>
            )}

            <button
              type="button"
              className="qf-finalize-prefill"
              onClick={() => setShowAdvancedFinalize((value) => !value)}
            >
              {showAdvancedFinalize
                ? t("finalizeHideAdvanced")
                : t("finalizeShowAdvanced")}
            </button>
            {showAdvancedFinalize && (
              <div className="qf-finalize-advanced">
                <NeoInput
                  value={projectIds}
                  label={t("finalizeProjectsJson")}
                  placeholder={t("finalizeProjectsPlaceholder")}
                  onChange={setProjectIds}
                />
                <NeoInput
                  value={matchedAmounts}
                  label={t("finalizeMatchesJson")}
                  placeholder={t("finalizeMatchesPlaceholder")}
                  hint={t("finalizeHint")}
                  onChange={setMatchedAmounts}
                />
                {knownProjectIds ? (
                  <p className="qf-finalize-hint">
                    {t("finalizeKnownProjects")}: <b>{knownProjectIds}</b>{" "}
                    <button
                      type="button"
                      className="qf-finalize-prefill"
                      onClick={prefillProjectIds}
                    >
                      {t("finalizePrefill")}
                    </button>
                  </p>
                ) : null}
                <NeoButton
                  size="sm"
                  variant="secondary"
                  loading={isFinalizing}
                  disabled={!canFinalize}
                  onClick={() => onFinalize(projectIds, matchedAmounts)}
                >
                  {t("finalizeRound")}
                </NeoButton>
              </div>
            )}
            {!isAdmin && (
              <p className="qf-finalize-note">{t("finalizeConnectAdmin")}</p>
            )}
          </div>
        </section>

        <div className="qf-ops-secondary-grid">
          <section className="qf-ops-mini-card qf-ops-mini-card--recover">
            <span className="qf-ops-mini-card__icon" aria-hidden="true">
              <BadgeCheck />
            </span>
            <div>
              <strong>{t("claimUnused")}</strong>
              <p>{t("qfOpsClaimUnusedHint")}</p>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isClaimingUnused}
              disabled={!canClaimUnused}
              onClick={onClaimUnused}
            >
              {t("claimUnused")}
            </NeoButton>
          </section>

          <section className="qf-ops-mini-card qf-ops-mini-card--danger">
            <span className="qf-ops-mini-card__icon" aria-hidden="true">
              <AlertTriangle />
            </span>
            <div>
              <strong>{t("cancelRound")}</strong>
              <p>{t("cancelRoundHint")}</p>
            </div>
            <NeoButton
              size="sm"
              variant="secondary"
              loading={isCancelling}
              disabled={!canCancel}
              onClick={onCancel}
            >
              {t("cancelRound")}
            </NeoButton>
          </section>
        </div>
      </div>
    </NeoCard>
  );
}
