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
import type { MultisigRequest } from "./services/api";
import "./PlayArea.scss";

type MultisigChain = "neo-n3-mainnet" | "neo-n3-testnet";
type MultisigAsset = "GAS" | "NEO";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const SIGNER_SLOTS = 3;

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-6)}` : id;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, num, val } = useStateBindings(state);
  const { statusLabel, shorten, formatDate } = useMultisigUI();
  const [idInput, setIdInput] = useState("");
  const [signers, setSigners] = useState(() =>
    Array.from({ length: SIGNER_SLOTS }, () => ""),
  );
  const [threshold, setThreshold] = useState("2");
  const [selectedChain, setSelectedChain] =
    useState<MultisigChain>("neo-n3-testnet");
  const [asset, setAsset] = useState<MultisigAsset>("GAS");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const history = (state.history?.get() ?? []) as HistoryItem[];
  const pendingCount = num("pendingCount");
  const completedCount = num("completedCount");
  const totalTxs = num("totalTxs");
  const totalCount = totalTxs || history.length;
  const lastRequest = val<MultisigRequest>("lastRequest");
  const selectedRequest = val<MultisigRequest>("selectedRequest");
  const isCreatingRequest = bool("isCreatingRequest");
  const isLoadingRequest = bool("isLoadingRequest");
  const normalizedSigners = useMemo(
    () => signers.map((signer) => signer.trim()).filter(Boolean),
    [signers],
  );
  const thresholdNumber = Math.max(1, Math.floor(Number(threshold) || 0));
  const createBlockedReason = useMemo(() => {
    if (normalizedSigners.length < 2) return t("multisigNeedSigners");
    if (thresholdNumber > normalizedSigners.length) {
      return t("multisigThresholdBlocked");
    }
    if (!toAddress.trim()) return t("multisigRecipientBlocked");
    if (!amount.trim()) return t("multisigAmountBlocked");
    return "";
  }, [amount, normalizedSigners.length, t, thresholdNumber, toAddress]);
  const canCreateRequest = !createBlockedReason && !isCreatingRequest;

  function updateSigner(index: number, value: string) {
    setSigners((current) =>
      current.map((signer, signerIndex) =>
        signerIndex === index ? value : signer,
      ),
    );
  }

  function createRequest() {
    return dispatch("createRequest", {
      signers: normalizedSigners,
      threshold: thresholdNumber,
      selectedChain,
      asset,
      toAddress: toAddress.trim(),
      amount: amount.trim(),
      memo: memo.trim(),
    });
  }

  return (
    <div className="multisig-play-area">
      <div className="multisig-shell">
        <section className="multisig-main" aria-label={t("multisigHeroTitle")}>
          <div className="multisig-hero">
            <div className="multisig-hero-copy">
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
            </div>
            <div className="multisig-stat-grid">
              <div>
                <span>{t("multisigPendingMetric")}</span>
                <strong>{pendingCount}</strong>
              </div>
              <div>
                <span>{t("multisigCompletedMetric")}</span>
                <strong>{completedCount}</strong>
              </div>
              <div>
                <span>{t("multisigTotalMetric")}</span>
                <strong>{totalCount}</strong>
              </div>
            </div>
          </div>

          <div className="multisig-workspace">
            <NeoCard variant="erobo" className="multisig-request-panel">
              <div className="multisig-section-heading">
                <span>{t("multisigRequestTitle")}</span>
                <strong>
                  {selectedChain === "neo-n3-testnet"
                    ? t("chainTestnet")
                    : t("chainMainnet")}
                </strong>
              </div>
              <p>{t("multisigRequestCopy")}</p>
              <div className="multisig-quorum-strip" aria-label={t("multisigQuorumTitle")}>
                <div>
                  <span>{t("multisigQuorumTitle")}</span>
                  <strong>
                    {thresholdNumber} / {Math.max(normalizedSigners.length, 2)}
                  </strong>
                </div>
                <div>
                  <span>{t("multisigNetworkTitle")}</span>
                  <strong>
                    {selectedChain === "neo-n3-testnet"
                      ? t("chainTestnet")
                      : t("chainMainnet")}
                  </strong>
                </div>
                <div>
                  <span>{t("multisigBroadcastTitle")}</span>
                  <strong>
                    {selectedRequest
                      ? statusLabel(selectedRequest.status)
                      : t("multisigDraftState")}
                  </strong>
                </div>
              </div>

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
                    options={[
                      { value: "1", label: "1" },
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                    ]}
                    onChange={setThreshold}
                  />
                  <NeoSelect
                    value={selectedChain}
                    label={t("chainLabel")}
                    options={[
                      { value: "neo-n3-testnet", label: t("chainTestnet") },
                      { value: "neo-n3-mainnet", label: t("chainMainnet") },
                    ]}
                    onChange={(value) =>
                      setSelectedChain(
                        value === "neo-n3-mainnet"
                          ? "neo-n3-mainnet"
                          : "neo-n3-testnet",
                      )
                    }
                  />
                  <NeoSelect
                    value={asset}
                    label={t("assetLabel")}
                    options={[
                      { value: "GAS", label: t("assetGas") },
                      { value: "NEO", label: t("assetNeo") },
                    ]}
                    onChange={(value) => setAsset(value === "NEO" ? "NEO" : "GAS")}
                  />
                </div>

                <div className="multisig-form-row multisig-form-row--transfer">
                  <NeoInput
                    value={toAddress}
                    label={t("toAddressLabel")}
                    placeholder={t("toAddressPlaceholder")}
                    onChange={setToAddress}
                  />
                  <NeoInput
                    value={amount}
                    label={t("amountLabel")}
                    placeholder={t("amountPlaceholder")}
                    suffix={asset}
                    onChange={setAmount}
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
                  loading={isCreatingRequest}
                  disabled={!canCreateRequest}
                  onClick={createRequest}
                >
                  {t("buttonCreate")}
                </NeoButton>
              </div>

              {(lastRequest || selectedRequest) && (
                <div className="multisig-receipt" aria-live="polite">
                  <span>{t("detailId")}</span>
                  <strong>{shortId((selectedRequest || lastRequest)?.id || "")}</strong>
                  <em>{t("multisigReceiptCopy")}</em>
                </div>
              )}

              <div className="multisig-load-box">
                <NeoInput
                  value={idInput}
                  label={t("loadTitle")}
                  placeholder={t("loadPlaceholder")}
                  onChange={setIdInput}
                />
                <NeoButton
                  variant="secondary"
                  loading={isLoadingRequest}
                  disabled={!idInput.trim() || isLoadingRequest}
                  onClick={() => dispatch("loadTransaction", idInput.trim())}
                >
                  {t("loadButton")}
                </NeoButton>
              </div>

              {selectedRequest && (
                <div className="multisig-request-details">
                  <div>
                    <span>{t("statusLabel")}</span>
                    <strong>{statusLabel(selectedRequest.status)}</strong>
                  </div>
                  <div>
                    <span>{t("multisigScriptHashLabel")}</span>
                    <strong>{shorten(selectedRequest.script_hash)}</strong>
                  </div>
                  <div>
                    <span>{t("reviewSigners")}</span>
                    <strong>
                      {Object.keys(selectedRequest.signatures).length} /{" "}
                      {selectedRequest.threshold}
                    </strong>
                  </div>
                </div>
              )}
            </NeoCard>

            <NeoCard variant="erobo" className="multisig-activity-panel">
              <div className="multisig-section-heading">
                <span>{t("recentTitle")}</span>
                <strong>{history.length}</strong>
              </div>
              {history.length === 0 ? (
                <div className="multisig-empty-state">
                  <strong>{t("sidebarNoActivity")}</strong>
                  <span>{t("recentEmpty")}</span>
                </div>
              ) : (
                <div className="multisig-history-list">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="multisig-history-card"
                      onClick={() => dispatch("loadTransaction", item.id)}
                    >
                      <span>{shorten(item.scriptHash)}</span>
                      <strong>{statusLabel(item.status)}</strong>
                      <em>{formatDate(item.createdAt)}</em>
                    </button>
                  ))}
                </div>
              )}
            </NeoCard>
          </div>
        </section>

        <aside className="multisig-side" aria-label={t("multisigSignerTitle")}>
          <NeoCard variant="erobo" className="multisig-signer-panel">
            <div className="multisig-section-heading">
              <span>{t("multisigSignerTitle")}</span>
              <strong>{t("multisigSignerList")}</strong>
            </div>
            <p>{t("multisigSignerCopy")}</p>
            <div className="multisig-signal-row">
              <span>{t("reviewSigners")}</span>
              <strong>{normalizedSigners.length}</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("thresholdLabel")}</span>
              <strong>
                {thresholdNumber} / {Math.max(normalizedSigners.length, 2)}
              </strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("reviewFees")}</span>
              <strong>{t("multisigFeeGuard")}</strong>
            </div>
          </NeoCard>

          <NeoCard variant="erobo" className="multisig-route-panel">
            <div className="multisig-section-heading">
              <span>{t("multisigRouteTitle")}</span>
              <strong>
                {selectedChain === "neo-n3-testnet"
                  ? t("chainTestnet")
                  : t("chainMainnet")}
              </strong>
            </div>
            <p>{t("multisigRouteCopy")}</p>
            <div className="multisig-signal-row">
              <span>{t("buttonCreate")}</span>
              <strong>{t("multisigRouteCreate")}</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("buttonSign")}</span>
              <strong>{t("multisigRouteSign")}</strong>
            </div>
            <div className="multisig-signal-row">
              <span>{t("buttonBroadcast")}</span>
              <strong>{t("multisigRouteBroadcast")}</strong>
            </div>
          </NeoCard>
        </aside>
      </div>
    </div>
  );
}
