import {
  ArrowLeftRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  BRIDGE_RESOURCES,
  compactHash,
  type BridgeOperation,
  type TimelineStep,
} from "./bridgeConsole";
import "./PlayArea.scss";

const EMPTY_OPERATIONS: BridgeOperation[] = [];
const EMPTY_TIMELINE: TimelineStep[] = [];
const GAS_PRESETS = ["0.1", "1", "5"];

type WorkspaceMode = "asset" | "message" | "track";
type DirectionValue = "n3-to-neox" | "neox-to-n3";

const DIRECTION_OPTIONS: Array<{ value: DirectionValue; label: string }> = [
  { value: "n3-to-neox", label: "Neo N3 -> Neo X" },
  { value: "neox-to-n3", label: "Neo X -> Neo N3" },
];

function isPositiveAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
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
  const rawDigest = str("lastDigest", "—");
  const notAvailableLabel = t("notAvailable");
  const lastDigest =
    rawDigest && rawDigest !== notAvailableLabel && rawDigest !== "N/A"
      ? rawDigest
      : "—";
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
  const gasLimitInvalid =
    gasLimit.trim().length > 0 && Number(gasLimit) < 21000;
  const canPrepareAsset =
    isPositiveAmount(assetAmount) && assetRecipient.trim().length > 0;
  const canPrepareMessage =
    targetContract.trim().length > 0 &&
    messagePayload.trim().length > 0 &&
    !gasLimitInvalid;
  const canTrack = operationId.trim().length > 0 || sourceTx.trim().length > 0;

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
      if (isPositiveAmount(nextAmount) && nextRecipient) {
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
          "Asset bridge handoff prepared.",
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
      if (nextTarget && nextPayload && Number(nextGasLimit) >= 21000) {
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
          "Message bridge intent prepared.",
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
          "Bridge tracking timeline refreshed.",
        );
      }
    }
  }, [dispatch, launchContext?.operation, launchContext?.params, launchContext?.signature]);

  async function copyPayload() {
    await services.clipboard.copy(payload, "copiedPayload");
  }

  async function runWorkspaceAction(
    mode: WorkspaceMode,
    action: () => Promise<void>,
    doneMessage: string,
  ) {
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
          : "Bridge handoff could not be prepared.";
      setActionError(message);
      setStatus(message, "error");
    } finally {
      setPendingMode(null);
    }
  }

  async function prepareAssetBridge() {
    if (!canPrepareAsset) {
      const message =
        "Enter a positive GAS amount and destination address before preparing the bridge handoff.";
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
      "Asset bridge handoff prepared.",
    );
  }

  async function prepareMessageBridge() {
    if (!canPrepareMessage) {
      const message =
        "Enter a target contract, payload, and gas limit of at least 21000.";
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
      "Message bridge intent prepared.",
    );
  }

  async function refreshTracking() {
    if (!canTrack) {
      const message = "Enter an operation id or source transaction to refresh tracking.";
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
      "Bridge tracking timeline refreshed.",
    );
  }

  return (
    <div className="neo-x-bridge-play-area">
      <section className="bridge-console-hero" aria-label="Neo X bridge overview">
        <div className="bridge-hero-copy">
          <span className="bridge-hero-badge" aria-hidden="true">
            <ArrowLeftRight size={22} />
          </span>
          <span className="bridge-eyebrow">AxLabs / BaneLabs Bridge Console</span>
          <h2>Neo N3 and Neo X cross-chain control</h2>
          <p>
            One production-facing surface for official bridge handoffs, arbitrary MessageBridge
            payloads, and lifecycle tracking from source transaction to destination finalization.
          </p>
        </div>
        <div className="bridge-route-card" aria-label="Active route">
          <div className="route-node">
            <span>Neo N3</span>
            <small>NEP-21 / NeoLine</small>
          </div>
          <ArrowLeftRight size={22} aria-hidden="true" />
          <div className="route-node">
            <span>Neo X</span>
            <small>EVM / MetaMask</small>
          </div>
        </div>
      </section>

      <div className="bridge-metrics-strip" aria-label="Bridge console status">
        <span className="strip-metric">
          <small>Route</small>
          <strong>{lastRoute}</strong>
        </span>
        <span className="strip-metric">
          <small>Bridge Type</small>
          <strong>{lastKind}</strong>
        </span>
        <span className="strip-metric">
          <small>Status</small>
          <strong>{lastStatus}</strong>
        </span>
        <span className="strip-metric">
          <small>Digest</small>
          <strong className="strip-metric--mono">{compactHash(lastDigest)}</strong>
        </span>
      </div>

      <NeoCard variant="erobo" className="bridge-action-card">
        <div className="bridge-action-head">
          <div>
            <span className="module-kicker">Bridge workspace</span>
            <h3>Build cross-chain handoff</h3>
          </div>
          <div className="bridge-mode-tabs" role="tablist" aria-label="Bridge workspace mode">
            {[
              ["asset", "Asset"],
              ["message", "Message"],
              ["track", "Track"],
            ].map(([mode, label]) => (
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
                {label}
              </button>
            ))}
          </div>
        </div>

        {workspaceMode === "asset" && (
          <div className="bridge-form-grid">
            <label className="bridge-select-field">
              <span>Direction</span>
              <select
                value={assetDirection}
                onChange={(event) =>
                  setAssetDirection(event.target.value as DirectionValue)
                }
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <NeoInput
              type="number"
              label="Amount"
              placeholder="0.1"
              suffix="GAS"
              value={assetAmount}
              error={assetAmountInvalid ? "Enter an amount greater than zero." : ""}
              onChange={setAssetAmount}
            />
            <div className="bridge-amount-presets" aria-label="GAS amount presets">
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
              label="Destination address"
              placeholder="Neo N3 or Neo X address"
              value={assetRecipient}
              onChange={setAssetRecipient}
              className="bridge-field-wide"
            />
            <BridgeActionPreview
              items={[
                ["Route", bridgeRouteLabel(assetDirection)],
                ["Amount", isPositiveAmount(assetAmount) ? `${assetAmount} GAS` : "--"],
                ["Recipient", assetRecipient || "--"],
              ]}
            />
            <NeoButton
              variant="primary"
              size="lg"
              disabled={!canPrepareAsset || pendingMode === "asset"}
              loading={pendingMode === "asset"}
              onClick={prepareAssetBridge}
            >
              Prepare asset handoff
            </NeoButton>
          </div>
        )}

        {workspaceMode === "message" && (
          <div className="bridge-form-grid">
            <label className="bridge-select-field">
              <span>Direction</span>
              <select
                value={messageDirection}
                onChange={(event) =>
                  setMessageDirection(event.target.value as DirectionValue)
                }
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <NeoInput
              label="Target contract"
              placeholder="0x... or Neo script hash"
              value={targetContract}
              onChange={setTargetContract}
            />
            <NeoInput
              label="Target method"
              placeholder="onCrossChainMessage"
              value={targetMethod}
              onChange={setTargetMethod}
            />
            <NeoInput
              type="number"
              label="Gas limit"
              placeholder="250000"
              value={gasLimit}
              error={gasLimitInvalid ? "Gas limit must be at least 21000." : ""}
              onChange={setGasLimit}
            />
            <NeoInput
              type="textarea"
              label="Message payload"
              placeholder='{"type":"signal","value":"..."}'
              value={messagePayload}
              onChange={setMessagePayload}
              className="bridge-field-wide"
            />
            <BridgeActionPreview
              items={[
                ["Route", bridgeRouteLabel(messageDirection)],
                ["Target", targetContract || "--"],
                ["Payload", messagePayload ? "Ready" : "--"],
              ]}
            />
            <NeoButton
              variant="primary"
              size="lg"
              disabled={!canPrepareMessage || pendingMode === "message"}
              loading={pendingMode === "message"}
              onClick={prepareMessageBridge}
            >
              Prepare message intent
            </NeoButton>
          </div>
        )}

        {workspaceMode === "track" && (
          <div className="bridge-form-grid">
            <label className="bridge-select-field">
              <span>Bridge type</span>
              <select
                value={trackKind}
                onChange={(event) =>
                  setTrackKind(event.target.value as "asset" | "message")
                }
              >
                <option value="asset">Asset Bridge</option>
                <option value="message">Message Bridge</option>
              </select>
            </label>
            <label className="bridge-select-field">
              <span>Direction</span>
              <select
                value={trackDirection}
                onChange={(event) =>
                  setTrackDirection(event.target.value as DirectionValue)
                }
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <NeoInput
              label="Operation ID"
              placeholder="N3X-ASSET-..."
              value={operationId}
              onChange={setOperationId}
            />
            <NeoInput
              label="Source transaction"
              placeholder="0x..."
              value={sourceTx}
              onChange={setSourceTx}
            />
            <BridgeActionPreview
              items={[
                ["Bridge", trackKind === "message" ? "Message Bridge" : "Asset Bridge"],
                ["Route", bridgeRouteLabel(trackDirection)],
                ["Source tx", sourceTx ? compactHash(sourceTx) : "--"],
              ]}
            />
            <NeoButton
              variant="secondary"
              size="lg"
              disabled={!canTrack || pendingMode === "track"}
              loading={pendingMode === "track"}
              onClick={refreshTracking}
            >
              Refresh tracking
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
          title="Generated bridge handoff"
          className="bridge-output-card"
          header={
            <NeoButton size="sm" variant="ghost" aria-label="Copy generated JSON" onClick={copyPayload}>
              <Copy size={15} aria-hidden="true" />
              Copy
            </NeoButton>
          }
        >
          <div className="operation-summary">
            <span>{activeOperation.id}</span>
            <strong>{activeOperation.title}</strong>
          </div>
          <pre className="payload-preview">{payload}</pre>
        </NeoCard>

        <NeoCard variant="erobo" title="Operation status" className="bridge-status-card">
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
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </NeoCard>
        </div>
      )}

      <div className="bridge-resource-row" aria-label="Bridge resources">
        <ResourceLink label="Testnet Bridge" href={BRIDGE_RESOURCES.bridgeAppTestnet} />
        <ResourceLink label="Asset Bridge Docs" href={BRIDGE_RESOURCES.assetBridgeDocs} />
        <ResourceLink label="MessageBridge Docs" href={BRIDGE_RESOURCES.messageBridgeDocs} />
        <ResourceLink label="BaneLabs SDK" href={BRIDGE_RESOURCES.bridgeSdk} />
      </div>

      {operations.length > 0 && (
        <NeoCard variant="erobo" title="Recent operations" className="bridge-recent-card">
          <div className="recent-operation-list">
            {operations.map((operation) => (
              <div key={operation.id} className="recent-operation">
                <span className="recent-kind">{operation.kind}</span>
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

function bridgeRouteLabel(direction: DirectionValue) {
  return direction === "neox-to-n3" ? "Neo X -> Neo N3" : "Neo N3 -> Neo X";
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
