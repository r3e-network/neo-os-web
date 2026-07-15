import { useEffect, useMemo, useState } from "react";
import {
  AppWindow,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCopy,
  CloudCog,
  Coins,
  Download,
  FileCode2,
  FileJson,
  History,
  KeyRound,
  LoaderCircle,
  Network,
  PackageCheck,
  Radio,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Ticket,
  Vault,
  WalletCards,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  factoryContractFor,
  factoryTemplateIdFor,
  type FactoryArtifactPresence,
  type FactoryPlan,
  type MiniAppDraft,
} from "@shared/factory/factoryPlan";
import type { FactoryDeploymentItem } from "@shared/factory/factoryChain";
import type { MiniAppCategory } from "@shared/types/miniapp-manifest";
import {
  applyVerifiedTemplateGate,
  buildMiniAppStudioArtifacts,
  normalizeMiniAppDraft,
  templateProfile,
} from "./studio-artifacts";
import type {
  DraftJournalState,
  MiniAppPlanSignature,
  RegistrationSnapshot,
  RegistrationState,
} from "./setup";
import "./PlayArea.scss";

const APP_ID = "miniapp-miniapp-factory";
const TESTNET = "neo-n3-testnet" as const;
const studioImageUrl = new URL("../public/miniapp-launch-studio.webp", import.meta.url).href;

type ArtifactTab = "catalog" | "manifest" | "binding" | "plan";

interface TemplateOption {
  kind: MiniAppDraft["templateKind"];
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  tone: string;
}

const TEMPLATE_OPTIONS: readonly TemplateOption[] = [
  {
    kind: "reward-vault",
    labelKey: "templateKindRewardVault",
    hintKey: "templateKindRewardVaultHint",
    icon: Vault,
    tone: "mint",
  },
  {
    kind: "ticket-pass",
    labelKey: "templateKindTicketPass",
    hintKey: "templateKindTicketPassHint",
    icon: Ticket,
    tone: "gold",
  },
  {
    kind: "certificate",
    labelKey: "templateKindCertificate",
    hintKey: "templateKindCertificateHint",
    icon: BadgeCheck,
    tone: "blue",
  },
  {
    kind: "oracle-console",
    labelKey: "templateKindOracleConsole",
    hintKey: "templateKindOracleConsoleHint",
    icon: Radio,
    tone: "violet",
  },
];

const ERROR_KEYS: Record<string, string> = {
  app_id_format: "errAppIdFormat",
  app_name_length: "errAppNameLength",
  template_kind: "errTemplateKind",
  admin_address: "errAdminAddress",
  factory_contract_not_configured: "errFactoryNotConfigured",
  factory_contract_invalid: "errFactoryInvalid",
};

const REGISTRATION_STATE_KEYS: Record<RegistrationState, string> = {
  idle: "registrationIdle",
  checking: "registrationChecking",
  submitting: "registrationSubmitting",
  submitted: "registrationSubmittedAwaitingRead",
  confirmed: "registrationConfirmed",
  mismatch: "registrationMismatch",
  uncertain: "registrationUncertain",
  unavailable: "registrationReadUnavailable",
};

const ARTIFACT_STATUS_KEYS: Record<FactoryPlan["templateArtifact"]["status"], string> = {
  "preloaded-on-chain": "templateRecordVerified",
  "metadata-only": "templateRecordVerified",
  "not-registered": "templateRecordMissing",
  unverified: "templateRecordUnverified",
};

const CATEGORY_KEYS: Record<MiniAppCategory, string> = {
  defi: "catalogCategoryDefi",
  social: "catalogCategorySocial",
  oracle: "catalogCategoryOracle",
  tool: "catalogCategoryTool",
  game: "catalogCategoryGame",
  governance: "catalogCategoryGovernance",
  console: "catalogCategoryConsole",
};

