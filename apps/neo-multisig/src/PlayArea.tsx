/**
 * PlayArea.tsx -- Neo Multisig
 *
 * Uses all state: history, pendingCount, completedCount, totalTxs.
 * Actions: navigateToCreate, loadTransaction.
 * Keeps existing sub-components: MultisigHero, ActivitySection, MainCard.
 */

import { useState } from "react";
import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { useMultisigUI } from "./composables/useMultisigUI";
import MultisigHero from "./components/MultisigHero";
import ActivitySection from "./components/ActivitySection";
import MainCard from "./components/MainCard";
import type { HistoryItem } from "./composables/useMultisigHistory";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const { getStatusIcon, statusLabel, shorten, formatDate } = useMultisigUI();

  const history = (state.history?.get() ?? []) as HistoryItem[];
  const pendingCount = num("pendingCount");
  const completedCount = num("completedCount");
  const totalTxs = num("totalTxs");

  const [idInput, setIdInput] = useState("");

  return (
    <div className="multisig-play-area">
      {/* Stats bar */}
      <MultisigHero
        t={t}
        pendingCount={pendingCount}
        completedCount={completedCount}
        totalCount={totalTxs || history.length}
      />

      {/* Summary card */}
      <NeoCard variant="erobo" className="summary-card">
        <div className="summary-grid">
          <div className="summary-row">
            <span className="summary-label">{t("statPending") || "Pending"}</span>
            <span className="summary-value pending">{pendingCount}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">{t("statCompleted") || "Completed"}</span>
            <span className="summary-value completed">{completedCount}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">{t("sidebarTotalTxs") || "Total Txs"}</span>
            <span className="summary-value">{totalTxs || history.length}</span>
          </div>
        </div>
      </NeoCard>

      {/* Recent activity */}
      <ActivitySection
        items={history}
        count={history.length}
        title={t("recentTitle") || "Recent Activity"}
        emptyTitle={t("sidebarNoActivity") || "No Activity Yet"}
        emptyDescription={t("recentEmpty") || "No recent requests yet."}
        getStatusIcon={getStatusIcon}
        statusLabel={statusLabel}
        shorten={shorten}
        formatDate={formatDate}
        onSelect={(id: string) => dispatch("loadTransaction", id)}
      />

      {/* Create / Load */}
      <MainCard
        value={idInput}
        onChange={setIdInput}
        createTitle={t("createCta") || "Create New Multisig"}
        createDesc={t("createDesc") || "Start a new multi-signature transaction"}
        dividerText={t("dividerOr") || "OR"}
        loadLabel={t("loadTitle") || "Load Existing Request"}
        loadPlaceholder={t("loadPlaceholder") || "Enter multisig ID"}
        loadButtonText={t("loadButton") || "Load"}
        onCreate={() => dispatch("navigateToCreate")}
        onLoad={() => { if (idInput) dispatch("loadTransaction", idInput); }}
      />
    </div>
  );
}
