import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BookOpenCheck,
  CreditCard,
  FileSignature,
  ImageIcon,
  LockKeyhole,
  RefreshCw,
  WandSparkles,
} from "lucide-react";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  PreviewStat,
  buildEmbeddedDappUrl,
  formatGas,
  getMetric,
  useEmbeddedWalletBridge,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

export function ForeverAlbumPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEmbeddedWalletBridge({ appId: app.app_id, iframeRef, network });

  return (
    <PlayShell
      app={app}
      title="Forever Album photo vault"
      subtitle="Upload image files, optionally encrypt them locally, sign the storage write, and reopen the wallet-scoped gallery from the same dApp."
      tone="violet"
      side={
        <>
          <ActivityPanel activity={activity} />
          <MetricGrid stats={stats} />
          <ChainStateStrip
            loading={loading}
            error={error}
            contractHash={contractHash}
            network={network}
            onRefresh={onRefresh}
          />
        </>
      }
    >
      <div className="grid gap-3">
        <section className="group relative overflow-hidden rounded-[18px] border border-violet-100 bg-violet-50/60 shadow-sm shadow-violet-950/5">
          <a
            href={dappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open Forever Album in a new window"
            title="Open in a new window"
            className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-violet-700 opacity-0 shadow-sm backdrop-blur transition hover:text-violet-900 group-hover:opacity-100 focus:opacity-100"
          >
            <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
            New window
          </a>
          {/* Audit fix C-4: sandbox the miniapp iframe; see PlayAreaShared.tsx. */}
          <iframe
            ref={iframeRef}
            title="Forever Album uploader"
            src={dappUrl}
            data-wallet-bridge="neo-miniapp-host"
            className="block h-[720px] w-full border-0 bg-white"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </section>

        <ActionBoard
          title="Album workflow"
          subtitle="The user path is explicit: choose images, write them, then inspect the saved gallery."
          tone="violet"
          rows={[
            {
              label: "Upload photos",
              detail: "Choose image files in the embedded dApp uploader.",
              value: "5 max",
              valueLabel: "per tx",
              active: true,
              icon: <ImageIcon className="h-4 w-4" />,
            },
            {
              label: "Encrypt locally",
              detail: "AES-GCM password encryption happens before storage.",
              value: "optional",
              valueLabel: "privacy",
              icon: <LockKeyhole className="h-4 w-4" />,
            },
            {
              label: "Sign storage write",
              detail: "The OS storage intent is submitted by the wallet.",
              value: network,
              valueLabel: "network",
              icon: <FileSignature className="h-4 w-4" />,
            },
            {
              label: "View gallery",
              detail: "Saved images load back into the same wallet album.",
              value: "live",
              valueLabel: "read",
              icon: <BookOpenCheck className="h-4 w-4" />,
            },
          ]}
        />
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

type TarotCard = {
  id: number;
  name: string;
  keyword: string;
  meaning: string;
  image: string;
};

export function TarotPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [deck, setDeck] = useState<TarotCard[]>([]);
  const [drawn, setDrawn] = useState<TarotCard[]>([]);
  const [flipped, setFlipped] = useState(false);
  const handledOperationRef = useRef("");
  const activeCards = drawn.length ? drawn : FALLBACK_TAROT.slice(0, 3);
  const deckSize = deck.length || FALLBACK_TAROT.length;
  const backImage = "/miniapps/on-chain-tarot/cards/back.webp";

  useEffect(() => {
    let cancelled = false;
    const fetcher = globalThis.fetch;
    if (typeof fetcher === "function") {
      fetcher("/miniapps/on-chain-tarot/cards/index.json")
        .then((response) => (response.ok ? response.json() : []))
        .then((cards: TarotCard[]) => {
          if (!cancelled && Array.isArray(cards)) setDeck(cards);
        })
        .catch(() => {
          if (!cancelled) setDeck([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const drawCards = useCallback(() => {
    const source = deck.length ? deck : FALLBACK_TAROT;
    const seed = Date.now();
    const picks = [0, 1, 2].map(
      (offset) => source[(seed + offset * 17) % source.length],
    );
    setDrawn(picks);
    setFlipped(false);
  }, [deck]);

  useEffect(() => {
    if (drawn.length === 0) drawCards();
  }, [drawCards, drawn.length]);

  useEffect(() => {
    const operation = launchContext?.operation;
    if (operation !== "drawTarotReading" && operation !== "flipTarotReading")
      return;
    const signature = `${operation}:${launchContext?.signature || ""}`;
    if (handledOperationRef.current === signature) return;
    handledOperationRef.current = signature;
    if (operation === "drawTarotReading") drawCards();
    if (operation === "flipTarotReading") setFlipped(true);
  }, [drawCards, launchContext?.operation, launchContext?.signature]);

  return (
    <PlayShell
      app={app}
      title={flipped ? "Reading revealed" : "Neo tarot table"}
      subtitle="Draw the spread from the Neo oracle deck, then flip the three cards when the wallet-reviewed reading is ready."
      tone="violet"
      side={
        <div className="rounded-lg border border-emerald-100 bg-white/85 p-4">
          <h3 className="m-0 text-sm font-bold text-gray-900">
            Reading context
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <PreviewStat label="Deck" value={`${deckSize} cards`} />
            <PreviewStat label="Spread" value="Past / Signal / Path" />
            <PreviewStat label="Randomness" value="Neo on-chain draw" />
          </div>
        </div>
      }
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
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f3fff9_100%)] px-3 py-4 sm:px-5 sm:py-5">
        <div
          className="pointer-events-none absolute inset-x-6 top-5 h-28 rounded-full bg-emerald-100/40 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)] lg:items-stretch">
          <div className="hidden rounded-[22px] border border-emerald-100 bg-white/80 p-3 shadow-sm shadow-emerald-950/5 lg:grid">
            <div className="relative mx-auto mt-2 h-[188px] w-[112px]">
              {[0, 1, 2].map((offset) => (
                <img
                  key={offset}
                  src={backImage}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full rounded-[12px] border border-emerald-950/10 object-cover shadow-md shadow-emerald-950/15"
                  style={{
                    transform: `translate(${offset * 7}px, ${offset * 5}px) rotate(${offset * 2 - 2}deg)`,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Neo oracle deck
              </p>
              <p className="m-0 mt-1 text-sm font-semibold text-gray-900">
                {deckSize} card spread source
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-white/90 p-3 shadow-sm shadow-emerald-950/5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Three-card spread
                </p>
                <p className="m-0 mt-1 text-sm text-gray-600">
                  {flipped
                    ? "Past, Signal, and Path are visible."
                    : "Tap a card or reveal all when ready."}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                0.1 GAS draw
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {activeCards.map((card, index) => {
                const image = card.image?.replace(
                  "./cards/",
                  "/miniapps/on-chain-tarot/cards/",
                );
                const label = ["Past", "Signal", "Path"][index];
                return (
                  <button
                    key={`${card.id}:${index}`}
                    type="button"
                    onClick={() => setFlipped(true)}
                    className="group min-w-0 cursor-pointer rounded-[18px] border border-emerald-100 bg-[#fffaf0] p-1.5 text-center shadow-sm shadow-emerald-950/5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:p-2"
                    aria-label={
                      flipped
                        ? `${label}: ${card.name}`
                        : `Reveal ${label} card`
                    }
                  >
                    <span className="block overflow-hidden rounded-[14px] border border-emerald-950/10 bg-white shadow-inner">
                      <img
                        src={flipped ? image : backImage}
                        alt={flipped ? card.name : `${label} sealed card`}
                        className="aspect-[9/16] w-full object-cover"
                        loading="lazy"
                      />
                    </span>
                    <span className="mt-2 block truncate text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      {label}
                    </span>
                    <span className="mt-0.5 block min-h-[34px] text-xs font-semibold leading-snug text-gray-900 sm:text-sm">
                      {flipped ? card.name : "Sealed card"}
                    </span>
                    {flipped && (
                      <span className="mt-1 hidden text-[11px] leading-snug text-gray-600 sm:line-clamp-2">
                        {card.keyword} / {card.meaning}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 sm:flex-none"
              >
                <WandSparkles className="h-4 w-4" aria-hidden="true" />
                {flipped ? "Revealed" : "Reveal"}
              </button>
              <button
                type="button"
                onClick={drawCards}
                className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:flex-none"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Draw again
              </button>
            </div>
          </div>
        </div>
      </section>
    </PlayShell>
  );
}

const FALLBACK_TAROT: TarotCard[] = [
  {
    id: 0,
    name: "The Fool",
    keyword: "Spark",
    meaning: "Leap",
    image: "/miniapps/on-chain-tarot/cards/00-the-fool.webp",
  },
  {
    id: 1,
    name: "The Magician",
    keyword: "Protocol",
    meaning: "Intent",
    image: "/miniapps/on-chain-tarot/cards/01-the-magician.webp",
  },
  {
    id: 2,
    name: "The High Priestess",
    keyword: "Oracle",
    meaning: "Signal",
    image: "/miniapps/on-chain-tarot/cards/02-the-high-priestess.webp",
  },
];
