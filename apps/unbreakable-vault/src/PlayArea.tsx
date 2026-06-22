import { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Coins,
  Crosshair,
  Flame,
  Gauge,
  KeyRound,
  LockKeyhole,
  PlusCircle,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
import { EmptyStateArt } from "@shared/components-react/illustrations";
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
  {
    value: "1",
    labelKey: "difficultyEasy",
    hintKey: "difficultyEasyHint",
    fee: "0.1 GAS",
    icon: ShieldCheck,
  },
  {
    value: "2",
    labelKey: "difficultyMedium",
    hintKey: "difficultyMediumHint",
    fee: "0.5 GAS",
    icon: Gauge,
  },
  {
    value: "3",
    labelKey: "difficultyHard",
    hintKey: "difficultyHardHint",
    fee: "1 GAS",
    icon: Flame,
  },
] satisfies ReadonlyArray<{
  value: string;
  labelKey: string;
  hintKey: string;
  fee: string;
  icon: LucideIcon;
}>;

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

export default function PlayArea({
  t,
  state,
  dispatch,
  setStatus,
  launchContext,
}: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const myVaultCount = num("myVaultCount");
  const recentVaultCount = num("recentVaultCount");
  const vaultDifficulty = str("vaultDifficulty", "1");
  const vaultIdInput = str("vaultIdInput", "");
  const attemptSecret = str("attemptSecret", "");
  const attemptFeeDisplay = str("attemptFeeDisplay", "0");
  const createdVaultId = val<string | number | null>("createdVaultId") ?? null;
  const vaultDetails =
    val<Record<string, unknown> | null>("vaultDetails") ?? null;
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
  const secretMismatch =
    secret.trim() !== "" &&
    confirmSecret.trim() !== "" &&
    secret !== confirmSecret;
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

  // Inline "why is Create disabled" reason so a first-timer knows the next step
  // instead of staring at a greyed button. Ordered by the form's top-to-bottom
  // flow; a secret mismatch is already surfaced by its own field error above, so
  // the hint falls through to the secret prompt rather than repeating it.
  const createHintKey =
    title.trim() === ""
      ? "createNeedTitle"
      : !(Number.isFinite(bountyValue) && bountyValue >= 1)
        ? "createNeedBounty"
        : secret.trim() === "" || confirmSecret.trim() === "" || secretMismatch
          ? "createNeedSecret"
          : "createReady";

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
      await dispatch(
        "increaseBounty",
        String(vaultDetails.id),
        topUpAmount.trim(),
      );
      setTopUpAmount("");
    } catch (error) {
      setStatus?.(
        error instanceof Error ? error.message : t("increaseBountyFailed"),
        "error",
      );
    }
  };

  const vaultStatus = vaultDetails
    ? String(vaultDetails.status ?? "active")
    : "";
  const statusLabelKey = STATUS_LABEL_KEYS[vaultStatus] ?? "active";

  // Details fetched into vaultDetails that a challenger needs BEFORE paying.
  const detailTitle = vaultDetails?.title ? String(vaultDetails.title) : "";
  const detailHint = vaultDetails?.description
    ? String(vaultDetails.description)
    : "";
  const detailBountyGas = vaultDetails
    ? baseUnitsToGas(vaultDetails.bounty)
    : "0";
  const detailNetPayoutGas = vaultDetails
    ? netPayoutGas(vaultDetails.bounty)
    : "0";
  const detailAttempts = vaultDetails ? Number(vaultDetails.attempts ?? 0) : 0;
  const detailRemainingDays = vaultDetails
    ? Number(vaultDetails.remainingDays ?? 0)
    : 0;
  const detailWinner = vaultDetails?.winner ? String(vaultDetails.winner) : "";
  const detailDifficulty = vaultDetails?.difficultyName
    ? String(vaultDetails.difficultyName)
    : "";
  const selectedDifficulty =
    DIFFICULTY_OPTIONS.find((option) => option.value === vaultDifficulty) ??
    DIFFICULTY_OPTIONS[0]!;
  const selectedDifficultyLabel = t(selectedDifficulty.labelKey);
  const blueprintTitle = title.trim() || t("blueprintUntitled");
  const blueprintBounty =
    Number.isFinite(bountyValue) && bountyValue > 0 ? bounty : "0";
  const secretReady =
    secret.trim() !== "" && confirmSecret.trim() !== "" && !secretMismatch;
  const createStageState = isCreating
    ? "creating"
    : secretReady
      ? "ready"
      : "draft";
  const shouldOpenBreakDesk =
    Boolean(vaultDetails) ||
    vaultIdInput.trim() !== "" ||
    canAttempt ||
    canReclaim;
  const breakStageState = canReclaim
    ? "claimable"
    : canAttempt
      ? "attempt"
      : vaultDetails
        ? "loaded"
        : "idle";
  const breakStageTarget = vaultDetails
    ? `#${String(vaultDetails.id)}`
    : vaultIdInput.trim()
      ? `#${vaultIdInput.trim()}`
      : t("vaultIdLabel");
  const [activeDesk, setActiveDesk] = useState<"create" | "break">(
    shouldOpenBreakDesk ? "break" : "create",
  );

  useEffect(() => {
    if (shouldOpenBreakDesk) setActiveDesk("break");
  }, [shouldOpenBreakDesk]);

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

      <section
        className={`vault-command-shell vault-command-shell--${activeDesk}`}
        aria-label={t("challengeConsole")}
      >
        <div className="vault-command-shell__head">
          <div>
            <span>{t("challengeConsole")}</span>
            <strong>{t("challengeConsoleTitle")}</strong>
          </div>
          <div className="vault-desk-tabs" role="tablist" aria-label={t("challengeConsole")}>
            <button
              type="button"
              role="tab"
              aria-selected={activeDesk === "create"}
              className={activeDesk === "create" ? "is-active" : ""}
              onClick={() => setActiveDesk("create")}
            >
              {t("createVault")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDesk === "break"}
              className={activeDesk === "break" ? "is-active" : ""}
              onClick={() => setActiveDesk("break")}
            >
              {t("breakVault")}
            </button>
          </div>
        </div>

        <div className={`vault-grid vault-grid--${activeDesk}`}>
        {activeDesk === "create" && (
          <NeoCard title={t("createVault")} className="vault-create-card">
          <div className="vault-builder">
            <aside className="vault-blueprint" aria-label={t("blueprintTitle")}>
              <div className="vault-blueprint__scene" aria-hidden="true">
                <img src="./vault-challenge.jpg" alt="" />
                <div className={`vault-system-stage vault-system-stage--${createStageState}`}>
                  <span className="vault-system-stage__rail" />
                  <span className="vault-system-stage__node vault-system-stage__node--bounty">
                    <Coins size={18} aria-hidden="true" />
                    <small>{t("bountyLabel")}</small>
                    <strong>
                      {blueprintBounty} {t("tokenGas")}
                    </strong>
                  </span>
                  <span className="vault-system-stage__core">
                    <span className="vault-system-stage__core-ring" />
                    <LockKeyhole size={28} aria-hidden="true" />
                  </span>
                  <span className="vault-system-stage__node vault-system-stage__node--secret">
                    <KeyRound size={18} aria-hidden="true" />
                    <small>{t("secretLabel")}</small>
                    <strong>
                      {secretReady ? t("secretReady") : t("secretWaiting")}
                    </strong>
                  </span>
                </div>
              </div>
              <div
                className={`vault-blueprint__lock${secretReady ? " is-ready" : ""}${isCreating ? " is-creating" : ""}`}
                aria-hidden="true"
              >
                <LockKeyhole size={32} />
              </div>
              <div className="vault-blueprint__copy">
                <span>{t("blueprintTitle")}</span>
                <strong>{blueprintTitle}</strong>
                <p>{description.trim() || t("blueprintHintEmpty")}</p>
              </div>
              <div className="vault-blueprint__facts">
                <span>
                  <Coins size={15} aria-hidden="true" />
                  {t("bountyLabel")}
                  <strong>
                    {blueprintBounty} {t("tokenGas")}
                  </strong>
                </span>
                <span>
                  <ShieldCheck size={15} aria-hidden="true" />
                  {t("difficultyLabel")}
                  <strong>{selectedDifficultyLabel}</strong>
                </span>
                <span>
                  <KeyRound size={15} aria-hidden="true" />
                  {t("secretLabel")}
                  <strong>
                    {secretReady ? t("secretReady") : t("secretWaiting")}
                  </strong>
                </span>
              </div>
              <div className="vault-blueprint__fee">
                <span>{t("attemptFee")}</span>
                <strong>{selectedDifficulty.fee}</strong>
              </div>
            </aside>

            <div className="vault-form vault-builder-form">
              {isMainnet && (
                <p className="vault-mainnet-note" role="note">
                  {t("mainnetVaultNote")}
                </p>
              )}
              <div className="vault-setup-grid">
                <NeoInput
                  className="vault-title-input"
                  label={t("titleLabel")}
                  placeholder={t("titlePlaceholder")}
                  value={title}
                  onChange={setTitle}
                />
                <NeoInput
                  className="vault-bounty-input"
                  label={t("bountyLabel")}
                  type="number"
                  placeholder={t("bountyPlaceholder")}
                  min={1}
                  hint={t("minBountyNote")}
                  value={bounty}
                  onChange={setBounty}
                />
                <NeoInput
                  className="vault-description-input"
                  label={t("descriptionLabel")}
                  type="textarea"
                  placeholder={t("descriptionPlaceholder")}
                  value={description}
                  onChange={setDescription}
                />
              </div>
              <div className="vault-difficulty-field">
                <span>{t("difficultyLabel")}</span>
                <div
                  className="vault-difficulty-grid"
                  role="radiogroup"
                  aria-label={t("difficultyLabel")}
                >
                  {DIFFICULTY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = vaultDifficulty === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${t(option.labelKey)} ${option.fee}`}
                        className={`vault-difficulty-card${selected ? " is-selected" : ""}`}
                        onClick={() => state.vaultDifficulty?.set(option.value)}
                      >
                        <span
                          className="vault-difficulty-card__icon"
                          aria-hidden="true"
                        >
                          <Icon />
                        </span>
                        <span className="vault-difficulty-card__copy">
                          <strong>{t(option.labelKey)}</strong>
                          <span>{option.fee}</span>
                          <small>{t(option.hintKey)}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="vault-secret-panel">
                <span className="vault-secret-panel__icon" aria-hidden="true">
                  <KeyRound size={18} />
                </span>
                <div className="vault-secret-panel__fields">
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
                </div>
              </div>
              {secretMismatch && (
                <p className="vault-field-error" role="alert">
                  {t("secretMismatch")}
                </p>
              )}
              {/* The four explanatory notes are collapsed behind a disclosure so the
              primary action rises toward the fold; details stay one tap away. */}
              <details className="vault-fineprint">
                <summary>
                  <span>{t("createFineLabel")}</span>
                  <ChevronDown
                    className="vault-fineprint-icon"
                    size={15}
                    aria-hidden="true"
                  />
                </summary>
                <div className="vault-fineprint-body">
                  <p className="vault-secret-note">{t("secretNote")}</p>
                  <p className="vault-secret-note">{t("difficultyFeeNote")}</p>
                  <p className="vault-secret-note">{t("createFeeNote")}</p>
                </div>
              </details>
              {/* Inline reason mirrors the disabled state so the missing field is
              named rather than implied by a greyed button. */}
              <p
                className={`vault-create-hint${canSubmitCreate ? " vault-create-hint--ready" : ""}`}
                role={canSubmitCreate ? undefined : "status"}
              >
                <span className="vault-create-hint__dot" aria-hidden="true" />
                <span>{t(createHintKey)}</span>
              </p>
              <NeoButton
                variant="primary"
                size="lg"
                block
                loading={isCreating || isLoading}
                disabled={!canSubmitCreate || isCreating}
                aria-label={t("createVaultButton")}
                onClick={handleCreate}
              >
                {isCreating ? t("creatingVault") : t("createVaultButton")}
              </NeoButton>
            </div>
          </div>
          </NeoCard>
        )}

        {activeDesk === "break" && (
          <div className="vault-col">
          <NeoCard title={t("breakVault")} className="vault-break-card">
            <div className="vault-form">
              <section
                className={`vault-break-stage vault-break-stage--${breakStageState}`}
                aria-label={t("challengeDeskTitle")}
              >
                <picture className="vault-break-stage__media" aria-hidden="true">
                  <source srcSet="./vault-challenge.jpg" type="image/jpeg" />
                  <img src="./vault-challenge.jpg" alt="" />
                </picture>
                <span className="vault-break-stage__scan" aria-hidden="true" />
                <div className="vault-break-stage__target">
                  <span className="vault-break-stage__reticle" aria-hidden="true">
                    {canReclaim ? <Trophy size={24} /> : <Crosshair size={24} />}
                  </span>
                  <span>{t("challengeDeskTitle")}</span>
                  <strong>{breakStageTarget}</strong>
                  <small>
                    {vaultDetails
                      ? `${detailDifficulty || t("difficultyLabel")} · ${detailRemainingDays} ${t("daysUnit")}`
                      : t("vaultIdPlaceholder")}
                  </small>
                </div>
                <div className="vault-break-stage__route" aria-hidden="true">
                  <span className={vaultDetails ? "is-active" : ""}>
                    <LockKeyhole size={15} />
                    {t("vaultStatus")}
                  </span>
                  <span className={canAttempt ? "is-active" : ""}>
                    <KeyRound size={15} />
                    {t("secretAttemptLabel")}
                  </span>
                  <span className={canReclaim || canAttempt ? "is-active" : ""}>
                    <Coins size={15} />
                    {t("bountyLabel")}
                  </span>
                </div>
                <dl className="vault-break-stage__readout">
                  <div>
                    <dt>{t("attemptFee")}</dt>
                    <dd>
                      {vaultDetails ? attemptFeeDisplay : "0"} {t("tokenGas")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("netPayoutLabel")}</dt>
                    <dd>
                      {vaultDetails ? detailNetPayoutGas : "0"} {t("tokenGas")}
                    </dd>
                  </div>
                </dl>
              </section>
              <div
                className={`vault-target-card${vaultDetails ? " vault-target-card--loaded" : ""}${canAttempt ? " vault-target-card--attempt-ready" : ""}${canReclaim ? " vault-target-card--claimable" : ""}`}
              >
                <span className="vault-target-card__icon" aria-hidden="true">
                  {vaultDetails ? (
                    <Trophy size={24} />
                  ) : (
                    <Crosshair size={24} />
                  )}
                </span>
                <div className="vault-target-card__copy">
                  <span>{t("challengeDeskTitle")}</span>
                  <strong>
                    {vaultDetails
                      ? `#${String(vaultDetails.id)}`
                      : t("challengeDeskEmpty")}
                  </strong>
                  <p>
                    {vaultDetails
                      ? detailTitle || t("challengeDeskLoaded")
                      : t("challengeDeskHint")}
                  </p>
                </div>
                <div className="vault-target-card__facts">
                  <span>
                    <Coins size={14} aria-hidden="true" />
                    {vaultDetails
                      ? `${t("bountyLabel")}: ${detailBountyGas} ${t("tokenGas")}`
                      : t("notAvailable")}
                  </span>
                  <span>
                    <Clock3 size={14} aria-hidden="true" />
                    {vaultDetails
                      ? `${t("remainingDaysLabel")}: ${detailRemainingDays} ${t("daysUnit")}`
                      : t("notAvailable")}
                  </span>
                </div>
              </div>
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
                  {detailHint && (
                    <p className="vault-detail-hint">{detailHint}</p>
                  )}
                  <div className="vault-detail-row">
                    <span className="detail-label">{t("vaultStatus")}</span>
                    <span
                      className={`detail-value vault-status-pill vault-status-pill--${statusLabelKey}`}
                    >
                      {t(statusLabelKey)}
                    </span>
                  </div>
                  <div className="vault-detail-row">
                    <span className="detail-label">{t("bountyLabel")}</span>
                    <span className="detail-value detail-value--accent">
                      {detailBountyGas} {t("tokenGas")}
                    </span>
                  </div>
                  {/* Failed attempt fees fold into the bounty on-chain — connect the
                  displayed bounty to the live attempt count below. */}
                  <p className="vault-secret-note">{t("bountyGrowthNote")}</p>
                  {/* What the winner actually receives: bounty minus the fixed 2%
                  platform fee. Surfaced beside the gross so the challenger can
                  weigh the attempt fee against the real prize. */}
                  <div className="vault-detail-row">
                    <span className="detail-label">{t("netPayoutLabel")}</span>
                    <span className="detail-value detail-value--accent">
                      {detailNetPayoutGas} {t("tokenGas")}
                    </span>
                  </div>
                  {detailDifficulty && (
                    <div className="vault-detail-row">
                      <span className="detail-label">
                        {t("difficultyLabel")}
                      </span>
                      <span className="detail-value">{detailDifficulty}</span>
                    </div>
                  )}
                  <div className="vault-detail-row">
                    <span className="detail-label">{t("attemptFee")}</span>
                    <span className="detail-value">
                      {attemptFeeDisplay} {t("tokenGas")}
                    </span>
                  </div>
                  <div className="vault-detail-row">
                    <span className="detail-label">{t("attempts")}</span>
                    <span className="detail-value">{detailAttempts}</span>
                  </div>
                  {(vaultStatus === "active" ||
                    vaultStatus === "claimable") && (
                    <div className="vault-detail-row">
                      <span className="detail-label">
                        {t("remainingDaysLabel")}
                      </span>
                      <span className="detail-value">
                        {detailRemainingDays}
                      </span>
                    </div>
                  )}
                  {detailWinner && (
                    <div className="vault-detail-row">
                      <span className="detail-label">{t("winner")}</span>
                      <span className="detail-value detail-value--mono">
                        {detailWinner}
                      </span>
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
                    <p className="vault-mainnet-note" role="note">
                      {t("mainnetVaultNote")}
                    </p>
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
                      <PlusCircle size={16} aria-hidden="true" />
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
          </div>
        )}
        </div>
      </section>

      {/* Recent Vaults span the full width below the two-column row so the right
          side of the create form is no longer a tall empty gutter. */}
      <NeoCard title={t("recentVaults")}>
        {recentVaults.length === 0 ? (
          <StateView
            kind="empty"
            className="vault-empty-state"
            icon={<EmptyStateArt size={96} title={t("noRecentVaults")} />}
            title={t("noRecentVaults")}
          />
        ) : (
          <div className="vault-list-container">
            <div className="vault-list vault-list--grid">
              {(recentVaults as Array<Record<string, unknown>>).map((vault) => (
                <div
                  key={String(vault.id)}
                  className="vault-list-item"
                  onClick={() => handleLoadVault(vault.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLoadVault(vault.id);
                  }}
                >
                  <span className="vault-id">#{String(vault.id)}</span>
                  <span
                    className={`vault-status-pill vault-status-pill--${STATUS_LABEL_KEYS[String(vault.status ?? "active")] ?? "active"}`}
                  >
                    {t(
                      STATUS_LABEL_KEYS[String(vault.status ?? "active")] ??
                        "active",
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </NeoCard>

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
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLoadVault(vault.id);
                }}
              >
                <span className="vault-id">#{String(vault.id)}</span>
                <span
                  className={`vault-status vault-status-pill vault-status-pill--${STATUS_LABEL_KEYS[String(vault.status ?? "active")] ?? "active"}`}
                >
                  {t(
                    STATUS_LABEL_KEYS[String(vault.status ?? "active")] ??
                      "active",
                  )}
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
