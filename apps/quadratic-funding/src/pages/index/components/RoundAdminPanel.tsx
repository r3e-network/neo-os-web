import { useState } from "react";
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

  const prefillProjectIds = () => {
    if (knownProjectIdList.length === 0) return;
    setProjectIds(JSON.stringify(knownProjectIdList.map((id) => Number.parseInt(id, 10))));
  };

  return (
    <NeoCard title={t("adminTools")} className="qf-admin-panel">
      <div className="qf-admin-group">
        <p className="qf-admin-group-title">{t("addMatching")}</p>
        <NeoInput value={matchingAmount} type="number" label={t("addMatching")} onChange={setMatchingAmount} />
        <NeoButton size="sm" variant="secondary" loading={isAddingMatching} disabled={!canManage} onClick={() => onAddMatching(matchingAmount)}>{t("addMatching")}</NeoButton>
      </div>

      <div className="qf-admin-group">
        <p className="qf-admin-group-title">{t("finalizeRound")}</p>
        <p className="qf-finalize-note">{t("finalizeAdminOnly")}</p>
        {suggestedMatches.length > 0 ? (
          <div className="qf-finalize-preview">
            <table className="qf-match-table">
              <thead>
                <tr>
                  <th>{t("matchTableProject")}</th>
                  <th>{t("matchTableContributed")}</th>
                  <th>{t("matchTableDonors")}</th>
                  <th>{t("matchTableSuggested")}</th>
                </tr>
              </thead>
              <tbody>
                {suggestedMatches.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.name}</td>
                    <td>{entry.contributedDisplay}</td>
                    <td>{entry.donors}</td>
                    <td>{entry.matchDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          {showAdvancedFinalize ? t("finalizeHideAdvanced") : t("finalizeShowAdvanced")}
        </button>
        {showAdvancedFinalize && (
          <div className="qf-finalize-advanced">
            <NeoInput value={projectIds} label={t("finalizeProjectsJson")} placeholder={t("finalizeProjectsPlaceholder")} onChange={setProjectIds} />
            <NeoInput value={matchedAmounts} label={t("finalizeMatchesJson")} placeholder={t("finalizeMatchesPlaceholder")} hint={t("finalizeHint")} onChange={setMatchedAmounts} />
            {knownProjectIds ? (
              <p className="qf-finalize-hint">
                {t("finalizeKnownProjects")}: <b>{knownProjectIds}</b>{" "}
                <button type="button" className="qf-finalize-prefill" onClick={prefillProjectIds}>
                  {t("finalizePrefill")}
                </button>
              </p>
            ) : null}
            <NeoButton size="sm" variant="secondary" loading={isFinalizing} disabled={!canFinalize} onClick={() => onFinalize(projectIds, matchedAmounts)}>{t("finalizeRound")}</NeoButton>
          </div>
        )}
        {!isAdmin && <p className="qf-finalize-note">{t("finalizeConnectAdmin")}</p>}
      </div>

      <div className="qf-admin-group">
        <p className="qf-admin-group-title">{t("claimUnused")}</p>
        <NeoButton size="sm" variant="secondary" loading={isClaimingUnused} disabled={!canClaimUnused} onClick={onClaimUnused}>{t("claimUnused")}</NeoButton>
      </div>

      <div className="qf-admin-group">
        <p className="qf-admin-group-title">{t("cancelRound")}</p>
        <p className="qf-finalize-note">{t("cancelRoundHint")}</p>
        <NeoButton size="sm" variant="secondary" loading={isCancelling} disabled={!canCancel} onClick={onCancel}>{t("cancelRound")}</NeoButton>
      </div>
    </NeoCard>
  );
}
