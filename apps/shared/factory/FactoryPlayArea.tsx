import { useMemo, useState, type ReactNode } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  buildFactoryPlan,
  createFactoryDraftFromLaunchContext,
  type FactoryKind,
  type FactoryPlan,
  type FactoryNetwork,
  type MiniAppDraft,
  type Nep11Draft,
  type Nep17Draft,
} from "./factoryPlan";
import "./FactoryPlayArea.scss";

const ERROR_COPY: Record<string, string> = {
  name_length: "Name must be 3-64 characters.",
  collection_name_length: "Collection name must be 3-64 characters.",
  symbol_format: "Symbol must be 2-12 uppercase letters or digits.",
  decimals_range: "Decimals must be an integer from 0 to 8.",
  initial_supply_positive: "Initial supply must be greater than zero.",
  initial_supply_precision: "Initial supply has more decimals than the token allows.",
  initial_supply_format: "Initial supply must be a positive decimal number.",
  owner_address: "Owner must be a Neo N3 address or Hash160.",
  treasury_address: "Treasury must be a Neo N3 address or Hash160.",
  max_supply_range: "Max supply must be 1-1,000,000.",
  royalty_range: "Royalty must be 0-1000 bps.",
  base_uri_https_trailing_slash: "Base URI must be an HTTPS URL ending with '/'.",
  app_id_format: "MiniApp ID must start with miniapp- and use lowercase slugs.",
  app_name_length: "MiniApp name must be 3-64 characters.",
  template_kind: "Choose a supported template kind.",
  admin_address: "Admin must be a Neo N3 address or Hash160.",
  factory_contract_not_configured: "Factory contract is not configured for this network. Sync the deployed template registry hash before execution.",
  factory_contract_invalid: "Factory contract hash is invalid. Configure a Neo N3 Hash160 before execution.",
};

const WARNING_COPY: Record<string, string> = {
  mainnet_review_required: "Mainnet packages require signer, GAS, domain, and registry review before submission.",
  catalog_registration_required: "The generated catalog patch must be synchronized to Notion and platform registries after deployment.",
};

function cloneDraft<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function networkLabel(network: FactoryNetwork): string {
  return network === "neo-n3-mainnet" ? "Mainnet" : "Testnet";
}

function kindLabel(kind: FactoryKind): string {
  if (kind === "nep11") return "NEP-11 collection";
  if (kind === "miniapp") return "MiniApp template";
  return "NEP-17 asset";
}

function statusClass(status: string) {
  if (status === "blocked") return "domain-factory-step--blocked";
  if (status === "manual") return "domain-factory-step--manual";
  return "domain-factory-step--ready";
}

function errorText(code: string) {
  return ERROR_COPY[code] ?? code.replace(/_/g, " ");
}

