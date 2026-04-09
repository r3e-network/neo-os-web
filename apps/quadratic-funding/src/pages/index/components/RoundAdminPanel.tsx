import { useState } from "react";
import { NeoInput, NeoButton, NeoCard } from "@shared/components-react";

interface RoundAdminPanelProps {
  round: Record<string, unknown>; canManage: boolean; canFinalize: boolean; canClaimUnused: boolean;
  isAddingMatching: boolean; isFinalizing: boolean; isClaimingUnused: boolean;
  onAddMatching: (...args: unknown[]) => void; onFinalize: (...args: unknown[]) => void; onClaimUnused: () => void;
  t: (key: string) => string;
}

export default function RoundAdminPanel({ round, canManage, canFinalize, canClaimUnused, isAddingMatching, isFinalizing, isClaimingUnused, onAddMatching, onFinalize, onClaimUnused, t }: RoundAdminPanelProps) {
  const [matchingAmount, setMatchingAmount] = useState("");
  const [projectIds, setProjectIds] = useState("");
  const [matchedAmounts, setMatchedAmounts] = useState("");

  return (
    <NeoCard title={t("adminTools")}>
      <NeoInput value={matchingAmount} type="number" label={t("addMatching")} onChange={setMatchingAmount} />
      <NeoButton size="sm" variant="secondary" loading={isAddingMatching} disabled={!canManage} onClick={() => onAddMatching(matchingAmount)}>{t("addMatching")}</NeoButton>
      <NeoInput value={projectIds} label={t("finalizeProjectsJson")} onChange={setProjectIds} />
      <NeoInput value={matchedAmounts} label={t("finalizeMatchesJson")} onChange={setMatchedAmounts} />
      <NeoButton size="sm" variant="primary" loading={isFinalizing} disabled={!canFinalize} onClick={() => onFinalize(projectIds, matchedAmounts)}>{t("finalizeRound")}</NeoButton>
      <NeoButton size="sm" variant="secondary" loading={isClaimingUnused} disabled={!canClaimUnused} onClick={onClaimUnused}>{t("claimUnused")}</NeoButton>
    </NeoCard>
  );
}
