import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import VaultHero from "./components/VaultHero";
import VaultConfirmation from "./components/VaultConfirmation";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);
  const myVaultCount = num("myVaultCount");
  const recentVaultCount = num("recentVaultCount");
  const createdVaultId = (state.createdVaultId?.get() as string | number | null) ?? null;

  return (
    <div className="vault-play-area">
      <VaultHero t={t} myVaultCount={myVaultCount} recentVaultCount={recentVaultCount} />
      <div className="vault-list-container">
        {myVaultCount === 0 && <div className="empty-state"><span>{t("noRecentVaults")}</span></div>}
      </div>
      <VaultConfirmation t={t} createdVaultId={createdVaultId} />
    </div>
  );
}
