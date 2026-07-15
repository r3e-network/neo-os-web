import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  FileJson2,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { PlayStage } from "@shared/components-react/v2";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2/DataPhase";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatHash } from "@shared/utils/format";
import {
  MIN_RECOVERY_DELAY_MS,
  type GuardianSetupPackage,
  type PendingRecoveryWrite,
  type RecoveryProfile,
} from "./recovery-guardian";
import type { GuardianJourneyState } from "./useRecoveryGuardian";
import "./PlayArea.scss";

const COMMAND_CENTER_IMAGE = "./recovery-command-center.webp";
const EXPIRY_PRESETS = [15, 30, 60, 240];

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

function DetailPanel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="guardian-detail-panel" aria-label={String(title)}>
      <header>
        <span>{icon}</span>
        <div><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
      </header>
      <div className="guardian-detail-panel__body">{children}</div>
    </section>
  );
}

function GuardianNotice({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="guardian-notice">
      <span>{icon}</span>
      <div><strong>{title}</strong>{children && <p>{children}</p>}</div>
    </div>
  );
}

function compact(value: string, fallback = "—"): string {
  return value ? formatHash(value, 7) : fallback;
}

function formatDelay(milliseconds: number, t: Props["t"]): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  if (milliseconds === 0) return t("legacyNoDelay");
  const hours = milliseconds / 3_600_000;
  if (Number.isInteger(hours)) return t("delayHours", { hours });
  return t("delayMinutes", { minutes: Math.round(milliseconds / 60_000) });
}

function formatCountdown(target: number, now: number): string {
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return [days ? `${days}d` : "", `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`]
    .filter(Boolean)
    .join(" ");
}

function journeyCopy(
  journey: GuardianJourneyState,
  profile: RecoveryProfile | null,
  now: number,
  t: Props["t"],
) {
  if (journey === "loading") return { title: t("journeyReading"), copy: t("journeyReadingCopy") };
  if (journey === "unconfigured") return { title: t("journeyNeedsSetup"), copy: t("journeyNeedsSetupCopy") };
  if (journey === "binding-required") return { title: t("journeyBindingRequired"), copy: t("journeyBindingRequiredCopy") };
  if (journey === "legacy") return { title: t("journeyLegacy"), copy: t("journeyLegacyCopy") };
  if (journey === "legacy-policy") {
    return { title: t("journeyLegacyPolicy"), copy: t("journeyLegacyPolicyCopy") };
  }
  if (journey === "protected") return { title: t("journeyProtected"), copy: t("journeyProtectedCopy") };
  if (journey === "collecting") {
    return {
      title: t("journeyCollecting", {
        approved: profile?.pending.approvedCount ?? 0,
        threshold: profile?.threshold ?? 0,
      }),
      copy: t("journeyCollectingCopy"),
    };
  }
  if (journey === "waiting") {
    return {
      title: t("journeyWaiting", { time: formatCountdown(profile?.pending.executableAt ?? 0, now) }),
      copy: t("journeyWaitingCopy"),
    };
  }
  if (journey === "ready") return { title: t("journeyReady"), copy: t("journeyReadyCopy") };
  if (journey === "pending-transaction") return { title: t("journeyConfirming"), copy: t("journeyConfirmingCopy") };
  if (journey === "failed") return { title: t("journeyReadFailed"), copy: t("journeyReadFailedCopy") };
  return { title: t("journeyStart"), copy: t("journeyStartCopy") };
}

