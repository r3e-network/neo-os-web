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
  launchContext?: { network?: "mainnet" | "testnet" | null };
}

const DIFFICULTY_OPTIONS = [
  { value: "1", labelKey: "difficultyEasy", fee: "0.1 GAS" },
  { value: "2", labelKey: "difficultyMedium", fee: "0.5 GAS" },
  { value: "3", labelKey: "difficultyHard", fee: "1 GAS" },
] as const;

/** Status enum → localized pill label key. */
const STATUS_LABEL_KEYS: Record<string, string> = {
  active: "active",
  broken: "broken",
  expired: "expired",
  claimable: "claimable",
};

/** Base units (1e8) → trimmed GAS decimal string for display. */
function baseUnitsToGas(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return (n / 1e8).toFixed(8).replace(/\.?0+$/, "");
}

/**
 * The deployed MiniAppUnbreakableVault takes a fixed 2% platform fee
 * (platformFeeBps=200, frozen on-chain) off the bounty when a vault is broken —
 * VaultBroken(vaultId, winner, reward) pays reward = bounty × 0.98. Surface the
 * net so a challenger sees what they actually win, not just the gross bounty.
 */
const PLATFORM_FEE_BPS = 200;

/** Net winning payout (base units → trimmed GAS): bounty minus the 2% fee. */
function netPayoutGas(bountyBase: unknown): string {
  const n = Number(bountyBase);
  if (!Number.isFinite(n) || n <= 0) return "0";
  const net = Math.floor((n * (10_000 - PLATFORM_FEE_BPS)) / 10_000);
  return baseUnitsToGas(net);
}

