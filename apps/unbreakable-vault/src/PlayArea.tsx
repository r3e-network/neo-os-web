/**
 * PlayArea.tsx -- Unbreakable Vault
 *
 * The vault is the product: challengers choose a live vault, inspect the bounty
 * and attempt fee, then crack the lock. Creation, lists, and reclaim controls
 * stay close, but secondary to the break ritual.
 */
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Binary,
  Clock3,
  Crown,
  Gauge,
  KeyRound,
  Loader2,
  LockKeyhole,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Vault,
  Wallet,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { formatGas, parsePositiveFixed8 } from "@shared/utils/format";
import {
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface PendingVaultOperation {
  kind?: "create" | "attempt" | "increase" | "reclaim";
  stage?: "payment" | "action";
  txid?: string;
  paymentTxid?: string;
  vaultId?: string;
}

interface VaultDetails {
  id: string;
  creator?: string;
  bounty?: string | number;
  attempts?: number;
  broken?: boolean;
  expired?: boolean;
  status?: string;
  winner?: string;
  attemptFee?: string | number;
  difficultyName?: string;
  remainingDays?: number;
  title?: string;
  description?: string;
  [k: string]: unknown;
}

type Mode = "break" | "create";

const VAULT_IMAGE = "vault-challenge.webp";
const BOUNTY_PRESETS = ["1", "5", "10", "25"];
const DIFFICULTIES = [
  { id: 1, key: "difficultyEasy", hint: "difficultyEasyHint" },
  { id: 2, key: "difficultyMedium", hint: "difficultyMediumHint" },
  { id: 3, key: "difficultyHard", hint: "difficultyHardHint" },
] as const;

function formatGasBaseUnits(value: unknown, fallback = "-") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" && /gas/i.test(value)) return value;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return fallback;
  return `${formatGas(normalized, 8)} GAS`;
}

function formatNetPayout(value: unknown, fallback: string) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return fallback;
  return `${formatGas(BigInt(normalized) * 9_800n / 10_000n, 8)} GAS`;
}

