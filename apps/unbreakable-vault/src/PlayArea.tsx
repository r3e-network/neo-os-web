import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { StatusType } from "@shared/composables/useStatusMessage";
import VaultHero from "./components/VaultHero";
import VaultConfirmation from "./components/VaultConfirmation";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  setStatus?: (msg: string, type: StatusType) => void;
}

const DIFFICULTY_OPTIONS = [
  { value: "1", labelKey: "difficultyEasy", fee: "0.1 GAS" },
  { value: "2", labelKey: "difficultyMedium", fee: "0.5 GAS" },
  { value: "3", labelKey: "difficultyHard", fee: "1 GAS" },
] as const;

export default function PlayArea({ t, state, dispatch, setStatus }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const myVaultCount = num("myVaultCount");
  const recentVaultCount = num("recentVaultCount");
  const vaultDifficulty = str("vaultDifficulty", "1");
  const vaultIdInput = str("vaultIdInput", "");
  const attemptSecret = str("attemptSecret", "");
  const attemptFeeDisplay = str("attemptFeeDisplay", "0");
  const createdVaultId = val<string | number | null>("createdVaultId") ?? null;
  const vaultDetails = val<Record<string, unknown> | null>("vaultDetails") ?? null;
  const recentVaults = val<unknown[]>("recentVaults") ?? [];
  const myVaults = val<unknown[]>("myVaults") ?? [];
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const canAttempt = bool("canAttempt");

  const [bounty, setBounty] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState("");

  const bountyValue = Number.parseFloat(bounty);
  const canSubmitCreate =
    Number.isFinite(bountyValue) &&
    bountyValue >= 1 &&
    Number(vaultDifficulty) >= 1 &&
    Number(vaultDifficulty) <= 3 &&
    bounty.trim() !== "" &&
    title.trim() !== "" &&
    secret.trim() !== "";

  const handleCreate = async () => {
    if (!canSubmitCreate) return;
    try {
      await dispatch("createVault", {
        bounty,
        title,
        description,
        difficulty: Number(vaultDifficulty),
        secret,
        secretHash: "",
      });
      setBounty("");
      setTitle("");
      setDescription("");
      setSecret("");
    } catch (error) {
      setStatus?.(
        error instanceof Error ? error.message : t("vaultCreateFailed"),
        "error",
      );
    }
  };

  const handleLoadVault = async (id?: unknown) => {
    try {
      await dispatch("loadVault", id);
    } catch (error) {
      setStatus?.(
        error instanceof Error ? error.message : t("loadFailed"),
        "error",
      );
    }
  };

  const handleAttemptBreak = async () => {
    try {
      await dispatch("attemptBreak");
    } catch (error) {
      setStatus?.(
        error instanceof Error ? error.message : t("vaultAttemptFailed"),
        "error",
      );
    }
  };

  return (
    <div className="vault-play-area">
      <VaultHero t={t} />

      <div className="vault-stats">
        <div className="vault-stat">
          <span className="vault-stat-value">{myVaultCount}</span>
          <span className="vault-stat-label">{t("create")}</span>
        </div>
        <div className="vault-stat">
          <span className="vault-stat-value">{recentVaultCount}</span>
          <span className="vault-stat-label">{t("break")}</span>
        </div>
      </div>

      <div className="vault-grid">
      <NeoCard title={t("createVault") || "Create Vault"}>
        <div className="vault-form">
          <NeoInput
            label={t("titleLabel") || "Vault Title"}
            placeholder={t("titlePlaceholder") || "Crack me if you can"}
            value={title}
            onChange={setTitle}
          />
          <NeoInput
            label={t("descriptionLabel") || "Description"}
            type="textarea"
            placeholder={t("descriptionPlaceholder") || "Optional clue for breakers"}
            value={description}
            onChange={setDescription}
          />
          <NeoInput
            label={t("bountyLabel") || "Bounty"}
            type="number"
            placeholder="10"
            min={1}
            value={bounty}
            onChange={setBounty}
          />
          <label className="vault-select-field">
            <span>{t("difficultyLabel") || "Difficulty"}</span>
            <div className="vault-select-control">
              <select
                value={vaultDifficulty}
                onChange={(e) => state.vaultDifficulty?.set(e.target.value)}
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)} · {option.fee}
                  </option>
                ))}
              </select>
              <svg className="vault-select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </label>
          <NeoInput
            label={t("secretLabel") || "Vault Secret"}
            type="password"
            placeholder={t("secretPlaceholder") || "The unlock phrase — kept private"}
            value={secret}
            onChange={setSecret}
          />
          <p className="vault-secret-note">{t("secretNote")}</p>
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isCreating || isLoading}
            disabled={!canSubmitCreate || isCreating}
            aria-label={t("createVaultButton") || "Create Vault"}
            onClick={handleCreate}
          >
            {isCreating
              ? t("creatingVault") || "Creating vault..."
              : t("createVaultButton") || "Create Vault"}
          </NeoButton>
        </div>
      </NeoCard>

      <div className="vault-col">
      <NeoCard title={t("breakVault") || "Break a Vault"}>
        <div className="vault-form">
          <NeoInput
            label={t("vaultIdLabel") || "Vault ID"}
            placeholder={t("vaultIdPlaceholder") || "Pick from list or enter ID"}
            value={vaultIdInput}
            onChange={(v) => state.vaultIdInput?.set(v)}
          />
          <NeoButton
            variant="secondary"
            size="sm"
            disabled={!vaultIdInput || isLoading}
            onClick={() => handleLoadVault(vaultIdInput)}
          >
            {t("loadVault") || "Load Vault"}
          </NeoButton>
          {vaultDetails && (
            <>
              <div className="vault-detail-row">
                <span className="detail-label">{t("attemptFee") || "Attempt Fee"}</span>
                <span className="detail-value">{attemptFeeDisplay} GAS</span>
              </div>
              <NeoInput
                label={t("secretAttemptLabel") || "Break Secret"}
                type="password"
                placeholder={t("secretAttemptPlaceholder") || "Try to crack the secret"}
                value={attemptSecret}
                onChange={(v) => state.attemptSecret?.set(v)}
              />
            </>
          )}
          <NeoButton
            variant="danger"
            size="lg"
            block
            loading={isLoading}
            disabled={!canAttempt}
            aria-label={t("attemptBreak") || "Attempt Break"}
            onClick={handleAttemptBreak}
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
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t("noRecentVaults") || "No recent vaults"}</span>
            </div>
          ) : (
            <div className="vault-list">
              {(recentVaults as Array<Record<string, unknown>>).map((vault) => (
                <div
                  key={String(vault.id)}
                  className="vault-list-item"
                  onClick={() => handleLoadVault(vault.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLoadVault(vault.id); }}
                >
                  <span className="vault-id">#{String(vault.id)}</span>
                  <span className="vault-status">{String(vault.status ?? "active")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </NeoCard>
      </div>
      </div>

      {/* My Vaults */}
      {myVaults.length > 0 && (
        <NeoCard title={t("myVaults") || "My Vaults"}>
          <div className="vault-list">
            {(myVaults as Array<Record<string, unknown>>).map((vault) => (
              <div
                key={String(vault.id)}
                className="vault-list-item"
                onClick={() => handleLoadVault(vault.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") handleLoadVault(vault.id); }}
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
