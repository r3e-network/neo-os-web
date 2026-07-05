/**
 * PlayArea.tsx -- Unbreakable Vault
 *
 * The vault is the product: challengers choose a live vault, inspect the bounty
 * and attempt fee, then crack the lock. Creation, lists, and reclaim controls
 * stay close, but secondary to the break ritual.
 */
import { useRef, useState } from "react";
import {
  BadgeCheck,
  Binary,
  CircleDollarSign,
  Crown,
  Gauge,
  KeyRound,
  LockKeyhole,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Vault,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { CoinArt, ParticleBurst } from "@shared/art";
import { OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
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

function formatGasValue(value: unknown, fallback = "-") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" && /gas/i.test(value)) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const gas = Math.abs(numeric) >= 100_000 ? numeric / 100_000_000 : numeric;
  return `${gas.toLocaleString(undefined, { maximumFractionDigits: 4 })} GAS`;
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

  const address = str("address", "");
  const isLoading = bool("isLoading");
  const isCreating = bool("isCreating");
  const isClaiming = bool("isClaiming");
  const canAttempt = bool("canAttempt");
  const canReclaim = bool("canReclaim");
  const vaultIdInput = str("vaultIdInput");
  const attemptSecret = str("attemptSecret");
  const attemptFeeDisplay = str("attemptFeeDisplay");
  const createdVaultId = str("createdVaultId", "");
  const vaultDetails = val<VaultDetails | null>("vaultDetails", null);
  const recentVaults = val<VaultDetails[]>("recentVaults", []) ?? [];
  const myVaults = val<VaultDetails[]>("myVaults", []) ?? [];

  const [mode, setMode] = useState<Mode>(() =>
    vaultDetails || recentVaults.length > 0 || vaultIdInput.trim() ? "break" : "create",
  );
  const [createSecret, setCreateSecret] = useState("");
  const [confirmSecret, setConfirmSecret] = useState("");
  const [createBounty, setCreateBounty] = useState("5");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [attemptPreview, setAttemptPreview] = useState(false);
  const attemptPreviewTimeout = useRef<number | null>(null);

  const busy = isLoading || isCreating || isClaiming;
  const loaded = Boolean(vaultDetails);
  const broken = Boolean(vaultDetails?.broken || vaultDetails?.status === "broken");
  const expired = Boolean(vaultDetails?.expired || vaultDetails?.status === "expired" || vaultDetails?.status === "claimable");
  const challengeName = vaultTitle(vaultDetails, t("challengeDeskEmpty"));
  const challengeHint = shortText(vaultDetails?.description, t("challengeDeskHint"));
  const bountyDisplay = formatGasValue(vaultDetails?.bounty, createBounty ? `${createBounty} GAS` : "-");
  const attemptFee = attemptFeeDisplay || formatGasValue(vaultDetails?.attemptFee, "-");
  const normalizedCreateSecret = createSecret.trim();
  const normalizedConfirmSecret = confirmSecret.trim();
  const createReady = normalizedCreateSecret !== "" && normalizedCreateSecret === normalizedConfirmSecret && createBounty.trim() !== "";
  const activeDifficulty = DIFFICULTIES.find((item) => item.id === difficulty) ?? DIFFICULTIES[1];
  const sceneDoorLabel = mode === "create" ? t("blueprintTitle") : loaded ? `#${vaultDetails?.id}` : t("vaultIdLabel");
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

  const startAttemptPreview = () => {
    if (attemptPreviewTimeout.current) window.clearTimeout(attemptPreviewTimeout.current);
    setAttemptPreview(true);
    attemptPreviewTimeout.current = window.setTimeout(() => {
      setAttemptPreview(false);
      attemptPreviewTimeout.current = null;
    }, 1200);
  };

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
    if (!canAttempt || busy) return;
    startAttemptPreview();
    void dispatch("attemptBreak");
  };

  const handleCreate = () => {
    if (!createReady || busy) return;
    void dispatch("createVault", {
      secret: normalizedCreateSecret,
      secretHash: "",
      bounty: createBounty.trim(),
      title: createTitle.trim() || t("blueprintUntitled"),
      description: createDescription.trim(),
      difficulty,
    });
  };
  const sceneState = attemptPreview || isLoading ? "attempting" : broken ? "broken" : loaded ? "loaded" : "empty";

  const scene = (
    <div className="vault-brk-scene" data-state={sceneState}>
      <figure className="vault-brk-scene__art-card" aria-hidden="true">
        <img className="vault-brk-scene__artwork" src={VAULT_IMAGE} alt="" loading="eager" decoding="async" draggable={false} />
      </figure>
      <div className="vault-core" aria-label={challengeName}>
        <div className="vault-core__door">
          <span className="vault-core__ring" aria-hidden="true" />
          <Vault size={52} />
          <strong>{sceneDoorLabel}</strong>
        </div>
        <div className="vault-core__laser vault-core__laser--left" aria-hidden="true" />
        <div className="vault-core__laser vault-core__laser--right" aria-hidden="true" />
      </div>

      <div className="vault-readout vault-readout--bounty">
        <CircleDollarSign size={17} />
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

      <div className="vault-crack-route">
        <span className="vault-crack-route__node"><Radar size={15} />{mode === "create" ? t("blueprintTitle") : t("loadVault")}</span>
        <span className={["vault-crack-route__beam", mode === "create" || loaded ? "vault-crack-route__beam--active" : null].filter(Boolean).join(" ")} />
        <span className={["vault-crack-route__node", mode === "create" || canAttempt ? "vault-crack-route__node--active" : null].filter(Boolean).join(" ")}><KeyRound size={15} />{mode === "create" ? t("secretLabel") : t("attemptBreak")}</span>
        <span className={["vault-crack-route__beam", createReady || attemptPreview || broken ? "vault-crack-route__beam--active" : null].filter(Boolean).join(" ")} />
        <span className={["vault-crack-route__node", createReady || broken ? "vault-crack-route__node--active" : null].filter(Boolean).join(" ")}><Trophy size={15} />{t("bountyLabel")}</span>
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
              <em>{formatGasValue(vault.bounty)}</em>
            </span>
            <span className="vault-target-card__status">{shortText(vault.status, t("active"))}</span>
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
          <span className="vault-mode-card__status">{loaded ? t("active") : t("loadVault")}</span>
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
        <div className="vault-work-card vault-work-card--break">
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
            disabled={busy || !loaded}
          />

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
                disabled={busy}
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
                disabled={busy}
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
                    disabled={busy}
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
                    disabled={busy}
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
      <div className="unbreakable-vault-play-area mx2 mx2-cat-game">
        <PlayStage
          category="game"
          stage={{
            eyebrow: t("challengeConsole"),
            title: mode === "create" ? t("createVault") : t("breakVault"),
            subtitle: t("docSubtitle"),
            badges: (
              <>
                <span className="mx2-badge vault-stage-badge vault-stage-badge--status" data-tone="accent"><span className="mx2-badge__dot" /> {t("challengeConsoleTitle")}</span>
                <span className="mx2-badge vault-stage-badge vault-stage-badge--wallet">{address ? compactAddress(address) : t("creator")}</span>
              </>
            ),
          }}
          scene={<>{scene}{controls}</>}
          score={[
            { label: t("attempts"), value: String(vaultDetails?.attempts ?? 0), accent: true },
            { label: t("bountyLabel"), value: bountyDisplay },
            { label: t("active"), value: broken ? t("broken") : expired ? t("expired") : t("active") },
          ]}
          actions={{
            primary: {
              label: mode === "break" ? (isLoading ? t("attempting") : t("attemptBreak")) : (isCreating ? t("creatingVault") : t("createVaultButton")),
              onClick: () => void (mode === "break" ? handleAttempt() : handleCreate()),
              disabled: mode === "break" ? busy || !canAttempt : busy || !createReady,
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
                    disabled={busy}
                  />
                  <OpenUiTextField
                    className="vault-drawer-field"
                    label={t("bountyLabel")}
                    value={createBounty}
                    onChange={(e) => setCreateBounty(e.target.value)}
                    placeholder={t("bountyPlaceholder")}
                    inputMode="decimal"
                    disabled={busy}
                  />
                  <OpenUiTextField
                    className="vault-drawer-field vault-drawer-field--wide"
                    label={t("descriptionLabel")}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    disabled={busy}
                  />
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
                          <span className="mx2-history__stake">{formatGasValue(vault.bounty)}</span>
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
                          <span className="mx2-history__stake">{formatGasValue(vault.bounty)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="vault-drawer-empty">{t("noRecentVaults")}</p>}
              </OpenUiPanel>

              {canReclaim && (
                <button type="button" className="mx2-btn mx2-btn--ghost vault-drawer-reclaim" onClick={() => void dispatch("settleVault")} disabled={busy}>
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
