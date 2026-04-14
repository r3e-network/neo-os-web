import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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
  const { num, str, bool, val } = useStateBindings(state);

  const address = str("address");
  const myVaultCount = num("myVaultCount");
  const recentVaultCount = num("recentVaultCount");
  const vaultDifficulty = str("vaultDifficulty", "1");
  const attemptFeeDisplay = str("attemptFeeDisplay", "0");
  const createdVaultId = val<string | number | null>("createdVaultId") ?? null;
  const vaultDetails = val<Record<string, unknown> | null>("vaultDetails") ?? null;
  const recentVaults = val<unknown[]>("recentVaults") ?? [];
  const myVaults = val<unknown[]>("myVaults") ?? [];
  const isLoading = bool("isLoading");
  const canAttempt = bool("canAttempt");

  return (
    <div className="vault-play-area">
      <VaultHero t={t} myVaultCount={myVaultCount} recentVaultCount={recentVaultCount} />

      {/* Create Vault */}
      <NeoCard title={t("createVault") || "Create Vault"}>
        <div className="vault-form">
          <NeoInput
            value={vaultDifficulty}
            type="number"
            label={t("difficulty") || "Difficulty"}
            placeholder={t("difficultyPlaceholder") || "1-10"}
            min={1}
            max={10}
            onChange={(val) => state.vaultDifficulty?.set(val)}
          />
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isLoading}
            aria-label={t("createVault") || "Create Vault"}
            onClick={() => dispatch("createVault", { difficulty: Number(vaultDifficulty) })}
          >
            {t("createVault") || "Create Vault"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Break Vault */}
      <NeoCard title={t("breakVault") || "Break a Vault"}>
        <div className="vault-form">
          {vaultDetails && (
            <div className="vault-detail-row">
              <span className="detail-label">{t("attemptFee") || "Attempt Fee"}</span>
              <span className="detail-value">{attemptFeeDisplay} GAS</span>
            </div>
          )}
          <NeoButton
            variant="danger"
            size="lg"
            block
            loading={isLoading}
            disabled={!canAttempt}
            aria-label={t("attemptBreak") || "Attempt Break"}
            onClick={() => dispatch("attemptBreak")}
          >
            {t("attemptBreak") || "Attempt Break"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Recent Vaults */}
      <NeoCard title={t("recentVaults") || "Recent Vaults"}>
        <div className="vault-list-container">
          {recentVaults.length === 0 ? (
            <div className="empty-state">
              <span>{t("noRecentVaults") || "No recent vaults"}</span>
            </div>
          ) : (
            <div className="vault-list">
              {(recentVaults as Array<Record<string, unknown>>).map((vault) => (
                <div
                  key={String(vault.id)}
                  className="vault-list-item"
                  onClick={() => dispatch("loadVault", vault.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") dispatch("loadVault", vault.id); }}
                >
                  <span className="vault-id">#{String(vault.id)}</span>
                  <span className="vault-status">{String(vault.status ?? "active")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeoCard>

      {/* My Vaults */}
      {myVaults.length > 0 && (
        <NeoCard title={t("myVaults") || "My Vaults"}>
          <div className="vault-list">
            {(myVaults as Array<Record<string, unknown>>).map((vault) => (
              <div
                key={String(vault.id)}
                className="vault-list-item"
                onClick={() => dispatch("loadVault", vault.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") dispatch("loadVault", vault.id); }}
              >
                <span className="vault-id">#{String(vault.id)}</span>
                <span className="vault-status">{String(vault.status ?? "active")}</span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      <VaultConfirmation t={t} createdVaultId={createdVaultId} />
    </div>
  );
}
