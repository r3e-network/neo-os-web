import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
  CircleAlert,
  ClipboardCopy,
  FileSearch,
  Fingerprint,
  Landmark,
  Network,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { ObservableState } from "@shared/react/context";
import { useNowMs } from "@shared/react/hooks/useNowMs";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { DEFAULT_SUBJECT_DID } from "./appConfig";
import {
  CONSOLE_FIELD_LIMITS,
  canonicalMorpheusDid,
  consoleUtf8Length,
  evidenceMatchesForm,
  truncateConsoleUtf8,
  validateConsoleForm,
  type NeoDidConsoleForm,
  type NeoDidEvidenceSnapshot,
  type NeoDidProvider,
  type NeoDidRegistryProbe,
  type ProviderCatalogSnapshot,
} from "./neodid-console";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
}

const DEFAULT_FORM: NeoDidConsoleForm = {
  did: DEFAULT_SUBJECT_DID,
  provider: "web3auth",
  claim: "Web3Auth_PrimaryIdentity",
};

const WORKSPACE_ART = new URL("../public/oracle-workspace-stage.webp", import.meta.url).href;
const CONSOLE_MARK = new URL("../public/logo.webp", import.meta.url).href;

function compact(value: string, head = 16, tail = 8) {
  const text = String(value || "").trim();
  if (!text || text === "—") return "—";
  if (text.length <= head + tail + 1) return text;
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function registryLabel(probe: NeoDidRegistryProbe | null, t: PlayAreaProps["t"]) {
  if (!probe || probe.status === "idle") return t("notChecked");
  if (probe.status === "verified") return t("registryVerified");
  if (probe.status === "mismatch") return t("registryMismatch");
  if (probe.reason === "no-network-deployment") return t("registryNotDeployed");
  return t("registryUnavailable");
}

function contextLabel(evidence: NeoDidEvidenceSnapshot | null, t: PlayAreaProps["t"]) {
  if (!evidence) return t("notChecked");
  if (evidence.context.status === "claim-listed") return t("catalogListed");
  if (evidence.context.status === "claim-unlisted") return t("catalogClaimUnlisted");
  if (evidence.context.status === "provider-unlisted") return t("catalogProviderUnlisted");
  return t("catalogUnavailable");
}

function evidenceIcon(tone: "ready" | "warning" | "idle"): ReactNode {
  if (tone === "ready") return <BadgeCheck size={17} aria-hidden="true" />;
  if (tone === "warning") return <CircleAlert size={17} aria-hidden="true" />;
  return <FileSearch size={17} aria-hidden="true" />;
}

function providerOptionLabel(provider: NeoDidProvider) {
  return provider.category ? `${provider.id} · ${provider.category}` : provider.id;
}

function ConsoleSelect({
  disabled,
  hint,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  hint?: ReactNode;
  label: ReactNode;
  onChange: (value: string) => void;
  options: Array<{ label: ReactNode; value: string }>;
  value: string;
}) {
  const id = `neodid-console-select-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className="mx2-open-field neodid-console-field" htmlFor={id}>
      <span className="mx2-open-field__label">{label}</span>
      <span className="mx2-open-field__control neodid-console-select-native">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </span>
      {hint ? <span id={hintId} className="mx2-open-field__hint">{hint}</span> : null}
    </label>
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const networkLabel = str("networkLabel", "Morpheus Mainnet");
  const endpointLabel = str("endpointLabel", t("endpointLabel"));
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastError = str("lastError");
  const recoveryStatus = str("recoveryStatus");
  const lastDigest = str("lastDigest", "—");
  const isResolving = bool("isResolving");
  const isCatalogLoading = bool("isCatalogLoading");
  const storageHealthy = bool("storageHealthy");
  const evidence = val<NeoDidEvidenceSnapshot>("evidence");
  const catalog = val<ProviderCatalogSnapshot>("providerCatalog");
  const recoveredForm = val<NeoDidConsoleForm>("recoveryForm", DEFAULT_FORM) ?? DEFAULT_FORM;

  const [did, setDid] = useState(() => truncateConsoleUtf8(
    recoveredForm.did || DEFAULT_FORM.did,
    CONSOLE_FIELD_LIMITS.did,
  ));
  const [provider, setProvider] = useState(() => truncateConsoleUtf8(
    recoveredForm.provider || DEFAULT_FORM.provider,
    CONSOLE_FIELD_LIMITS.provider,
  ));
  const [claim, setClaim] = useState(() => truncateConsoleUtf8(
    recoveredForm.claim || DEFAULT_FORM.claim,
    CONSOLE_FIELD_LIMITS.claim,
  ));
  const now = useNowMs(30_000);
  const hydratedRecoveryRef = useRef("");
  const discardedDraftRef = useRef("");
  const expiredEvidenceRef = useRef("");
  const dispatchSafely = useCallback((name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  }, [dispatch]);

  const form = useMemo<NeoDidConsoleForm>(() => ({ did, provider, claim }), [claim, did, provider]);
  const validationKey = validateConsoleForm(form);
  const draftReady = !validationKey && !isResolving;
  const evidenceMatchesDraft = Boolean(evidence && evidenceMatchesForm(evidence, form));
  const evidenceExpired = Boolean(
    evidence && Number.isFinite(Date.parse(evidence.expiresAt)) && Date.parse(evidence.expiresAt) <= now,
  );
  const visibleEvidence = evidenceMatchesDraft && !evidenceExpired ? evidence : null;
  const providers = useMemo(() => catalog?.providers ?? [], [catalog]);
  const normalizedProvider = provider.toLowerCase();
  const selectedProvider = providers.find((item) => item.id.toLowerCase() === normalizedProvider) ??
    providers.find((item) => item.aliases.some((alias) => alias.toLowerCase() === normalizedProvider));
  const claimTypes = selectedProvider?.claimTypes ?? [];

  useEffect(() => {
    const fingerprint = JSON.stringify([recoveredForm.did, recoveredForm.provider, recoveredForm.claim]);
    if (!fingerprint || hydratedRecoveryRef.current === fingerprint) return;
    hydratedRecoveryRef.current = fingerprint;
    setDid(truncateConsoleUtf8(recoveredForm.did || DEFAULT_FORM.did, CONSOLE_FIELD_LIMITS.did));
    setProvider(truncateConsoleUtf8(
      recoveredForm.provider || DEFAULT_FORM.provider,
      CONSOLE_FIELD_LIMITS.provider,
    ));
    setClaim(truncateConsoleUtf8(
      recoveredForm.claim || DEFAULT_FORM.claim,
      CONSOLE_FIELD_LIMITS.claim,
    ));
  }, [recoveredForm.claim, recoveredForm.did, recoveredForm.provider]);

  useEffect(() => {
    if (!evidenceExpired || !evidence) {
      if (!evidence) expiredEvidenceRef.current = "";
      return;
    }
    if (expiredEvidenceRef.current === evidence.digest) return;
    expiredEvidenceRef.current = evidence.digest;
    dispatchSafely("expireEvidence");
  }, [dispatchSafely, evidence, evidenceExpired]);

  useEffect(() => {
    if (!evidence || evidenceMatchesDraft || evidenceExpired) return;
    const fingerprint = `${evidence.digest}:${canonicalMorpheusDid(did) ?? did}:${provider}:${claim}`;
    if (discardedDraftRef.current === fingerprint) return;
    discardedDraftRef.current = fingerprint;
    dispatchSafely("discardEvidence");
  }, [claim, did, dispatchSafely, evidence, evidenceExpired, evidenceMatchesDraft, provider]);

  useEffect(() => {
    if (visibleEvidence || isCatalogLoading || providers.length === 0) return;
    const exactProvider = providers.find((item) => item.id.toLowerCase() === provider.toLowerCase());
    if (!exactProvider) {
      const first = providers[0];
      if (!first) return;
      setProvider(first.id);
      const firstClaim = first.claimTypes[0];
      if (firstClaim) setClaim(firstClaim);
      return;
    }
    if (provider !== exactProvider.id) setProvider(exactProvider.id);
    if (exactProvider.claimTypes.length > 0 && !exactProvider.claimTypes.includes(claim)) {
      const firstClaim = exactProvider.claimTypes[0];
      if (firstClaim) setClaim(firstClaim);
    }
  }, [claim, isCatalogLoading, provider, providers, visibleEvidence]);

  const providerOptions = providers.length > 0
    ? providers.map((item) => ({ label: providerOptionLabel(item), value: item.id }))
    : [{ label: provider, value: provider }];
  const claimOptions = claimTypes.length > 0
    ? claimTypes.map((item) => ({ label: item, value: item }))
    : [{ label: claim, value: claim }];

  const registryValue = registryLabel(visibleEvidence?.registry ?? null, t);
  const contextValue = contextLabel(visibleEvidence, t);
  const resolverValue = visibleEvidence ? t("resolverReturned") : t("notChecked");
  const oracleValue = visibleEvidence?.didDocument.oracleGateway === "declared"
    ? t("oracleDeclared")
    : visibleEvidence
      ? t("oracleNotDeclared")
      : t("notChecked");
  const registryTone = visibleEvidence?.registry.status === "verified"
    ? "ready" as const
    : visibleEvidence ? "warning" as const : "idle" as const;
  const contextTone = visibleEvidence?.context.status === "claim-listed"
    ? "ready" as const
    : visibleEvidence ? "warning" as const : "idle" as const;
  const oracleTone = visibleEvidence?.didDocument.oracleGateway === "declared"
    ? "ready" as const
    : visibleEvidence ? "warning" as const : "idle" as const;
  const evidenceItems = [
    { key: "resolver", label: t("resolverEvidence"), value: resolverValue, tone: visibleEvidence ? "ready" as const : "idle" as const },
    { key: "registry", label: t("registryEvidence"), value: registryValue, tone: registryTone },
    { key: "catalog", label: t("providerEvidence"), value: contextValue, tone: contextTone },
    { key: "oracle", label: t("oracleEvidence"), value: oracleValue, tone: oracleTone },
  ];

  const resolve = () => {
    if (!draftReady) return;
    dispatchSafely("resolveEvidence", form);
  };
  const copy = () => {
    if (!visibleEvidence) return;
    dispatchSafely("copyEvidence");
  };
  const reset = () => {
    if (isResolving) return;
    dispatchSafely("resetEvidence");
  };
  const retryCatalog = () => {
    if (isCatalogLoading || isResolving) return;
    dispatchSafely("refreshProviderCatalog");
  };

  const statusText = isResolving
    ? t("resolvingStatus")
    : lastError || recoveryStatus || lastStatus;

  const scene = (
    <div
      className="neodid-console-scene"
      data-state={isResolving ? "resolving" : visibleEvidence ? "resolved" : "idle"}
      aria-busy={isResolving || undefined}
    >
      <section className="neodid-console-stage" aria-label={t("evidenceRecord")}>
        <img
          className="neodid-console-stage__art"
          src={WORKSPACE_ART}
          alt={t("heroVisualAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="neodid-console-stage__veil" aria-hidden="true" />
        <div className="neodid-console-stage__network">
          <Network size={15} aria-hidden="true" />
          <span>{networkLabel}</span>
        </div>

        <article className="neodid-evidence-pass" data-ready={visibleEvidence ? "true" : undefined}>
          <header className="neodid-evidence-pass__head">
            <img src={CONSOLE_MARK} alt="" aria-hidden="true" />
            <div>
              <span>{t("evidenceRecord")}</span>
              <strong>{visibleEvidence ? t("recordReady") : t("recordAwaiting")}</strong>
            </div>
            <span className="neodid-evidence-pass__stamp">
              {t("noVerificationBadge")}
            </span>
          </header>

          <div className="neodid-evidence-pass__subject">
            <small>{t("subjectDid")}</small>
            <strong>{compact(visibleEvidence?.subject ?? did, 24, 12)}</strong>
          </div>

          <dl className="neodid-evidence-pass__facts">
            <div>
              <dt>{t("documentVersion")}</dt>
              <dd>{visibleEvidence ? compact(visibleEvidence.didDocument.versionId) : t("factAwait")}</dd>
            </div>
            <div>
              <dt>{t("services")}</dt>
              <dd>{visibleEvidence?.didDocument.serviceCount ?? 0}</dd>
            </div>
            <div>
              <dt>{t("verificationMethods")}</dt>
              <dd>{visibleEvidence?.didDocument.verificationMethodCount ?? 0}</dd>
            </div>
          </dl>

          <footer className="neodid-evidence-pass__foot">
            <Fingerprint size={16} aria-hidden="true" />
            <span>{t("digestLabel")}</span>
            <code>{visibleEvidence ? lastDigest : t("factAwait")}</code>
          </footer>
        </article>
      </section>

      <aside className="neodid-evidence-map" aria-label={t("evidenceMapTitle")}>
        <header className="neodid-evidence-map__head">
          <span><ShieldCheck size={20} aria-hidden="true" /></span>
          <div>
            <strong>{t("evidenceMapTitle")}</strong>
            <small>{t(visibleEvidence ? "evidenceMapSubtitle" : "evidenceMapSubtitleIdle")}</small>
          </div>
        </header>
        <div className="neodid-evidence-map__list">
          {evidenceItems.map((item) => (
            <div key={item.key} data-tone={item.tone}>
              <span>{evidenceIcon(item.tone)}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.value}</small>
              </div>
            </div>
          ))}
        </div>
        <p className="neodid-evidence-map__boundary">
          <CircleAlert size={15} aria-hidden="true" />
          <span>{t("boundaryNote")}</span>
        </p>
      </aside>

      <p
        className="neodid-console-scene__status"
        data-error={lastError ? "true" : undefined}
        role="status"
        aria-live="polite"
      >
        {statusText}
      </p>
    </div>
  );

  const drawer = (
    <OpenUiProvider>
      <div className="neodid-console-drawer">
        <OpenUiNotice
          className="neodid-console-drawer__notice"
          icon={<ShieldCheck size={18} aria-hidden="true" />}
          title={t("detailBoundaryTitle")}
        >
          {t("detailBoundaryCopy")}
        </OpenUiNotice>

        <OpenUiPanel
          className="neodid-console-drawer__panel neodid-console-drawer__panel--wide"
          icon={<Fingerprint size={18} aria-hidden="true" />}
          title={t("resolverFieldsTitle")}
          subtitle={t("resolverFieldsCopy")}
        >
          <div className="neodid-console-fields">
            <OpenUiTextField
              className="neodid-console-field neodid-console-field--did"
              inputClassName="neodid-console-input"
              label={t("did")}
              value={did}
              onChange={(event) => setDid(truncateConsoleUtf8(
                event.target.value,
                CONSOLE_FIELD_LIMITS.did,
              ))}
              placeholder={t("didPlaceholder")}
              hint={validationKey === "consoleInvalidDid"
                ? t("consoleInvalidDid")
                : t("fieldByteLimit", {
                    count: consoleUtf8Length(did),
                    max: CONSOLE_FIELD_LIMITS.did,
                  })}
              disabled={isResolving}
              mono
              spellCheck={false}
            />
            <ConsoleSelect
              label={t("provider")}
              value={provider}
              onChange={(value) => {
                setProvider(value);
                const next = providers.find((item) => item.id === value);
                if (next?.claimTypes[0]) setClaim(next.claimTypes[0]);
              }}
              options={providerOptions}
              hint={isCatalogLoading ? t("catalogLoading") : t("providerHint")}
              disabled={isResolving || isCatalogLoading}
            />
            <ConsoleSelect
              label={t("claim")}
              value={claim}
              onChange={setClaim}
              options={claimOptions}
              hint={t("claimHint")}
              disabled={isResolving || isCatalogLoading || claimOptions.length === 0}
            />
          </div>
          {catalog?.status === "unavailable" && (
            <button
              type="button"
              className="neodid-console-inline-action"
              onClick={retryCatalog}
              disabled={isCatalogLoading || isResolving}
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>{t("retryCatalogAction")}</span>
            </button>
          )}
        </OpenUiPanel>

        <OpenUiPanel
          className="neodid-console-drawer__panel"
          icon={<BookOpenCheck size={18} aria-hidden="true" />}
          title={t("snapshotDetailsTitle")}
          subtitle={t("snapshotDetailsCopy")}
        >
          {visibleEvidence ? (
            <div className="neodid-console-details">
              <dl className="neodid-console-details__facts">
                <div><dt>{t("digestLabel")}</dt><dd title={visibleEvidence.digest}>{visibleEvidence.digest}</dd></div>
                <div><dt>{t("resolverEndpoint")}</dt><dd>{visibleEvidence.resolver.endpoint}</dd></div>
                <div><dt>{t("catalogEndpoint")}</dt><dd>{visibleEvidence.catalog.endpoint}</dd></div>
                <div><dt>{t("anchorContract")}</dt><dd>{visibleEvidence.didDocument.anchorContract || "—"}</dd></div>
                <div><dt>{t("runtimeMetadata")}</dt><dd>{visibleEvidence.didDocument.runtimeVerifierMetadata === "available" ? t("runtimeAvailable") : t("runtimeUnavailable")}</dd></div>
                <div><dt>{t("providerCountLabel")}</dt><dd>{visibleEvidence.catalog.providers.length}</dd></div>
                <div><dt>{t("expiresLabel")}</dt><dd>{new Date(visibleEvidence.expiresAt).toLocaleString()}</dd></div>
              </dl>
              <div className="neodid-console-boundaries">
                {([
                  ["identityVerification", "identityVerification"],
                  ["claimAttestation", "claimAttestation"],
                  ["signatureVerification", "signatureVerification"],
                  ["oracleDispatch", "oracleDispatch"],
                ] as const).map(([key, label]) => (
                  <span key={key}><strong>{t(label)}</strong><small>{t("notPerformed")}</small></span>
                ))}
              </div>
            </div>
          ) : (
            <OpenUiNotice
              className="neodid-console-drawer__empty"
              icon={<FileSearch size={17} aria-hidden="true" />}
              title={t("recordAwaiting")}
            >
              {t("boundaryNote")}
            </OpenUiNotice>
          )}
        </OpenUiPanel>

        <div className="neodid-console-recovery">
          <Landmark size={16} aria-hidden="true" />
          <span>{t("localRecovery")}</span>
          <strong>{storageHealthy ? t("recoveryAvailable") : t("recoveryUnavailable")}</strong>
        </div>
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="oracle-neodid-play-area mx2 mx2-cat-tool">
      <PlayStage
        category="tool"
        stage={{
          title: t("stageTitle"),
          subtitle: t("stageSubtitle"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {networkLabel}
            </span>
          ),
        }}
        scene={scene}
        actions={{
          primary: {
            label: isResolving ? t("resolvingAction") : t("resolveAction"),
            onClick: resolve,
            loading: isResolving,
            disabled: !draftReady,
            icon: <RadioTower size={17} aria-hidden="true" />,
            hint: validationKey ? t(validationKey) : endpointLabel,
          },
          secondary: [
            ...(visibleEvidence ? [{
              label: t("copyAction"),
              onClick: copy,
              icon: <ClipboardCopy size={16} aria-hidden="true" />,
            }] : []),
            {
              label: t("resetAction"),
              onClick: reset,
              disabled: isResolving,
              icon: <RotateCcw size={16} aria-hidden="true" />,
            },
          ],
        }}
        drawerToggleLabel={t("detailsLabel")}
        drawer={{ title: t("detailsLabel"), children: drawer }}
      />
    </div>
  );
}
