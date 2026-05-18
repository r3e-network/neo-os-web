import React from "react";
import { ArrowRightLeft, MessageSquareText, ReceiptText } from "lucide-react";

import {
  ActionBoard,
  BridgeStatusPanel,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  shortHash,
  useLaunchChoiceState,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

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
  const [direction] = useLaunchChoiceState(
    launchContext,
    ["direction", "route"],
    ["Neo N3 -> Neo X", "Neo X -> Neo N3"] as const,
    "Neo N3 -> Neo X",
  );
  const [targetContract] = useLaunchParamState(
    launchContext,
    ["targetContract", "contract", "to"],
    "",
  );
  const [bridgeMessage] = useLaunchParamState(
    launchContext,
    ["message", "payload"],
    "",
  );

  return (
    <PlayShell
      app={app}
      title="Neo X bridge control console"
      subtitle="Operate asset bridge, Message Bridge, and operation status tracking without leaving the platform shell."
      tone="sky"
      side={<BridgeStatusPanel />}
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
              value: direction,
              valueLabel: amount ? `${amount} GAS` : "route",
              active: true,
              icon: <ArrowRightLeft className="h-4 w-4" />,
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
              label: "Relay",
              detail: "Release once lock, relay, and proof are confirmed",
              value: "waiting proof",
              valueLabel: "state",
            },
          ]}
        />
        <MetricGrid
          stats={[
            { label: "Route", value: direction, accent: true },
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
      </div>
    </PlayShell>
  );
}
