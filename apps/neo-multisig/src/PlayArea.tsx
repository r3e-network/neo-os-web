import { useMemo, useState } from "react";
import {
  NeoButton,
  NeoCard,
  NeoInput,
  NeoSelect,
} from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { useMultisigUI } from "./composables/useMultisigUI";
import type { HistoryItem } from "./composables/useMultisigHistory";
import {
  fromBaseUnits,
  isValidAddress,
  isValidAmount,
  MAX_SIGNERS,
  MIN_SIGNERS,
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

const SIGNER_SLOTS = 3;

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);
  const { statusLabel, shorten, formatDate } = useMultisigUI();

  // Create-vault form
  const [signers, setSigners] = useState(() =>
    Array.from({ length: SIGNER_SLOTS }, () => ""),
  );
  const [threshold, setThreshold] = useState("2");

  // Deposit + propose form
  const [vaultIdInput, setVaultIdInput] = useState("");
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

  // Vault id used by the deposit/propose forms: prefer the typed override,
  // otherwise fall back to the active vault loaded into state.
  const workingVaultId = useMemo(() => {
    const typed = Math.floor(Number(vaultIdInput.trim()) || 0);
    if (typed > 0) return typed;
    return activeVault?.id ?? 0;
  }, [vaultIdInput, activeVault]);

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

  const canPropose =
    workingVaultId > 0 &&
    isValidAddress(recipient.trim()) &&
    isValidAmount(spendAmount.trim(), spendAsset) &&
    !isProposing;

  const requestPending = activeRequest?.status === "pending";
  const canApprove = !!activeRequest && requestPending && !isApproving;
  const canCancel = !!activeRequest && requestPending && !isCancelling;

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
                  {signers.map((signer, index) => (
                    <NeoInput
                      key={index}
                      value={signer}
                      label={`${t("signerLabel")} ${index + 1}`}
                      placeholder={t("signerPlaceholder")}
                      onChange={(value) => updateSigner(index, value)}
                    />
                  ))}
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