function shortValue(value: string, lead = 10, tail = 8): string {
  if (!value) return "—";
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

function fieldError(plan: FactoryPlan, code: string, t: PlayAreaProps["t"]): string {
  return plan.blockingErrors.includes(code) ? t(ERROR_KEYS[code] ?? code) : "";
}

function TemplateShelf({
  value,
  disabled,
  t,
  onChange,
}: {
  value: MiniAppDraft["templateKind"];
  disabled: boolean;
  t: PlayAreaProps["t"];
  onChange: (kind: MiniAppDraft["templateKind"]) => void;
}) {
  return (
    <div className="miniapp-studio__template-shelf" role="radiogroup" aria-label={t("chooseTemplate")}>
      {TEMPLATE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.kind;
        return (
          <button
            key={option.kind}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? "is-selected" : undefined}
            data-tone={option.tone}
            disabled={disabled}
            onClick={() => onChange(option.kind)}
          >
            <span className="miniapp-studio__template-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <span>
              <strong>{t(option.labelKey)}</strong>
              <small>{t(option.hintKey)}</small>
            </span>
            {selected ? <Check size={16} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

function CapabilitySwitch({
  checked,
  disabled,
  icon: Icon,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="miniapp-studio__capability"
      data-enabled={checked ? "true" : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="miniapp-studio__capability-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span className="miniapp-studio__switch-track" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

export default function MiniAppFactoryPlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { bool, num, str, val } = useStateBindings(state);
  const launchDraft = useMemo(
    () => createFactoryDraftFromLaunchContext(launchContext, "miniapp").miniapp,
    [launchContext],
  );
  const normalizedLaunchDraft = useMemo(
    () => normalizeMiniAppDraft(launchDraft, launchDraft),
    [launchDraft],
  );
  const [draft, setDraft] = useState<MiniAppDraft>(normalizedLaunchDraft);
  const [restoredApplied, setRestoredApplied] = useState(false);
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>("catalog");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Pristine-form guard: true once the visitor has edited or left the admin
  // field. Gates error styling only — validation itself is unchanged.
  const [adminTouched, setAdminTouched] = useState(false);

  const storedPlan = val<FactoryPlan>("currentPlan") ?? null;
  const restoredDraft = val<MiniAppDraft>("restoredDraft") ?? null;
  const draftJournalState = str("draftJournalState", "loading") as DraftJournalState;
  const presenceMap = val<Record<string, FactoryArtifactPresence>>("artifactPresence") ?? {};
  const walletAddress = str("walletAddress");
  const isGenerating = bool("isGenerating");
  const isSigning = bool("isSigning");
  const isExecuting = bool("isExecuting");
  const walletSignature = str("walletSignature");
  const signatureInfo = val<MiniAppPlanSignature>("walletSignatureInfo") ?? null;
  const lastError = str("lastError");
  const executedDigest = str("executedDigest");
  const feeEstimate = str("feeEstimateGas");
  const deployments = val<FactoryDeploymentItem[]>("deployments") ?? [];
  const deploymentsTotal = num("deploymentsTotal");
  const deploymentsState = str("deploymentsState", "idle");
  const registrationState = str("registrationState", "idle") as RegistrationState;
  const registrationSnapshot = val<RegistrationSnapshot>("registrationSnapshot") ?? null;
  const registrationRecord = val<FactoryDeploymentItem>("registrationRecord") ?? null;

  const busy = isGenerating || isSigning || isExecuting;
  const hydrating = draftJournalState === "loading";
  const templateId = factoryTemplateIdFor("miniapp", draft.templateKind);
  const presence = presenceMap[`${TESTNET}|${templateId}`];
  const fallbackPlan = useMemo(() => {
    const planned = buildFactoryPlan("miniapp", draft as unknown as Record<string, unknown>, {
      appId: APP_ID,
      artifactPresence: presence,
    });
    return applyVerifiedTemplateGate(planned, presence);
  }, [draft, presence]);
  const currentPlan = storedPlan ?? fallbackPlan;
  const artifacts = useMemo(() => buildMiniAppStudioArtifacts(currentPlan), [currentPlan]);
  const profile = templateProfile(draft.templateKind);

  const storedPlanMatchesDraft = Boolean(storedPlan && storedPlan.digest === fallbackPlan.digest);
  const registrationMatchesPlan = Boolean(
    storedPlan &&
      registrationSnapshot?.digest === storedPlan.digest,
  );
  const registrationSubmitted = Boolean(
    registrationMatchesPlan &&
      registrationSnapshot?.txid &&
      (registrationState === "submitted" || registrationState === "unavailable"),
  );
  const registrationConfirmed = Boolean(
    registrationMatchesPlan && registrationState === "confirmed",
  );
  const canGenerate = !busy && fallbackPlan.blockingErrors.length === 0;
  const registrationEligible = Boolean(
    storedPlan?.publishable &&
      storedPlan.execution.available &&
      executedDigest !== storedPlan.digest &&
      !registrationSubmitted &&
      !registrationConfirmed,
  );
  const canRegister = registrationEligible && !busy;
  const planBlockedReason = storedPlan?.execution.blockedReasonKey
    ? t(storedPlan.execution.blockedReasonKey)
    : "";
  // `admin` is the one field that starts empty, so it is the one field whose
  // blocking error fires on a pristine form. An untouched empty required field
  // is a normal first-run state, not a mistake the visitor has made: red
  // outline + red error copy before a single keystroke reads as a broken app.
  // A value that is present but malformed IS an actionable error, whatever its
  // origin (typed now, restored from a draft, or passed in via launch params),
  // so surface that immediately.
  const adminMissing = fallbackPlan.blockingErrors.includes("admin_address");
  const adminFieldError =
    adminTouched || draft.admin.trim().length > 0 ? fieldError(fallbackPlan, "admin_address", t) : "";

  useEffect(() => {
    if (restoredApplied || draftJournalState !== "restored" || !restoredDraft) return;
    setDraft(normalizeMiniAppDraft(restoredDraft, normalizedLaunchDraft));
    setRestoredApplied(true);
  }, [draftJournalState, normalizedLaunchDraft, restoredApplied, restoredDraft]);

  useEffect(() => {
    if (hydrating) return;
    const timer = window.setTimeout(() => {
      void dispatch("persistMiniAppDraft", draft).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [dispatch, draft, hydrating]);

  useEffect(() => {
    void dispatch("ensureArtifactState", {
      templateId,
      network: TESTNET,
      scriptHash: factoryContractFor("miniapp", TESTNET),
    }).catch(() => undefined);
  }, [dispatch, templateId]);

  useEffect(() => {
    void dispatch("refreshDeployments").catch(() => undefined);
  }, [dispatch]);

  useEffect(() => {
    if (!storedPlan || storedPlanMatchesDraft) return;
    void dispatch("discardPlan").catch(() => undefined);
  }, [dispatch, storedPlan, storedPlanMatchesDraft]);

  // Reveal the section that holds the one outstanding detail. Keyed off the
  // plan's blocking error, not the (touch-gated) error string, so the field is
  // still surfaced on a pristine form — just without the red styling.
  useEffect(() => {
    if (adminMissing) setAdvancedOpen(true);
  }, [adminMissing]);

  const updateDraft = (patch: Partial<MiniAppDraft>) => {
    setDraft((current) => ({ ...current, ...patch, network: TESTNET }));
  };

  const generatePlan = async () => {
    if (!canGenerate) return;
    await dispatch("persistMiniAppDraft", draft);
    await dispatch("generatePlan", draft);
  };

  const resetDraft = async () => {
    const reset = normalizeMiniAppDraft(
      {
        ...normalizedLaunchDraft,
        admin: walletAddress || normalizedLaunchDraft.admin,
        network: TESTNET,
      },
      normalizedLaunchDraft,
    );
    setDraft(reset);
    setRestoredApplied(true);
    await Promise.allSettled([dispatch("discardPlan"), dispatch("clearMiniAppDraft")]);
  };

  const activeArtifact = artifactTab === "catalog"
    ? artifacts.catalogPatchJson
    : artifactTab === "manifest"
      ? artifacts.manifestCode
      : artifactTab === "binding"
        ? artifacts.bindingCode
        : artifacts.planJson;

  const copyArtifact = async () => {
    if (!storedPlan || !navigator.clipboard?.writeText) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1600);
      return;
    }
    try {
      await navigator.clipboard.writeText(activeArtifact);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const exportBundle = () => {
    if (!storedPlan) return;
    const blobUrl = URL.createObjectURL(
      new Blob([artifacts.bundleJson], { type: "application/json;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = artifacts.bundleFileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  };

  const selectedTemplate = TEMPLATE_OPTIONS.find((option) => option.kind === draft.templateKind)!;
  const SelectedIcon = selectedTemplate.icon;
  const appName = draft.appName.trim() || t("previewUntitledApp");
  const appId = draft.appId.trim() || "miniapp-…";
  const services = [
    draft.needsOneGate ? t("previewServiceOneGate") : null,
    draft.needsOracle ? t("previewServiceOracle") : null,
  ].filter(Boolean) as string[];
  const templateStatus = t(ARTIFACT_STATUS_KEYS[currentPlan.templateArtifact.status]);

  const primaryLabel = storedPlan
    ? isExecuting
      ? t("registrationSubmitting")
      : registrationConfirmed
        ? t("registrationRecorded")
        : registrationSubmitted
          ? t("registrationSubmittedAwaitingRead")
          : registrationEligible
            ? t("registerTestnetRecord")
            : t("registrationUnavailable")
    : isGenerating
      ? t("generatingPackage")
      : t("generateRegistrationPackage");

  const primaryDisabled = storedPlan ? !canRegister : !canGenerate;
  const primaryAction = storedPlan
    ? () => void dispatch("executePlan")
    : () => void generatePlan();

  return (
    <div
      className="miniapp-studio"
      data-template={draft.templateKind}
      data-busy={busy ? "true" : undefined}
    >
      <section className="miniapp-studio__stage" aria-label={t("studioStageTitle")}>
        <div className="miniapp-studio__media">
          <img
            src={studioImageUrl}
            alt={t("studioImageAlt")}
            loading="eager"
            decoding="async"
          />
        </div>

        <aside className="miniapp-studio__journey" aria-label={t("creationJourney")}>
          <header>
            <div>
              <strong>{appName}</strong>
              <span>{appId}</span>
            </div>
            <span className="miniapp-studio__network">
              <Network size={14} aria-hidden="true" />
              {t("registryScope")}
            </span>
          </header>
          <ol>
            <li data-state="done">
              <span><SelectedIcon size={17} aria-hidden="true" /></span>
              <div><strong>{t("journeyChoose")}</strong><small>{t(selectedTemplate.labelKey)}</small></div>
            </li>
            <li data-state={storedPlan ? "done" : "active"}>
              <span><PackageCheck size={17} aria-hidden="true" /></span>
              <div><strong>{t("journeyGenerate")}</strong><small>{storedPlan ? shortValue(storedPlan.digest) : t("journeyGenerateHint")}</small></div>
            </li>
            <li data-state={registrationConfirmed ? "done" : storedPlan ? "active" : "waiting"}>
              <span><Network size={17} aria-hidden="true" /></span>
              <div>
                <strong>{t("journeyRegister")}</strong>
                <small>
                  {registrationConfirmed
                    ? t("registrationRecorded")
                    : registrationSubmitted
                      ? t("registrationSubmittedAwaitingRead")
                      : t("journeyRegisterHint")}
                </small>
              </div>
            </li>
            <li data-state={registrationState === "confirmed" ? "active" : "waiting"}>
              <span><Rocket size={17} aria-hidden="true" /></span>
              <div><strong>{t("journeyOperator")}</strong><small>{t("journeyOperatorHint")}</small></div>
            </li>
          </ol>
        </aside>
      </section>

      <div className="miniapp-studio__workspace">
        <section className="miniapp-studio__composer" aria-labelledby="miniapp-studio-compose-title">
          <header className="miniapp-studio__section-head">
            <div>
              <h2 id="miniapp-studio-compose-title">{t("shapeYourMiniApp")}</h2>
              <p>{t("shapeYourMiniAppHint")}</p>
            </div>
            <span data-ready={fallbackPlan.blockingErrors.length === 0 ? "true" : undefined}>
              {fallbackPlan.blockingErrors.length === 0 ? t("draftReady") : t("draftNeedsWork")}
            </span>
          </header>

          <TemplateShelf
            value={draft.templateKind}
            disabled={busy || hydrating}
            t={t}
            onChange={(templateKind) => updateDraft({ templateKind })}
          />

          <div className="miniapp-studio__identity">
            <label>
              <span>{t("appName")}</span>
              <input
                value={draft.appName}
                maxLength={64}
                disabled={busy || hydrating}
                aria-invalid={Boolean(fieldError(fallbackPlan, "app_name_length", t))}
                onChange={(event) => updateDraft({ appName: event.target.value })}
                placeholder={t("appNamePlaceholder")}
              />
              <small>{fieldError(fallbackPlan, "app_name_length", t) || t("appNameHint")}</small>
            </label>
            <label>
              <span>{t("appId")}</span>
              <input
                value={draft.appId}
                maxLength={80}
                disabled={busy || hydrating}
                aria-invalid={Boolean(fieldError(fallbackPlan, "app_id_format", t))}
                onChange={(event) => updateDraft({ appId: event.target.value.toLowerCase() })}
                placeholder="miniapp-my-app"
                spellCheck={false}
              />
              <small>{fieldError(fallbackPlan, "app_id_format", t) || t("appIdHint")}</small>
            </label>
          </div>

          <details
            className="miniapp-studio__advanced"
            open={advancedOpen}
            onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
          >
            <summary>
              <span>
                <strong>{t("advancedSetup")}</strong>
                <small>{t("advancedSetupHint")}</small>
              </span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className="miniapp-studio__advanced-body">
              <div className="miniapp-studio__admin-field">
                <label>
                  <span>{t("admin")}</span>
                  <input
                    value={draft.admin}
                    maxLength={64}
                    disabled={busy || hydrating}
                    aria-invalid={Boolean(adminFieldError)}
                    onChange={(event) => {
                      setAdminTouched(true);
                      updateDraft({ admin: event.target.value });
                    }}
                    onBlur={() => setAdminTouched(true)}
                    placeholder={t("adminPlaceholder")}
                    spellCheck={false}
                  />
                  <small>{adminFieldError || t("adminHint")}</small>
                </label>
                {walletAddress && walletAddress !== draft.admin ? (
                  <button type="button" disabled={busy} onClick={() => updateDraft({ admin: walletAddress })}>
                    <WalletCards size={15} aria-hidden="true" /> {t("useMyAddress")}
                  </button>
                ) : null}
              </div>

              <div className="miniapp-studio__fixed-network">
                <Network size={18} aria-hidden="true" />
                <span><strong>{t("fixedRegistryTarget")}</strong><small>{t("fixedRegistryTargetHint")}</small></span>
              </div>

              <div className="miniapp-studio__capabilities">
                <CapabilitySwitch
                  checked={draft.needsOneGate}
                  disabled={busy || hydrating}
                  icon={AppWindow}
                  label={t("needsOneGate")}
                  detail={t("needsOneGateHint")}
                  onChange={(needsOneGate) => updateDraft({ needsOneGate })}
                />
                <CapabilitySwitch
                  checked={draft.needsOracle}
                  disabled={busy || hydrating}
                  icon={CloudCog}
                  label={t("needsOracle")}
                  detail={t("needsOracleHint")}
                  onChange={(needsOracle) => updateDraft({ needsOracle })}
                />
              </div>

              <button type="button" className="miniapp-studio__reset" disabled={busy} onClick={() => void resetDraft()}>
                <RefreshCw size={15} aria-hidden="true" /> {t("resetDraft")}
              </button>
            </div>
          </details>
        </section>

        <section className="miniapp-studio__preview" aria-labelledby="miniapp-studio-preview-title">
          <header className="miniapp-studio__section-head">
            <div>
              <h2 id="miniapp-studio-preview-title">{t("liveAppPreview")}</h2>
              <p>{t("liveAppPreviewHint")}</p>
            </div>
            <span>{t(selectedTemplate.labelKey)}</span>
          </header>

          <div className="miniapp-studio__app-card" data-tone={selectedTemplate.tone}>
            <div className="miniapp-studio__app-card-head">
              <span aria-hidden="true"><SelectedIcon size={25} /></span>
              <div><strong>{appName}</strong><code>{appId}</code></div>
            </div>
            <p>{t(selectedTemplate.hintKey)}</p>
            <dl>
              <div><dt>{t("previewTemplate")}</dt><dd>{t(selectedTemplate.labelKey)}</dd></div>
              <div><dt>{t("previewServices")}</dt><dd>{services.length ? services.join(" · ") : t("previewServiceNone")}</dd></div>
              <div><dt>{t("catalogCategory")}</dt><dd>{t(CATEGORY_KEYS[profile.category])}</dd></div>
            </dl>
          </div>

          <section className="miniapp-studio__command" aria-live="polite">
            <div className="miniapp-studio__command-status">
              <span data-ready={storedPlan?.publishable ? "true" : undefined}>
                {storedPlan ? (storedPlan.publishable ? t("packageReady") : t("packageBlocked")) : t("draftPreview")}
              </span>
              <div>
                <small>{t("templateStatus")}</small>
                <strong>{templateStatus}</strong>
              </div>
              <div>
                <small>{storedPlan ? t("packageDigest") : t("nextAction")}</small>
                <strong>{storedPlan ? shortValue(storedPlan.digest) : t("generateRegistrationPackage")}</strong>
              </div>
              {feeEstimate ? (
                <div><small>{t("estimatedFee")}</small><strong>{feeEstimate} GAS</strong></div>
              ) : null}
            </div>

            <button
              type="button"
              className="miniapp-studio__primary"
              disabled={primaryDisabled}
              onClick={primaryAction}
            >
              {busy ? <LoaderCircle className="is-spinning" size={17} aria-hidden="true" /> : storedPlan ? <Network size={17} aria-hidden="true" /> : <WandSparkles size={17} aria-hidden="true" />}
              {primaryLabel}
            </button>
            <p className="miniapp-studio__primary-hint">
              {storedPlan
                ? canRegister
                  ? t("registerRecordHint")
                  : registrationConfirmed
                    ? t("operatorSyncHint")
                    : registrationSubmitted
                      ? t("registrationCheckHint")
                    : planBlockedReason || t("templateVerificationRequired")
                : canGenerate
                  ? t("generatePackageHint")
                  : adminMissing && !adminFieldError
                    ? // Nothing is highlighted yet on a pristine form, so
                      // "Complete the highlighted detail first" would point at
                      // nothing. Name the outstanding field instead.
                      t("adminNeededHint")
                    : t("fixHighlightedFields")}
            </p>
          </section>

          {lastError ? (
            <div className="miniapp-studio__error" role="alert">
              <CircleAlert size={17} aria-hidden="true" />
              <span><strong>{t("actionNeedsAttention")}</strong><small>{lastError}</small></span>
            </div>
          ) : null}
        </section>
      </div>

      <details className="miniapp-studio__drawer" data-kind="artifacts">
        <summary>
          <span><FileCode2 size={18} aria-hidden="true" /><strong>{t("generatedArtifacts")}</strong><small>{t("generatedArtifactsHint")}</small></span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div className="miniapp-studio__drawer-body">
          <div className="miniapp-studio__artifact-tabs" role="tablist" aria-label={t("generatedArtifacts")}>
            {([
              ["catalog", "catalogPatch", FileJson],
              ["manifest", "starterManifest", AppWindow],
              ["binding", "bindingCode", KeyRound],
              ["plan", "registrationPlan", PackageCheck],
            ] as const).map(([tab, labelKey, Icon]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={artifactTab === tab}
                className={artifactTab === tab ? "is-active" : undefined}
                onClick={() => setArtifactTab(tab)}
              >
                <Icon size={15} aria-hidden="true" /> {t(labelKey)}
              </button>
            ))}
          </div>
          <div className="miniapp-studio__artifact-panel" role="tabpanel">
            <header>
              <span>{storedPlan ? t("generatedFromLockedPlan") : t("draftArtifactPreview")}</span>
              <div>
                <button type="button" disabled={!storedPlan} onClick={() => void copyArtifact()}>
                  <ClipboardCopy size={15} aria-hidden="true" />
                  {copyState === "copied" ? t("copied") : copyState === "error" ? t("copyFailed") : t("copyArtifact")}
                </button>
                <button type="button" disabled={!storedPlan} onClick={exportBundle}>
                  <Download size={15} aria-hidden="true" /> {t("exportPackage")}
                </button>
              </div>
            </header>
            <pre>{activeArtifact}</pre>
          </div>

          <details className="miniapp-studio__signature-panel">
            <summary><span><ShieldCheck size={16} aria-hidden="true" /><strong>{t("developerSignature")}</strong><small>{t("developerSignatureHint")}</small></span><ChevronDown size={15} /></summary>
            <div>
              <button type="button" disabled={!storedPlan?.publishable || isSigning} onClick={() => void dispatch("signCurrentPlan")}>
                {isSigning ? <LoaderCircle className="is-spinning" size={15} /> : <ShieldCheck size={15} />} {t("signPlanAction")}
              </button>
              {signatureInfo || walletSignature ? (
                <code>{shortValue(signatureInfo?.signature || walletSignature, 18, 12)}</code>
              ) : <p>{t("signatureOptional")}</p>}
            </div>
          </details>
        </div>
      </details>

      {(registrationSnapshot || registrationState !== "idle") ? (
        <section className="miniapp-studio__recovery" data-state={registrationState} aria-live="polite">
          <span><History size={18} aria-hidden="true" /></span>
          <div>
            <strong>{t(REGISTRATION_STATE_KEYS[registrationState])}</strong>
            <small>{registrationSnapshot ? `${shortValue(registrationSnapshot.packageId, 16, 8)} · ${shortValue(registrationSnapshot.txid)}` : t("registrationRecoveryHint")}</small>
          </div>
          {registrationRecord ? <code>{shortValue(registrationRecord.digest, 12, 10)}</code> : null}
          <button type="button" disabled={registrationState === "checking"} onClick={() => void dispatch("recoverLastRegistration")}>
            <RefreshCw size={15} aria-hidden="true" /> {t("checkRegistration")}
          </button>
        </section>
      ) : null}

      <details className="miniapp-studio__drawer" data-kind="operations">
        <summary>
          <span><History size={18} aria-hidden="true" /><strong>{t("registryHistory")}</strong><small>{t("registryHistoryHint", { count: deploymentsTotal })}</small></span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div className="miniapp-studio__history">
          <header>
            <span>{deploymentsState === "loading" ? t("loadingDeployments") : t("deploymentsCount", { count: deploymentsTotal })}</span>
            <button type="button" disabled={deploymentsState === "loading"} onClick={() => void dispatch("refreshDeployments")}>
              <RefreshCw size={15} aria-hidden="true" /> {t("refreshAction")}
            </button>
          </header>
          {deploymentsState === "error" ? (
            <p>{t("deploymentsError")}</p>
          ) : deployments.length ? (
            <ul>
              {deployments.map((item) => (
                <li key={item.packageId}>
                  <span><strong>{item.packageId}</strong><small>{item.templateId}</small></span>
                  <code>{shortValue(item.digest)}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("noDeploymentsYet")}</p>
          )}
        </div>
      </details>

      {storedPlan?.warnings.length || fallbackPlan.blockingErrors.length ? (
        <details className="miniapp-studio__drawer" data-kind="validation">
          <summary>
            <span><CircleAlert size={18} aria-hidden="true" /><strong>{t("validationDetails")}</strong><small>{t("validationDetailsHint")}</small></span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="miniapp-studio__validation">
            {fallbackPlan.blockingErrors.map((code) => (
              <p key={code}><CircleAlert size={15} aria-hidden="true" /> {t(ERROR_KEYS[code] ?? code)}</p>
            ))}
            {(storedPlan?.warnings ?? fallbackPlan.warnings).map((code) => (
              <p key={code}><ShieldCheck size={15} aria-hidden="true" /> {t(code === "catalog_registration_required" ? "warnCatalogRegistration" : "warnMainnetReview")}</p>
            ))}
          </div>
        </details>
      ) : null}

      <footer className="miniapp-studio__boundary">
        <Coins size={17} aria-hidden="true" />
        <span><strong>{t("productionBoundaryTitle")}</strong><small>{t("productionBoundaryBody")}</small></span>
      </footer>
    </div>
  );
}
