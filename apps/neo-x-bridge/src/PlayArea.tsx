import {
  ArrowLeftRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  BRIDGE_RESOURCES,
  compactHash,
  sourceExplorerUrl,
  type BridgeEnvironment,
  type BridgeOperation,
  type TimelineStep,
} from "./bridgeConsole";
import "./PlayArea.scss";

const EMPTY_OPERATIONS: BridgeOperation[] = [];
const EMPTY_TIMELINE: TimelineStep[] = [];
const GAS_PRESETS = ["0.1", "1", "5"];

type WorkspaceMode = "asset" | "message" | "track";
type DirectionValue = "n3-to-neox" | "neox-to-n3";

const DIRECTION_OPTIONS: Array<{ value: DirectionValue; labelKey: string }> = [
  { value: "n3-to-neox", labelKey: "routeN3ToNeoX" },
  { value: "neox-to-n3", labelKey: "routeNeoXToN3" },
];

const STRICT_DECIMAL = /^\d+(\.\d+)?$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const NEO_N3_ADDRESS = /^N[1-9A-HJ-NP-Za-km-z]{33}$/;
const HASH256 = /^0x[0-9a-fA-F]{64}$/;
/** Em-dash placeholder used fleet-wide for empty preview values. */
const EM_DASH = "—";

/** Map a bridge kind enum to its short localized label. */
function kindLabel(t: PlayAreaProps["t"], kind: string): string {
  return kind === "message" ? t("messageBridge") : t("assetBridge");
}

function isPositiveAmount(value: string) {
  const text = value.trim();
  if (!STRICT_DECIMAL.test(text)) return false;
  const amount = Number(text);
  return Number.isFinite(amount) && amount > 0;
}

function parseGasLimit(value: string): number | null {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const limit = Number(text);
  return Number.isInteger(limit) ? limit : null;
}

/** Target chain of a direction: Neo X (EVM) for n3-to-neox, Neo N3 otherwise. */
function targetChain(direction: DirectionValue): "neo-x" | "neo-n3" {
  return direction === "neox-to-n3" ? "neo-n3" : "neo-x";
}

/** Address must match the target chain of the selected direction. */
function isValidTargetAddress(direction: DirectionValue, value: string) {
  const text = value.trim();
  return targetChain(direction) === "neo-x"
    ? EVM_ADDRESS.test(text)
    : NEO_N3_ADDRESS.test(text);
}

/** Locale key for the direction-specific wrong-chain address error. */
function addressErrorKey(direction: DirectionValue) {
  return targetChain(direction) === "neo-x" ? "errAddressNeoX" : "errAddressNeoN3";
}

function normalizeWorkspaceDirection(value: unknown): DirectionValue {
  const text = String(value ?? "").toLowerCase();
  return text === "neox-to-n3" ||
    text === "neo x -> neo n3" ||
    text === "neo x → neo n3"
    ? "neox-to-n3"
    : "n3-to-neox";
}

