import { useState } from "react";
import { NeoInput, NeoButton, NeoCard } from "@shared/components-react";

interface RoundAdminPanelProps {
  round: Record<string, unknown>; canManage: boolean; canFinalize: boolean; canClaimUnused: boolean;
  isAddingMatching: boolean; isFinalizing: boolean; isClaimingUnused: boolean;
  /** IDs of projects registered in the selected round, for finalize guidance. */
  knownProjectIds?: string[];
  onAddMatching: (...args: unknown[]) => void; onFinalize: (...args: unknown[]) => void; onClaimUnused: () => void;
  t: (key: string) => string;
}

export default function RoundAdminPanel({ round, canManage, canFinalize, canClaimUnused, isAddingMatching, isFinalizing, isClaimingUnused, knownProjectIds: knownProjectIdList = [], onAddMatching, onFinalize, onClaimUnused, t }: RoundAdminPanelProps) {
  const [matchingAmount, setMatchingAmount] = useState("");
  const [projectIds, setProjectIds] = useState("");
  const [matchedAmounts, setMatchedAmounts] = useState("");

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
        <NeoButton size="sm" variant="primary" loading={isFinalizing} disabled={!canFinalize} onClick={() => onFinalize(projectIds, matchedAmounts)}>{t("finalizeRound")}</NeoButton>
      </div>
      <div className="qf-admin-group">
        <p className="qf-admin-group-title">{t("claimUnused")}</p>
        <NeoButton size="sm" variant="secondary" loading={isClaimingUnused} disabled={!canClaimUnused} onClick={onClaimUnused}>{t("claimUnused")}</NeoButton>
      </div>
    </NeoCard>
  );
}
