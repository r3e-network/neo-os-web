import React from "react";
import {
  ArrowRightLeft,
  Coins,
  Fingerprint,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";

import { getLaunchParam } from "@/lib/miniapp-launch-params";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  PreviewStat,
  SecondaryInfo,
  getMetric,
  shortHash,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps, PlayTone } from "./PlayAreaShared";

export function ProfitAnchorPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorPlayArea {...props} mode="profit" />;
}

export function TrustAnchorPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorPlayArea {...props} mode="trust" />;
}

export function ProfitAnchorAdminPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorAdminPlayArea {...props} mode="profit" />;
}

export function TrustAnchorAdminPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorAdminPlayArea {...props} mode="trust" />;
}

export function CustomAnchorPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const anchorAppId =
    getLaunchParam(launchContext, ["anchorAppId", "appId", "anchor"]) || "";
  const slug = getLaunchParam(launchContext, ["slug"], "my-anchor");
  const nonce = getLaunchParam(launchContext, ["nonce"], "user-nonce");
  const totalStaked = getMetric(
    statsMap,
    "Total Staked",
    anchorAppId ? "0 NEO" : "after registration",
  );
  const rewardReserve = getMetric(
    statsMap,
    "Reward Reserve",
    anchorAppId ? "0 GAS" : "after funding",
  );
  const agentCount = getMetric(
    statsMap,
    "Agents",
    anchorAppId ? "0" : "21 on register",
  );

  return (
    <PlayShell
      app={app}
      title="Custom Anchor"
      subtitle="Create your own 21-agent NEO voting anchor. Users only need the Anchor App ID to stake, redeem, and claim."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
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
          title={anchorAppId ? "Anchor user flow" : "Register your Anchor"}
          subtitle={
            anchorAppId
              ? "This link is scoped to one registered Custom Anchor. Stake, redeem, and claim stay simple for users."
              : "Pick a slug and private nonce, paste 21 council candidate public keys in the action console, then register once."
          }
          tone="emerald"
          rows={[
            {
              label: anchorAppId ? "Anchor App ID" : "Registration ID",
              detail: anchorAppId
                ? "Loaded from URL or OneGate QR"
                : "Derived from slug + nonce",
              value: anchorAppId || `custom-anchor:${slug}:${nonce}`,
              valueLabel: "scope",
              active: true,
              icon: <Fingerprint className="h-4 w-4" />,
            },
            {
              label: "21 AA agents",
              detail: "One account per council candidate",
              value: agentCount,
              valueLabel: "agents",
              icon: <Users className="h-4 w-4" />,
            },
            {
              label: "User actions",
              detail: "Stake NEO, redeem NEO, claim GAS",
              value: anchorAppId ? rewardReserve : "after share",
              valueLabel: "rewards",
              icon: <Coins className="h-4 w-4" />,
            },
          ]}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Total staked" value={totalStaked} />
          <PreviewStat label="Reward reserve" value={rewardReserve} />
          <PreviewStat label="Routing" value="Manual admin" />
        </div>
        <SecondaryInfo
          title="Operator setup"
          description="Advanced setup only. Normal users should receive a link or QR with anchorAppId and use Stake, Redeem, or Claim."
          meta="advanced"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <PreviewStat label="AA seed" value="anchor+appId+agentId+nonce" />
            <PreviewStat label="Batch size" value="21 agents" />
          </div>
        </SecondaryInfo>
      </div>
    </PlayShell>
  );
}

