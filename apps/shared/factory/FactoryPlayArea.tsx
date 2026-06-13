import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { ownerMatchesAddress } from "@shared/utils/neo";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  factoryContractFor,
  factoryTemplateIdFor,
  type FactoryArtifactPresence,
  type FactoryKind,
  type FactoryPlan,
  type FactoryNetwork,
  type FactoryTemplateStatus,
  type MiniAppDraft,
  type Nep11Draft,
  type Nep17Draft,
} from "./factoryPlan";
import type { FactoryDeploymentItem } from "./factoryChain";
import type { FactorySignatureInfo } from "./runtime";
import "./FactoryPlayArea.scss";

const ERROR_KEYS: Record<string, string> = {
  name_length: "errNameLength",
  collection_name_length: "errCollectionNameLength",
  symbol_format: "errSymbolFormat",
  decimals_range: "errDecimalsRange",
  initial_supply_positive: "errInitialSupplyPositive",
  initial_supply_precision: "errInitialSupplyPrecision",
  initial_supply_format: "errInitialSupplyFormat",
  owner_address: "errOwnerAddress",
  treasury_address: "errTreasuryAddress",
  max_supply_range: "errMaxSupplyRange",
  royalty_range: "errRoyaltyRange",
  base_uri_https_trailing_slash: "errBaseUri",
  app_id_format: "errAppIdFormat",
  app_name_length: "errAppNameLength",
  template_kind: "errTemplateKind",
  admin_address: "errAdminAddress",
  factory_contract_not_configured: "errFactoryNotConfigured",
  factory_contract_invalid: "errFactoryInvalid",
};

const WARNING_KEYS: Record<string, string> = {
  mainnet_review_required: "warnMainnetReview",
  catalog_registration_required: "warnCatalogRegistration",
};

const STEP_STATUS_KEYS: Record<string, string> = {
  ready: "stepStatusReady",
  manual: "stepStatusManual",
  blocked: "stepStatusBlocked",
};

const ARTIFACT_STATUS_KEYS: Record<FactoryTemplateStatus, string> = {
  "preloaded-on-chain": "artifactStatusPreloaded",
  "metadata-only": "artifactStatusMetadataOnly",
  "not-registered": "artifactStatusNotRegistered",
  unverified: "artifactStatusUnverified",
};

function cloneDraft<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function statusClass(status: string) {
  if (status === "blocked") return "domain-factory-step--blocked";
  if (status === "manual") return "domain-factory-step--manual";
  return "domain-factory-step--ready";
}

