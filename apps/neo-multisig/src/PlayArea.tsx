import { useMemo, useState } from "react";
import {
  NeoButton,
  NeoCard,
  NeoInput,
  NeoSelect,
} from "@shared/components-react";
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

  return (
    <div className="multisig-play-area">
      <div className="multisig-shell">
        <section className="multisig-main" aria-label={t("multisigHeroTitle")}>
          <div className="multisig-hero">
            <span className="multisig-hero-accent" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path
                  d="M12 2.5 19.5 6v6c0 4.4-3.2 7.8-7.5 9.5C7.7 19.8 4.5 16.4 4.5 12V6L12 2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="m8.6 12 2.3 2.3 4.5-4.6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="multisig-hero-eyebrow">{t("multisigHeroEyebrow")}</span>
            <h2>{t("multisigHeroTitle")}</h2>
            <p>{t("multisigHeroSubtitle")}</p>
            <div className="multisig-hero-facts">
              <span className="multisig-hero-tile">
                <small>{t("multisigQuorumTitle")}</small>
                <strong>{heroQuorumLabel}</strong>
              </span>
              <span className="multisig-hero-tile">
                <small>{t("multisigBalanceTitle")}</small>
                <strong>{heroBalanceLabel}</strong>
              </span>
              <span className="multisig-hero-tile">
                <small>{t("multisigRequestStatusTitle")}</small>
                <strong>{heroRequestLabel}</strong>
              </span>
            </div>
            <p className="multisig-hero-connected">
              {connectedAddress
                ? `${t("multisigConnectedAs")}: ${shorten(connectedAddress)}`
                : t("multisigNotConnected")}
            </p>
          </div>

          <div className="multisig-workspace">
            <NeoCard variant="erobo" className="multisig-request-panel">
              {/* Step 1 — create a custody vault from signer addresses */}
              <div className="multisig-section-heading">
                <span>{t("multisigVaultTitle")}</span>
                <strong>{t("multisigStepCreate")}</strong>
              </div>
              <p>{t("multisigVaultCopy")}</p>

              <div className="multisig-form-grid">
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
                            {"×"}
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
                      {t("multisigAddSigner")}
                    </button>
                  )}
                </div>

                <div className="multisig-form-row">
                  <NeoSelect
                    value={threshold}
                    label={t("thresholdLabel")}
                    options={thresholdOptions}
                    onChange={setThreshold}
                  />
                </div>
              </div>

              {createBlockedReason ? (
                <p className="multisig-request-hint">{createBlockedReason}</p>
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
                  {t("buttonCreateVault")}
                </NeoButton>
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
                    disabled={!loadVaultId.trim()}
                    onClick={() => dispatch("loadVault", loadVaultId.trim())}
                  >
                    {t("loadButton")}
                  </NeoButton>
                </div>
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
                  <div className="multisig-form-row multisig-form-row--transfer">
                    <NeoInput
                      value={depositAmount}
                      label={t("amountLabel")}
                      placeholder={t("amountPlaceholder")}
                      suffix={depositAsset}
                      onChange={setDepositAmount}
                    />
                    <NeoSelect
                      value={depositAsset}
                      label={t("assetLabel")}
                      options={[
                        { value: "GAS", label: t("assetGas") },
                        { value: "NEO", label: t("assetNeo") },
                      ]}
                      onChange={(value) =>
                        setDepositAsset(value === "NEO" ? "NEO" : "GAS")
                      }
                    />
                  </div>
                  <div className="multisig-primary-actions">
                    <NeoButton
                      variant="primary"
                      loading={isDepositing}
                      disabled={!canDeposit}
                      onClick={deposit}
                    >
                      {t("buttonDeposit")}
                    </NeoButton>
                  </div>

                  {/* Step 3 — propose a spend */}
                  <div className="multisig-section-heading">
                    <span>{t("multisigProposeTitle")}</span>
                    <strong>{t("multisigStepPropose")}</strong>
                  </div>
                  <p>{t("multisigProposeCopy")}</p>
                  <div className="multisig-form-grid">
                    <div className="multisig-form-row multisig-form-row--transfer">
                      <NeoInput
                        value={recipient}
                        label={t("toAddressLabel")}
                        placeholder={t("toAddressPlaceholder")}
                        onChange={setRecipient}
                      />
                      <NeoSelect
                        value={spendAsset}
                        label={t("assetLabel")}
                        options={[
                          { value: "GAS", label: t("assetGas") },
                          { value: "NEO", label: t("assetNeo") },
                        ]}
                        onChange={(value) =>
                          setSpendAsset(value === "NEO" ? "NEO" : "GAS")
                        }
                      />
                    </div>
                    <div className="multisig-form-row multisig-form-row--transfer">
                      <NeoInput
                        value={spendAmount}
                        label={t("amountLabel")}
                        placeholder={t("amountPlaceholder")}
                        suffix={spendAsset}
                        onChange={setSpendAmount}
                      />
                    </div>
                    <NeoInput
                      value={memo}
                      type="textarea"
                      label={t("memoLabel")}
                      placeholder={t("memoPlaceholder")}
                      onChange={setMemo}
                    />
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
                      {t("buttonPropose")}
                    </NeoButton>
                  </div>
                </>
              )}

              {/* Step 4 — approve / cancel a loaded request */}
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
                  disabled={!loadRequestId.trim()}
                  onClick={() => dispatch("loadRequest", loadRequestId.trim())}
                >
                  {t("loadButton")}
                </NeoButton>
              </div>

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
                      {copiedRequestId ? t("multisigCopied") : t("multisigCopy")}
                    </button>
                  </div>
                  <p className="multisig-request-hint">
                    {t("multisigShareRequestId")}
                  </p>

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
                  <span>{t("multisigSignerTitle")}</span>
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

              <NeoCard variant="erobo" className="multisig-route-panel">
                <div className="multisig-section-heading">
                  <span>{t("multisigRouteTitle")}</span>
                  <strong>{t("multisigNetworkValue")}</strong>
                </div>
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
              </NeoCard>

              <NeoCard variant="erobo" className="multisig-activity-panel">
                <div className="multisig-section-heading">
                  <span>{t("recentTitle")}</span>
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
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