function AnchorPlayArea(
  props: PlayAreaRegistryProps & { mode: "profit" | "trust" },
) {
  const {
    app,
    statsMap,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
    mode,
  } = props;
  const [amount] = useLaunchParamState(launchContext, ["amount", "neo"], "1");
  const isProfit = mode === "profit";
  const totalStaked = getMetric(statsMap, "Total Staked", "0 NEO");
  const agentCount = getMetric(
    statsMap,
    "Agents",
    getMetric(statsMap, "Agent Count", "0"),
  );
  const rewardReserve = getMetric(
    statsMap,
    "Reward Reserve",
    getMetric(statsMap, "Rewards", "0 GAS"),
  );
  const selectedAgent = getMetric(statsMap, "Selected Agent", "not selected");

  return (
    <PlayShell
      app={app}
      title={isProfit ? "ProfitAnchor" : "TrustAnchor"}
      subtitle={
        isProfit
          ? "Stake NEO, redeem your stake, and claim GAS rewards. Operator routing is handled separately in ProfitAnchor Admin."
          : "Stake NEO, redeem your stake, and claim GAS rewards. Operator routing is handled separately in TrustAnchor Admin."
      }
      tone={isProfit ? "emerald" : "slate"}
      side={<ActivityPanel activity={activity} />}
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
        <div className="grid gap-3">
          <ActionBoard
            title="Your anchor position"
            subtitle="Three actions matter for users: stake, redeem, claim. Everything else is admin-only."
            tone={isProfit ? "emerald" : "slate"}
            rows={[
              {
                label: "Stake NEO",
                detail: "Add NEO to your anchor position",
                value: amount || "1",
                valueLabel: "NEO",
                active: true,
                icon: <LockKeyhole className="h-4 w-4" />,
              },
              {
                label: "Redeem NEO",
                detail: "Withdraw your own stake from the anchor",
                value: "wallet",
                valueLabel: "action",
                icon: <RotateCcw className="h-4 w-4" />,
              },
              {
                label: "Claim GAS",
                detail: "Collect rewards available for your wallet",
                value: rewardReserve,
                valueLabel: "reserve",
                icon: <Coins className="h-4 w-4" />,
              },
            ]}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Total staked" value={totalStaked} />
          <PreviewStat label="Reward reserve" value={rewardReserve} />
          <PreviewStat label="Routing" value="Manual admin" />
        </div>
        <SecondaryInfo
          title="Operator route details"
          description="Secondary diagnostics. Normal users do not need these values to stake, redeem, or claim."
          meta="advanced"
        >
          <div className="grid gap-3">
            <ActionBoard
              title="Live contract reads"
              subtitle="Values come from the configured chain/server data source. Missing values are shown as unavailable, not fabricated."
              tone={isProfit ? "emerald" : "slate"}
              rows={[
                {
                  label: "Registered agents",
                  detail: "One AA agent per council candidate",
                  value: agentCount,
                  valueLabel: "count",
                  active: true,
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  label: "Reward reserve",
                  detail: "Reward accounting read from the anchor contract",
                  value: rewardReserve,
                  valueLabel: "GAS",
                  icon: <Coins className="h-4 w-4" />,
                },
                {
                  label: "Selected manual route",
                  detail: "Updated by admin routing",
                  value: selectedAgent,
                  valueLabel: "agent",
                  icon: <ArrowRightLeft className="h-4 w-4" />,
                },
              ]}
            />
          </div>
        </SecondaryInfo>
      </div>
    </PlayShell>
  );
}

function AnchorAdminPlayArea(
  props: PlayAreaRegistryProps & { mode: "profit" | "trust" },
) {
  const {
    app,
    statsMap,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
    mode,
  } = props;
  const [agentId] = useLaunchParamState(
    launchContext,
    ["agentId", "agent"],
    "1",
  );
  const [candidate] = useLaunchParamState(
    launchContext,
    ["candidate", "target", "voteTarget"],
    "",
  );
  const [amount] = useLaunchParamState(launchContext, ["amount", "neo"], "1");
  const isProfit = mode === "profit";
  const totalStaked = getMetric(statsMap, "Total Staked", "0 NEO");
  const agentCount = getMetric(
    statsMap,
    "Agents",
    getMetric(statsMap, "Agent Count", "0"),
  );
  const selectedAgent = getMetric(statsMap, "Selected Agent", "not selected");

  return (
    <PlayShell
      app={app}
      title={isProfit ? "ProfitAnchor Admin" : "TrustAnchor Admin"}
      subtitle="Admin-only manual routing: move NEO between the 21 AA agents, update vote target, then sync vote."
      tone={isProfit ? "emerald" : "slate"}
      side={<ActivityPanel activity={activity} />}
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
          title="Manual route workflow"
          subtitle="This page is for the admin wallet only. User stake, redeem, and claim stay in the public Anchor app."
          tone={isProfit ? "emerald" : "slate"}
          rows={[
            {
              label: "Move NEO",
              detail: "Transfer NEO from one candidate agent to another",
              value: amount || "1",
              valueLabel: "NEO",
              active: true,
              icon: <ArrowRightLeft className="h-4 w-4" />,
            },
            {
              label: "Update target",
              detail: "Change the candidate public key for one agent",
              value: candidate ? shortHash(candidate) : `agent ${agentId}`,
              valueLabel: "vote",
              icon: <Vote className="h-4 w-4" />,
            },
            {
              label: "Sync vote",
              detail: "Submit the selected agent vote on-chain",
              value: selectedAgent,
              valueLabel: "selected",
              icon: <ShieldCheck className="h-4 w-4" />,
            },
          ]}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Anchor stake" value={totalStaked} />
          <PreviewStat label="AA agents" value={agentCount} />
          <PreviewStat label="Selected route" value={selectedAgent} />
        </div>
        <SecondaryInfo
          title="Agent derivation"
          description="Setup should derive each AA account from anchor + appId + agentId + nonce, then batch-register the 21 accounts through the AA contract."
          meta="setup"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <PreviewStat
              label="Derivation"
              value="anchor+appId+agentId+nonce"
            />
            <PreviewStat label="Agent set" value="21 candidate agents" />
          </div>
        </SecondaryInfo>
      </div>
    </PlayShell>
  );
}