function SelectField({
  label,
  value,
  children,
  onChange,
}: {
  label: string;
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <label className="domain-factory-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="domain-factory-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export interface FactoryPlayAreaProps extends PlayAreaProps {
  fixedKind: FactoryKind;
  appId: string;
}

export function FactoryPlayArea({
  t,
  state,
  dispatch,
  launchContext,
  fixedKind,
  appId,
}: FactoryPlayAreaProps) {
  const initialDraft = useMemo(
    () => createFactoryDraftFromLaunchContext(launchContext, fixedKind),
    [fixedKind, launchContext.signature],
  );
  const kind = fixedKind;
  const [nep17, setNep17] = useState<Nep17Draft>(() => cloneDraft(initialDraft.nep17));
  const [nep11, setNep11] = useState<Nep11Draft>(() => cloneDraft(initialDraft.nep11));
  const [miniapp, setMiniapp] = useState<MiniAppDraft>(() => cloneDraft(initialDraft.miniapp));
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const { val, bool, str, num } = useStateBindings(state);
  const storedPlan = val<FactoryPlan>("currentPlan") ?? null;
  const walletAddress = str("walletAddress");
  const presenceMap = val<Record<string, FactoryArtifactPresence>>("artifactPresence") ?? {};

  const activeNetwork =
    kind === "nep17" ? nep17.network : kind === "nep11" ? nep11.network : miniapp.network;
  const draftTemplateId = factoryTemplateIdFor(kind, miniapp.templateKind);
  const draftPresence = presenceMap[`${activeNetwork}|${draftTemplateId}`];

  // Memoize the live-preview fallback on the actual draft inputs so the plan
  // (and the derived JSON memo) keep a stable identity across unrelated
  // re-renders, instead of rebuilding on every keystroke/render.
  const fallbackPlan = useMemo(
    () =>
      buildFactoryPlan(
        kind,
        (kind === "nep17" ? nep17 : kind === "nep11" ? nep11 : miniapp) as unknown as Record<string, unknown>,
        { appId, artifactPresence: draftPresence },
      ),
    [kind, nep17, nep11, miniapp, appId, draftPresence],
  );
  const currentPlan = storedPlan ?? fallbackPlan;
  // Signing/executing must operate on the STORED plan (populated by
  // "Generate plan"), not the live form preview. The preview can be
  // publishable while no plan has been generated, which previously enabled
  // Sign and then threw `noPlanToSign`.
  const canSign = Boolean(storedPlan?.publishable);
  const previewReadyButUnsaved = !storedPlan && currentPlan.publishable;
  const isSigning = bool("isSigning");
  const isGenerating = bool("isGenerating");
  const isExecuting = bool("isExecuting");
  const walletSignature = str("walletSignature");
  const signatureInfo = val<FactorySignatureInfo>("walletSignatureInfo") ?? null;
  const lastError = str("lastError");
  const lastTxid = str("lastTxid");
  const deployedContractHash = str("deployedContractHash");
  const executedDigest = str("executedDigest");
  const feeEstimate = str("feeEstimateGas");
  const deployments = val<FactoryDeploymentItem[]>("deployments") ?? [];
  const deploymentsTotal = num("deploymentsTotal");
  const deploymentsState = str("deploymentsState");

  const alreadyExecuted = Boolean(storedPlan && executedDigest && storedPlan.digest === executedDigest);
  const canExecute = Boolean(storedPlan?.publishable && storedPlan.execution.available) && !alreadyExecuted;
  const executeBlockedReason =
    storedPlan?.publishable && !storedPlan.execution.available && storedPlan.execution.blockedReasonKey
      ? t(storedPlan.execution.blockedReasonKey)
      : "";

  // Prefill the creator fields from the connected wallet so the first paint
  // is a workable draft instead of a red "owner missing" blocked state. Only
  // empty fields are seeded — user input always wins.
  useEffect(() => {
    if (!walletAddress) return;
    setNep17((draft) =>
      draft.owner ? draft : { ...draft, owner: walletAddress, treasury: draft.treasury || walletAddress },
    );
    setNep11((draft) => (draft.owner ? draft : { ...draft, owner: walletAddress }));
    setMiniapp((draft) => (draft.admin ? draft : { ...draft, admin: walletAddress }));
  }, [walletAddress]);

  // Live-verify the active template's artifact whenever template/network
  // changes, so the preview's honesty state never relies on local assumptions.
  useEffect(() => {
    void dispatch("ensureArtifactState", {
      templateId: draftTemplateId,
      network: activeNetwork,
      scriptHash: factoryContractFor(kind, activeNetwork),
    }).catch(() => undefined);
  }, [dispatch, kind, draftTemplateId, activeNetwork]);

  useEffect(() => {
    void dispatch("refreshDeployments", { network: activeNetwork }).catch(() => undefined);
  }, [dispatch, activeNetwork]);

  const packageJson = useMemo(
    () => JSON.stringify(
      {
        packageId: currentPlan.packageId,
        digest: currentPlan.digest,
        templateId: currentPlan.templateId,
        templateVersion: currentPlan.templateVersion,
        templateArtifact: currentPlan.templateArtifact,
        operation: currentPlan.operation,
        deploymentCall: currentPlan.deploymentCall,
        network: currentPlan.network,
        payload: currentPlan.payload,
        ...(signatureInfo && storedPlan && currentPlan.digest === storedPlan.digest
          ? { walletSignature: signatureInfo }
          : {}),
      },
      null,
      2,
    ),
    [currentPlan, signatureInfo, storedPlan],
  );

  async function copyText(text: string, target: string) {
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
      setCopyError(target);
      window.setTimeout(() => setCopyError(null), 1500);
    }
  }

  function copyLabel(target: string, idleKey: string): string {
    if (copied === target) return t("copied");
    if (copyError === target) return t("copyFailed");
    return t(idleKey);
  }

  async function generatePlan() {
    if (isGenerating) return;
    const input = kind === "nep17" ? nep17 : kind === "nep11" ? nep11 : miniapp;
    await dispatch("generatePlan", input);
  }

  const setNetwork = (network: FactoryNetwork) => {
    setNep17((draft) => ({ ...draft, network }));
    setNep11((draft) => ({ ...draft, network }));
    setMiniapp((draft) => ({ ...draft, network }));
  };

  const networkLabel = t(activeNetwork === "neo-n3-mainnet" ? "networkMainnet" : "networkTestnet");
  const kindLabel = t(kind === "nep11" ? "nep11" : kind === "miniapp" ? "miniappTemplate" : "nep17");

  const heroPill = storedPlan
    ? storedPlan.publishable
      ? { className: "is-ready", label: t("ready") }
      : { className: "is-blocked", label: t("blocked") }
    : { className: "is-draft", label: t("draft") };

  const royaltyBpsNumber = Number(nep11.royaltyBps);
  const royaltyHint =
    Number.isFinite(royaltyBpsNumber) && royaltyBpsNumber >= 0 && royaltyBpsNumber <= 1000
      ? t("royaltyHelper", {
          bps: royaltyBpsNumber,
          percent: (royaltyBpsNumber / 100).toFixed(2).replace(/\.?0+$/, "") || "0",
        })
      : "";

  function renderUseMyAddress(currentValue: string, apply: () => void) {
    if (!walletAddress || currentValue === walletAddress) return null;
    return (
      <button type="button" className="domain-factory-affix" onClick={apply}>
        {t("useMyAddress")}
      </button>
    );
  }

  return (
    <div className="domain-factory">
      <section className="domain-factory-hero">
        <div className="domain-factory-hero__lead">
          <span className="ns-icon-badge ns-badge--mint domain-factory-hero__badge" aria-hidden="true">◆</span>
          <div className="domain-factory-hero__text">
            <h2>{t("title")}</h2>
            <p>{t("subtitle")}</p>
          </div>
        </div>
        <div className="domain-factory-hero__status" aria-label={t("planStatus")}>
          <span className={`domain-factory-hero__pill ${heroPill.className}`}>
            {heroPill.label}
          </span>
          <div className="domain-factory-hero__meta">
            <span className="domain-factory-hero__metalabel">{t("packageDigest")}</span>
            <strong>{currentPlan.digest.slice(-10)}</strong>
          </div>
          <small>{networkLabel}</small>
        </div>
      </section>

      <div className="domain-factory-grid">
        <NeoCard variant="erobo" title={kindLabel}>
          <div className="domain-factory-form">
            <SelectField label={t("network")} value={activeNetwork} onChange={(value) => setNetwork(value as FactoryNetwork)}>
              <option value="neo-n3-testnet">{t("networkOptionTestnet")}</option>
              <option value="neo-n3-mainnet">{t("networkOptionMainnet")}</option>
            </SelectField>

            {kind === "nep17" && (
              <>
                <NeoInput label={t("name")} value={nep17.name} onChange={(name) => setNep17((draft) => ({ ...draft, name }))} />
                <div className="domain-factory-form__row">
                  <NeoInput label={t("symbol")} value={nep17.symbol} onChange={(symbol) => setNep17((draft) => ({ ...draft, symbol }))} />
                  <NeoInput label={t("decimals")} type="number" value={nep17.decimals} min={0} max={8} onChange={(decimals) => setNep17((draft) => ({ ...draft, decimals }))} />
                </div>
                <NeoInput label={t("initialSupply")} type="number" value={nep17.initialSupply} onChange={(initialSupply) => setNep17((draft) => ({ ...draft, initialSupply }))} />
                <div className="domain-factory-field">
                  <NeoInput label={t("owner")} value={nep17.owner} placeholder="N..." onChange={(owner) => setNep17((draft) => ({ ...draft, owner, treasury: draft.treasury || owner }))} />
                  {renderUseMyAddress(nep17.owner, () =>
                    setNep17((draft) => ({ ...draft, owner: walletAddress, treasury: draft.treasury || walletAddress })),
                  )}
                </div>
                <NeoInput label={t("treasury")} value={nep17.treasury} placeholder="N..." onChange={(treasury) => setNep17((draft) => ({ ...draft, treasury }))} />
                <ToggleField label={t("mintable")} checked={nep17.mintable} onChange={(mintable) => setNep17((draft) => ({ ...draft, mintable }))} />
              </>
            )}

            {kind === "nep11" && (
              <>
                <NeoInput label={t("collectionName")} value={nep11.collectionName} onChange={(collectionName) => setNep11((draft) => ({ ...draft, collectionName }))} />
                <div className="domain-factory-form__row">
                  <NeoInput label={t("symbol")} value={nep11.symbol} onChange={(symbol) => setNep11((draft) => ({ ...draft, symbol }))} />
                  <NeoInput label={t("maxSupply")} type="number" value={nep11.maxSupply} onChange={(maxSupply) => setNep11((draft) => ({ ...draft, maxSupply }))} />
                </div>
                <NeoInput label={t("royaltyBps")} type="number" value={nep11.royaltyBps} min={0} max={1000} hint={royaltyHint} onChange={(royaltyBps) => setNep11((draft) => ({ ...draft, royaltyBps }))} />
                <NeoInput label={t("baseUri")} value={nep11.baseUri} onChange={(baseUri) => setNep11((draft) => ({ ...draft, baseUri }))} />
                <div className="domain-factory-field">
                  <NeoInput label={t("owner")} value={nep11.owner} placeholder="N..." onChange={(owner) => setNep11((draft) => ({ ...draft, owner }))} />
                  {renderUseMyAddress(nep11.owner, () => setNep11((draft) => ({ ...draft, owner: walletAddress })))}
                </div>
                <ToggleField label={t("transferable")} checked={nep11.transferable} onChange={(transferable) => setNep11((draft) => ({ ...draft, transferable }))} />
              </>
            )}

            {kind === "miniapp" && (
              <>
                <NeoInput label={t("appId")} value={miniapp.appId} onChange={(appId) => setMiniapp((draft) => ({ ...draft, appId }))} />
                <NeoInput label={t("appName")} value={miniapp.appName} onChange={(appName) => setMiniapp((draft) => ({ ...draft, appName }))} />
                <SelectField label={t("templateKind")} value={miniapp.templateKind} onChange={(templateKind) => setMiniapp((draft) => ({ ...draft, templateKind: templateKind as MiniAppDraft["templateKind"] }))}>
                  <option value="reward-vault">{t("templateKindRewardVault")}</option>
                  <option value="ticket-pass">{t("templateKindTicketPass")}</option>
                  <option value="certificate">{t("templateKindCertificate")}</option>
                  <option value="oracle-console">{t("templateKindOracleConsole")}</option>
                </SelectField>
                <div className="domain-factory-field">
                  <NeoInput label={t("admin")} value={miniapp.admin} placeholder="N..." onChange={(admin) => setMiniapp((draft) => ({ ...draft, admin }))} />
                  {renderUseMyAddress(miniapp.admin, () => setMiniapp((draft) => ({ ...draft, admin: walletAddress })))}
                </div>
                <div className="domain-factory-form__row domain-factory-form__row--toggles">
                  <ToggleField label={t("needsOracle")} checked={miniapp.needsOracle} onChange={(needsOracle) => setMiniapp((draft) => ({ ...draft, needsOracle }))} />
                  <ToggleField label={t("needsOneGate")} checked={miniapp.needsOneGate} onChange={(needsOneGate) => setMiniapp((draft) => ({ ...draft, needsOneGate }))} />
                </div>
              </>
            )}

            <NeoButton
              variant="primary"
              size="lg"
              block
              disabled={isGenerating}
              loading={isGenerating}
              onClick={generatePlan}
            >
              {t("generatePlan")}
            </NeoButton>
          </div>
        </NeoCard>

        <section className="domain-factory-output">
          <NeoCard
            variant={storedPlan ? (storedPlan.publishable ? "success" : "warning") : "erobo"}
            title={t("publishPackage")}
          >
            <div className="domain-factory-package">
              <div className="domain-factory-package__meta">
                <div>
                  <span>{t("packageId")}</span>
                  <strong>{currentPlan.packageId}</strong>
                </div>
                <div>
                  <span>{t("packageDigestFull")}</span>
                  <strong>{currentPlan.digest}</strong>
                </div>
                <div>
                  <span>{t("artifactStatusLabel")}</span>
                  <strong>{t(ARTIFACT_STATUS_KEYS[currentPlan.templateArtifact.status])}</strong>
                </div>
                {feeEstimate ? (
                  <div>
                    <span>{t("estimatedFee")}</span>
                    <strong>{t("estimatedFeeValue", { amount: feeEstimate })}</strong>
                  </div>
                ) : null}
              </div>

              <div className="domain-factory-alerts">
                <div>
                  <h3>{t("blockingErrors")}</h3>
                  {currentPlan.blockingErrors.length === 0 ? (
                    <p>{t("noErrors")}</p>
                  ) : (
                    <ul>
                      {currentPlan.blockingErrors.map((code) => (
                        <li key={code}>{ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : code.replace(/_/g, " ")}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3>{t("warnings")}</h3>
                  {currentPlan.warnings.length === 0 ? (
                    <p>{t("noWarnings")}</p>
                  ) : (
                    <ul>
                      {currentPlan.warnings.map((code) => (
                        <li key={code}>{WARNING_KEYS[code] ? t(WARNING_KEYS[code]) : code.replace(/_/g, " ")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <details className="domain-factory-json-disclosure">
                <summary>{t("viewPackagePayload")}</summary>
                <pre className="domain-factory-json">{packageJson}</pre>
              </details>

              <div className="domain-factory-actions">
                <NeoButton variant="secondary" onClick={() => copyText(packageJson, "package")}>
                  {copyLabel("package", "copyPackage")}
                </NeoButton>
                <NeoButton
                  variant="success"
                  disabled={!canSign || isSigning}
                  loading={isSigning}
                  onClick={() => dispatch("signCurrentPlan")}
                >
                  {t("signPlanAction")}
                </NeoButton>
                <NeoButton
                  variant="primary"
                  disabled={!canExecute || isExecuting}
                  loading={isExecuting}
                  onClick={() => dispatch("executePlan")}
                >
                  {t(kind === "miniapp" ? "executeRecordAction" : "executeDeployAction")}
                </NeoButton>
              </div>

              {previewReadyButUnsaved ? (
                <div className="domain-factory-hint">{t("noPlanToSign")}</div>
              ) : null}
              {executeBlockedReason ? (
                <div className="domain-factory-hint">{executeBlockedReason}</div>
              ) : null}
              {alreadyExecuted && !lastTxid ? (
                <div className="domain-factory-hint">{t("alreadyExecuted")}</div>
              ) : null}
              {lastTxid ? (
                <div className="domain-factory-result">
                  <div>
                    <span>{t("lastTxidLabel")}</span>
                    <code>{lastTxid}</code>
                  </div>
                  {deployedContractHash ? (
                    <div>
                      <span>{t("deployedContractLabel")}</span>
                      <code>{deployedContractHash}</code>
                      <NeoButton variant="ghost" size="sm" onClick={() => copyText(deployedContractHash, "deployed-hash")}>
                        {copyLabel("deployed-hash", "copyContractHash")}
                      </NeoButton>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {walletSignature ? (
                <div className="domain-factory-signature">
                  <span>{t("walletSignature")}</span>
                  <code>{walletSignature}</code>
                  <NeoButton variant="ghost" size="sm" onClick={() => copyText(walletSignature, "signature")}>
                    {copyLabel("signature", "copySignature")}
                  </NeoButton>
                </div>
              ) : null}
              {lastError ? <div className="domain-factory-error">{lastError}</div> : null}
            </div>
          </NeoCard>

          <NeoCard variant="erobo" title={t("deployChecklist")}>
            <ol className="domain-factory-steps">
              {currentPlan.steps.map((step) => (
                <li key={step.key} className={statusClass(step.status)}>
                  <span>{t(STEP_STATUS_KEYS[step.status] ?? "stepStatusManual")}</span>
                  <div>
                    <strong>{t(step.titleKey)}</strong>
                    <p>{t(step.detailKey)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </NeoCard>

          <NeoCard variant="erobo" title={t("myDeployments")}>
            <div className="domain-factory-deployments">
              <div className="domain-factory-deployments__bar">
                <span>
                  {deploymentsState === "ready" ? t("deploymentsCount", { count: deploymentsTotal }) : "—"}
                </span>
                <NeoButton
                  variant="ghost"
                  size="sm"
                  disabled={deploymentsState === "loading"}
                  onClick={() => dispatch("refreshDeployments", { network: activeNetwork }).catch(() => undefined)}
                >
                  {t("refreshAction")}
                </NeoButton>
              </div>
              {deploymentsState === "loading" ? (
                <p className="domain-factory-deployments__empty">{t("loadingDeployments")}</p>
              ) : deploymentsState === "error" ? (
                <div className="domain-factory-deployments__empty">
                  <p>{t("deploymentsError")}</p>
                  <NeoButton
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch("refreshDeployments", { network: activeNetwork }).catch(() => undefined)}
                  >
                    {t("retryAction")}
                  </NeoButton>
                </div>
              ) : deployments.length === 0 ? (
                <p className="domain-factory-deployments__empty">{t("noDeploymentsYet")}</p>
              ) : (
                <ul className="domain-factory-deployments__list">
                  {deployments.map((item) => (
                    <li key={item.packageId} className="domain-factory-deployment">
                      <div className="domain-factory-deployment__head">
                        <strong>{item.packageId}</strong>
                        {ownerMatchesAddress(item.creator, walletAddress || null) ? (
                          <span className="domain-factory-deployment__mine">{t("mineTag")}</span>
                        ) : null}
                      </div>
                      <div className="domain-factory-deployment__meta">
                        <span>{item.templateId}</span>
                        {item.createdAt > 0 ? (
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        ) : null}
                      </div>
                      {item.deployedHash ? (
                        <div className="domain-factory-deployment__hash">
                          <code>{item.deployedHash}</code>
                          <NeoButton
                            variant="ghost"
                            size="sm"
                            onClick={() => copyText(item.deployedHash, `hash-${item.packageId}`)}
                          >
                            {copyLabel(`hash-${item.packageId}`, "copyContractHash")}
                          </NeoButton>
                        </div>
                      ) : (
                        <span className="domain-factory-deployment__recordonly">{t("recordOnly")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </NeoCard>

          <NeoCard variant="erobo" title={t("oneGateLaunch")}>
            <div className="domain-factory-onegate">
              <p>{currentPlan.oneGate.url}</p>
              <NeoButton variant="ghost" onClick={() => copyText(currentPlan.oneGate.url, "link")}>
                {copyLabel("link", "copyLink")}
              </NeoButton>
            </div>
            <p className="domain-factory-note">{t("deployHonesty")}</p>
          </NeoCard>
        </section>
      </div>
    </div>
  );
}