export default function PlayArea({
  t,
  state,
  services,
  dispatch,
  setStatus,
  launchContext,
}: PlayAreaProps) {
  const { str, val } = useStateBindings(state);
  const lastRoute = str("lastRoute", "Neo N3 -> Neo X");
  const lastKind = str("lastKind", "asset");
  // Active bridge environment + the official-bridge URL (network-derived), so the
  // required "Open official bridge" next step and the source-tx explorer link
  // target mainnet/testnet correctly rather than a hardcoded testnet literal.
  const bridgeEnvironment = str("bridgeEnvironment", "mainnet") as BridgeEnvironment;
  const officialBridgeUrl = str("bridgeAppUrl", BRIDGE_RESOURCES.bridgeAppMainnet);
  const rawDigest = str("lastDigest", "—");
  const notAvailableLabel = t("notAvailable");
  const lastDigest =
    rawDigest && rawDigest !== notAvailableLabel && rawDigest !== "N/A"
      ? rawDigest
      : "—";
  // The digest only becomes meaningful once a handoff is prepared; before then
  // it is a lone "—" that leaves the top summary strip half-empty, so keep the
  // strip to its three live facts (route / type / status) and surface DIGEST
  // only after a real digest exists.
  const hasDigest = lastDigest !== "—";
  const lastStatus = str("lastStatus", t("statusReady"));
  const payload = str("lastPayload", t("emptyPayload"));
  const operations = val<BridgeOperation[]>("operationsLog", EMPTY_OPERATIONS) ?? EMPTY_OPERATIONS;
  const timeline = val<TimelineStep[]>("timeline", EMPTY_TIMELINE) ?? EMPTY_TIMELINE;

  const activeOperation = operations[0] ?? null;
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("asset");
  const [assetDirection, setAssetDirection] =
    useState<DirectionValue>("n3-to-neox");
  const [assetAmount, setAssetAmount] = useState("");
  const [assetRecipient, setAssetRecipient] = useState("");
  const [messageDirection, setMessageDirection] =
    useState<DirectionValue>("n3-to-neox");
  const [targetContract, setTargetContract] = useState("");
  const [targetMethod, setTargetMethod] = useState("onCrossChainMessage");
  const [messagePayload, setMessagePayload] = useState("");
  const [messagePayloadTouched, setMessagePayloadTouched] = useState(false);
  const [gasLimit, setGasLimit] = useState("250000");
  const [trackKind, setTrackKind] = useState<"asset" | "message">("asset");
  const [trackDirection, setTrackDirection] =
    useState<DirectionValue>("n3-to-neox");
  const [operationId, setOperationId] = useState("");
  const [sourceTx, setSourceTx] = useState("");
  const [pendingMode, setPendingMode] = useState<WorkspaceMode | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const handledLaunchRef = useRef("");

  const assetAmountInvalid =
    assetAmount.trim().length > 0 && !isPositiveAmount(assetAmount);
  const assetRecipientInvalid =
    assetRecipient.trim().length > 0 &&
    !isValidTargetAddress(assetDirection, assetRecipient);
  const parsedGasLimit = parseGasLimit(gasLimit);
  const gasLimitInvalid =
    gasLimit.trim().length > 0 &&
    (parsedGasLimit === null || parsedGasLimit < 21000);
  const targetContractInvalid =
    targetContract.trim().length > 0 &&
    !isValidTargetAddress(messageDirection, targetContract);
  const messagePayloadInvalid =
    messagePayloadTouched && messagePayload.trim().length === 0;
  // The operation panel declares sourceTx as hash256; validate it so a typo'd
  // hash cannot flip the timeline's first steps to done/active.
  const sourceTxInvalid =
    sourceTx.trim().length > 0 && !HASH256.test(sourceTx.trim());
  const canPrepareAsset =
    isPositiveAmount(assetAmount) &&
    isValidTargetAddress(assetDirection, assetRecipient);
  const canPrepareMessage =
    isValidTargetAddress(messageDirection, targetContract) &&
    messagePayload.trim().length > 0 &&
    parsedGasLimit !== null &&
    parsedGasLimit >= 21000;
  const canTrack =
    (operationId.trim().length > 0 || sourceTx.trim().length > 0) && !sourceTxInvalid;

  const runWorkspaceAction = useCallback(
    async (
      mode: WorkspaceMode,
      action: () => Promise<void>,
      doneMessage: string,
    ) => {
      setPendingMode(mode);
      setActionError("");
      setActionNotice("");
      try {
        await action();
        setActionNotice(doneMessage);
        setStatus(doneMessage, "success");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("errBridgeGeneric");
        setActionError(message);
        setStatus(message, "error");
      } finally {
        setPendingMode(null);
      }
    },
    [setStatus, t],
  );

  useEffect(() => {
    const operation = String(launchContext?.operation || "");
    const params = launchContext?.params ?? {};
    const signature = `${operation}:${launchContext?.signature || ""}`;
    if (!operation || handledLaunchRef.current === signature) return;

    const direction = normalizeWorkspaceDirection(params.direction || params.route);
    if (/bridgeAsset|assetBridge|prepareAssetBridge/i.test(operation)) {
      const nextAmount = String(params.amount || "").trim();
      const nextRecipient = String(
        params.recipient || params.to || params.address || "",
      ).trim();
      setWorkspaceMode("asset");
      setAssetDirection(direction);
      setAssetAmount(nextAmount);
      setAssetRecipient(nextRecipient);
      if (
        isPositiveAmount(nextAmount) &&
        isValidTargetAddress(direction, nextRecipient)
      ) {
        handledLaunchRef.current = signature;
        void runWorkspaceAction(
          "asset",
          () =>
            dispatch("prepareAssetBridge", {
              direction,
              asset: "GAS",
              amount: nextAmount,
              recipient: nextRecipient,
            }),
          t("noticeAssetReady"),
        );
      }
      return;
    }

    if (/messageBridge|bridgeMessage|prepareMessageBridge/i.test(operation)) {
      const nextTarget = String(
        params.targetContract || params.contract || params.to || "",
      ).trim();
      const nextPayload = String(params.payload || params.message || "").trim();
      const nextMethod = String(params.method || "onCrossChainMessage").trim();
      const nextGasLimit = String(params.gasLimit || "250000").trim();
      setWorkspaceMode("message");
      setMessageDirection(direction);
      setTargetContract(nextTarget);
      setTargetMethod(nextMethod || "onCrossChainMessage");
      setMessagePayload(nextPayload);
      setGasLimit(nextGasLimit);
      const nextGasParsed = parseGasLimit(nextGasLimit);
      if (
        isValidTargetAddress(direction, nextTarget) &&
        nextPayload &&
        nextGasParsed !== null &&
        nextGasParsed >= 21000
      ) {
        handledLaunchRef.current = signature;
        void runWorkspaceAction(
          "message",
          () =>
            dispatch("prepareMessageBridge", {
              direction,
              targetContract: nextTarget,
              method: nextMethod || "onCrossChainMessage",
              payload: nextPayload,
              gasLimit: nextGasLimit,
            }),
          t("noticeMessageReady"),
        );
      }
      return;
    }

    if (/trackBridgeOperation/i.test(operation)) {
      const nextKind =
        String(params.bridgeKind || params.kind || "asset") === "message"
          ? "message"
          : "asset";
      const nextOperationId = String(params.operationId || params.id || "").trim();
      const nextSourceTx = String(params.sourceTx || params.txHash || "").trim();
      setWorkspaceMode("track");
      setTrackKind(nextKind);
      setTrackDirection(direction);
      setOperationId(nextOperationId);
      setSourceTx(nextSourceTx);
      if (nextOperationId || nextSourceTx) {
        handledLaunchRef.current = signature;
        void runWorkspaceAction(
          "track",
          () =>
            dispatch("trackBridgeOperation", {
              bridgeKind: nextKind,
              direction,
              operationId: nextOperationId,
              sourceTx: nextSourceTx,
            }),
          t("noticeTrackingReady"),
        );
      }
    }
  }, [
    dispatch,
    runWorkspaceAction,
    t,
    launchContext?.operation,
    launchContext?.params,
    launchContext?.signature,
  ]);

  async function copyPayload() {
    await services.clipboard.copy(payload, "copiedPayload");
  }

  async function prepareAssetBridge() {
    if (!canPrepareAsset) {
      const message = t("errAssetForm");
      setActionError(message);
      setStatus(message, "error");
      return;
    }
    await runWorkspaceAction(
      "asset",
      () =>
        dispatch("prepareAssetBridge", {
          direction: assetDirection,
          asset: "GAS",
          amount: assetAmount,
          recipient: assetRecipient,
        }),
      t("noticeAssetReady"),
    );
  }

  async function prepareMessageBridge() {
    if (!canPrepareMessage) {
      setMessagePayloadTouched(true);
      const message = t("errMessageForm");
      setActionError(message);
      setStatus(message, "error");
      return;
    }
    await runWorkspaceAction(
      "message",
      () =>
        dispatch("prepareMessageBridge", {
          direction: messageDirection,
          targetContract,
          method: targetMethod || "onCrossChainMessage",
          payload: messagePayload,
          gasLimit,
        }),
      t("noticeMessageReady"),
    );
  }

  async function refreshTracking() {
    if (!canTrack) {
      const message = t("errTrackForm");
      setActionError(message);
      setStatus(message, "error");
      return;
    }
    await runWorkspaceAction(
      "track",
      () =>
        dispatch("trackBridgeOperation", {
          bridgeKind: trackKind,
          direction: trackDirection,
          operationId,
          sourceTx,
        }),
      t("noticeTrackingReady"),
    );
  }

  return (
    <div className="neo-x-bridge-play-area">
      <section className="bridge-console-hero" aria-label={t("heroAria")}>
        <div className="bridge-hero-copy">
          <span className="bridge-hero-badge" aria-hidden="true">
            <ArrowLeftRight size={22} />
          </span>
          <span className="bridge-eyebrow">{t("heroEyebrow")}</span>
          <h2>{t("heroTitle")}</h2>
          <p>{t("heroBody")}</p>
          <p className="bridge-hero-disclaimer" role="note">
            {t("heroNoFunds")}
          </p>
        </div>
        <div className="bridge-route-card" aria-label={t("routeAria")}>
          <div className="route-node">
            <span>Neo N3</span>
            <small>{t("routeN3Wallet")}</small>
          </div>
          <ArrowLeftRight size={22} aria-hidden="true" />
          <div className="route-node">
            <span>{t("neoX")}</span>
            <small>{t("routeNeoXWallet")}</small>
          </div>
        </div>
      </section>

      <div className="bridge-metrics-strip" aria-label={t("metricsAria")}>
        <span className="strip-metric">
          <small>{t("metricRoute")}</small>
          <strong>{lastRoute}</strong>
        </span>
        <span className="strip-metric">
          <small>{t("bridgeKind")}</small>
          <strong>{kindLabel(t, lastKind)}</strong>
        </span>
        <span className="strip-metric">
          <small>{t("metricStatus")}</small>
          <strong>{lastStatus}</strong>
        </span>
        {hasDigest && (
          <span className="strip-metric">
            <small>{t("statDigest")}</small>
            <strong className="strip-metric--mono">{compactHash(lastDigest)}</strong>
          </span>
        )}
      </div>

      <NeoCard variant="erobo" className="bridge-action-card">
        <div className="bridge-action-head">
          <div>
            <span className="module-kicker">{t("workspaceKicker")}</span>
            <h3>{t("workspaceTitle")}</h3>
          </div>
          <div className="bridge-mode-tabs" role="tablist" aria-label={t("workspaceModeAria")}>
            {([
              ["asset", "tabAsset"],
              ["message", "tabMessage"],
              ["track", "tabTrack"],
            ] as const).map(([mode, labelKey]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={workspaceMode === mode}
                className={`bridge-mode-tab${
                  workspaceMode === mode ? " bridge-mode-tab--active" : ""
                }`}
                onClick={() => setWorkspaceMode(mode as WorkspaceMode)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {workspaceMode === "asset" && (
          <div className="bridge-form-grid">
            <label className="bridge-select-field">
              <span>{t("direction")}</span>
              <select
                value={assetDirection}
                onChange={(event) =>
                  setAssetDirection(event.target.value as DirectionValue)
                }
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <NeoInput
              type="number"
              label={t("amount")}
              placeholder="0.1"
              suffix="GAS"
              value={assetAmount}
              error={assetAmountInvalid ? t("errAmountPositive") : ""}
              onChange={setAssetAmount}
            />
            <div className="bridge-amount-presets" aria-label={t("amountPresetsAria")}>
              {GAS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`bridge-preset${
                    assetAmount === preset ? " bridge-preset--active" : ""
                  }`}
                  onClick={() => setAssetAmount(preset)}
                >
                  {preset} GAS
                </button>
              ))}
            </div>
            <NeoInput
              label={t("destinationAddress")}
              placeholder={t("destinationPlaceholder")}
              value={assetRecipient}
              error={
                assetRecipientInvalid
                  ? t(addressErrorKey(assetDirection))
                  : ""
              }
              onChange={setAssetRecipient}
              className="bridge-field-wide"
            />
            <BridgeActionPreview
              items={[
                [t("previewRoute"), bridgeRouteLabel(t, assetDirection)],
                [t("previewAmount"), isPositiveAmount(assetAmount) ? `${assetAmount} GAS` : EM_DASH],
                [t("previewRecipient"), assetRecipient || EM_DASH],
              ]}
            />
            <NeoButton
              variant="primary"
              size="lg"
              disabled={!canPrepareAsset || pendingMode === "asset"}
              loading={pendingMode === "asset"}
              onClick={prepareAssetBridge}
            >
              {t("btnPrepareAsset")}
            </NeoButton>
          </div>
        )}

        {workspaceMode === "message" && (
          <div className="bridge-form-grid">
            <label className="bridge-select-field">
              <span>{t("direction")}</span>
              <select
                value={messageDirection}
                onChange={(event) =>
                  setMessageDirection(event.target.value as DirectionValue)
                }
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <NeoInput
              label={t("targetContract")}
              placeholder={t("targetContractPlaceholder")}
              value={targetContract}
              error={
                targetContractInvalid
                  ? t(addressErrorKey(messageDirection))
                  : ""
              }
              onChange={setTargetContract}
            />
            <NeoInput
              label={t("targetMethod")}
              placeholder="onCrossChainMessage"
              value={targetMethod}
              onChange={setTargetMethod}
            />
            <NeoInput
              type="number"
              label={t("gasLimit")}
              placeholder="250000"
              value={gasLimit}
              error={gasLimitInvalid ? t("errGasLimit") : ""}
              onChange={setGasLimit}
            />
            <NeoInput
              type="textarea"
              label={t("messagePayload")}
              placeholder='{"type":"signal","value":"..."}'
              value={messagePayload}
              error={messagePayloadInvalid ? t("messagePayloadRequired") : ""}
              onChange={(value) => {
                setMessagePayloadTouched(true);
                setMessagePayload(value);
              }}
              onBlur={() => setMessagePayloadTouched(true)}
              className="bridge-field-wide"
            />
            <BridgeActionPreview
              items={[
                [t("previewRoute"), bridgeRouteLabel(t, messageDirection)],
                [t("previewTarget"), targetContract || EM_DASH],
                [t("previewPayload"), messagePayload ? t("previewReady") : EM_DASH],
              ]}
            />
            <NeoButton
              variant="primary"
              size="lg"
              disabled={!canPrepareMessage || pendingMode === "message"}
              loading={pendingMode === "message"}
              onClick={prepareMessageBridge}
            >
              {t("btnPrepareMessage")}
            </NeoButton>
          </div>
        )}

        {workspaceMode === "track" && (
          <div className="bridge-form-grid">
            <label className="bridge-select-field">
              <span>{t("bridgeKind")}</span>
              <select
                value={trackKind}
                onChange={(event) =>
                  setTrackKind(event.target.value as "asset" | "message")
                }
              >
                <option value="asset">{t("assetBridge")}</option>
                <option value="message">{t("messageBridge")}</option>
              </select>
            </label>
            <label className="bridge-select-field">
              <span>{t("direction")}</span>
              <select
                value={trackDirection}
                onChange={(event) =>
                  setTrackDirection(event.target.value as DirectionValue)
                }
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <NeoInput
              label={t("operationId")}
              placeholder="N3X-ASSET-..."
              value={operationId}
              onChange={setOperationId}
            />
            <NeoInput
              label={t("sourceTx")}
              placeholder="0x..."
              value={sourceTx}
              error={sourceTxInvalid ? t("errSourceTx") : ""}
              onChange={setSourceTx}
            />
            <BridgeActionPreview
              items={[
                [t("previewBridge"), trackKind === "message" ? t("messageBridge") : t("assetBridge")],
                [t("previewRoute"), bridgeRouteLabel(t, trackDirection)],
                [t("previewSourceTx"), sourceTx ? compactHash(sourceTx) : EM_DASH],
              ]}
            />
            <NeoButton
              variant="secondary"
              size="lg"
              disabled={!canTrack || pendingMode === "track"}
              loading={pendingMode === "track"}
              onClick={refreshTracking}
            >
              {t("btnRefreshTracking")}
            </NeoButton>
          </div>
        )}

        {(actionNotice || actionError) && (
          <div
            className={`bridge-action-feedback${
              actionError ? " bridge-action-feedback--error" : ""
            }`}
            role="status"
          >
            {actionError || actionNotice}
          </div>
        )}
      </NeoCard>

      {activeOperation && (
        <div className="bridge-output-grid">
        <NeoCard
          variant="erobo"
          title={t("outputTitle")}
          className="bridge-output-card"
          header={
            <NeoButton size="sm" variant="ghost" aria-label={t("copyAria")} onClick={copyPayload}>
              <Copy size={15} aria-hidden="true" />
              {t("copyLabel")}
            </NeoButton>
          }
        >
          <div className="operation-summary">
            <span>{activeOperation.id}</span>
            <strong>{activeOperation.title}</strong>
          </div>
          <pre className="payload-preview">{payload}</pre>
          <div className="bridge-next-step" role="note">
            <div className="bridge-next-step__copy">
              <strong>{t("nextStepTitle")}</strong>
              <small>{t("nextStepBody")}</small>
            </div>
            <a
              className="bridge-next-step__cta"
              href={officialBridgeUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>{t("btnOpenOfficialBridge")}</span>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
        </NeoCard>

        <NeoCard variant="erobo" title={t("statusCardTitle")} className="bridge-status-card">
          <p className="bridge-preview-note" role="note">
            {t("trackPreviewNote")}
          </p>
          <div className="timeline-list">
            {timeline.map((step) => (
              <div key={step.key} className={`timeline-step timeline-step--${step.state}`}>
                <span className="timeline-icon" aria-hidden="true">
                  {step.state === "done" ? (
                    <CheckCircle2 size={16} />
                  ) : step.state === "active" ? (
                    <Clock3 size={16} />
                  ) : (
                    <CircleDashed size={16} />
                  )}
                </span>
                <span className="timeline-copy">
                  <strong>{t(step.labelKey)}</strong>
                  <small>{t(step.detailKey, step.detailParams)}</small>
                </span>
              </div>
            ))}
          </div>
          {activeOperation.sourceTx && HASH256.test(activeOperation.sourceTx) && (
            <a
              className="bridge-source-explorer"
              href={sourceExplorerUrl(
                activeOperation.direction,
                bridgeEnvironment,
                activeOperation.sourceTx,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <span>{t("viewSourceTxExplorer")}</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </NeoCard>
        </div>
      )}

      <div className="bridge-resource-row" aria-label={t("resourcesAria")}>
        <ResourceLink label={t("resOfficialBridge")} href={officialBridgeUrl} />
        <ResourceLink label={t("resAssetBridgeDocs")} href={BRIDGE_RESOURCES.assetBridgeDocs} />
        <ResourceLink label={t("resMessageBridgeDocs")} href={BRIDGE_RESOURCES.messageBridgeDocs} />
        <ResourceLink label={t("resBridgeSdk")} href={BRIDGE_RESOURCES.bridgeSdk} />
      </div>

      {operations.length > 0 && (
        <NeoCard variant="erobo" title={t("recentTitle")} className="bridge-recent-card">
          <div className="recent-operation-list">
            {operations.map((operation) => (
              <div key={operation.id} className="recent-operation">
                <span className="recent-kind">{kindLabel(t, operation.kind)}</span>
                <span className="recent-title">{operation.title}</span>
                <code>{compactHash(operation.digest)}</code>
              </div>
            ))}
          </div>
        </NeoCard>
      )}
    </div>
  );
}

function bridgeRouteLabel(t: PlayAreaProps["t"], direction: DirectionValue) {
  return direction === "neox-to-n3" ? t("routeNeoXToN3") : t("routeN3ToNeoX");
}

function BridgeActionPreview({
  items,
}: {
  items: Array<[label: string, value: string]>;
}) {
  return (
    <div className="bridge-action-preview">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function ResourceLink({ label, href }: { label: string; href: string }) {
  return (
    <a className="bridge-resource-link" href={href} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}
