/**
 * PlayArea.tsx - Breakup Contract
 *
 * Social identity. The first screen is a pact desk: review partner, stake,
 * duration, and the on-chain consequence before creating the wallet intent.
 * Contract actions live on concrete pact cards in the drawer.
 */
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  FileSignature,
  Handshake,
  HeartCrack,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextArea as OpenUiTextArea,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import type { RelationshipContractView } from "./types";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<unknown>;
}

const PACT_IMAGE = "pact-table.webp";
const STAKE_PRESETS = ["1", "5", "10"];
const DURATION_PRESETS = ["30", "90", "365"];
type DrawerMode = "setup" | "contracts";

function compact(value: unknown, empty = "-") {
  const text = String(value ?? "").trim();
  if (!text) return empty;
  return text.length > 22 ? `${text.slice(0, 12)}...${text.slice(-7)}` : text;
}

function statusTone(status?: string) {
  if (status === "active") return "active";
  if (status === "broken" || status === "cancelled") return "danger";
  if (status === "ended") return "done";
  return "pending";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);

  const contractCount = num("contractCount");
  const activeCount = num("activeCount");
  const isLoading = bool("isLoading");
  const actionPhase = str("actionPhase", "idle");
  const hasPendingAction = bool("hasPendingAction");
  const serviceNotice = str("serviceNotice");
  const actionNotice = str("actionNotice");
  const pendingNotice = str("pendingNotice");
  const lastSubmittedTitle = str("lastSubmittedTitle");
  const walletAddress = str("address");
  const creditBalance = str("creditBalance", "—");
  const creditKnown = bool("creditKnown");
  const hasCredit = bool("hasCredit");
  const contracts = (val("contracts") ?? []) as RelationshipContractView[];

  const [partnerAddress, setPartnerAddress] = useState("");
  const [stakeAmount, setStakeAmount] = useState("1");
  const [duration, setDuration] = useState("30");
  const [contractTitle, setContractTitle] = useState("");
  const [contractTerms, setContractTerms] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("setup");

  const latestContract = contracts[0] ?? null;
  const previewTerms = contractTerms.trim() || latestContract?.terms || t("pactPreviewTerms");
  const partnerReady = /^N[0-9A-Za-z]{33}$/.test(partnerAddress.trim()) &&
    Boolean(addressToScriptHash(partnerAddress.trim()));
  const titleReady = contractTitle.trim().length > 0;
  const stakeReady = /^(?:[1-9]\d*)(?:\.\d{1,8})?$/.test(stakeAmount.trim()) && Number(stakeAmount) >= 1;
  const durationReady = /^[1-9]\d*$/.test(duration.trim()) && Number(duration) >= 30 && Number(duration) <= 3650;
  const formReady = partnerReady && titleReady && stakeReady && durationReady;
  const actionBusy = actionPhase !== "idle";
  const controlsLocked = isLoading || actionBusy || hasPendingAction;
  // An unnamed draft is an honest zero-state, not a pact called "Our covenant":
  // contractTitlePlaceholder is the *input* placeholder and reads as real data
  // once it is promoted into the preview heading.
  const pactTitle = contractTitle.trim() || latestContract?.title || t("pactPreviewUntitled");
  const pactPartner = partnerReady
    ? compact(partnerAddress)
    : latestContract?.partner
      ? compact(latestContract.partner)
      : t("pactPreviewPartner");

  const createHint = useMemo(() => {
    if (!partnerReady) return t("createHintPartner");
    if (!stakeReady) return t("createHintStake");
    if (!durationReady) return t("createHintDuration");
    if (!titleReady) return t("createHintTitle");
    return t("createHintReady");
  }, [durationReady, partnerReady, stakeReady, t, titleReady]);

  const handleCreate = async () => {
    if (!formReady || controlsLocked) return;
    const created = await dispatch("createContract", {
      partnerAddress: partnerAddress.trim(),
      stakeAmount: stakeAmount.trim(),
      duration: duration.trim(),
      title: contractTitle.trim(),
      terms: contractTerms.trim(),
    });
    if (created === true) {
      setPartnerAddress("");
      setStakeAmount("1");
      setDuration("30");
      setContractTitle("");
      setContractTerms("");
      setDrawerMode("contracts");
    }
  };

  const handleRefresh = () => {
    void dispatch("refreshContracts");
  };

  const scene = (
    <div className="breakup-scene" data-state={actionBusy ? actionPhase : formReady ? "ready" : "draft"}>
      <section className="breakup-preview" aria-label={t("pactPreview")}>
        <div className="breakup-preview__header">
          <span>{t("pactPreview")}</span>
          <strong>{pactTitle}</strong>
          {/* Caption labels the heading; it must never restate it. */}
          <small>{titleReady ? t("titleLabel") : t("pactPreviewTitleHint")}</small>
        </div>

        <div className="breakup-preview__partner" data-ready={partnerReady ? "true" : undefined}>
          <Handshake size={18} />
          <span>{t("partner")}</span>
          <strong>{pactPartner}</strong>
        </div>

        <div className="breakup-preview__terms">
          <p>{previewTerms}</p>
        </div>

        <div className="breakup-pact-console" aria-label={t("builderTitle")}>
          <div className="breakup-summary-grid" aria-label={t("builderStepStake")}>
            <div className="breakup-summary-card">
              <span><CoinArt size={18} variant="gas" decorative /> {t("stake")}</span>
              <strong>{stakeAmount} GAS</strong>
            </div>
            <div className="breakup-summary-card">
              <span><CalendarDays size={16} /> {t("duration")}</span>
              <strong>{duration} {t("daysSuffix")}</strong>
            </div>
            <div className="breakup-summary-card">
              <span><FileSignature size={16} /> {t("builderStepTerms")}</span>
              <strong>{contractTerms.trim() ? t("notesAdded") : t("localNotes")}</strong>
            </div>
          </div>
          <div className="breakup-status-card" data-ready={formReady ? "true" : undefined}>
            <ShieldCheck size={17} />
            <span>{t("walletAction")}</span>
            <strong>{formReady ? t("createHintReady") : createHint}</strong>
          </div>
        </div>

        <p className="breakup-preview__rule">
          <HeartCrack size={16} />
          {t("pactPreviewRule")}
        </p>
      </section>

      <section className="breakup-desk" aria-label={t("deskOnChainTitle")}>
        <div className="breakup-desk__media">
          <img className="breakup-desk__image" src={PACT_IMAGE} alt={t("heroImageAlt")} />
        </div>
        <span className="breakup-desk__chip"><Sparkles size={14} />{t("heroTagStakeBacked")}</span>
        {/*
          The desk is not a second copy of the preview: .breakup-preview above
          already owns the live draft (eyebrow, title, partner, terms, wallet
          action). This card answers the one question the draft cannot — which
          of those fields the contract actually records — so it must carry its
          own eyebrow and must not restate the title or the wallet-action hint.
        */}
        <div className="breakup-desk__pact" data-ready={formReady ? "true" : undefined}>
          <div>
            <span>{t("deskOnChainTitle")}</span>
            <p>{t("deskOnChainCopy")}</p>
          </div>
          <dl>
            <div>
              <dt>{t("partner")}</dt>
              <dd>{pactPartner}</dd>
            </div>
            <div>
              <dt>{t("stake")}</dt>
              <dd>{stakeAmount} GAS</dd>
            </div>
            <div>
              <dt>{t("duration")}</dt>
              <dd>{duration} {t("daysSuffix")}</dd>
            </div>
          </dl>
        </div>
        <div className="breakup-desk__signatures" aria-label={t("contractTitle")}>
          <span data-ready="true"><UserRoundCheck size={16} />{t("builderStepPartner")}</span>
          <span data-ready={formReady ? "true" : undefined}><FileSignature size={16} />{t("builderStepTerms")}</span>
        </div>
      </section>
    </div>
  );

  const drawer = (
    <div className="breakup-drawer">
      {(serviceNotice || actionNotice || pendingNotice || lastSubmittedTitle) && (
        <OpenUiNotice className="breakup-notices" icon={<Sparkles size={17} />} title={t("walletAction")}>
          {serviceNotice && <p>{serviceNotice}</p>}
          {actionNotice && <p>{actionNotice}</p>}
          {pendingNotice && <p>{pendingNotice}</p>}
          {lastSubmittedTitle && <p>{t("lastSubmittedContract", { title: lastSubmittedTitle })}</p>}
        </OpenUiNotice>
      )}

      <OpenUiSegmented
        className="breakup-drawer-tabs"
        label={t("builderTitle")}
        onChange={(value) => setDrawerMode(value === "contracts" ? "contracts" : "setup")}
        options={[
          { value: "setup", label: t("builderStepPartner") },
          { value: "contracts", label: t("contracts") },
        ]}
        value={drawerMode}
      />

      <div className="breakup-drawer__panel" data-mode={drawerMode}>
        {drawerMode === "setup" && (
          <OpenUiPanel
            className="breakup-drawer-panel breakup-drawer-editor"
            icon={<FileSignature size={16} />}
            title={t("pactDetails")}
            subtitle={t("partnerTermsOffChain")}
          >
            <div className="breakup-drawer-editor__grid">
              <OpenUiTextField
                className="breakup-field breakup-field--title"
                inputClassName="breakup-input--title"
                label={t("titleLabel")}
                value={contractTitle}
                onChange={(event) => setContractTitle(event.target.value)}
                placeholder={latestContract?.title || t("contractTitlePlaceholder")}
                maxLength={100}
              />
              <OpenUiTextField
                className="breakup-field breakup-field--partner"
                inputClassName="breakup-input--partner"
                label={t("partnerAddress")}
                value={partnerAddress}
                onChange={(event) => setPartnerAddress(event.target.value)}
                placeholder={latestContract?.partner ? compact(latestContract.partner) : t("partnerPlaceholder")}
              />
            </div>
            <div className="breakup-preset-board breakup-preset-board--drawer">
              <div className="breakup-preset-group" role="radiogroup" aria-label={t("stakeLabel")}>
                <span>{t("stakeLabel")}</span>
                <div>
                  {STAKE_PRESETS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      aria-checked={stakeAmount === amount}
                      role="radio"
                      className={stakeAmount === amount ? "is-selected" : undefined}
                      onClick={() => setStakeAmount(amount)}
                    >
                      <CoinArt size={18} variant="gas" decorative />
                      {amount} GAS
                    </button>
                  ))}
                </div>
              </div>
              <div className="breakup-preset-group" role="radiogroup" aria-label={t("durationLabel")}>
                <span>{t("durationLabel")}</span>
                <div>
                  {DURATION_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-checked={duration === days}
                      role="radio"
                      className={duration === days ? "is-selected" : undefined}
                      onClick={() => setDuration(days)}
                    >
                      <CalendarDays size={16} />
                      {days} {t("daysSuffix")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <details className="breakup-drawer-advanced">
              <summary>{t("advancedPactDetails")}</summary>
              <p>{t("advancedPactDetailsCopy")}</p>
              <div className="breakup-drawer-advanced__grid">
                <OpenUiTextField
                  className="breakup-field breakup-field--stake"
                  inputClassName="breakup-input--stake"
                  label={t("stakeLabel")}
                  value={stakeAmount}
                  onChange={(event) => setStakeAmount(event.target.value)}
                  placeholder={t("stakePlaceholder")}
                  inputMode="decimal"
                />
                <OpenUiTextField
                  className="breakup-field breakup-field--duration"
                  inputClassName="breakup-input--duration"
                  label={t("durationLabel")}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  placeholder={t("durationPlaceholder")}
                  inputMode="numeric"
                />
                <OpenUiTextArea
                  className="breakup-field breakup-field--terms mx2-open-field--compact"
                  textareaClassName="breakup-input--terms"
                  label={t("termsLabel")}
                  value={contractTerms}
                  onChange={(event) => setContractTerms(event.target.value)}
                  placeholder={t("contractTermsPlaceholder")}
                  maxLength={2000}
                  rows={3}
                />
              </div>
            </details>
          </OpenUiPanel>
        )}

        {drawerMode === "contracts" && (
          <div className="breakup-contracts-panel">
            {hasCredit && (
              <OpenUiPanel
                className="breakup-drawer-panel breakup-credit"
                icon={<WalletCards size={16} />}
                title={t("creditRecoveryTitle")}
                subtitle={`${creditBalance} GAS`}
              >
                <p>{t("creditRecoveryCopy")}</p>
                <button type="button" disabled={controlsLocked} onClick={() => void dispatch("withdrawCredit")}>{t("recoverCredit")}</button>
              </OpenUiPanel>
            )}
            {walletAddress && !creditKnown && (
              <OpenUiNotice className="breakup-notices" icon={<WalletCards size={16} />} title={t("creditUnknownTitle")}>
                <p>{t("creditUnknownCopy")}</p>
              </OpenUiNotice>
            )}

            <OpenUiPanel
              className="breakup-drawer-panel breakup-contract-list"
              icon={<FileSignature size={16} />}
              title={t("contracts")}
              subtitle={`${contractCount} ${t("contracts")}`}
            >
              <div className="breakup-drawer__head">
                <button type="button" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw size={14} />
                  {t("refreshRecords")}
                </button>
              </div>

              {contracts.length > 0 ? (
                <ul className="breakup-contracts">
                  {contracts.slice(0, 10).map((contract) => (
                    <li key={contract.pactId || contract.id} className="breakup-contract" data-tone={statusTone(contract.status)}>
                      <div className="breakup-contract__main">
                        <span className="breakup-contract__icon"><FileSignature size={17} /></span>
                        <span>
                          <strong>{contract.title || t("untitledContract")}</strong>
                          <em>#{contract.pactId || contract.id} · {t(contract.status || "pending")}</em>
                        </span>
                      </div>

                      <div className="breakup-contract__meta">
                        <span>{t("stake")}: <strong>{contract.stake} GAS</strong></span>
                        <span>{t("partner")}: <strong>{compact(contract.partner || contract.party2)}</strong></span>
                        {contract.status === "active" && (
                          <span>{t("duration")}: <strong>{contract.settleable ? t("readyToSettle") : t("daysRemaining", { count: contract.daysLeft })}</strong></span>
                        )}
                      </div>

                      <div className="breakup-contract__actions">
                        {contract.status === "pending" && (
                          <>
                            {contract.isPartner && <button type="button" disabled={controlsLocked} onClick={() => void dispatch("signContract", contract)}>{t("signContract")}</button>}
                            {contract.isCreator && <button type="button" disabled={controlsLocked} onClick={() => void dispatch("cancelContract", contract)}>{t("cancelContract")}</button>}
                          </>
                        )}
                        {contract.status === "active" && (
                          contract.settleable
                            ? <button type="button" disabled={controlsLocked} onClick={() => void dispatch("settleContract", contract)}>{t("settleContract")}</button>
                            : <button type="button" disabled={controlsLocked} onClick={() => void dispatch("breakContract", contract)}>{t("breakContract")}</button>
                        )}
                        {contract.status !== "pending" && contract.status !== "active" && (
                          <span className="breakup-contract__closed"><XCircle size={14} />{t(contract.status || "ended")}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="breakup-empty">
                  <FileSignature size={18} />
                  <strong>{t("noContracts")}</strong>
                  <span>{t("noContractsHint")}</span>
                </div>
              )}
            </OpenUiPanel>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="breakup-contract-play-area mx2 mx2-cat-social">
      <PlayStage
        category="social"
        stage={{
          eyebrow: t("contractTitle"),
          title: t("title"),
          subtitle: t("docSubtitle"),
          badges: (
            <>
              <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {contractCount} {t("contracts")}</span>
              <span className="mx2-badge">{activeCount} {t("active")}</span>
            </>
          ),
        }}
        scene={scene}
        actions={{
          primary: {
            label: hasPendingAction ? t("checkPendingAction") : actionBusy ? t("preparingWallet") : t("createContract"),
            onClick: hasPendingAction ? handleRefresh : handleCreate,
            loading: actionBusy || (hasPendingAction && isLoading),
            disabled: hasPendingAction ? actionBusy || isLoading : controlsLocked || !formReady,
            icon: hasPendingAction ? <RefreshCw size={17} /> : <BadgeCheck size={17} />,
            hint: hasPendingAction ? t("checkPendingHint") : createHint,
          },
        }}
        drawerToggleLabel={t("builderTitle")}
        drawer={{ title: t("builderTitle"), children: drawer }}
      />
    </div>
  );
}
