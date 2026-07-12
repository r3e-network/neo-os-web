import { useRef } from "react";
import {
  ArrowRightLeft,
  CreditCard,
} from "lucide-react";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  buildEmbeddedDappUrl,
  formatGas,
  getMetric,
  useEmbeddedWalletBridge,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

export function ForeverAlbumPlayArea(props: PlayAreaRegistryProps) {
  const { app, network, launchContext } = props;
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEmbeddedWalletBridge({ appId: app.app_id, iframeRef, network });

  return (
    <PlayShell
      app={app}
      title="Forever Album · device memory album"
      subtitle="Choose, protect, view, and delete photos inside one focused album. The wallet address separates local albums; it does not sign a transaction."
      tone="emerald"
      immersive
    >
      <div>
        <section className="group relative overflow-hidden rounded-[18px] border border-emerald-100 bg-emerald-50/40 shadow-sm shadow-emerald-950/5">
          <a
            href={dappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open Forever Album in a new window"
            title="Open in a new window"
            className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-emerald-700 opacity-0 shadow-sm backdrop-blur transition hover:text-emerald-900 group-hover:opacity-100 focus:opacity-100"
          >
            <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
            New window
          </a>
          <iframe
            ref={iframeRef}
            title="Forever Album local photo workspace"
            src={dappUrl}
            data-wallet-bridge="neo-miniapp-host"
            className="block h-[720px] w-full border-0 bg-white"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </section>
      </div>
    </PlayShell>
  );
}

export function NeoPayPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [amount] = useLaunchParamState(
    launchContext,
    ["amount", "total"],
    "12",
  );
  const [rate] = useLaunchParamState(
    launchContext,
    ["rate", "releaseRate"],
    "1",
  );
  const duration = Math.ceil(
    (Number(amount) || 0) / Math.max(0.01, Number(rate) || 1),
  );

  return (
    <PlayShell
      app={app}
      title="Payment stream builder"
      subtitle="Compose a payroll, grant, or escrow stream with release cadence and beneficiary before submitting."
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
        <div className="grid gap-3">
          <ActionBoard
            title="Payment stream"
            subtitle="Amount, cadence, and unlock horizon are visible before the stream is created."
            tone="emerald"
            rows={[
              {
                label: "Total amount",
                detail: "Funds streamed over time",
                value: formatGas(Number(amount) || 0),
                valueLabel: "total",
                active: true,
                icon: <CreditCard className="h-4 w-4" />,
              },
              {
                label: "Release rate",
                detail: "Linear release cadence",
                value: `${rate || "0"} GAS/day`,
                valueLabel: "rate",
              },
              {
                label: "Duration",
                detail: "Calculated from amount and rate",
                value: `${duration} days`,
                valueLabel: "length",
              },
              {
                label: "Active streams",
                detail: "Current contract read",
                value: getMetric(statsMap, "Total Streams", "0"),
                valueLabel: "count",
              },
            ]}
          />
        </div>
        <MetricGrid stats={stats} />
      </div>
    </PlayShell>
  );
}
