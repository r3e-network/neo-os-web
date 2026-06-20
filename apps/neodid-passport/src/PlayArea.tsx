import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Github,
  Mail,
  RotateCcw,
  ShieldCheck,
  Signature,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoInput } from "@shared/components-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react";
import { getAADocsUrl } from "@shared/constants/rpc";
import { DEFAULT_SUBJECT_DID } from "./appConfig";
import type { PassportForm, PassportPayload, PassportProvider } from "./passport";
import { shortHash } from "./passport";
import "./PlayArea.scss";

function readLaunchDefault(
  params: Record<string, string> | undefined,
  key: keyof PassportForm,
  fallback: string,
) {
  const value = String(params?.[key] ?? "").trim();
  return value || fallback;
}

function initialForm(params: Record<string, string> = {}): PassportForm {
  const provider = readLaunchDefault(params, "provider", "wallet");
  return {
    subject: readLaunchDefault(params, "subject", DEFAULT_SUBJECT_DID),
    provider: provider === "github" || provider === "email" ? provider : "wallet",
    claim: readLaunchDefault(params, "claim", "wallet-ownership"),
    audience: readLaunchDefault(params, "audience", "miniapp-neodid-passport"),
  };
}

const providerOptions: Array<{
  value: PassportProvider;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "wallet",
    labelKey: "walletProvider",
    descriptionKey: "walletProviderTile",
  },
  {
    value: "github",
    labelKey: "githubProvider",
    descriptionKey: "githubProviderTile",
  },
  {
    value: "email",
    labelKey: "emailProvider",
    descriptionKey: "emailProviderTile",
  },
];

function providerIcon(provider: PassportProvider, size = 18) {
  if (provider === "wallet") return <WalletCards size={size} aria-hidden="true" />;
  if (provider === "github") return <Github size={size} aria-hidden="true" />;
  return <Mail size={size} aria-hidden="true" />;
}