export default function PlayArea({ t, state, dispatch }: Props) {
  const { str, bool, num, val } = useStateBindings(state);
  const profileInput = str("profileInput");
  const setupPackageText = str("setupPackageText");
  const recoveryExpiryMinutes = str("recoveryExpiryMinutes", "30");
  const network = str("network") || "—";
  const verifierHash = str("verifierHash");
  const aaCoreHash = str("aaCoreHash");
  const morpheusOracleHash = str("morpheusOracleHash");
  const walletAddress = str("walletAddress");
  const journey = (str("journeyState", "idle") as GuardianJourneyState);
  const isLoading = bool("isLoading");
  const isWalletConnecting = bool("isWalletConnecting");
  const isSubmitting = bool("isSubmitting");
  const isRecovering = bool("isRecovering");
  const activeAction = str("activeAction");
  const lastError = str("lastError");
  const lastSuccess = str("lastSuccess");
  const transactionNotice = str("transactionNotice");
  const confirmationKind = str("confirmationKind");
  const setupWriteAvailable = bool("setupWriteAvailable");
  const storageHealthy = bool("storageHealthy");
  const approvedCount = num("approvedCount");
  const threshold = num("threshold");
  const guardianCount = num("guardianCount");
  const executableAt = num("executableAt");
  const profile = val<RecoveryProfile | null>("profile", null);
  const setupPreview = val<GuardianSetupPackage | null>("setupPreview", null);
  const pendingWrite = val<PendingRecoveryWrite | null>("pendingWrite", null);
  const [showSetup, setShowSetup] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (journey !== "waiting") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [journey]);

  useEffect(() => {
    if (journey !== "unconfigured") setShowSetup(false);
  }, [journey]);

  const busy = isLoading || isWalletConnecting || isSubmitting || isRecovering;
  const fieldLocked = busy || Boolean(pendingWrite);
  const storageNotice = storageHealthy ? "" : t("recoveryStorageUnavailable");
  const feedback = lastError || storageNotice || transactionNotice || lastSuccess;
  const feedbackTone = lastError || storageNotice ? "error" : transactionNotice ? "pending" : "success";
  const status = journey === "unconfigured" && !setupWriteAvailable
    ? { title: t("journeySetupUpgradeRequired"), copy: t("journeySetupUpgradeRequiredCopy") }
    : journeyCopy(journey, profile, now, t);
  const protectionHealthy = Boolean(
    profile?.configured && profile.aaBindingVerified && profile.timelockMs >= MIN_RECOVERY_DELAY_MS,
  );
  const approvalPercent = profile?.configured
    ? Math.min(100, Math.round(((profile.pending.approvedCount || 0) / Math.max(profile.threshold, 1)) * 100))
    : 0;
  const currentStep = pendingWrite?.kind === "setup"
    ? 1
    : journey === "idle" || journey === "failed" || journey === "loading"
      ? 0
      : journey === "unconfigured" || journey === "binding-required" || journey === "legacy" ||
          journey === "legacy-policy" || journey === "protected"
        ? 1
        : journey === "collecting"
          ? 2
          : 3;
  const reviewWindowValue = profile?.pending.active && executableAt > 0
    ? now >= executableAt ? t("recoveryReadyNow") : formatCountdown(executableAt, now)
    : profile?.configured ? formatDelay(profile.timelockMs, t) : "";

  // Every readout below describes ONE account's on-chain guardian policy, and
  // this console reads it only once a profile ID has been entered. Before that
  // there is nothing to report — the expected first paint, since the surface
  // opens on an empty ID field and says so ("Find your guardian circle"). The
  // three tiles used to render that normal state as an em-dash apiece, which
  // reads as three broken readouts rather than one un-started lookup.
  const profilePhase = resolvePhase({
    loading: journey === "loading",
    settled: journey !== "loading",
    hasData: Boolean(profile),
  });
  const profileStat = (value: ReactNode, skeletonWidth?: string) => (
    <PhaseValue
      phase={profilePhase}
      placeholder={t("valueEnterProfileId")}
      skeletonWidth={skeletonWidth}
    >
      {value}
    </PhaseValue>
  );

  const setField = (field: string, value: string) => void dispatch("setField", field, value);
  const load = () => void dispatch("loadProfile");
  const continueRecovery = () => void dispatch("continueRecovery");
  const openAAWorkspace = () => void dispatch("openAAWorkspace");
  const reviewSetup = () => void dispatch("reviewSetupPackage");
  const submitSetup = () => void dispatch("submitSetup");
  const finalize = () => void dispatch("submitFinalize");
  const cancel = () => void dispatch("submitCancel");
  const recover = () => void dispatch("recoverPendingWrite");
  const retryStorage = () => void dispatch("refreshRecoveryStorage");
  const writeStorageBlocked = !storageHealthy && (
    journey === "ready" ||
    (setupWriteAvailable && journey === "unconfigured" && Boolean(setupPreview))
  );

  const primary = pendingWrite && !storageHealthy
    ? {
        label: t("retryRecoveryStorage"),
        onClick: retryStorage,
        disabled: busy,
        icon: <RefreshCw size={17} />,
      }
    : pendingWrite
      ? {
        label: isRecovering ? t("checkingConfirmation") : t("checkConfirmation"),
        onClick: recover,
        loading: isRecovering,
        disabled: isRecovering,
        icon: <RefreshCw size={17} />,
        }
    : writeStorageBlocked
      ? {
          label: t("retryRecoveryStorage"),
          onClick: retryStorage,
          disabled: busy,
          icon: <RefreshCw size={17} />,
        }
    : journey === "ready"
      ? {
          label: confirmationKind === "finalize" ? t("confirmFinalize") : t("finalizeRecovery"),
          onClick: finalize,
          loading: activeAction === "finalize",
          disabled: busy || !storageHealthy,
          icon: <KeyRound size={17} />,
        }
      : journey === "binding-required"
        ? {
            label: t("bindRecoveryVerifier"),
            onClick: openAAWorkspace,
            disabled: busy,
            icon: <ArrowRight size={17} />,
          }
      : journey === "waiting"
        ? {
            label: t("refreshStatus"),
            onClick: load,
            loading: isLoading,
            disabled: busy,
            icon: <RefreshCw size={17} />,
          }
      : journey === "protected" || journey === "legacy-policy" || journey === "collecting"
        ? {
            label: journey === "collecting" ? t("continueGuardianApproval") : t("startRecovery"),
            onClick: continueRecovery,
            loading: activeAction === "continue",
            disabled: busy,
            icon: <ArrowRight size={17} />,
          }
        : journey === "unconfigured" && !setupWriteAvailable
          ? {
              label: t("refreshStatus"),
              onClick: load,
              loading: isLoading,
              disabled: busy,
              icon: <RefreshCw size={17} />,
            }
        : journey === "unconfigured"
          ? {
              label: setupPreview
                ? confirmationKind === "setup" ? t("confirmGuardianSetup") : t("activateGuardians")
                : showSetup ? t("reviewSetupPackage") : t("setupGuardians"),
              onClick: setupPreview ? submitSetup : showSetup ? reviewSetup : () => setShowSetup(true),
              loading: activeAction === "setup" || activeAction === "review-setup",
              disabled: busy || Boolean(setupPreview && !storageHealthy) ||
                (showSetup && !setupPreview && !setupPackageText.trim()),
              icon: setupPreview ? <ShieldCheck size={17} /> : <FileJson2 size={17} />,
            }
          : {
              label: isLoading ? t("readingProtection") : t("checkProtection"),
              onClick: load,
              loading: isLoading,
              disabled: busy || !profileInput.trim(),
              icon: <ShieldCheck size={17} />,
            };

  const secondary = (() => {
    if (pendingWrite) return [];
    if (journey === "unconfigured" && !setupWriteAvailable) return [];
    if (!storageHealthy && journey === "ready") return [];
    if (!storageHealthy && (journey === "waiting" || journey === "collecting")) {
      return [{
        label: t("retryRecoveryStorage"),
        onClick: retryStorage,
        disabled: busy,
        icon: <RefreshCw size={16} />,
      }];
    }
    if (journey === "waiting") {
      return [
        {
          label: confirmationKind === "cancel" ? t("confirmCancel") : t("cancelRecovery"),
          onClick: cancel,
          disabled: busy || !storageHealthy,
          icon: <RotateCcw size={16} />,
        },
      ];
    }
    if ((journey === "collecting" || journey === "ready") && profile?.pending.active) {
      return [{
        label: confirmationKind === "cancel" ? t("confirmCancel") : t("cancelRecovery"),
        onClick: cancel,
        disabled: busy || !storageHealthy,
        icon: <RotateCcw size={16} />,
      }];
    }
    if (profile) return [{ label: t("refreshStatus"), onClick: load, disabled: busy, icon: <RefreshCw size={16} /> }];
    return [];
  })();

  const scene = (
    <div className="guardian-app guardian-scene" data-journey={journey}>
      {feedback && (
        <div className={`guardian-feedback is-${feedbackTone}`} role={lastError ? "alert" : "status"}>
          {feedbackTone === "error" ? <AlertTriangle size={18} /> : feedbackTone === "success" ? <BadgeCheck size={18} /> : <Clock3 size={18} />}
          <span><strong>{feedback}</strong>{pendingWrite?.txid && <small>{compact(pendingWrite.txid)}</small>}</span>
        </div>
      )}

      <div className="guardian-app__grid">
        <section className="guardian-console">
          <div className="guardian-lookup">
            <label htmlFor="guardian-profile-id">{t("profileIdLabel")}</label>
            <div className="guardian-lookup__control">
              <input
                id="guardian-profile-id"
                value={profileInput}
                onChange={(event) => setField("profileInput", event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && profileInput.trim() && !fieldLocked) load(); }}
                placeholder={t("profileIdPlaceholder")}
                disabled={fieldLocked}
                spellCheck={false}
              />
              <button type="button" onClick={load} disabled={!profileInput.trim() || fieldLocked} aria-label={t("checkProtection")}>
                {isLoading ? <span className="mx2-spinner" /> : <RefreshCw size={17} />}
              </button>
            </div>
            <small>{t("profileIdHint")}</small>
          </div>

          <div className="guardian-journey" aria-label={t("recoveryJourneyLabel")}>
            {[t("journeyStepProfile"), t("journeyStepProtected"), t("journeyStepApproval"), t("journeyStepRecover")].map((label, index) => (
              <span key={label} className={index < currentStep ? "is-complete" : index === currentStep ? "is-current" : ""}>
                <i>{index < currentStep ? <Check size={13} /> : index + 1}</i>
                <small>{label}</small>
              </span>
            ))}
          </div>

          <section className="guardian-status-card">
            <div className="guardian-status-card__icon">
              {journey === "ready"
                ? <KeyRound size={30} />
                : journey === "legacy-policy" || (journey === "unconfigured" && !setupWriteAvailable)
                  ? <AlertTriangle size={30} />
                  : journey === "collecting" || journey === "waiting"
                    ? <UsersRound size={30} />
                    : <ShieldCheck size={30} />}
            </div>
            <div>
              <span>{t("recoveryStatus")}</span>
              <strong>{status.title}</strong>
              <p>{status.copy}</p>
            </div>
          </section>

          {journey === "unconfigured" && !setupWriteAvailable && (
            <GuardianNotice icon={<AlertTriangle size={17} />} title={t("setupActivationPaused")}>
              {t("setupActivationPausedCopy")}
            </GuardianNotice>
          )}

          {profile?.configured && (
            <section className="guardian-quorum-card">
              <div className="guardian-quorum-card__head">
                <span><UsersRound size={16} /> {t("guardianQuorum")}</span>
                <strong>{profile.pending.active ? `${approvedCount}/${threshold}` : t("guardianPolicy", { threshold, total: guardianCount })}</strong>
              </div>
              <div className="guardian-progress" aria-label={t("guardianApprovalProgress")}>
                <span style={{ width: `${approvalPercent}%` }} />
              </div>
              <div className="guardian-quorum-card__meta">
                <span><ShieldCheck size={15} /> {t("guardianCountValue", { count: guardianCount })}</span>
                <span><Clock3 size={15} /> {formatDelay(profile.timelockMs, t)}</span>
                {profile.pending.newOwner && <span><UserRoundCheck size={15} /> {compact(profile.pending.newOwner)}</span>}
              </div>
            </section>
          )}

          {journey === "unconfigured" && setupWriteAvailable && showSetup && (
            <section className="guardian-setup-card">
              <div className="guardian-setup-card__head">
                <span><FileJson2 size={17} /> {t("publicSetupPackage")}</span>
                <small>{t("publicDataOnly")}</small>
              </div>
              {!setupPreview ? (
                <>
                  <textarea
                    value={setupPackageText}
                    onChange={(event) => setField("setupPackageText", event.target.value)}
                    placeholder={t("setupPackagePlaceholder")}
                    rows={4}
                    spellCheck={false}
                    disabled={fieldLocked}
                  />
                  <p>{t("setupPackageHint")}</p>
                </>
              ) : (
                <div className="guardian-setup-summary">
                  <BadgeCheck size={24} />
                  <div>
                    <strong>{t("setupPackageReady")}</strong>
                    <span>{t("setupPackagePolicy", { threshold: setupPreview.threshold, total: setupPreview.guardianCommitments.length })}</span>
                    <small>{formatDelay(setupPreview.timelockMs, t)}</small>
                  </div>
                </div>
              )}
            </section>
          )}
        </section>

        <figure className="guardian-command-art">
          <img src={COMMAND_CENTER_IMAGE} alt={t("guardianHeroVisualAlt")} loading="eager" decoding="async" />
          <figcaption>
            <strong>{protectionHealthy ? t("guardianVisualProtected") : t("guardianVisualReady")}</strong>
            <small>{walletAddress ? t("walletReady", { wallet: compact(walletAddress) }) : t("walletConnectsWhenNeeded")}</small>
          </figcaption>
        </figure>
      </div>
    </div>
  );

  const drawer = (
    <div className="guardian-details guardian-drawer">
        <DetailPanel
          icon={<ShieldCheck size={18} />}
          title={t("protectionDetails")}
          subtitle={profile?.checkedAt ? new Date(profile.checkedAt).toLocaleString() : t("notChecked")}
        >
          {profile ? (
            <dl className="guardian-facts">
              <div><dt>{t("profileIdLabel")}</dt><dd>{profile.profileId.hex}</dd></div>
              <div><dt>{t("ownerLabel")}</dt><dd>{profile.owner || t("notConfigured")}</dd></div>
              <div><dt>{t("aaBackupOwnerLabel")}</dt><dd>{profile.aaBackupOwner || t("notConfigured")}</dd></div>
              <div><dt>{t("accountAddressLabel")}</dt><dd>{profile.accountAddress || "—"}</dd></div>
              <div><dt>{t("recoveryNonceLabel")}</dt><dd>{profile.recoveryNonce}</dd></div>
              <div><dt>{t("boundVerifierLabel")}</dt><dd>{profile.aaVerifierHash || t("notConfigured")}</dd></div>
              <div><dt>{t("networkLabel")}</dt><dd>{network}</dd></div>
              <div><dt>{t("verifierLabel")}</dt><dd>{verifierHash || "—"}</dd></div>
            </dl>
          ) : (
            <GuardianNotice icon={<ShieldCheck size={17} />} title={t("detailsLoadFirst")} />
          )}
        </DetailPanel>

        <DetailPanel
          icon={<Clock3 size={18} />}
          title={t("recoveryWindowTitle")}
          subtitle={t("recoveryWindowSubtitle")}
        >
          <div className="guardian-expiry-presets" aria-label={t("recoveryWindowTitle")}>
            {EXPIRY_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={recoveryExpiryMinutes === String(minutes) ? "is-active" : ""}
                onClick={() => setField("recoveryExpiryMinutes", String(minutes))}
                disabled={fieldLocked}
              >
                {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
              </button>
            ))}
          </div>
          <p className="guardian-detail-copy">{t("recoveryWindowHint")}</p>
        </DetailPanel>

        <DetailPanel
          icon={<KeyRound size={18} />}
          title={t("contractDetails")}
          subtitle={t("technicalSecondary")}
        >
          <dl className="guardian-facts guardian-facts--contracts">
            <div><dt>{t("verifierLabel")}</dt><dd>{verifierHash || "—"}</dd></div>
            <div><dt>{t("aaCoreLabel")}</dt><dd>{aaCoreHash || "—"}</dd></div>
            <div><dt>{t("oracleLabel")}</dt><dd>{morpheusOracleHash || "—"}</dd></div>
            <div><dt>{t("networkLabel")}</dt><dd>{network}</dd></div>
          </dl>
        </DetailPanel>

        {profile?.pending.active && (
          <DetailPanel
            icon={<RotateCcw size={18} />}
            title={t("ownerControlTitle")}
            subtitle={t("ownerControlSubtitle")}
          >
            <GuardianNotice
              icon={<AlertTriangle size={17} />}
              title={confirmationKind === "cancel" ? t("cancelConfirmationTitle") : t("cancelRecovery")}
            >
              {t("cancelRecoveryHint")}
            </GuardianNotice>
          </DetailPanel>
        )}
      </div>
  );

  return (
    <div className="recovery-guardian-play-area mx2">
      <PlayStage
        category="tool"
        stage={{
          eyebrow: t("guardianCommandStageEyebrow"),
          title: t("guardianHeroTitle"),
          subtitle: t("guardianHeroCopy"),
          badges: (
            <span className="mx2-badge" data-tone={protectionHealthy ? "success" : "accent"}>
              <span className="mx2-badge__dot" /> {journey === "unconfigured" && !setupWriteAvailable
                ? t("setupUpgradePending")
                : journey === "legacy-policy"
                  ? t("policyReviewNeeded")
                  : protectionHealthy
                    ? t("protectionActive")
                    : t("recoveryReadyToCheck")}
            </span>
          ),
        }}
        scene={scene}
        score={[
          {
            label: t("guardianMetricPolicy"),
            value: profileStat(
              profile?.configured ? t("guardianPolicy", { threshold, total: guardianCount }) : t("guardianPolicyNone"),
              "5em",
            ),
            accent: true,
          },
          {
            label: t("guardianMetricProgress"),
            value: profileStat(
              profile?.pending.active ? `${approvedCount}/${threshold}` : t("noRecoveryOpen"),
              "4em",
            ),
          },
          { label: t("guardianMetricDelay"), value: profileStat(reviewWindowValue, "5em") },
        ]}
        actions={{ primary, secondary }}
        drawerToggleLabel={t("guardianDetails")}
        drawer={{ title: t("guardianDetails"), children: drawer }}
      />
    </div>
  );
}
