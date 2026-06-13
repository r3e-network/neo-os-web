import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { CategoryIcon } from "@shared/components-react/illustrations";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ContractList from "./components/ContractList";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const isValidNeoAddress = (value: string) => /^N[0-9a-zA-Z]{33}$/.test(value.trim());

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const contracts = val<unknown[]>("contracts") ?? [];
  const address = str("address");
  const contractCount = num("contractCount");
  const activeCount = num("activeCount");
  const pendingCount = num("pendingCount");
  const brokenCount = num("brokenCount");
  const isLoading = bool("isLoading");
  const serviceNotice = str("serviceNotice");
  const actionNotice = str("actionNotice");
  const lastSubmittedTitle = str("lastSubmittedTitle");
  const creditBalance = str("creditBalance");
  const hasCredit = bool("hasCredit");

  const [partner, setPartner] = useState("");
  const [stake, setStake] = useState("");
  const [days, setDays] = useState("90");
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");

  const TITLE_MAX = 100;
  const TERMS_MAX = 2000;
  const stakeNumber = Number(stake);
  const daysNumber = Number(days);
  const partnerLooksInvalid = partner.trim().length > 0 && !isValidNeoAddress(partner);
  const stakeLooksInvalid =
    stake.trim().length > 0 && (!Number.isFinite(stakeNumber) || stakeNumber < 1);
  const daysLooksInvalid =
    days.trim().length > 0 && (!Number.isFinite(daysNumber) || daysNumber < 30);
  // Length limits mirror the composable's createContract guards (title > 100,
  // terms > 2000). Surface them inline/pre-submit instead of only after submit.
  const titleTooLong = title.trim().length > TITLE_MAX;
  const termsTooLong = terms.trim().length > TERMS_MAX;
  const canSubmit =
    isValidNeoAddress(partner) &&
    Number.isFinite(stakeNumber) &&
    stakeNumber >= 1 &&
    Number.isFinite(daysNumber) &&
    daysNumber >= 30 &&
    title.trim().length > 0 &&
    !titleTooLong &&
    !termsTooLong &&
    !isLoading;
  const stakePresets = ["1", "5", "10"];
  const durationPresets = ["30", "90", "365"];

  const hasContracts = contractCount > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;
    // dispatch resolves to the action's result (true only on a real success);
    // notify.guard swallows failures into error toasts, so a validation/chain
    // failure must NOT wipe the form — keep the input for retry.
    const ok = (await dispatch("createContract", {
      partnerAddress: partner,
      stakeAmount: stake,
      duration: days,
      title,
      terms,
    })) as unknown as boolean;
    if (ok) {
      setPartner("");
      setStake("");
      setDays("90");
      setTitle("");
      setTerms("");
    }
  };

  return (
    <div className="breakup-play-area">
      {/* Hero — badge + title + subtitle, with a single compact metrics line */}
      <div className="breakup-hero">
        <div className="breakup-hero-head">
          <div className="breakup-hero-badge">
            <CategoryIcon name="social" size={40} title={t("title")} />
          </div>
          <div className="breakup-hero-copy">
            <span className="breakup-hero-eyebrow">{t("contractTitle")}</span>
            <h1 className="breakup-hero-title">{t("title")}</h1>
            <p className="breakup-hero-subtitle">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {hasContracts && (
          <div className="breakup-hero-metrics" role="group">
            <span className="breakup-metric">
              <strong>{activeCount}</strong> {t("active")}
            </span>
            <span className="breakup-metric-sep" aria-hidden="true" />
            <span className="breakup-metric">
              <strong>{pendingCount}</strong> {t("pending")}
            </span>
            <span className="breakup-metric-sep" aria-hidden="true" />
            <span className="breakup-metric">
              <strong>{brokenCount}</strong> {t("broken")}
            </span>
            <span className="breakup-metric-sep" aria-hidden="true" />
            <span className="breakup-metric">
              <strong>{contractCount}</strong> {t("total")}
            </span>
          </div>
        )}
      </div>

      {/* Primary action — Create Contract form, surfaced immediately */}
      <NeoCard title={t("newContract")} className="breakup-create-card">
        <div className="create-contract-section">
          <p className="contract-description">
            {t("contractDescription")}
          </p>
          <NeoInput
            label={t("partnerAddress")}
            placeholder="N..."
            value={partner}
            error={partnerLooksInvalid ? t("partnerInvalid") : ""}
            onChange={setPartner}
          />
          <div className="create-contract-grid">
            <div className="breakup-field-stack">
              <NeoInput
                label={t("stakeAmount")}
                placeholder="5"
                type="number"
                suffix="GAS"
                min={1}
                value={stake}
                error={stakeLooksInvalid ? t("stakeOrDurationInvalid") : ""}
                onChange={setStake}
              />
              <div className="breakup-presets" aria-label={t("stakeLabel")}>
                {stakePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`breakup-preset${stake === preset ? " is-active" : ""}`}
                    onClick={() => setStake(preset)}
                  >
                    {preset} GAS
                  </button>
                ))}
              </div>
            </div>
            <div className="breakup-field-stack">
              <NeoInput
                label={t("durationDays")}
                placeholder="90"
                type="number"
                suffix={t("daysSuffix")}
                min={30}
                value={days}
                error={daysLooksInvalid ? t("stakeOrDurationInvalid") : ""}
                onChange={setDays}
              />
              <div className="breakup-presets" aria-label={t("durationLabel")}>
                {durationPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`breakup-preset${days === preset ? " is-active" : ""}`}
                    onClick={() => setDays(preset)}
                  >
                    {preset} {t("daysSuffix")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <NeoInput
            label={t("titleLabel")}
            placeholder={t("contractTitlePlaceholder")}
            value={title}
            required
            error={titleTooLong ? t("titleTooLong") : ""}
            hint={titleTooLong ? "" : t("titleCounter", { count: title.trim().length, max: TITLE_MAX })}
            onChange={setTitle}
          />
          <NeoInput
            label={t("contractTerms")}
            placeholder={t("contractTermsPlaceholder")}
            type="textarea"
            value={terms}
            error={termsTooLong ? t("termsTooLong") : ""}
            hint={termsTooLong ? "" : t("termsCounter", { count: terms.trim().length, max: TERMS_MAX })}
            onChange={setTerms}
          />
          {actionNotice && (
            <div className="breakup-action-notice" role="status">
              {actionNotice}
            </div>
          )}
          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isLoading}
            disabled={!canSubmit}
            aria-label={isLoading ? t("contractPreparing", { title: title || "contract", amount: `${stake || "0"} GAS` }) : t("createContract")}
            onClick={handleCreate}
          >
            {t("createContract")}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Stranded stake-credit recovery — a deposit that landed without its
          create/sign completing (e.g. a rejected second prompt) is held as
          reusable prepaid credit; withdraw returns it to the wallet. Shown only
          when there is recoverable credit. */}
      {hasCredit && (
        <NeoCard title={t("creditRecoveryTitle")} className="breakup-credit-card">
          <p className="breakup-credit-copy">{t("creditRecoveryCopy")}</p>
          <div className="breakup-credit-row">
            <span className="breakup-credit-amount">
              <strong>{creditBalance}</strong> GAS
            </span>
            <NeoButton
              variant="primary"
              size="sm"
              loading={isLoading}
              disabled={isLoading}
              onClick={() => dispatch("withdrawCredit")}
            >
              {t("recoverCredit")}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      {/* Contracts — only shown once there is something to list */}
      {(hasContracts || lastSubmittedTitle || serviceNotice) && (
        <NeoCard title={t("contracts")} className="breakup-list-card">
          {lastSubmittedTitle && (
            <div className="breakup-last-submit" role="status">
              {t("lastSubmittedContract", { title: lastSubmittedTitle })}
            </div>
          )}
          {serviceNotice && (
            <p className="breakup-service-hint" role="status">
              <strong>{t("contractServiceUnavailableTitle")}</strong>
              <span>{serviceNotice}</span>
            </p>
          )}
          <ContractList
            contracts={contracts}
            address={address || null}
            onSign={(c: unknown) => dispatch("signContract", c)}
            onBreak={(c: unknown) => dispatch("breakContract", c)}
            onCancel={(c: unknown) => dispatch("cancelContract", c)}
            onSettle={(c: unknown) => dispatch("settleContract", c)}
            busy={isLoading}
            t={t}
          />
          {contracts.length === 0 && !isLoading && !serviceNotice && (
            <p className="breakup-list-empty">
              {t("noContractsHint")}
            </p>
          )}
        </NeoCard>
      )}
    </div>
  );
}