function shortText(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function compactAddress(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 14 ? `${text.slice(0, 6)}...${text.slice(-5)}` : text || "-";
}

function vaultTitle(vault: VaultDetails | null | undefined, fallback: string) {
  return shortText(vault?.title, vault?.id ? `#${vault.id}` : fallback);
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);

  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const isClaiming = bool("isClaiming");
  const isRecovering = bool("isRecovering");
  const recoveryStorageHealthy = val<boolean>("recoveryStorageHealthy", true) ?? true;
  const chainStatus = val<"probing" | "ready" | "mismatch" | "awaiting-context">(
    "chainStatus",
    "probing",
  ) ?? "probing";
  const writeStatus = val<"probing" | "ready" | "blocked">("writeStatus", "probing") ?? "probing";
  const chainReady = bool("chainReady");
  const writeReady = bool("writeReady");
  const writeBlockReason = str("writeBlockReason", "");
  const canAttempt = bool("canAttempt");
  const canReclaim = bool("canReclaim");
  const vaultIdInput = str("vaultIdInput");
  const attemptSecret = str("attemptSecret");
  const attemptFeeDisplay = str("attemptFeeDisplay");
  const createdVaultId = str("createdVaultId", "");
  const vaultDetails = val<VaultDetails | null>("vaultDetails", null);
  const recentVaults = val<VaultDetails[]>("recentVaults", []) ?? [];
  const myVaults = val<VaultDetails[]>("myVaults", []) ?? [];
  const pendingOperation = val<PendingVaultOperation | null>("pendingOperation", null);
  const networkName = str("networkName", "").toLowerCase();
  const catalogReadError = str("catalogReadError", "");
  const myVaultsReadError = str("myVaultsReadError", "");

  const [mode, setMode] = useState<Mode>("break");
  const [createSecret, setCreateSecret] = useState("");
  const [confirmSecret, setConfirmSecret] = useState("");
  const [createBounty, setCreateBounty] = useState("5");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [createReceiptId, setCreateReceiptId] = useState("");
  const [attemptReceiptId, setAttemptReceiptId] = useState("");
  const [topupAmount, setTopupAmount] = useState("1");
  const [topupReceiptId, setTopupReceiptId] = useState("");
  const [attemptPreview, setAttemptPreview] = useState(false);
  const attemptPreviewTimeout = useRef<number | null>(null);

  const busy = isLoading || isCreating || isClaiming || isRecovering;
  const pendingWrite = Boolean(pendingOperation);
  const writesBlocked = busy || pendingWrite || !writeReady || !recoveryStorageHealthy;
  const isMainnet = networkName.includes("mainnet");
  const showsMainnetReceipt = isMainnet && writeReady;
  const loaded = Boolean(vaultDetails);
  const broken = Boolean(vaultDetails?.broken || vaultDetails?.status === "broken");
  const expired = Boolean(vaultDetails?.expired || vaultDetails?.status === "expired" || vaultDetails?.status === "claimable");
  const challengeName = vaultTitle(vaultDetails, t("challengeDeskEmpty"));
  const challengeHint = shortText(vaultDetails?.description, t("challengeDeskHint"));
  const createBountyBase = parsePositiveFixed8(createBounty);
  const topupBase = parsePositiveFixed8(topupAmount);
  const bountyDisplay = mode === "create"
    ? createBountyBase
      ? `${formatGas(createBountyBase, 8)} GAS`
      : "-"
    : formatGasBaseUnits(vaultDetails?.bounty, "-");
  const attemptFee = attemptFeeDisplay
    ? `${attemptFeeDisplay.replace(/\s*GAS$/i, "")} GAS`
    : formatGasBaseUnits(vaultDetails?.attemptFee, t("selectVaultFee"));
  const netPayoutDisplay = formatNetPayout(
    mode === "create" ? createBountyBase : vaultDetails?.bounty,
    t("winnerShare"),
  );
  const statusLabel = (status: unknown) => {
    const normalized = String(status ?? "").trim().toLowerCase();
    return ["active", "broken", "expired", "claimable", "reclaimed"].includes(normalized)
      ? t(normalized)
      : shortText(status, t("active"));
  };
  const normalizedCreateSecret = createSecret.trim();
  const normalizedConfirmSecret = confirmSecret.trim();
  const validCreateBounty = Boolean(
    createBountyBase && BigInt(createBountyBase) >= 100_000_000n,
  );
  const createReady = normalizedCreateSecret !== ""
    && normalizedCreateSecret === normalizedConfirmSecret
    && validCreateBounty
    && (!showsMainnetReceipt || /^[1-9]\d*$/.test(createReceiptId.trim()));
  const activeDifficulty = DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[1];
  const sceneSecondaryLabel = mode === "create" ? t("difficultyLabel") : t("attemptFee");
  const sceneSecondaryValue = mode === "create" ? t(activeDifficulty.key) : attemptFee;
  const sceneStatusValue = mode === "create" ? t("blueprintTitle") : broken ? t("broken") : expired ? t("expired") : loaded ? t("active") : t("challengeDeskEmpty");
  const sceneStatusHint = mode === "create"
    ? (createReady ? t("createReady") : t("createNeedSecret"))
    : isLoading
      ? t("attempting")
      : loaded
        ? challengeHint
        : t("challengeDeskHint");
  const expiryDisplay = mode === "create"
    ? `30 ${t("daysUnit")}`
    : loaded
      ? `${vaultDetails?.remainingDays ?? 0} ${t("daysUnit")}`
      : t("selectVaultExpiry");

  const startAttemptPreview = () => {
    if (attemptPreviewTimeout.current) window.clearTimeout(attemptPreviewTimeout.current);
    setAttemptPreview(true);
    attemptPreviewTimeout.current = window.setTimeout(() => {
      setAttemptPreview(false);
      attemptPreviewTimeout.current = null;
    }, 1200);
  };

  useEffect(() => {
    if (!createdVaultId) return;
    // A created id is exposed only after event + readback verification. This is
    // the safe boundary for removing plaintext from component memory.
    setCreateSecret("");
    setConfirmSecret("");
    setCreateReceiptId("");
  }, [createdVaultId]);

  useEffect(() => () => {
    if (attemptPreviewTimeout.current) {
      window.clearTimeout(attemptPreviewTimeout.current);
      attemptPreviewTimeout.current = null;
    }
  }, []);

  const selectVault = (vault: VaultDetails) => {
    state.vaultIdInput?.set(String(vault.id));
    setMode("break");
    void dispatch("loadVault", vault.id);
  };

  const handleLoadVault = () => {
    if (!vaultIdInput.trim() || busy) return;
    void dispatch("loadVault", vaultIdInput.trim());
  };

  const handleAttempt = () => {
    if (
      !canAttempt
      || writesBlocked
      || (showsMainnetReceipt && !/^[1-9]\d*$/.test(attemptReceiptId.trim()))
    ) return;
    startAttemptPreview();
    void dispatch("attemptBreak", {
      receiptId: showsMainnetReceipt ? attemptReceiptId.trim() : undefined,
    });
  };

  const handleCreate = () => {
    if (!createReady || writesBlocked) return;
    void dispatch("createVault", {
      secret: normalizedCreateSecret,
      secretHash: "",
      bounty: createBounty.trim(),
      title: createTitle.trim() || t("blueprintUntitled"),
      description: createDescription.trim(),
      difficulty,
      receiptId: showsMainnetReceipt ? createReceiptId.trim() : undefined,
    });
  };

  const handleIncreaseBounty = () => {
    if (
      !vaultDetails?.id
      || writesBlocked
      || !topupBase
      || (showsMainnetReceipt && !/^[1-9]\d*$/.test(topupReceiptId.trim()))
    ) return;
    void dispatch("increaseBounty", {
      vaultId: String(vaultDetails.id),
      amountGas: topupAmount.trim(),
      receiptId: showsMainnetReceipt ? topupReceiptId.trim() : undefined,
    });
  };
  const sceneState = attemptPreview || isLoading ? "attempting" : broken ? "broken" : loaded ? "loaded" : "empty";

  const scene = (
    <div className="vault-brk-scene" data-state={sceneState}>
      <figure className="vault-brk-scene__art-card">
        <img className="vault-brk-scene__artwork" src={VAULT_IMAGE} alt={t("vaultHeroImageAlt")} loading="eager" decoding="async" draggable={false} />
        <figcaption className="vault-brk-scene__asset-caption">
          <CoinArt size={34} variant="gas" />
          <span>
            <small>{mode === "create" ? t("create") : t("challengeDeskTitle")}</small>
            <strong>{mode === "create" ? (createTitle.trim() || t("blueprintUntitled")) : challengeName}</strong>
          </span>
          <em>{bountyDisplay}</em>
        </figcaption>
      </figure>

      <div className="vault-readout vault-readout--bounty">
        <CoinArt size={22} variant="gas" />
        <span>{t("bountyLabel")}</span>
        <strong>{bountyDisplay}</strong>
      </div>
      <div className="vault-readout vault-readout--fee">
        <Gauge size={17} />
        <span>{sceneSecondaryLabel}</span>
        <strong>{sceneSecondaryValue}</strong>
      </div>
      <div className="vault-readout vault-readout--status">
        <ShieldCheck size={17} />
        <span>{t("vaultStatus")}</span>
        <strong>{sceneStatusValue}</strong>
      </div>

      <div className="vault-asset-journey" aria-label={t("challengeConsole")}>
        <span data-active={mode === "create" || loaded ? "true" : undefined}><Radar size={15} />{mode === "create" ? t("blueprintTitle") : t("loadVault")}</span>
        <span data-active={mode === "create" || canAttempt ? "true" : undefined}><KeyRound size={15} />{mode === "create" ? t("secretLabel") : t("attemptBreak")}</span>
        <span data-active={createReady || broken ? "true" : undefined}><Trophy size={15} />{t("bountyLabel")}</span>
      </div>

      {(attemptPreview || isLoading) && <ParticleBurst coins count={10} />}
      <p className="vault-brk-scene__status" aria-live="polite">
        {sceneStatusHint}
      </p>
    </div>
  );

  const vaultRail = (
    <div className="vault-target-rail" aria-label={t("recentVaults")}>
      {recentVaults.slice(0, 6).map((vault) => {
        const active = String(vaultDetails?.id) === String(vault.id);
        return (
          <button
            key={vault.id}
            type="button"
            className={["vault-target-card", active ? "vault-target-card--active" : null].filter(Boolean).join(" ")}
            onClick={() => selectVault(vault)}
            disabled={busy}
            aria-pressed={active}
          >
            <span className="vault-target-card__icon"><LockKeyhole size={18} /></span>
            <span className="vault-target-card__copy">
              <strong>{vaultTitle(vault, `#${vault.id}`)}</strong>
              <em>{formatGasBaseUnits(vault.bounty)}</em>
            </span>
            <span className="vault-target-card__status">{statusLabel(vault.status)}</span>
          </button>
        );
      })}
      {recentVaults.length === 0 && (
        <button type="button" className="vault-target-card vault-target-card--empty" onClick={() => setMode("create")}>
          <span className="vault-target-card__icon"><Sparkles size={18} /></span>
          <span className="vault-target-card__copy">
            <strong>{t("blueprintTitle")}</strong>
            <em>{t("createNeedSecret")}</em>
          </span>
        </button>
      )}
    </div>
  );

  const controls = (
    <div className="vault-brk-controls">
      {chainStatus === "probing" && (
        <div className="vault-operation-notice vault-operation-notice--probing" role="status">
          <Loader2 size={18} className="vault-operation-notice__spinner" aria-hidden="true" />
          <span><strong>{t("chainProbingTitle")}</strong>{t("chainProbing")}</span>
        </div>
      )}
      {chainStatus === "awaiting-context" && (
        <div className="vault-operation-notice vault-operation-notice--connect" role="status">
          <Wallet size={18} aria-hidden="true" />
          <span><strong>{t("chainAwaitingTitle")}</strong>{t("chainAwaiting")}</span>
        </div>
      )}
      {chainStatus === "mismatch" && (
        <div className="vault-operation-notice vault-operation-notice--error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>{t("chainUnavailableTitle")}</strong>{t("chainContextMismatch")}</span>
        </div>
      )}
      {chainStatus === "ready" && writeStatus === "blocked" && !writeReady && (
        <div className="vault-operation-notice" role="status">
          <AlertTriangle size={18} />
          <span>
            <strong>{t("writeUnavailableTitle")}</strong>
            {writeBlockReason || t("writeUnavailable")}
          </span>
        </div>
      )}
      {!recoveryStorageHealthy && !pendingOperation && (
        <div className="vault-operation-notice vault-operation-notice--error" role="alert">
          <AlertTriangle size={18} />
          <span>
            <strong>{t("recoveryStorageTitle")}</strong>
            {t("recoveryStorageUnavailable")}
          </span>
          <button
            type="button"
            className="vault-secondary-action vault-storage-action"
            onClick={() => void dispatch("refreshVaultRecoveryStorage")}
            disabled={busy}
          >
            {t("retryRecoveryStorage")}
          </button>
        </div>
      )}
      {(catalogReadError || myVaultsReadError) && (
        <div className="vault-operation-notice vault-operation-notice--read" role="status">
          <Radar size={18} />
          <span>
            <strong>{t("readUnavailableTitle")}</strong>
            {[catalogReadError, myVaultsReadError].filter(Boolean).join(" ")}
          </span>
        </div>
      )}
      {pendingOperation && (
        <div className="vault-operation-notice" role="status">
          <RefreshCw size={18} />
          <span>
            <strong>{t("pendingTitle")}</strong>
            {pendingOperation.stage === "payment"
              ? t("paymentRecoveryReady")
              : t("transactionPending")}
            <small>{compactAddress(pendingOperation.txid || pendingOperation.paymentTxid)}</small>
          </span>
          <button
            type="button"
            className="vault-secondary-action vault-recovery-action"
            onClick={() => void dispatch(
              recoveryStorageHealthy ? "recoverPendingVault" : "refreshVaultRecoveryStorage",
            )}
            disabled={busy || (recoveryStorageHealthy && !chainReady)}
          >
            {!recoveryStorageHealthy
              ? t("retryRecoveryStorage")
              : isRecovering
                ? t("recoveringTransaction")
                : t("recoverTransaction")}
          </button>
        </div>
      )}
      <div className="vault-risk-summary" aria-label={t("riskSummaryTitle")}>
        <span><ShieldCheck size={17} /><strong>{netPayoutDisplay}</strong><em>{t("netPayoutCompact")}</em></span>
        <span><AlertTriangle size={17} /><strong>{attemptFee}</strong><em>{t("attemptRiskCompact")}</em></span>
        <span><Clock3 size={17} /><strong>{expiryDisplay}</strong><em>{t("expiryRiskCompact")}</em></span>
      </div>
      <div className="vault-mode-switch" role="tablist" aria-label={t("challengeConsole")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "break"}
          className={["vault-mode-card", mode === "break" ? "vault-mode-card--active" : null].filter(Boolean).join(" ")}
          onClick={() => setMode("break")}
        >
          <span className="vault-mode-card__icon"><Radar size={18} /></span>
          <span className="vault-mode-card__copy">
            <strong>{t("break")}</strong>
            <em>{loaded ? challengeName : t("challengeDeskHint")}</em>
          </span>
          <span className="vault-mode-card__status">{loaded ? statusLabel(vaultDetails?.status) : t("loadVault")}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          className={["vault-mode-card", mode === "create" ? "vault-mode-card--active" : null].filter(Boolean).join(" ")}
          onClick={() => setMode("create")}
        >
          <span className="vault-mode-card__icon"><Sparkles size={18} /></span>
          <span className="vault-mode-card__copy">
            <strong>{t("create")}</strong>
            <em>{createReady ? t("createReady") : t("createNeedSecret")}</em>
          </span>
          <span className="vault-mode-card__status">{createReady ? t("secretReady") : t("secretWaiting")}</span>
        </button>
      </div>

      {(mode === "break" || recentVaults.length > 0) && vaultRail}

      {mode === "break" && (
        <div className="vault-work-card vault-work-card--break" data-mainnet={isMainnet ? "true" : undefined}>
          <div className="vault-work-card__hero">
            <div className="vault-work-card__icon"><Binary size={19} /></div>
            <div className="vault-work-card__copy">
              <strong>{loaded ? challengeName : t("challengeDeskTitle")}</strong>
              <span>{loaded ? `${t("attempts")}: ${vaultDetails?.attempts ?? 0}` : t("challengeDeskHint")}</span>
            </div>
          </div>

          <div className="vault-target-lock" data-loaded={loaded ? "true" : undefined}>
            <LockKeyhole size={21} />
            <OpenUiTextField
              className="vault-field vault-field--id vault-target-lock__id"
              inputClassName="vault-input"
              label={t("vaultIdLabel")}
              value={vaultIdInput}
              onChange={(e) => state.vaultIdInput?.set(e.target.value)}
              placeholder={t("vaultIdPlaceholder")}
              disabled={busy}
              inputMode="numeric"
            />
            <button type="button" className="vault-secondary-action vault-lock-button" onClick={handleLoadVault} disabled={busy || !vaultIdInput.trim()}>
              <RefreshCw size={15} />
              <span>{t("loadVault")}</span>
            </button>
          </div>

          <OpenUiTextField
            className="vault-field vault-key-slot vault-field--secret"
            inputClassName="vault-input"
            label={(
              <>
                <KeyRound size={18} />
                <span>{t("secretAttemptLabel")}</span>
              </>
            )}
            value={attemptSecret}
            onChange={(e) => state.attemptSecret?.set(e.target.value)}
            placeholder={t("secretAttemptPlaceholder")}
            disabled={busy || !loaded || (pendingWrite && pendingOperation?.kind !== "attempt")}
            type="password"
            autoComplete="off"
          />

          {showsMainnetReceipt && (
            <OpenUiTextField
              className="vault-field vault-field--receipt"
              inputClassName="vault-input"
              label={t("receiptIdLabel")}
              value={attemptReceiptId}
              onChange={(event) => setAttemptReceiptId(event.target.value)}
              placeholder={t("receiptIdPlaceholder")}
              disabled={busy || !loaded || pendingWrite}
              inputMode="numeric"
            />
          )}

          <div className="vault-attempt-meter" aria-label={t("attemptFee")}>
            <span>{t("attemptFee")}</span>
            <strong>{attemptFee}</strong>
            <em>{broken ? t("broken") : expired ? t("expired") : loaded ? t("active") : t("challengeDeskEmpty")}</em>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="vault-work-card vault-work-card--create">
          <div className="vault-work-card__hero">
            <div className="vault-work-card__icon"><Crown size={19} /></div>
            <div className="vault-work-card__copy">
              <strong>{createTitle.trim() || t("blueprintUntitled")}</strong>
              <span>{createReady ? t("createReady") : t("createNeedSecret")}</span>
            </div>
          </div>

          <div className="vault-secret-console" data-ready={createReady ? "true" : "false"}>
            <div className="vault-secret-console__head">
              <span className="vault-secret-console__icon"><KeyRound size={17} /></span>
              <span className="vault-secret-console__copy">
                <strong>{t("secretLabel")}</strong>
                <em>{createReady ? t("secretReady") : t("createNeedSecret")}</em>
              </span>
              <span className="vault-secret-console__status">{createReady ? t("secretReady") : t("secretWaiting")}</span>
            </div>
            <div className="vault-key-grid vault-key-grid--create" aria-label={t("secretNote")}>
              <OpenUiTextField
                className="vault-field vault-key-slot vault-field--secret vault-field--create-secret"
                inputClassName="vault-input"
                label={(
                  <>
                    <KeyRound size={18} />
                    <span>{t("secretLabel")}</span>
                  </>
                )}
                type="password"
                autoComplete="new-password"
                value={createSecret}
                onChange={(e) => setCreateSecret(e.target.value)}
                placeholder={t("secretLabel")}
                disabled={busy || pendingWrite}
              />
              <OpenUiTextField
                className="vault-field vault-key-slot vault-field--secret vault-field--confirm-secret"
                inputClassName="vault-input"
                label={(
                  <>
                    <ShieldCheck size={18} />
                    <span>{t("confirmSecretLabel")}</span>
                  </>
                )}
                type="password"
                autoComplete="new-password"
                value={confirmSecret}
                onChange={(e) => setConfirmSecret(e.target.value)}
                placeholder={t("confirmSecretLabel")}
                disabled={busy || pendingWrite}
              />
            </div>
            <div className="vault-create-dossier">
              <div>
                <span>{t("blueprintTitle")}</span>
                <strong>{createTitle.trim() || t("blueprintUntitled")}</strong>
                <small>{createBounty.trim() || t("bountyPlaceholder")} GAS · {t(activeDifficulty.key)}</small>
              </div>
            </div>
          </div>

          <div className="vault-tuning-grid">
            <section className="vault-tuning-card" aria-label={t("bountyPresetLabel")}>
              <span className="vault-tuning-card__label">{t("bountyLabel")}</span>
              <div className="vault-bounty-strip">
                {BOUNTY_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={["vault-bounty", createBounty === amount ? "vault-bounty--active" : null].filter(Boolean).join(" ")}
                    onClick={() => setCreateBounty(amount)}
                    disabled={busy || pendingWrite}
                  >
                    <CoinArt size={16} variant="gas" />
                    <span>{amount}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="vault-tuning-card" aria-label={t("difficultyLabel")}>
              <span className="vault-tuning-card__label">{t("difficultyLabel")}</span>
              <div className="vault-difficulty-strip">
                {DIFFICULTIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={["vault-difficulty", difficulty === item.id ? "vault-difficulty--active" : null].filter(Boolean).join(" ")}
                    onClick={() => setDifficulty(item.id)}
                    disabled={busy || pendingWrite}
                  >
                    <strong>{t(item.key)}</strong>
                    <span>{t(item.hint)}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="unbreakable-vault-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("challengeConsole"),
            title: mode === "create" ? t("createVault") : t("breakVault"),
            subtitle: t("docSubtitle"),
          }}
          scene={<>{scene}{controls}</>}
          actions={{
            primary: {
              label: mode === "break" ? (isLoading ? t("attempting") : t("attemptBreak")) : (isCreating ? t("creatingVault") : t("createVaultButton")),
              onClick: () => void (mode === "break" ? handleAttempt() : handleCreate()),
              disabled: mode === "break"
                ? writesBlocked
                  || !canAttempt
                  || (showsMainnetReceipt && !/^[1-9]\d*$/.test(attemptReceiptId.trim()))
                : writesBlocked || !createReady,
              loading: mode === "break" ? isLoading : isCreating,
            },
          }}
          drawerToggleLabel={t("detailsLabel")}
          drawer={{
            title: t("challengeConsole"),
            children: (
              <div className="vault-drawer-grid">
              <OpenUiPanel
                className="vault-drawer-panel vault-drawer-panel--target"
                icon={<Radar size={16} />}
                title={t("challengeDeskTitle")}
                subtitle={loaded ? challengeName : t("challengeDeskEmpty")}
                titleId="vault-drawer-target"
              >
                <div className="vault-drawer-action-row">
                  <OpenUiTextField
                    className="vault-drawer-field vault-drawer-field--id"
                    label={t("vaultIdLabel")}
                    value={vaultIdInput}
                    onChange={(e) => state.vaultIdInput?.set(e.target.value)}
                    placeholder={t("vaultIdPlaceholder")}
                    inputMode="numeric"
                    disabled={busy}
                  />
                  <button type="button" className="mx2-btn mx2-btn--ghost vault-drawer-load" onClick={handleLoadVault} disabled={busy || !vaultIdInput.trim()}>{t("loadVault")}</button>
                </div>
                {loaded && !broken && !expired && (
                  <div className="vault-topup-row">
                    <OpenUiTextField
                      className="vault-drawer-field vault-drawer-field--topup"
                      label={t("increaseBountyLabel")}
                      value={topupAmount}
                      onChange={(event) => setTopupAmount(event.target.value)}
                      placeholder={t("increaseBountyPlaceholder")}
                      inputMode="decimal"
                      disabled={writesBlocked}
                    />
                    {showsMainnetReceipt && (
                      <OpenUiTextField
                        className="vault-drawer-field vault-drawer-field--receipt"
                        label={t("receiptIdLabel")}
                        value={topupReceiptId}
                        onChange={(event) => setTopupReceiptId(event.target.value)}
                        placeholder={t("receiptIdPlaceholder")}
                        inputMode="numeric"
                        disabled={writesBlocked}
                      />
                    )}
                    <button
                      type="button"
                      className="mx2-btn mx2-btn--ghost vault-topup-action"
                      onClick={handleIncreaseBounty}
                      disabled={writesBlocked || !topupBase || (showsMainnetReceipt && !/^[1-9]\d*$/.test(topupReceiptId.trim()))}
                    >
                      {t("increaseBounty")}
                    </button>
                  </div>
                )}
              </OpenUiPanel>

              <OpenUiPanel
                className="vault-drawer-panel vault-drawer-panel--create"
                icon={<Crown size={16} />}
                title={t("createFineLabel")}
                subtitle={createReady ? t("createReady") : t("createNeedSecret")}
                titleId="vault-drawer-create"
              >
                <div className="vault-drawer-form-row">
                  <OpenUiTextField
                    className="vault-drawer-field vault-drawer-field--title"
                    label={t("titleLabel")}
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder={t("titlePlaceholder")}
                    disabled={busy || pendingWrite}
                  />
                  <OpenUiTextField
                    className="vault-drawer-field"
                    label={t("bountyLabel")}
                    value={createBounty}
                    onChange={(e) => setCreateBounty(e.target.value)}
                    placeholder={t("bountyPlaceholder")}
                    inputMode="decimal"
                    disabled={busy || pendingWrite}
                  />
                  <OpenUiTextField
                    className="vault-drawer-field vault-drawer-field--wide"
                    label={t("descriptionLabel")}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    disabled={busy || pendingWrite}
                  />
                  {showsMainnetReceipt && (
                    <OpenUiTextField
                      className="vault-drawer-field vault-drawer-field--wide vault-drawer-field--receipt"
                      label={t("receiptIdLabel")}
                      value={createReceiptId}
                      onChange={(event) => setCreateReceiptId(event.target.value)}
                      placeholder={t("receiptIdPlaceholder")}
                      inputMode="numeric"
                      disabled={busy || pendingWrite}
                    />
                  )}
                </div>
                <p className="vault-drawer-note">{t("secretNote")}</p>
                {createdVaultId && <p className="vault-drawer-note vault-drawer-note--success"><BadgeCheck size={14} /> {t("vaultCreated")}: #{createdVaultId}</p>}
              </OpenUiPanel>

              <OpenUiPanel
                className="vault-drawer-panel vault-drawer-panel--list"
                icon={<Vault size={16} />}
                title={t("recentVaults")}
                subtitle={recentVaults.length}
                titleId="vault-drawer-recent"
              >
                {recentVaults.length > 0 ? (
                  <ul className="mx2-history vault-drawer-list">
                    {recentVaults.slice(0, 8).map((vault) => (
                      <li key={vault.id} className="mx2-history__item">
                        <button type="button" className="vault-list__select" onClick={() => selectVault(vault)}>
                          <span className="mx2-history__face">{vaultTitle(vault, `#${vault.id}`)}</span>
                          <span className="mx2-history__stake">{formatGasBaseUnits(vault.bounty)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="vault-drawer-empty">{t("noRecentVaults")}</p>}
              </OpenUiPanel>

              <OpenUiPanel
                className="vault-drawer-panel vault-drawer-panel--list"
                icon={<LockKeyhole size={16} />}
                title={t("myVaults")}
                subtitle={myVaults.length}
                titleId="vault-drawer-owned"
              >
                {myVaults.length > 0 ? (
                  <ul className="mx2-history vault-drawer-list">
                    {myVaults.slice(0, 8).map((vault) => (
                      <li key={vault.id} className="mx2-history__item">
                        <button type="button" className="vault-list__select" onClick={() => selectVault(vault)}>
                          <span className="mx2-history__face">{vaultTitle(vault, `#${vault.id}`)}</span>
                          <span className="mx2-history__stake">{formatGasBaseUnits(vault.bounty)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="vault-drawer-empty">{t("noRecentVaults")}</p>}
              </OpenUiPanel>

              {canReclaim && (
                <button type="button" className="mx2-btn mx2-btn--ghost vault-drawer-reclaim" onClick={() => void dispatch("settleVault")} disabled={writesBlocked}>
                  {isClaiming ? t("claimBounty") : t("reclaimVault")}
                </button>
              )}
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
