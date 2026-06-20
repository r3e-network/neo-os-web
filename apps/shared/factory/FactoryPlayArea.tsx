import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Boxes,
  Check,
  Coins,
  Network,
  PackagePlus,
  Radio,
  ShieldCheck,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
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

interface ChoiceOption<TValue extends string = string> {
  value: TValue;
  label: string;
  meta?: string;
  icon: LucideIcon;
}

function ChoiceField<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: ChoiceOption<TValue>[];
  onChange: (value: TValue) => void;
}) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <section className="domain-factory-choice" aria-label={label}>
      <div className="domain-factory-choice__head">
        <span>{label}</span>
        {selectedOption ? <strong>{selectedOption.label}</strong> : null}
      </div>
      <div className="domain-factory-choice__options" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}: ${option.label}`}
              className={`domain-factory-choice__button${
                selected ? " domain-factory-choice__button--active" : ""
              }`}
              onClick={() => onChange(option.value)}
            >
              <span className="domain-factory-choice__icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="domain-factory-choice__copy">
                <strong>{option.label}</strong>
                {option.meta ? <small>{option.meta}</small> : null}
              </span>
              {selected ? (
                <span className="domain-factory-choice__check" aria-hidden="true">
                  <Check size={14} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ToggleField({
  label,
  checked,
  icon: Icon = Check,
  onChange,
}: {
  label: string;
  checked: boolean;
  icon?: LucideIcon;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`domain-factory-toggle-button${
        checked ? " domain-factory-toggle-button--checked" : ""
      }`}
      onClick={() => onChange(!checked)}
    >
      <span className="domain-factory-toggle-button__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="domain-factory-toggle-button__label">{label}</span>
      <span className="domain-factory-toggle-button__track" aria-hidden="true" />
    </button>
  );
}

const TEMPLATE_KIND_KEYS: Record<MiniAppDraft["templateKind"], string> = {
  "reward-vault": "templateKindRewardVault",
  "ticket-pass": "templateKindTicketPass",
  certificate: "templateKindCertificate",
  "oracle-console": "templateKindOracleConsole",
};

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="domain-factory-preview__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * Kind-aware preview of the artifact this factory will create. It reads the live
 * draft (not the generated plan) so the output column always shows a concrete
 * picture of the input — an NFT card for nep11, a token summary for nep17, a
 * template summary for miniapp. Purely presentational; no logic/dispatch.
 */
function FactoryPreviewCard({
  kind,
  nep11,
  nep17,
  miniapp,
  t,
}: {
  kind: FactoryKind;
  nep11: Nep11Draft;
  nep17: Nep17Draft;
  miniapp: MiniAppDraft;
  t: PlayAreaProps["t"];
}) {
  let body: ReactNode;

  if (kind === "nep11") {
    const name = nep11.collectionName.trim() || t("previewUntitledCollection");
    const symbol = nep11.symbol.trim() || t("previewSymbolPlaceholder");
    const maxSupplyNum = Number(nep11.maxSupply);
    // An empty/invalid max supply is a blocking validation error (the template
    // requires 1–1,000,000), so it can never deploy as "Unlimited" — show a
    // neutral placeholder instead of implying an unavailable option.
    const maxSupply =
      nep11.maxSupply.trim() && Number.isFinite(maxSupplyNum) && maxSupplyNum > 0
        ? maxSupplyNum.toLocaleString()
        : "—";
    const royaltyNum = Number(nep11.royaltyBps);
    const royalty =
      Number.isFinite(royaltyNum) && royaltyNum > 0
        ? `${(royaltyNum / 100).toFixed(2).replace(/\.?0+$/, "")}%`
        : "0%";
    const initial = (symbol[0] ?? "N").toUpperCase();
    body = (
      <div className="domain-factory-preview__nft">
        <div className="domain-factory-preview__art" aria-hidden="true">
          <img src="./nft-drop-preview.jpg" alt="" loading="lazy" decoding="async" />
          <div className="domain-factory-preview__art-overlay">
            <span>NEP-11</span>
            <strong>{initial}</strong>
          </div>
        </div>
        <div className="domain-factory-preview__nftbody">
          <div className="domain-factory-preview__head">
            <strong>{t("previewSampleNftName", { name })}</strong>
            <span className="domain-factory-preview__symbol">{symbol}</span>
          </div>
          <div className="domain-factory-preview__stats">
            <PreviewStat label={t("previewMaxSupply")} value={maxSupply} />
            <PreviewStat label={t("previewRoyalty")} value={royalty} />
            <PreviewStat
              label={t("previewTransferPolicy")}
              value={t(nep11.transferable ? "previewTransferable" : "previewSoulbound")}
            />
          </div>
        </div>
      </div>
    );
  } else if (kind === "nep17") {
    const name = nep17.name.trim() || t("previewUntitledToken");
    const symbol = nep17.symbol.trim() || t("previewSymbolPlaceholder");
    const supplyNum = Number(nep17.initialSupply);
    const supply =
      nep17.initialSupply.trim() && Number.isFinite(supplyNum)
        ? supplyNum.toLocaleString()
        : "—";
    const decimals = nep17.decimals.trim() || "0";
    const initial = (symbol[0] ?? "T").toUpperCase();
    body = (
      <div className="domain-factory-preview__token">
        <div className="domain-factory-preview__coin" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div className="domain-factory-preview__nftbody">
          <div className="domain-factory-preview__head">
            <strong>{name}</strong>
            <span className="domain-factory-preview__symbol">{symbol}</span>
          </div>
          <div className="domain-factory-preview__stats">
            <PreviewStat label={t("previewSupply")} value={supply} />
            <PreviewStat label={t("decimals")} value={decimals} />
            <PreviewStat
              label={t("previewMintPolicy")}
              value={t(nep17.mintable ? "previewMintable" : "previewFixedSupply")}
            />
          </div>
        </div>
      </div>
    );
  } else {
    const name = miniapp.appName.trim() || t("previewUntitledApp");
    const id = miniapp.appId.trim() || "miniapp-…";
    const template = t(TEMPLATE_KIND_KEYS[miniapp.templateKind]);
    const services = [
      miniapp.needsOracle ? t("previewServiceOracle") : null,
      miniapp.needsOneGate ? t("previewServiceOneGate") : null,
    ].filter(Boolean) as string[];
    const initial = (name[0] ?? "A").toUpperCase();
    body = (
      <div className="domain-factory-preview__token">
        <div className="domain-factory-preview__coin" aria-hidden="true">
          <span>{initial}</span>
        </div>
        <div className="domain-factory-preview__nftbody">
          <div className="domain-factory-preview__head">
            <strong>{name}</strong>
            <span className="domain-factory-preview__symbol">{id}</span>
          </div>
          <div className="domain-factory-preview__stats">
            <PreviewStat label={t("previewTemplate")} value={template} />
            <PreviewStat
              label={t("previewServices")}
              value={services.length ? services.join(" · ") : t("previewServiceNone")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <NeoCard variant="erobo" title={t("previewTitle")}>
      <div className="domain-factory-preview">
        {body}
        <p className="domain-factory-preview__hint">{t("previewHint")}</p>
      </div>
    </NeoCard>
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
    [fixedKind, launchContext],
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
  const networkOptions: ChoiceOption<FactoryNetwork>[] = [
    {
      value: "neo-n3-testnet",
      label: t("networkOptionTestnet"),
      meta: t("networkTestnet"),
      icon: Network,
    },
    {
      value: "neo-n3-mainnet",
      label: t("networkOptionMainnet"),
      meta: t("networkMainnet"),
      icon: ShieldCheck,
    },
  ];
  const templateOptions: ChoiceOption<MiniAppDraft["templateKind"]>[] = [
    {
      value: "reward-vault",
      label: t("templateKindRewardVault"),
      meta: "reward-vault",
      icon: Coins,
    },
    {
      value: "ticket-pass",
      label: t("templateKindTicketPass"),
      meta: "ticket-pass",
      icon: Ticket,
    },
    {
      value: "certificate",
      label: t("templateKindCertificate"),
      meta: "certificate",
      icon: BadgeCheck,
    },
    {
      value: "oracle-console",
      label: t("templateKindOracleConsole"),
      meta: "oracle-console",
      icon: Radio,
    },
  ];

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
  const nep11CollectionLabel = nep11.collectionName.trim() || t("previewUntitledCollection");
  const nep11SymbolLabel = nep11.symbol.trim() || t("previewSymbolPlaceholder");
  const nep11MaxSupplyNum = Number(nep11.maxSupply);
  const nep11MaxSupplyLabel =
    nep11.maxSupply.trim() && Number.isFinite(nep11MaxSupplyNum) && nep11MaxSupplyNum > 0
      ? nep11MaxSupplyNum.toLocaleString()
      : "—";
  const nep11RoyaltyLabel =
    Number.isFinite(royaltyBpsNumber) && royaltyBpsNumber >= 0
      ? `${(royaltyBpsNumber / 100).toFixed(2).replace(/\.?0+$/, "") || "0"}%`
      : "—";
  const nep11PolicyLabel = t(nep11.transferable ? "previewTransferable" : "previewSoulbound");

  function renderUseMyAddress(currentValue: string, apply: () => void) {
    if (!walletAddress || currentValue === walletAddress) return null;
    return (
      <button type="button" className="domain-factory-affix" onClick={apply}>
        {t("useMyAddress")}
      </button>
    );
  }

  return (
    <div className={`domain-factory domain-factory--${kind}`}>
      <section className="domain-factory-hero">
        <div className="domain-factory-hero__lead">
          <span className="ns-icon-badge ns-badge--mint domain-factory-hero__badge" aria-hidden="true">
            <PackagePlus size={24} />
          </span>
          <div className="domain-factory-hero__text">
            <span className="domain-factory-hero__eyebrow">{t("factoryOverview")}</span>
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
            <ChoiceField
              label={t("network")}
              value={activeNetwork}
              options={networkOptions}
              onChange={setNetwork}
            />

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
                <ToggleField label={t("mintable")} icon={Coins} checked={nep17.mintable} onChange={(mintable) => setNep17((draft) => ({ ...draft, mintable }))} />
              </>
            )}

            {kind === "nep11" && (
              <>
                <section className="domain-factory-drop-rail" aria-label={t("dropStudio")}>
                  <span className="domain-factory-drop-rail__icon" aria-hidden="true">
                    <Ticket size={18} />
                  </span>
                  <div className="domain-factory-drop-rail__copy">
                    <span>{t("dropStudio")}</span>
                    <strong>{nep11CollectionLabel}</strong>
                    <small>{t("dropStudioHint", { symbol: nep11SymbolLabel })}</small>
                  </div>
                  <dl className="domain-factory-drop-rail__stats">
                    <div>
                      <dt>{t("previewMaxSupply")}</dt>
                      <dd>{nep11MaxSupplyLabel}</dd>
                    </div>
                    <div>
                      <dt>{t("previewRoyalty")}</dt>
                      <dd>{nep11RoyaltyLabel}</dd>
                    </div>
                    <div>
                      <dt>{t("previewTransferPolicy")}</dt>
                      <dd>{nep11PolicyLabel}</dd>
                    </div>
                  </dl>
                </section>
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
                <ToggleField label={t("transferable")} icon={Ticket} checked={nep11.transferable} onChange={(transferable) => setNep11((draft) => ({ ...draft, transferable }))} />
              </>
            )}

            {kind === "miniapp" && (
              <>
                <NeoInput label={t("appId")} value={miniapp.appId} onChange={(appId) => setMiniapp((draft) => ({ ...draft, appId }))} />
                <NeoInput label={t("appName")} value={miniapp.appName} onChange={(appName) => setMiniapp((draft) => ({ ...draft, appName }))} />
                <ChoiceField
                  label={t("templateKind")}
                  value={miniapp.templateKind}
                  options={templateOptions}
                  onChange={(templateKind) =>
                    setMiniapp((draft) => ({ ...draft, templateKind }))
                  }
                />
                <div className="domain-factory-field">
                  <NeoInput label={t("admin")} value={miniapp.admin} placeholder="N..." onChange={(admin) => setMiniapp((draft) => ({ ...draft, admin }))} />
                  {renderUseMyAddress(miniapp.admin, () => setMiniapp((draft) => ({ ...draft, admin: walletAddress })))}
                </div>
                <div className="domain-factory-form__row domain-factory-form__row--toggles">
                  <ToggleField label={t("needsOracle")} icon={Radio} checked={miniapp.needsOracle} onChange={(needsOracle) => setMiniapp((draft) => ({ ...draft, needsOracle }))} />
                  <ToggleField label={t("needsOneGate")} icon={Boxes} checked={miniapp.needsOneGate} onChange={(needsOneGate) => setMiniapp((draft) => ({ ...draft, needsOneGate }))} />
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
          <FactoryPreviewCard
            kind={kind}
            nep11={nep11}
            nep17={nep17}
            miniapp={miniapp}
            t={t}
          />

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
            {/* Before a plan is generated the checklist shows the live preview's
                provisional steps; render them in the neutral draft palette
                (matching the hero's DRAFT pill) so a fresh form doesn't paint a
                wall of red "BLOCKED" chips. Red is reserved for steps blocked
                after an actual generate. Purely visual — no logic change. */}
            <ol
              className={`domain-factory-steps${storedPlan ? "" : " domain-factory-steps--draft"}`}
            >
              {currentPlan.steps.map((step) => (
                <li key={step.key} className={statusClass(step.status)}>
                  {/* In draft (no plan generated) the per-step ready/blocked
                      verdict is provisional, so label every chip "Pending" —
                      a wall of "Blocked" badges read as errors on first run. */}
                  <span>
                    {storedPlan
                      ? t(STEP_STATUS_KEYS[step.status] ?? "stepStatusManual")
                      : t("stepStatusPending")}
                  </span>
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
                <StateView
                  kind="loading"
                  className="domain-factory-deployments__state"
                  title={t("loadingDeployments")}
                />
              ) : deploymentsState === "error" ? (
                <StateView
                  kind="error"
                  icon={null}
                  className="domain-factory-deployments__state"
                  title={t("deploymentsError")}
                  action={
                    <NeoButton
                      variant="ghost"
                      size="sm"
                      onClick={() => dispatch("refreshDeployments", { network: activeNetwork }).catch(() => undefined)}
                    >
                      {t("retryAction")}
                    </NeoButton>
                  }
                />
              ) : deployments.length === 0 ? (
                <StateView
                  kind="empty"
                  icon={null}
                  className="domain-factory-deployments__state"
                  title={t("noDeploymentsYet")}
                />
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
