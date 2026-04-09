import { useState } from "react";
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

  const [idInput, setIdInput] = useState("");

  return (
    <div className="multisig-play-area">
      <MultisigHero t={t} pendingCount={pendingCount} completedCount={completedCount} totalCount={history.length} />
      <ActivitySection
        items={history}
        count={history.length}
        title={t("recentTitle")}
        emptyTitle={t("sidebarNoActivity")}
        emptyDescription={t("recentEmpty")}
        getStatusIcon={getStatusIcon}
        statusLabel={statusLabel}
        shorten={shorten}
        formatDate={formatDate}
        onSelect={(id: string) => uni.navigateTo({ url: `/pages/sign/index?id=${id}` })}
      />
      <MainCard
        value={idInput}
        onChange={setIdInput}
        createTitle={t("createCta")}
        createDesc={t("createDesc")}
        dividerText={t("dividerOr")}
        loadLabel={t("loadTitle")}
        loadPlaceholder={t("loadPlaceholder")}
        loadButtonText={t("loadButton")}
        onCreate={() => dispatch("navigateToCreate")}
        onLoad={() => { if (idInput) dispatch("loadTransaction", idInput); }}
      />
    </div>
  );
}
