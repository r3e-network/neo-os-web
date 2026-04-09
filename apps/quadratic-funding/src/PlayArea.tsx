import { useState } from "react";
import { NeoCard, NeoButton } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { formatAddress } from "@shared/utils/format";
import FundingHero from "./components/FundingHero";
import RoundForm from "./pages/index/components/RoundForm";
import RoundList from "./pages/index/components/RoundList";
import RoundAdminPanel from "./pages/index/components/RoundAdminPanel";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);

  const rounds = (state.rounds?.get() ?? []) as Array<Record<string, unknown>>;
  const selectedRoundId = val<number>("selectedRoundId");
  const selectedRound = val<Record<string, unknown>>("selectedRound");
  const isRefreshingRounds = bool("isRefreshingRounds");
  const isAddingMatching = bool("isAddingMatching");
  const isFinalizing = bool("isFinalizing");
  const isClaimingUnused = bool("isClaimingUnused");
  const canManageSelectedRound = bool("canManageSelectedRound");
  const canFinalizeSelectedRound = bool("canFinalizeSelectedRound");
  const canClaimUnused = bool("canClaimUnused");
  const projects = (state.projects?.get() ?? []) as Array<Record<string, unknown>>;
  const matchingPoolDisplay = String(state.matchingPoolDisplay?.get() ?? t("notAvailable"));

  const activeRounds = rounds.filter((r) => r.status === "active").length;
  const roundProgressPct = rounds.length === 0 ? 0 : Math.round((activeRounds / rounds.length) * 100);

  const roundStatusLabel = (round: Record<string, unknown>) => String(round.statusLabel ?? round.status ?? "");
  const formatAmount = (v: unknown) => String(v ?? "0");
  const formatSchedule = (v: unknown) => String(v ?? "");

  return (
    <div className="qf-play-area">
      <FundingHero t={t} progressPct={roundProgressPct} matchingPoolDisplay={matchingPoolDisplay} projectCount={projects.length} />
      <RoundForm onSubmit={(...args: unknown[]) => dispatch("createRound", ...args)} t={t} />
      <RoundList
        rounds={rounds}
        selectedRoundId={String(selectedRoundId ?? "")}
        isRefreshing={isRefreshingRounds}
        roundStatusLabel={roundStatusLabel}
        formatAmount={formatAmount}
        formatSchedule={formatSchedule}
        formatAddress={formatAddress}
        onRefresh={() => {}}
        onSelect={(round: Record<string, unknown>) => {
          if (state.selectedRoundId) state.selectedRoundId.set(round.id as number);
        }}
        t={t}
      />
      {selectedRound && (
        <RoundAdminPanel
          round={selectedRound}
          canManage={canManageSelectedRound}
          canFinalize={canFinalizeSelectedRound}
          canClaimUnused={canClaimUnused}
          isAddingMatching={isAddingMatching}
          isFinalizing={isFinalizing}
          isClaimingUnused={isClaimingUnused}
          onAddMatching={(...args: unknown[]) => dispatch("addMatching", ...args)}
          onFinalize={(...args: unknown[]) => dispatch("finalize", ...args)}
          onClaimUnused={() => dispatch("claimUnused")}
          t={t}
        />
      )}
      <NeoCard title={t("quickContribute")}>
        <NeoButton size="sm" variant="primary" onClick={() => { if (state.activeTab) state.activeTab.set("contribute"); }}>
          {t("tabContribute")}
        </NeoButton>
      </NeoCard>
    </div>
  );
}