export default function PlayArea({ t, state, dispatch, setStatus, launchContext }: PlayAreaProps) {
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
  const isClaiming = bool("isClaiming");
  const canAttempt = bool("canAttempt");
  const canReclaim = bool("canReclaim");

  const [bounty, setBounty] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [secret, setSecret] = useState("");
  const [confirmSecret, setConfirmSecret] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");

  const isMainnet = launchContext?.network === "mainnet";
  const bountyValue = Number.parseFloat(bounty);
  // A mistyped secret locks the bounty until expiry — block submit on mismatch.
  const secretMismatch = secret.trim() !== "" && confirmSecret.trim() !== "" && secret !== confirmSecret;
  const canSubmitCreate =
    Number.isFinite(bountyValue) &&
    bountyValue >= 1 &&
    Number(vaultDifficulty) >= 1 &&
    Number(vaultDifficulty) <= 3 &&
    bounty.trim() !== "" &&
    title.trim() !== "" &&
    secret.trim() !== "" &&
    confirmSecret.trim() !== "" &&
    !secretMismatch;

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
      setConfirmSecret("");
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

  const handleSettleVault = async () => {
    try {
      await dispatch("settleVault");
    } catch (error) {
      setStatus?.(
        error instanceof Error ? error.message : t("settleFailed"),
        "error",
      );
    }
  };

  const handleIncreaseBounty = async () => {
    if (!vaultDetails || !topUpAmount.trim()) return;
    try {
      await dispatch("increaseBounty", String(vaultDetails.id), topUpAmount.trim());
      setTopUpAmount("");
    } catch (error) {
      setStatus?.(
        error instanceof Error ? error.message : t("increaseBountyFailed"),
        "error",
      );
    }
  };

  const vaultStatus = vaultDetails ? String(vaultDetails.status ?? "active") : "";
  const statusLabelKey = STATUS_LABEL_KEYS[vaultStatus] ?? "active";

  // Details fetched into vaultDetails that a challenger needs BEFORE paying.
  const detailTitle = vaultDetails?.title ? String(vaultDetails.title) : "";
  const detailHint = vaultDetails?.description ? String(vaultDetails.description) : "";
  const detailBountyGas = vaultDetails ? baseUnitsToGas(vaultDetails.bounty) : "0";
  const detailNetPayoutGas = vaultDetails ? netPayoutGas(vaultDetails.bounty) : "0";
  const detailAttempts = vaultDetails ? Number(vaultDetails.attempts ?? 0) : 0;
  const detailRemainingDays = vaultDetails ? Number(vaultDetails.remainingDays ?? 0) : 0;
  const detailWinner = vaultDetails?.winner ? String(vaultDetails.winner) : "";
  const detailDifficulty = vaultDetails?.difficultyName ? String(vaultDetails.difficultyName) : "";

  return (
    <div className="vault-play-area">
      <VaultHero t={t} />

      <div className="vault-stats">
        <div className="vault-stat">
          <span className="vault-stat-value">{myVaultCount}</span>
          <span className="vault-stat-label">{t("myVaultsStat")}</span>
        </div>
        <div className="vault-stat">
          <span className="vault-stat-value">{recentVaultCount}</span>
          <span className="vault-stat-label">{t("openVaultsStat")}</span>
        </div>
      </div>

      <div className="vault-grid">
      <NeoCard title={t("createVault")}>
        <div className="vault-form">
          {isMainnet && (
            <p className="vault-mainnet-note" role="note">{t("mainnetVaultNote")}</p>
          )}
          <NeoInput
            label={t("titleLabel")}
            placeholder={t("titlePlaceholder")}
            value={title}
            onChange={setTitle}
          />
          <NeoInput
            label={t("descriptionLabel")}
            type="textarea"
            placeholder={t("descriptionPlaceholder")}
            value={description}
            onChange={setDescription}
          />
          <NeoInput
            label={t("bountyLabel")}
            type="number"
            placeholder={t("bountyPlaceholder")}
            min={1}
            value={bounty}
            onChange={setBounty}
          />
          <p className="vault-secret-note">{t("minBountyNote")}</p>
          <label className="vault-select-field">
            <span>{t("difficultyLabel")}</span>
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
          <p className="vault-secret-note">{t("difficultyFeeNote")}</p>
          <NeoInput
            label={t("secretLabel")}
            type="password"
            placeholder={t("secretPlaceholder")}
            value={secret}
            onChange={setSecret}
          />
          <NeoInput
            label={t("confirmSecretLabel")}
            type="password"
            placeholder={t("confirmSecretPlaceholder")}
            value={confirmSecret}
            onChange={setConfirmSecret}
          />
          {secretMismatch && (
            <p className="vault-field-error" role="alert">{t("secretMismatch")}</p>
          )}
          <p className="vault-secret-note">{t("secretNote")}</p>
          <p className="vault-secret-note">{t("createFeeNote")}</p>
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isCreating || isLoading}
            disabled={!canSubmitCreate || isCreating}
            aria-label={t("createVaultButton")}
            onClick={handleCreate}
          >
            {isCreating
              ? t("creatingVault")
              : t("createVaultButton")}
          </NeoButton>
        </div>
      </NeoCard>

      <div className="vault-col">
      <NeoCard title={t("breakVault")}>
        <div className="vault-form">
          <NeoInput
            label={t("vaultIdLabel")}
            placeholder={t("vaultIdPlaceholder")}
            value={vaultIdInput}
            onChange={(v) => state.vaultIdInput?.set(v)}
          />
          <NeoButton
            variant="secondary"
            size="sm"
            disabled={!vaultIdInput || isLoading}
            onClick={() => handleLoadVault(vaultIdInput)}
          >
            {t("loadVault")}
          </NeoButton>
          {vaultDetails && (
            <>
              {/* What you are trying to break — surfaced BEFORE paying the fee. */}
              {detailTitle && <p className="vault-detail-title">{detailTitle}</p>}
              {detailHint && <p className="vault-detail-hint">{detailHint}</p>}
              <div className="vault-detail-row">
                <span className="detail-label">{t("vaultStatus")}</span>
                <span className={`detail-value vault-status-pill vault-status-pill--${statusLabelKey}`}>
                  {t(statusLabelKey)}
                </span>
              </div>
              <div className="vault-detail-row">
                <span className="detail-label">{t("bountyLabel")}</span>
                <span className="detail-value detail-value--accent">{detailBountyGas} {t("tokenGas")}</span>
              </div>
              {/* Failed attempt fees fold into the bounty on-chain — connect the
                  displayed bounty to the live attempt count below. */}
              <p className="vault-secret-note">{t("bountyGrowthNote")}</p>
              {/* What the winner actually receives: bounty minus the fixed 2%
                  platform fee. Surfaced beside the gross so the challenger can
                  weigh the attempt fee against the real prize. */}
              <div className="vault-detail-row">
                <span className="detail-label">{t("netPayoutLabel")}</span>
                <span className="detail-value detail-value--accent">{detailNetPayoutGas} {t("tokenGas")}</span>
              </div>
              {detailDifficulty && (
                <div className="vault-detail-row">
                  <span className="detail-label">{t("difficultyLabel")}</span>
                  <span className="detail-value">{detailDifficulty}</span>
                </div>
              )}
              <div className="vault-detail-row">
                <span className="detail-label">{t("attemptFee")}</span>
                <span className="detail-value">{attemptFeeDisplay} {t("tokenGas")}</span>
              </div>
              <div className="vault-detail-row">
                <span className="detail-label">{t("attempts")}</span>
                <span className="detail-value">{detailAttempts}</span>
              </div>
              {(vaultStatus === "active" || vaultStatus === "claimable") && (
                <div className="vault-detail-row">
                  <span className="detail-label">{t("remainingDaysLabel")}</span>
                  <span className="detail-value">{detailRemainingDays}</span>
                </div>
              )}
              {detailWinner && (
                <div className="vault-detail-row">
                  <span className="detail-label">{t("winner")}</span>
                  <span className="detail-value detail-value--mono">{detailWinner}</span>
                </div>
              )}
              {vaultStatus === "active" && (
                <NeoInput
                  label={t("secretAttemptLabel")}
                  type="password"
                  placeholder={t("secretAttemptPlaceholder")}
                  value={attemptSecret}
                  onChange={(v) => state.attemptSecret?.set(v)}
                />
              )}
            </>
          )}
          {vaultStatus === "active" && (
            <>
              {isMainnet && (
                <p className="vault-mainnet-note" role="note">{t("mainnetVaultNote")}</p>
              )}
              <NeoButton
                variant="danger"
                size="lg"
                block
                loading={isLoading}
                disabled={!canAttempt}
                aria-label={t("attemptBreak")}
                onClick={handleAttemptBreak}
              >
                {t("attemptBreak")}
              </NeoButton>
              <p className="vault-secret-note">{t("attemptCostNote")}</p>
              {/* Top up — anyone can grow an active vault's bounty (contract has
                  increaseBounty, advertised in the operation panel). */}
              <div className="vault-topup">
                <NeoInput
                  label={t("increaseBountyLabel")}
                  type="number"
                  min={0}
                  placeholder={t("increaseBountyPlaceholder")}
                  value={topUpAmount}
                  onChange={setTopUpAmount}
                />
                <NeoButton
                  variant="secondary"
                  size="sm"
                  loading={isCreating}
                  disabled={!topUpAmount.trim() || isCreating || isLoading}
                  aria-label={t("increaseBounty")}
                  onClick={handleIncreaseBounty}
                >
                  {t("increaseBounty")}
                </NeoButton>
              </div>
            </>
          )}
          {canReclaim && (
            <NeoButton
              variant="primary"
              size="lg"
              block
              loading={isClaiming}
              disabled={isClaiming || isLoading}
              aria-label={t("reclaimVault")}
              onClick={handleSettleVault}
            >
              {t("reclaimVault")}
            </NeoButton>
          )}
          {vaultDetails && vaultStatus === "broken" && (
            <p className="vault-secret-note">{t("bountyPaidNote")}</p>
          )}
        </div>
      </NeoCard>

      {/* Recent Vaults */}
      <NeoCard title={t("recentVaults")}>
        <div className="vault-list-container">
          {recentVaults.length === 0 ? (
            <div className="empty-state">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t("noRecentVaults")}</span>
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
                  <span className={`vault-status-pill vault-status-pill--${STATUS_LABEL_KEYS[String(vault.status ?? "active")] ?? "active"}`}>
                    {t(STATUS_LABEL_KEYS[String(vault.status ?? "active")] ?? "active")}
                  </span>
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
        <NeoCard title={t("myVaults")}>
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
                <span className={`vault-status vault-status-pill vault-status-pill--${STATUS_LABEL_KEYS[String(vault.status ?? "active")] ?? "active"}`}>
                  {t(STATUS_LABEL_KEYS[String(vault.status ?? "active")] ?? "active")}
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      <VaultConfirmation t={t} createdVaultId={createdVaultId} />
    </div>
  );
}