function warningText(code: string) {
  return WARNING_COPY[code] ?? code.replace(/_/g, " ");
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
  const [copied, setCopied] = useState<"package" | "link" | null>(null);

  const { val, bool, str } = useStateBindings(state);
  const currentPlan =
    val<FactoryPlan>("currentPlan") ??
    buildFactoryPlan(kind, kind === "nep17" ? nep17 : kind === "nep11" ? nep11 : miniapp, { appId });
  const isSigning = bool("isSigning");
  const walletSignature = str("walletSignature");
  const lastError = str("lastError");

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
      },
      null,
      2,
    ),
    [currentPlan],
  );

  async function copyText(text: string, target: "package" | "link") {
    await navigator.clipboard?.writeText(text);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function generatePlan() {
    const input = kind === "nep17" ? nep17 : kind === "nep11" ? nep11 : miniapp;
    await dispatch("generatePlan", input);
  }

  const setNetwork = (network: FactoryNetwork) => {
    setNep17((draft) => ({ ...draft, network }));
    setNep11((draft) => ({ ...draft, network }));
    setMiniapp((draft) => ({ ...draft, network }));
  };

  const activeNetwork =
    kind === "nep17" ? nep17.network : kind === "nep11" ? nep11.network : miniapp.network;

  return (
    <div className="domain-factory">
      <section className="domain-factory-hero">
        <div>
          <h2>{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </div>
        <div className="domain-factory-hero__status" aria-label={t("planStatus")}>
          <span className={currentPlan.publishable ? "is-ready" : "is-blocked"}>
            {currentPlan.publishable ? t("ready") : t("blocked")}
          </span>
          <strong>{currentPlan.digest.slice(-10)}</strong>
          <small>{networkLabel(activeNetwork)}</small>
        </div>
      </section>

      <div className="domain-factory-grid">
        <NeoCard variant="erobo" title={kindLabel(kind)}>
          <div className="domain-factory-form">
            <SelectField label={t("network")} value={activeNetwork} onChange={(value) => setNetwork(value as FactoryNetwork)}>
              <option value="neo-n3-testnet">Neo N3 Testnet</option>
              <option value="neo-n3-mainnet">Neo N3 Mainnet</option>
            </SelectField>

            {kind === "nep17" && (
              <>
                <NeoInput label={t("name")} value={nep17.name} onChange={(name) => setNep17((draft) => ({ ...draft, name }))} />
                <div className="domain-factory-form__row">
                  <NeoInput label={t("symbol")} value={nep17.symbol} onChange={(symbol) => setNep17((draft) => ({ ...draft, symbol }))} />
                  <NeoInput label={t("decimals")} type="number" value={nep17.decimals} min={0} max={8} onChange={(decimals) => setNep17((draft) => ({ ...draft, decimals }))} />
                </div>
                <NeoInput label={t("initialSupply")} type="number" value={nep17.initialSupply} onChange={(initialSupply) => setNep17((draft) => ({ ...draft, initialSupply }))} />
                <NeoInput label={t("owner")} value={nep17.owner} placeholder="N..." onChange={(owner) => setNep17((draft) => ({ ...draft, owner, treasury: draft.treasury || owner }))} />
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
                <NeoInput label={t("royaltyBps")} type="number" value={nep11.royaltyBps} min={0} max={1000} onChange={(royaltyBps) => setNep11((draft) => ({ ...draft, royaltyBps }))} />
                <NeoInput label={t("baseUri")} value={nep11.baseUri} onChange={(baseUri) => setNep11((draft) => ({ ...draft, baseUri }))} />
                <NeoInput label={t("owner")} value={nep11.owner} placeholder="N..." onChange={(owner) => setNep11((draft) => ({ ...draft, owner }))} />
                <ToggleField label={t("transferable")} checked={nep11.transferable} onChange={(transferable) => setNep11((draft) => ({ ...draft, transferable }))} />
              </>
            )}

            {kind === "miniapp" && (
              <>
                <NeoInput label={t("appId")} value={miniapp.appId} onChange={(appId) => setMiniapp((draft) => ({ ...draft, appId }))} />
                <NeoInput label={t("appName")} value={miniapp.appName} onChange={(appName) => setMiniapp((draft) => ({ ...draft, appName }))} />
                <SelectField label={t("templateKind")} value={miniapp.templateKind} onChange={(templateKind) => setMiniapp((draft) => ({ ...draft, templateKind: templateKind as MiniAppDraft["templateKind"] }))}>
                  <option value="reward-vault">Reward vault</option>
                  <option value="ticket-pass">Event ticket pass</option>
                  <option value="certificate">Soulbound certificate</option>
                  <option value="oracle-console">Oracle console</option>
                </SelectField>
                <NeoInput label={t("admin")} value={miniapp.admin} placeholder="N..." onChange={(admin) => setMiniapp((draft) => ({ ...draft, admin }))} />
                <div className="domain-factory-form__row domain-factory-form__row--toggles">
                  <ToggleField label={t("needsOracle")} checked={miniapp.needsOracle} onChange={(needsOracle) => setMiniapp((draft) => ({ ...draft, needsOracle }))} />
                  <ToggleField label={t("needsOneGate")} checked={miniapp.needsOneGate} onChange={(needsOneGate) => setMiniapp((draft) => ({ ...draft, needsOneGate }))} />
                </div>
              </>
            )}

            <NeoButton variant="primary" size="lg" block onClick={generatePlan}>
              {t("generatePlan")}
            </NeoButton>
          </div>
        </NeoCard>

        <section className="domain-factory-output">
          <NeoCard variant={currentPlan.publishable ? "success" : "warning"} title={t("publishPackage")}>
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
              </div>

              <div className="domain-factory-alerts">
                <div>
                  <h3>{t("blockingErrors")}</h3>
                  {currentPlan.blockingErrors.length === 0 ? (
                    <p>{t("noErrors")}</p>
                  ) : (
                    <ul>
                      {currentPlan.blockingErrors.map((code) => (
                        <li key={code}>{errorText(code)}</li>
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
                        <li key={code}>{warningText(code)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <pre className="domain-factory-json">{packageJson}</pre>

              <div className="domain-factory-actions">
                <NeoButton variant="secondary" onClick={() => copyText(packageJson, "package")}>
                  {copied === "package" ? t("copied") : t("copyPackage")}
                </NeoButton>
                <NeoButton
                  variant="success"
                  disabled={!currentPlan.publishable || isSigning}
                  loading={isSigning}
                  onClick={() => dispatch("signCurrentPlan")}
                >
                  {t("signPlanAction")}
                </NeoButton>
              </div>

              {walletSignature ? (
                <div className="domain-factory-signature">
                  <span>{t("walletSignature")}</span>
                  <code>{walletSignature}</code>
                </div>
              ) : null}
              {lastError ? <div className="domain-factory-error">{lastError}</div> : null}
            </div>
          </NeoCard>

          <NeoCard variant="erobo" title={t("deployChecklist")}>
            <ol className="domain-factory-steps">
              {currentPlan.steps.map((step) => (
                <li key={step.key} className={statusClass(step.status)}>
                  <span>{step.status}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </NeoCard>

          <NeoCard variant="erobo" title={t("oneGateLaunch")}>
            <div className="domain-factory-onegate">
              <p>{currentPlan.oneGate.url}</p>
              <NeoButton variant="ghost" onClick={() => copyText(currentPlan.oneGate.url, "link")}>
                {copied === "link" ? t("copied") : t("copyLink")}
              </NeoButton>
            </div>
            <p className="domain-factory-note">{t("deployHonesty")}</p>
          </NeoCard>
        </section>
      </div>
    </div>
  );
}
