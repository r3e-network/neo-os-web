import React, { useMemo } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  CircleDashed,
  Clock3,
  MessageSquareText,
  ReceiptText,
} from "lucide-react";

import {
  ActionBoard,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  shortHash,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";
import {
  buildAssetBridgeIntent,
  buildMessageBridgeIntent,
  buildStatusTimeline,
  bridgeRoute,
  normalizeDirection,
  type BridgeOperation,
  type TimelineStep,
} from "../../../../apps/neo-x-bridge/src/bridgeConsole";

type HostBridgeIntent = {
  operation: BridgeOperation | null;
  payloadText: string;
  timeline: TimelineStep[];
  notice: string;
};

export function NeoXBridgePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [amount] = useLaunchParamState(launchContext, ["amount"], "");
  const [rawDirection] = useLaunchParamState(
    launchContext,
    ["direction", "route"],
    "n3-to-neox",
  );
  const direction = normalizeDirection(rawDirection);
  const route = bridgeRoute(direction);
  const [recipient] = useLaunchParamState(
    launchContext,
    ["recipient", "to", "address"],
    "",
  );
  const [targetContract] = useLaunchParamState(
    launchContext,
    ["targetContract", "contract", "to"],
    "",
  );
  const [bridgeMessage] = useLaunchParamState(
    launchContext,
    ["payload", "message"],
    "",
  );
  const [operationId] = useLaunchParamState(
    launchContext,
    ["operationId", "id"],
    "",
  );
  const [sourceTx] = useLaunchParamState(
    launchContext,
    ["sourceTx", "txHash"],
    "",
  );
  const [bridgeKind] = useLaunchParamState(
    launchContext,
    ["bridgeKind", "kind"],
    "asset",
  );
  const hostIntent = useMemo<HostBridgeIntent>(() => {
    const mode = String(launchContext?.operation || "");
    try {
      if (
        /messageBridge|bridgeMessage|prepareMessageBridge/i.test(mode) &&
        targetContract &&
        bridgeMessage
      ) {
        const intent = buildMessageBridgeIntent({
          direction,
          targetContract,
          method: "onCrossChainMessage",
          payload: bridgeMessage,
          gasLimit: "250000",
        });
        return {
          operation: intent.operation,
          payloadText: intent.payloadText,
          timeline: intent.timeline,
          notice: "Message bridge intent is ready for SDK handoff.",
        };
      }

      if (/bridgeAsset|assetBridge|prepareAssetBridge/i.test(mode) && amount && recipient) {
        const intent = buildAssetBridgeIntent({
          direction,
          asset: "GAS",
          amount,
          recipient,
        });
        return {
          operation: intent.operation,
          payloadText: intent.payloadText,
          timeline: intent.timeline,
          notice: "Asset bridge handoff is ready for wallet review.",
        };
      }
    } catch {
      // Keep the native host surface in draft mode if launch params are incomplete.
    }

    const timeline = buildStatusTimeline({
      bridgeKind,
      direction,
      operationId,
      sourceTx,
    });

    return {
      operation: null,
      payloadText: "",
      timeline,
      notice:
        operationId || sourceTx
          ? "Tracking timeline refreshed from launch parameters."
          : "Add bridge parameters in the action console to generate a handoff.",
    };
  }, [
    amount,
    bridgeKind,
    bridgeMessage,
    direction,
    launchContext?.operation,
    operationId,
    recipient,
    sourceTx,
    targetContract,
  ]);

  return (
    <PlayShell
      app={app}
      title="Neo X bridge control console"
      subtitle="Operate asset bridge, Message Bridge, and operation status tracking without leaving the platform shell."
      tone="sky"
      side={<NeoXBridgeStatusPanel timeline={hostIntent.timeline} />}
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <div className="space-y-3">
        <ActionBoard
          title="Bridge route"
          subtitle="Bridge inputs define the route; the playarea summarizes current status and tracking."
          tone="sky"
          rows={[
            {
              label: "Asset bridge",
              detail: "Direction selected for this operation",
              value: route,
              valueLabel: amount ? `${amount} GAS` : "route",
              active: true,
              icon: <ArrowRightLeft className="h-4 w-4" />,
            },
            {
              label: "Recipient",
              detail: recipient || "Destination pending",
              value: recipient ? shortHash(recipient) : "waiting",
              valueLabel: "address",
              active: Boolean(recipient),
            },
            {
              label: "Target contract",
              detail: "Message Bridge target",
              value: targetContract ? shortHash(targetContract) : "not set",
              valueLabel: "hash",
              icon: <MessageSquareText className="h-4 w-4" />,
            },
            {
              label: "Message",
              detail: bridgeMessage || "Payload pending",
              value: bridgeMessage ? "ready" : "waiting",
              valueLabel: "payload",
              icon: <ReceiptText className="h-4 w-4" />,
            },
            {
              label: "Operation",
              detail: hostIntent.notice,
              value: hostIntent.operation
                ? hostIntent.operation.id
                : operationId || "draft",
              valueLabel: "state",
            },
          ]}
        />
        <MetricGrid
          stats={[
            { label: "Route", value: route, accent: true },
            {
              label: "Amount",
              value: amount ? `${amount} GAS` : "Not set",
            },
            {
              label: "Target",
              value: targetContract ? shortHash(targetContract) : "No target",
            },
            { label: "Payload", value: bridgeMessage ? "Ready" : "Empty" },
          ]}
        />
        <section className="rounded-lg border border-sky-100 bg-white/85 p-4">
          <h3 className="m-0 text-sm font-black text-gray-950">
            Generated handoff
          </h3>
          {hostIntent.payloadText ? (
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-gray-950 p-3 text-xs font-semibold leading-5 text-sky-50">
              {hostIntent.payloadText}
            </pre>
          ) : (
            <p className="m-0 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold leading-6 text-amber-950">
              {hostIntent.notice}
            </p>
          )}
        </section>
      </div>
    </PlayShell>
  );
}

function NeoXBridgeStatusPanel({ timeline }: { timeline: TimelineStep[] }) {
  return (
    <div className="rounded-lg border border-sky-100 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-black text-gray-950">Operation status</h3>
      <div className="mt-4 space-y-3">
        {timeline.map((step, index) => (
          <div key={step.key} className="flex items-start gap-3">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                step.state === "done"
                  ? "bg-emerald-100 text-emerald-700"
                  : step.state === "active"
                    ? "bg-sky-600 text-white"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {step.state === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : step.state === "active" ? (
                <Clock3 className="h-3.5 w-3.5" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-bold text-gray-800">
                {index + 1}. {step.label}
              </strong>
              <small className="mt-0.5 block break-words text-xs leading-5 text-gray-600">
                {step.detail}
              </small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