export default function PlayArea({
  t,
  state,
  dispatch,
  services,
  launchContext,
}: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const [form, setForm] = useState<PassportForm>(() =>
    initialForm(launchContext?.params),
  );
  const payload = val<PassportPayload>("passportPayload");
  const payloadText = useMemo(
    () => (payload ? JSON.stringify(payload, null, 2) : ""),
    [payload],
  );
  const isResolving = bool("isResolving");
  const isSigning = bool("isSigning");
  const lastError = str("lastError");
  const proofStatus = str("proofStatus", t("notSignedStatus"));
  const isSigned = Boolean(payload?.proof?.signature);
  const providerHint = form.provider === "wallet" ? t("walletProofHint") : t("apiProofHint");
  const selectedProviderLabel =
    t(providerOptions.find((option) => option.value === form.provider)?.labelKey ?? "walletProvider");
  // The host resolver falls back to versionId "unversioned" when the live TEE
  // runtime metadata is unavailable, silently dropping the verification key a
  // relying party needs — surface that as a warning on the built passport.
  const runtimeDegraded =
    Boolean(payload) && payload?.didDocument.versionId === "unversioned";
  // github/email providers only PREPARE an attestation package; there is no
  // in-app completion lane, so point the user at the external attestation docs.
  const isExternalProvider = form.provider === "github" || form.provider === "email";
  const attestationDocsUrl = getAADocsUrl();

  function openAttestationDocs() {
    if (typeof window !== "undefined") {
      window.open(attestationDocsUrl, "_blank", "noopener,noreferrer");
    }
  }

  function updateForm(key: keyof PassportForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === "provider" ? (value as PassportProvider) : value,
    }));
  }

  async function resolveAndBuild() {
    await dispatch("buildPassport", form);
  }

  async function signPassport() {
    await dispatch("signPassport");
  }

  async function copyPayload() {
    if (!payloadText) return;
    await services.clipboard.copy(payloadText, "copied");
  }

  function resetForm() {
    setForm(initialForm(launchContext?.params));
    void dispatch("resetPassport");
  }

  return (
    <div className="neodid-passport">
      <section className="neodid-passport__hero" aria-labelledby="neodid-passport-title">
        <div className="neodid-passport__hero-copy">
          <span className="neodid-passport__icon" aria-hidden="true">
            <Fingerprint size={24} />
          </span>
          <div>
            <span className="neodid-passport__eyebrow">{t("identityRoute")}</span>
            <h2 id="neodid-passport-title">{t("panelTitle")}</h2>
            <p>{t("panelDescription")}</p>
            <span className="neodid-passport__offchain-chip">{t("offChainNote")}</span>
          </div>
        </div>
        <figure className="neodid-passport__visual">
          <img src="./passport-desk.jpg" alt={t("heroVisualAlt")} />
          <figcaption>
            <span>{t("credentialCardTitle")}</span>
            <strong>{selectedProviderLabel}</strong>
          </figcaption>
        </figure>
        <div className="neodid-passport__metrics" aria-label={t("statistics")}>
          <div>
            <ShieldCheck size={15} aria-hidden="true" />
            <span>{t("statNetwork")}</span>
            <strong>{str("networkLabel")}</strong>
          </div>
          <div>
            <BadgeCheck size={15} aria-hidden="true" />
            <span>{t("statEndpoint")}</span>
            <strong>{str("endpointLabel")}</strong>
          </div>
          <div>
            <FileCheck2 size={15} aria-hidden="true" />
            <span>{t("statRequests")}</span>
            <strong>{num("requestCount")}</strong>
          </div>
        </div>
      </section>

      <section className="neodid-passport__route" aria-label={t("identityRoute")}>
        <div>
          <b>1</b>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>{t("routeResolve")}</span>
        </div>
        <div>
          <b>2</b>
          <FileCheck2 size={18} aria-hidden="true" />
          <span>{t("routeBuild")}</span>
        </div>
        <div>
          <b>3</b>
          <Signature size={18} aria-hidden="true" />
          <span>{t("routeSign")}</span>
        </div>
      </section>

      <section className="neodid-passport__workspace">
        <form
          className="neodid-passport__form"
          aria-label={t("panelTitle")}
          onSubmit={(event) => {
            event.preventDefault();
            void resolveAndBuild();
          }}
        >
          <div
            className={`neodid-passport__form-head${isSigned ? " neodid-passport__form-head--signed" : ""}`}
          >
            <div>
              <span>{t("liveResolver")}</span>
              <strong>{t("passportWorkspaceTitle")}</strong>
            </div>
            <em>
              <span className="neodid-passport__status-dot" aria-hidden="true" />
              {proofStatus}
            </em>
          </div>

          <div className="neodid-passport__credential-preview" aria-label={t("passportPreview")}>
            <div className="neodid-passport__credential-mark" aria-hidden="true">
              <Fingerprint size={30} />
            </div>
            <div className="neodid-passport__credential-copy">
              <span>{t("credentialCardTitle")}</span>
              <strong>{form.subject || t("previewSubjectFallback")}</strong>
              <p>{t("credentialFlowCopy")}</p>
            </div>
            <dl className="neodid-passport__credential-facts">
              <div>
                <dt>{t("provider")}</dt>
                <dd>{selectedProviderLabel}</dd>
              </div>
              <div>
                <dt>{t("previewClaimLabel")}</dt>
                <dd>{form.claim || t("notAvailable")}</dd>
              </div>
              <div>
                <dt>{t("previewAudienceLabel")}</dt>
                <dd>{form.audience || t("notAvailable")}</dd>
              </div>
            </dl>
          </div>

          <section className="neodid-passport__provider-lanes" aria-labelledby="neodid-provider-title">
            <div className="neodid-passport__provider-head">
              <span id="neodid-provider-title">{t("proofLaneTitle")}</span>
              <strong>{t("proofLaneHint")}</strong>
            </div>
            <div
              className="neodid-passport__provider-options"
              role="radiogroup"
              aria-label={t("provider")}
            >
              {providerOptions.map((option) => {
                const selected = form.provider === option.value;
                const label = t(option.labelKey);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${t("provider")}: ${label}`}
                    className={`neodid-passport__provider-card${
                      selected ? " neodid-passport__provider-card--active" : ""
                    }`}
                    onClick={() => updateForm("provider", option.value)}
                  >
                    <span className="neodid-passport__provider-icon">
                      {providerIcon(option.value)}
                    </span>
                    <span className="neodid-passport__provider-copy">
                      <strong>{label}</strong>
                      <small>{t(option.descriptionKey)}</small>
                    </span>
                    {selected ? (
                      <span className="neodid-passport__provider-check" aria-hidden="true">
                        <CheckCircle2 size={15} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <NeoInput
            label={t("subject")}
            value={form.subject}
            placeholder={t("subjectPlaceholder")}
            required
            onChange={(value) => updateForm("subject", value)}
          />

          <NeoInput
            label={t("claim")}
            value={form.claim}
            placeholder={t("claimPlaceholder")}
            required
            onChange={(value) => updateForm("claim", value)}
          />

          <NeoInput
            label={t("audience")}
            value={form.audience}
            placeholder={t("audiencePlaceholder")}
            onChange={(value) => updateForm("audience", value)}
          />

          <div className="neodid-passport__hint">{providerHint}</div>

          {isExternalProvider ? (
            <div className="neodid-passport__external" role="note">
              <strong>{t("externalVerifierTitle")}</strong>
              <p>{t("externalVerifierCopy")}</p>
              <button
                type="button"
                className="neodid-passport__external-link"
                onClick={openAttestationDocs}
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>{t("externalVerifierLink")}</span>
              </button>
            </div>
          ) : null}

          {lastError ? (
            <div className="neodid-passport__alert" role="alert">
              {lastError}
            </div>
          ) : null}

          <div className="neodid-passport__actions">
            <NeoButton variant="primary" size="lg" loading={isResolving} onClick={resolveAndBuild}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{t("runAction")}</span>
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="lg"
              loading={isSigning}
              disabled={!payload || form.provider !== "wallet"}
              onClick={signPassport}
            >
              <Signature size={18} aria-hidden="true" />
              <span>{t("signAction")}</span>
            </NeoButton>
            <NeoButton variant="ghost" size="lg" onClick={resetForm}>
              <RotateCcw size={18} aria-hidden="true" />
              <span>{t("reset")}</span>
            </NeoButton>
          </div>
        </form>

        <div className="neodid-passport__result" aria-live="polite">
          {payload ? (
            <>
              <div className="neodid-passport__result-head">
                <div>
                  <span>{t("passportReady")}</span>
                  <strong>{payload.didDocument.id}</strong>
                  {runtimeDegraded ? (
                    <span className="neodid-passport__degraded-chip">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {t("degradedRuntimeBadge")}
                    </span>
                  ) : null}
                </div>
                <NeoButton variant="secondary" size="sm" onClick={copyPayload}>
                  <Copy size={16} aria-hidden="true" />
                  <span>{t("copyAction")}</span>
                </NeoButton>
              </div>

              {runtimeDegraded ? (
                <div className="neodid-passport__degraded-note" role="status">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{t("degradedRuntimeWarning")}</span>
                </div>
              ) : null}

              <div className="neodid-passport__summary">
                <div>
                  <span>{t("documentVersion")}</span>
                  <strong>{payload.didDocument.versionId}</strong>
                </div>
                <div>
                  <span>{t("services")}</span>
                  <strong>{payload.didDocument.serviceCount}</strong>
                </div>
                <div>
                  <span>{t("payloadDigest")}</span>
                  <strong>{shortHash(payload.digest)}</strong>
                </div>
                <div>
                  <span>{t("signature")}</span>
                  <strong>{shortHash(payload.proof.signature ?? "") || proofStatus}</strong>
                </div>
              </div>

              <pre className="neodid-passport__payload">{payloadText}</pre>
            </>
          ) : (
            <div className="neodid-passport__empty">
              <FileCheck2 size={28} aria-hidden="true" />
              <span>{t("emptyPayloadTitle")}</span>
              <strong>{t("emptyPayloadCopy")}</strong>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
