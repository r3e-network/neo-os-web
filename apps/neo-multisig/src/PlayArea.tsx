import { useMemo, useState } from "react";
import {
  NeoButton,
  NeoCard,
  NeoInput,
} from "@shared/components-react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileSignature,
  HandCoins,
  History,
  KeyRound,
  Plus,
  ShieldCheck,
  Signature,
  Users,
  Vault,
  X,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { parseHash160, ownerMatchesAddress } from "@shared/utils/neo";
import { useMultisigUI } from "./composables/useMultisigUI";
import type { HistoryItem } from "./composables/useMultisigHistory";
import {
  fromBaseUnits,
  isValidAddress,
  isValidAmount,
  MAX_SIGNERS,
  MIN_SIGNERS,
  toBaseUnits,
  type RequestView,
  type VaultAsset,
  type VaultView,
} from "./utils/vault";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

/** v2: why a request auto-cancelled (vault underfunded at threshold). */
interface UnfundedNotice {
  requestId: number;
  required: string;
  available: string;
  asset: string;
}

/** Default signer slots on first paint (a common 2-of-3 board). */
const INITIAL_SIGNER_SLOTS = 3;

interface AssetChoiceGroupProps {
  label: string;
  value: VaultAsset;
  onChange: (value: VaultAsset) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function AssetChoiceGroup({ label, value, onChange, t }: AssetChoiceGroupProps) {
  const choices: Array<{ value: VaultAsset; label: string; hint: string }> = [
    { value: "GAS", label: t("assetGas"), hint: t("multisigGasAssetHint") },
    { value: "NEO", label: t("assetNeo"), hint: t("multisigNeoAssetHint") },
  ];

  return (
    <fieldset className="multisig-asset-toggle" aria-label={label}>
      <legend>{label}</legend>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={
            "multisig-asset-toggle__option" +
            (value === choice.value ? " is-active" : "")
          }
          aria-pressed={value === choice.value}
          onClick={() => onChange(choice.value)}
        >
          <strong>{choice.label}</strong>
          <span>{choice.hint}</span>
        </button>
      ))}
    </fieldset>
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const { statusLabel, shorten, formatDate } = useMultisigUI();

  // Create-vault form. The signer list is DYNAMIC: rows can be added up to the
  // contract's MAX_SIGNERS (16) and removed down to MIN_SIGNERS (2), so common
  // 3-of-4 / 4-of-5 boards are configurable (the old fixed 3-slot grid capped
  // every vault at 3 signers).
  const [signers, setSigners] = useState(() =>
    Array.from({ length: INITIAL_SIGNER_SLOTS }, () => ""),
  );
  const [threshold, setThreshold] = useState("2");
  const [copiedRequestId, setCopiedRequestId] = useState(false);

  // Deposit + propose form
  const [depositAsset, setDepositAsset] = useState<VaultAsset>("GAS");
  const [depositAmount, setDepositAmount] = useState("");
  const [spendAsset, setSpendAsset] = useState<VaultAsset>("GAS");
  const [recipient, setRecipient] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [memo, setMemo] = useState("");

  // Load forms
  const [loadVaultId, setLoadVaultId] = useState("");
  const [loadRequestId, setLoadRequestId] = useState("");

  const history = (state.history?.get() ?? []) as HistoryItem[];
  const activeVault = val<VaultView>("activeVault");
  const activeRequest = val<RequestView>("activeRequest");
  const unfundedNotice = val<UnfundedNotice>("unfundedNotice");
  const connectedAddress = str("connectedAddress");
  const connectedIsSigner = bool("connectedIsSigner");
  const connectedHasApproved = bool("connectedHasApproved");
  const isCreatingVault = bool("isCreatingVault");
  const isDepositing = bool("isDepositing");
  const isProposing = bool("isProposing");
  const isApproving = bool("isApproving");
  const isCancelling = bool("isCancelling");

  const normalizedSigners = useMemo(
    () => signers.map((signer) => signer.trim()).filter(Boolean),
    [signers],
  );
  const thresholdNumber = Math.max(1, Math.floor(Number(threshold) || 0));
  const signerDenominator = Math.max(normalizedSigners.length, MIN_SIGNERS);

  // Vault id used by the deposit/propose forms. These forms only render once a
  // vault is loaded into state (the `activeVault` block), so the working id is
  // simply the active vault's id — populated by createVault, loadVault, or the
  // history "load" path.
  const workingVaultId = activeVault?.id ?? 0;

  const createBlockedReason = useMemo(() => {
    if (normalizedSigners.length < MIN_SIGNERS) return t("multisigNeedSigners");
    if (normalizedSigners.length > MAX_SIGNERS) return t("multisigTooManySigners");
    if (normalizedSigners.some((signer) => !isValidAddress(signer))) {
      return t("multisigInvalidSignerAddress");
    }
    if (new Set(normalizedSigners).size !== normalizedSigners.length) {
      return t("multisigDuplicateSigners");
    }
    if (thresholdNumber > normalizedSigners.length) {
      return t("multisigThresholdBlocked");
    }
    return "";
  }, [normalizedSigners, t, thresholdNumber]);
  const canCreateVault = !createBlockedReason && !isCreatingVault;

  const thresholdOptions = useMemo(
    () =>
      Array.from({ length: Math.max(signerDenominator, 1) }, (_, index) => ({
        value: String(index + 1),
        label: String(index + 1),
      })),
    [signerDenominator],
  );

  const canDeposit =
    workingVaultId > 0 &&
    isValidAmount(depositAmount.trim(), depositAsset) &&
    !isDepositing;

  // Pre-flight insufficient-balance guard: when the entered spend is a valid
  // amount but exceeds the vault's on-chain balance for the chosen asset, block
  // the proposal up front instead of surfacing a post-invoke error toast. Both
  // sides are compared in BASE UNITS (GAS 1e8 / NEO integer) via BigInt.
  const spendExceedsBalance = useMemo(() => {
    if (!activeVault) return false;
    const trimmed = spendAmount.trim();
    if (!isValidAmount(trimmed, spendAsset)) return false;
    try {
      const requested = BigInt(toBaseUnits(trimmed, spendAsset));
      const available = BigInt(
        spendAsset === "NEO"
          ? activeVault.neoBalance
          : activeVault.gasBalance,
      );
      return requested > available;
    } catch {
      return false;
    }
  }, [activeVault, spendAmount, spendAsset]);

  const canPropose =
    workingVaultId > 0 &&
    isValidAddress(recipient.trim()) &&
    isValidAmount(spendAmount.trim(), spendAsset) &&
    !spendExceedsBalance &&
    !isProposing;

  const requestPending = activeRequest?.status === "pending";
  // Approve/Cancel are membership-gated: only a vault signer may call them, and
  // a signer who already approved cannot approve again — both would otherwise
  // revert on-chain with a raw assert. hasApproved/connectedIsSigner are read
  // back from the contract when a request/vault loads.
  const canApprove =
    !!activeRequest &&
    requestPending &&
    connectedIsSigner &&
    !connectedHasApproved &&
    !isApproving;
  // v2 contract: ANY vault signer may cancel a pending request (previously
  // creator-only) — still gated to signers (a non-signer cancel reverts).
  const canCancel =
    !!activeRequest && requestPending && connectedIsSigner && !isCancelling;

  // Reason shown under the action row when Approve is blocked for a gating
  // reason (not merely a busy/non-pending state).
  const approveBlockedReason =
    activeRequest && requestPending && connectedAddress
      ? !connectedIsSigner
        ? t("multisigNotSignerHint")
        : connectedHasApproved
          ? t("multisigAlreadyApprovedHint")
          : ""
      : "";
  // v2: a threshold approval that found the vault underfunded auto-cancelled
  // the request — explain that instead of leaving a bare "Cancelled" status.
  const showUnfundedNotice =
    !!activeRequest &&
    activeRequest.status === "cancelled" &&
    unfundedNotice?.requestId === activeRequest.id;

  const vaultGas = activeVault ? fromBaseUnits(activeVault.gasBalance, "GAS") : "0";
  const vaultNeo = activeVault ? fromBaseUnits(activeVault.neoBalance, "NEO") : "0";
  const requestAmount = activeRequest
    ? fromBaseUnits(
        activeRequest.amount,
        activeRequest.assetSymbol === "NEO" ? "NEO" : "GAS",
      )
    : "0";

  function updateSigner(index: number, value: string) {
    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? value : signer,
      ),
    );
  }

  // Dynamic signer slots: add up to MAX_SIGNERS (16), remove down to
  // MIN_SIGNERS (2) so any M-of-N board the contract supports is configurable.
  const canAddSigner = signers.length < MAX_SIGNERS;
  const canRemoveSigner = signers.length > MIN_SIGNERS;
  function addSigner() {
    setSigners((current) =>
      current.length < MAX_SIGNERS ? [...current, ""] : current,
    );
  }
  function removeSigner(index: number) {
    setSigners((current) =>
      current.length > MIN_SIGNERS
        ? current.filter((_, signerIndex) => signerIndex !== index)
        : current,
    );
  }

  async function copyRequestId() {
    if (!activeRequest) return;
    try {
      await navigator.clipboard?.writeText(String(activeRequest.id));
      setCopiedRequestId(true);
      window.setTimeout(() => setCopiedRequestId(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions/insecure context); the id is
      // still visible for manual copy, so silently ignore.
    }
  }

  function createVault() {
    return dispatch("createVault", {
      signers: normalizedSigners,
      threshold: thresholdNumber,
    });
  }

  function deposit() {
    return dispatch("deposit", {
      vaultId: workingVaultId,
      asset: depositAsset,
      amount: depositAmount.trim(),
    });
  }

  function propose() {
    return dispatch("proposeRequest", {
      vaultId: workingVaultId,
      asset: spendAsset,
      recipient: recipient.trim(),
      amount: spendAmount.trim(),
      memo: memo.trim(),
    });
  }

  const heroBalanceLabel = activeVault
    ? `${vaultGas} GAS · ${vaultNeo} NEO`
    : t("multisigDraftState");
  const heroQuorumLabel = activeVault
    ? `${activeVault.threshold} / ${activeVault.signers.length}`
    : `${thresholdNumber} / ${signerDenominator}`;
  const heroRequestLabel = activeRequest
    ? statusLabel(activeRequest.status)
    : t("multisigDraftState");
  const approvalTarget = activeVault?.threshold ?? thresholdNumber;
  const approvalCount = activeRequest?.approvalCount ?? 0;
  const approvalPercent = Math.min(
    100,
    Math.max(0, approvalTarget > 0 ? (approvalCount / approvalTarget) * 100 : 0),
  );
  const proposalAmountLabel = activeRequest
    ? `${requestAmount} ${activeRequest.assetSymbol}`
    : spendAmount.trim()
      ? `${spendAmount.trim()} ${spendAsset}`
      : t("multisigAmountPreview");
  const proposalRecipientLabel = activeRequest
    ? shorten(activeRequest.recipient)
    : recipient.trim()
      ? shorten(recipient.trim())
      : t("multisigRecipientPreview");
  const signerBoard = activeVault?.signers.length
    ? activeVault.signers.map((signer, index) => ({
        id: signer,
        label: shorten(parseHash160(signer) || signer),
        status:
          activeRequest && index < activeRequest.approvalCount
            ? t("multisigSignerApproved")
            : t("multisigSignerWaiting"),
        isApproved: !!activeRequest && index < activeRequest.approvalCount,
        isYou: ownerMatchesAddress(signer, connectedAddress),
      }))
    : signers.map((signer, index) => ({
        id: `${index}:${signer}`,
        label: signer.trim() ? shorten(signer.trim()) : `${t("signerLabel")} ${index + 1}`,
        status: signer.trim() ? t("multisigSignerDraft") : t("multisigSignerWaiting"),
        isApproved: false,
        isYou: false,
      }));

  return (
    <div className="multisig-play-area">
      <div className="multisig-shell">
        <section className="multisig-main" aria-label={t("multisigHeroTitle")}>
          <div className="multisig-hero">
            <img
              className="multisig-hero__image"
              src="./multisig-vault-stage.jpg"
              alt=""
              aria-hidden="true"
            />
            <div className="multisig-hero__shade" aria-hidden="true" />
            <div className="multisig-hero__copy">
              <span className="multisig-hero-accent" aria-hidden="true">
                <ShieldCheck size={22} />
              </span>
              <div>
                <span className="multisig-hero-eyebrow">{t("multisigHeroEyebrow")}</span>
                <h2>{t("multisigHeroTitle")}</h2>
                <p>{t("multisigHeroSubtitle")}</p>
                <div className="multisig-hero-flow" aria-label={t("multisigRouteTitle")}>
                  <span>
                    <Vault size={14} />
                    {t("buttonCreateVault")}
                  </span>
                  <span>
                    <HandCoins size={14} />
                    {t("buttonPropose")}
                  </span>
                  <span>
                    <Signature size={14} />
                    {t("buttonApprove")}
                  </span>
                </div>
              </div>
            </div>
            <div className="multisig-hero__glass" aria-label={t("multisigHeroSnapshot")}>
              <div className="multisig-hero__vault-card">
                <span>{t("multisigQuorumTitle")}</span>
                <strong>{heroQuorumLabel}</strong>
                <small>{heroBalanceLabel}</small>
              </div>
              <div className="multisig-hero__proposal-card">
                <span>{t("multisigRequestStatusTitle")}</span>
                <strong>{heroRequestLabel}</strong>
                <small>
                  {connectedAddress
                    ? `${t("multisigConnectedAs")}: ${shorten(connectedAddress)}`
                    : t("multisigNotConnected")}
                </small>
              </div>
            </div>
          </div>

          <div className="multisig-workspace">
            <NeoCard variant="erobo" className="multisig-request-panel">
              {/* Step 1 — create a custody vault from signer addresses */}
              <div className="multisig-section-heading">
                <span>{t("multisigVaultTitle")}</span>
                <strong>{t("multisigStepCreate")}</strong>
              </div>
              <p>{t("multisigVaultCopy")}</p>

              <section className="multisig-board" aria-label={t("multisigBoardTitle")}>
                <div className="multisig-board__head">
                  <div>
                    <span>{t("multisigBoardTitle")}</span>
                    <strong>{heroQuorumLabel}</strong>
                  </div>
                  <div className="multisig-board__progress" aria-hidden="true">
                    <span style={{ width: `${approvalPercent}%` }} />
                  </div>
                </div>
                <div className="multisig-board__signers">
                  {signerBoard.map((signer, index) => (
                    <div
                      key={signer.id}
                      className={
                        "multisig-board__signer" +
                        (signer.isApproved ? " is-approved" : "") +
                        (signer.isYou ? " is-you" : "")
                      }
                    >
                      <span className="multisig-board__seal" aria-hidden="true">
                        {signer.isApproved ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <KeyRound size={18} />
                        )}
                      </span>
                      <div>
                        <strong>{signer.label}</strong>
                        <small>
                          {signer.isYou
                            ? t("multisigYouBadge")
                            : signer.status || `${t("signerLabel")} ${index + 1}`}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className="multisig-proposal-preview multisig-proposal-preview--draft"
                aria-label={t("multisigProposalPreview")}
              >
                <div className="multisig-proposal-preview__art" aria-hidden="true" />
                <div className="multisig-proposal-preview__copy">
                  <span>{t("multisigProposalPreview")}</span>
                  <strong>{proposalAmountLabel}</strong>
                  <div>
                    <small>{proposalRecipientLabel}</small>
                    <ArrowRight size={14} />
                    <small>{t("multisigRouteBroadcast")}</small>
                  </div>
                </div>
              </section>

              <div className="multisig-create-console">
                <div className="multisig-signer-grid" aria-label={t("ariaSigners")}>
                  {signers.map((signer, index) => {
                    // Hide the × on the minimum required rows while they're still
                    // empty so a blank first-paint form isn't cluttered with
                    // no-op remove affordances; keep it on populated rows and on
                    // any extra rows beyond the minimum (which are removable).
                    const showRemove =
                      canRemoveSigner &&
                      (signer.trim().length > 0 || index >= MIN_SIGNERS);
                    return (
                      <div className="multisig-signer-row" key={index}>
                        <NeoInput
                          value={signer}
                          label={`${t("signerLabel")} ${index + 1}`}
                          placeholder={t("signerPlaceholder")}
                          onChange={(value) => updateSigner(index, value)}
                        />
                        {showRemove && (
                          <button
                            type="button"
                            className="multisig-signer-remove"
                            aria-label={t("multisigRemoveSigner")}
                            onClick={() => removeSigner(index)}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {canAddSigner && (
                    <button
                      type="button"
                      className="multisig-signer-add"
                      onClick={addSigner}
                    >
                      <Plus size={15} />
                      {t("multisigAddSigner")}
                    </button>
                  )}
                </div>

                <section
                  className="multisig-threshold-panel"
                  aria-label={t("thresholdLabel")}
                >
                  <div className="multisig-threshold-panel__head">
                    <span>{t("thresholdLabel")}</span>
                    <strong>
                      {thresholdNumber} / {signerDenominator}
                    </strong>
                  </div>
                  <div className="multisig-threshold-chips">
                    {thresholdOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={
                          "multisig-threshold-chip" +
                          (threshold === option.value ? " is-active" : "")
                        }
                        aria-pressed={threshold === option.value}
                        onClick={() => setThreshold(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {createBlockedReason ? (
                <p className="multisig-request-hint multisig-request-hint--guide">
                  {createBlockedReason}
                </p>
              ) : (
                <p className="multisig-request-hint is-ready">
                  {t("multisigCreateReady")}
                </p>
              )}

              <div className="multisig-primary-actions">
                <NeoButton
                  variant="primary"
                  loading={isCreatingVault}
                  disabled={!canCreateVault}
                  onClick={createVault}
                >
                  <Vault size={16} />
                  {t("buttonCreateVault")}
                </NeoButton>
              </div>

              {activeVault && (
                <>
                  <div className="multisig-receipt" aria-live="polite">
                    <span>{t("multisigVaultIdLabel")}</span>
                    <strong>#{activeVault.id}</strong>
                    <em>{t("multisigVaultReceiptCopy")}</em>
                  </div>

                  {/* Step 2 — deposit into the vault */}
                  <div className="multisig-section-heading">
                    <span>{t("multisigDepositTitle")}</span>
                    <strong>{t("multisigStepDeposit")}</strong>
                  </div>
                  <p>{t("multisigDepositCopy")}</p>
                  <div className="multisig-transfer-console">
                    <div className="multisig-amount-panel">
                      <NeoInput
                        value={depositAmount}
                        label={t("amountLabel")}
                        placeholder={t("amountPlaceholder")}
                        suffix={depositAsset}
                        onChange={setDepositAmount}
                      />
                    </div>
                    <AssetChoiceGroup
                      label={t("assetLabel")}
                      value={depositAsset}
                      onChange={setDepositAsset}
                      t={t}
                    />
                  </div>
                  <div className="multisig-primary-actions">
                    <NeoButton
                      variant="primary"
                      loading={isDepositing}
                      disabled={!canDeposit}
                      onClick={deposit}
                    >
                      <HandCoins size={16} />
                      {t("buttonDeposit")}
                    </NeoButton>
                  </div>

                  {/* Step 3 — propose a spend */}
                  <div className="multisig-section-heading">
                    <span>{t("multisigProposeTitle")}</span>
                    <strong>{t("multisigStepPropose")}</strong>
                  </div>
                  <p>{t("multisigProposeCopy")}</p>
                  <section className="multisig-proposal-preview" aria-label={t("multisigProposalPreview")}>
                    <div className="multisig-proposal-preview__art" aria-hidden="true" />
                    <div className="multisig-proposal-preview__copy">
                      <span>{t("multisigProposalPreview")}</span>
                      <strong>{proposalAmountLabel}</strong>
                      <div>
                        <small>{proposalRecipientLabel}</small>
                        <ArrowRight size={14} />
                        <small>{t("multisigRouteBroadcast")}</small>
                      </div>
                    </div>
                  </section>
                  <div className="multisig-spend-console">
                    <div className="multisig-recipient-panel">
                      <NeoInput
                        value={recipient}
                        label={t("toAddressLabel")}
                        placeholder={t("toAddressPlaceholder")}
                        onChange={setRecipient}
                      />
                    </div>
                    <div className="multisig-transfer-console">
                      <div className="multisig-amount-panel">
                        <NeoInput
                          value={spendAmount}
                          label={t("amountLabel")}
                          placeholder={t("amountPlaceholder")}
                          suffix={spendAsset}
                          onChange={setSpendAmount}
                        />
                      </div>
                      <AssetChoiceGroup
                        label={t("assetLabel")}
                        value={spendAsset}
                        onChange={setSpendAsset}
                        t={t}
                      />
                    </div>
                    <details
                      className="multisig-memo-drawer"
                      open={memo.trim().length > 0}
                    >
                      <summary>
                        <span>{t("multisigMemoDetails")}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <NeoInput
                        value={memo}
                        type="textarea"
                        label={t("memoLabel")}
                        placeholder={t("memoPlaceholder")}
                        onChange={setMemo}
                      />
                    </details>
                  </div>
                  {spendExceedsBalance && (
                    <p className="multisig-request-hint" aria-live="polite">
                      {t("multisigInsufficientBalance", {
                        balance:
                          spendAsset === "NEO" ? vaultNeo : vaultGas,
                        asset: spendAsset,
                      })}
                    </p>
                  )}
                  {/* Pooled-balance disclosure: a proposal doesn't reserve
                      funds, so two pending requests can race the same balance. */}
                  <p className="multisig-request-hint multisig-request-hint--info">
                    {t("multisigPooledBalanceNote")}
                  </p>
                  <div className="multisig-primary-actions">
                    <NeoButton
                      variant="primary"
                      loading={isProposing}
                      disabled={!canPropose}
                      onClick={propose}
                    >
                      <FileSignature size={16} />
                      {t("buttonPropose")}
                    </NeoButton>
                  </div>
                </>
              )}

              {/* Step 4 — approve / cancel a loaded request. The request is
                  loaded via the "Load vault or request" disclosure in the aside,
                  so the create card ends cleanly on its own step sequence. */}
              {activeRequest && (
                <>
                  <div className="multisig-request-id-row" aria-live="polite">
                    <span>{t("multisigRequestIdLabel")}</span>
                    <strong>#{activeRequest.id}</strong>
                    <button
                      type="button"
                      className="multisig-copy-btn"
                      onClick={copyRequestId}
                    >
                      <Copy size={13} />
                      {copiedRequestId ? t("multisigCopied") : t("multisigCopy")}
                    </button>
                  </div>
                  <p className="multisig-request-hint">
                    {t("multisigShareRequestId")}
                  </p>

                  <section className="multisig-approval-card" aria-label={t("multisigApprovalBoard")}>
                    <div className="multisig-approval-card__head">
                      <span>{t("multisigApprovalBoard")}</span>
                      <strong>
                        {activeRequest.approvalCount} / {activeVault?.threshold ?? "?"}
                      </strong>
                    </div>
                    <div className="multisig-approval-card__track" aria-hidden="true">
                      <span style={{ width: `${approvalPercent}%` }} />
                    </div>
                    <div className="multisig-approval-card__route">
                      <span>
                        <FileSignature size={15} />
                        #{activeRequest.id}
                      </span>
                      <ArrowRight size={15} />
                      <span>
                        <Banknote size={15} />
                        {requestAmount} {activeRequest.assetSymbol}
                      </span>
                    </div>
                  </section>

                  <div className="multisig-request-details">
                    <div>
                      <span>{t("statusLabel")}</span>
                      <strong>{statusLabel(activeRequest.status)}</strong>
                    </div>
                    <div>
                      <span>{t("reviewAmount")}</span>
                      <strong>
                        {requestAmount} {activeRequest.assetSymbol}
                      </strong>
                    </div>
                    <div>
                      <span>{t("reviewSigners")}</span>
                      <strong>
                        {activeRequest.approvalCount} /{" "}
                        {activeVault?.threshold ?? "?"}
                      </strong>
                    </div>
                    <div>
                      <span>{t("reviewTo")}</span>
                      <strong>{shorten(activeRequest.recipient)}</strong>
                    </div>
                  </div>

                  <p className="multisig-request-hint" aria-live="polite">
                    {t("approvalProgress", {
                      count: activeRequest.approvalCount,
                      total: activeVault?.threshold ?? 0,
                    })}
                  </p>

                  {showUnfundedNotice && unfundedNotice && (
                    <p
                      className="multisig-request-hint multisig-request-hint--unfunded"
                      aria-live="polite"
                    >
                      {t("multisigUnfundedNotice", {
                        required: unfundedNotice.required,
                        available: unfundedNotice.available,
                        asset: unfundedNotice.asset,
                      })}
                    </p>
                  )}

                  {approveBlockedReason && (
                    <p className="multisig-request-hint" aria-live="polite">
                      {approveBlockedReason}
                    </p>
                  )}

                  <div className="multisig-primary-actions multisig-primary-actions--row">
                    <NeoButton
                      variant="primary"
                      loading={isApproving}
                      disabled={!canApprove}
                      onClick={() =>
                        dispatch("approveRequest", activeRequest.id)
                      }
                    >
                      <BadgeCheck size={16} />
                      {isApproving ? t("buttonApproving") : t("buttonApprove")}
                    </NeoButton>
                    <NeoButton
                      variant="secondary"
                      loading={isCancelling}
                      disabled={!canCancel}
                      onClick={() =>
                        dispatch("cancelRequest", activeRequest.id)
                      }
                    >
                      {isCancelling ? t("buttonCancelling") : t("buttonCancel")}
                    </NeoButton>
                  </div>
                </>
              )}
            </NeoCard>

            <div className="multisig-aside">
              <NeoCard variant="erobo" className="multisig-signer-panel">
                <div className="multisig-section-heading">
                  <span>
                    <Users size={17} />
                    {t("multisigSignerTitle")}
                  </span>
                  <strong>{t("multisigSignerList")}</strong>
                </div>
                <p>{t("multisigSignerCopy")}</p>
                <div className="multisig-signal-row">
                  <span>{t("reviewSigners")}</span>
                  <strong>
                    {activeVault?.signers.length ?? normalizedSigners.length}
                  </strong>
                </div>
                <div className="multisig-signal-row">
                  <span>{t("thresholdLabel")}</span>
                  <strong>{heroQuorumLabel}</strong>
                </div>
                {activeVault && (
                  <>
                    {/* Signer roster: the vault loads the signers as UInt160
                        chain values — render each as its display-order 0x hash
                        and flag the connected wallet so a signer can confirm
                        their own membership at a glance. */}
                    {activeVault.signers.length > 0 && (
                      <div className="multisig-roster" aria-label={t("multisigSignerRoster")}>
                        <span className="multisig-roster-title">
                          {t("multisigSignerRoster")}
                        </span>
                        {activeVault.signers.map((signer, index) => {
                          const isYou = ownerMatchesAddress(signer, connectedAddress);
                          const display = parseHash160(signer) || signer;
                          return (
                            <div
                              key={`${signer}:${index}`}
                              className={
                                "multisig-roster-row" + (isYou ? " is-you" : "")
                              }
                            >
                              <span className="multisig-roster-hash">
                                {shorten(display)}
                              </span>
                              {isYou && (
                                <span className="multisig-roster-you">
                                  {t("multisigYouBadge")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="multisig-signal-row">
                      <span>{t("assetGas")}</span>
                      <strong>{vaultGas}</strong>
                    </div>
                    <div className="multisig-signal-row">
                      <span>{t("assetNeo")}</span>
                      <strong>{vaultNeo}</strong>
                    </div>
                  </>
                )}
              </NeoCard>

              <NeoCard variant="erobo" className="multisig-activity-panel">
                <div className="multisig-section-heading">
                  <span>
                    <History size={17} />
                    {t("recentTitle")}
                  </span>
                  {history.length > 0 && <strong>{history.length}</strong>}
                </div>
                {history.length === 0 ? (
                  <p className="multisig-empty-line">{t("recentEmpty")}</p>
                ) : (
                  <div className="multisig-history-list">
                    {history.map((item) => (
                      <button
                        key={`${item.kind}:${item.id}`}
                        type="button"
                        className="multisig-history-card"
                        onClick={() =>
                          dispatch(
                            item.kind === "vault" ? "loadVault" : "loadRequest",
                            item.id,
                          )
                        }
                      >
                        <span>{item.label}</span>
                        <strong>
                          {item.kind === "vault"
                            ? t("multisigVaultBadge")
                            : statusLabel(item.status ?? "pending")}
                        </strong>
                        <em>{formatDate(item.createdAt)}</em>
                      </button>
                    ))}
                  </div>
                )}
              </NeoCard>

              {/* Secondary entry path: a co-signer who receives a vault/request
                  ID loads it here. Kept below Recent Activity since the primary
                  flow is the create card on the left. */}
              <NeoCard variant="erobo" className="multisig-load-panel">
                <div className="multisig-section-heading">
                  <span>
                    <KeyRound size={17} />
                    {t("multisigLoadTitle")}
                  </span>
                  <strong>{t("multisigNetworkValue")}</strong>
                </div>
                <p>{t("multisigLoadCopy")}</p>
                <div className="multisig-load-box">
                  <NeoInput
                    value={loadVaultId}
                    type="number"
                    label={t("loadVaultTitle")}
                    placeholder={t("loadVaultPlaceholder")}
                    onChange={setLoadVaultId}
                  />
                  <NeoButton
                    variant="secondary"
                    className="multisig-load-btn"
                    disabled={!loadVaultId.trim()}
                    onClick={() => dispatch("loadVault", loadVaultId.trim())}
                  >
                    <ArrowRight size={15} />
                    {t("loadButton")}
                  </NeoButton>
                </div>
                <div className="multisig-load-box">
                  <NeoInput
                    value={loadRequestId}
                    type="number"
                    label={t("loadRequestTitle")}
                    placeholder={t("loadRequestPlaceholder")}
                    onChange={setLoadRequestId}
                  />
                  <NeoButton
                    variant="secondary"
                    className="multisig-load-btn"
                    disabled={!loadRequestId.trim()}
                    onClick={() => dispatch("loadRequest", loadRequestId.trim())}
                  >
                    <ArrowRight size={15} />
                    {t("loadButton")}
                  </NeoButton>
                </div>

                {/* Pure reference: the create -> propose -> approve glossary is
                    collapsed behind a disclosure so it stays out of the resting
                    fold until a user wants the walkthrough. */}
                <details className="multisig-route-details">
                  <summary>
                    <span>{t("multisigRouteTitle")}</span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <p>{t("multisigRouteCopy")}</p>
                  <div className="multisig-signal-row">
                    <span>{t("buttonCreateVault")}</span>
                    <strong>{t("multisigRouteCreate")}</strong>
                  </div>
                  <div className="multisig-signal-row">
                    <span>{t("buttonPropose")}</span>
                    <strong>{t("multisigRouteSign")}</strong>
                  </div>
                  <div className="multisig-signal-row">
                    <span>{t("buttonApprove")}</span>
                    <strong>{t("multisigRouteBroadcast")}</strong>
                  </div>
                </details>
              </NeoCard>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
