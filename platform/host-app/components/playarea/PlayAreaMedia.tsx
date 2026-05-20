import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BookOpenCheck,
  CreditCard,
  FileSignature,
  ImageIcon,
  LockKeyhole,
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
            title="Forever Album uploader"
            src={dappUrl}
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
      title="Draw, flip, read"
      subtitle="The first screen is the reading table: draw three cards, flip them, and request the on-chain reading."
      tone="violet"
      side={
        <div className="rounded-lg border border-violet-100 bg-white/85 p-4">
          <h3 className="m-0 text-sm font-bold text-gray-950">
            Reading spread
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <PreviewStat
              label="Deck"
              value={`${deck.length || FALLBACK_TAROT.length} cards`}
            />
            <PreviewStat label="Spread" value="Past / Signal / Path" />
            <PreviewStat label="Randomness" value="Neo block seed" />
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
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(drawn.length ? drawn : FALLBACK_TAROT.slice(0, 3)).map(
            (card, index) => {
              const image = card.image?.replace(
                "./cards/",
                "/miniapps/on-chain-tarot/cards/",
              );
              return (
                <button
                  key={`${card.id}:${index}`}
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="group min-h-[140px] cursor-pointer rounded-lg border border-violet-200 bg-white p-2 text-center shadow-sm shadow-violet-900/5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md sm:min-h-[260px] sm:p-3 sm:text-left"
                >
                  {flipped ? (
                    <div className="h-full">
                      <img
                        src={image}
                        alt={card.name}
                        className="mx-auto aspect-[2/3] h-24 rounded-md object-cover sm:h-44"
                      />
                      <p className="m-0 mt-2 text-xs font-black text-gray-950 sm:mt-3 sm:text-sm">
                        {card.name}
                      </p>
                      <p className="m-0 mt-1 line-clamp-2 text-[10px] leading-snug text-gray-700 sm:text-xs">
                        {card.keyword} / {card.meaning}
                      </p>
                    </div>
                  ) : (
                    <div className="grid h-full min-h-[112px] place-items-center rounded-md border border-violet-200 bg-[radial-gradient(circle_at_50%_18%,rgba(16,185,129,0.18),transparent_42%),linear-gradient(145deg,#f5f3ff,#ecfeff)] sm:min-h-[232px]">
                      <div className="text-center text-violet-800">
                        <WandSparkles className="mx-auto mb-2 h-5 w-5 text-violet-700 sm:mb-3 sm:h-8 sm:w-8" />
                        <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-violet-800 sm:text-xs">
                          {["Past", "Signal", "Path"][index]}
                        </p>
                      </div>
                    </div>
                  )}
                </button>
              );
            },
          )}
        </div>
      </div>
    </PlayShell>
  );
}

const FALLBACK_TAROT: TarotCard[] = [
  {
    id: 0,
    name: "The Fool",
    keyword: "Spark",
    meaning: "Leap",
    image: "/miniapps/on-chain-tarot/cards/00-the-fool.svg",
  },
  {
    id: 1,
    name: "The Magician",
    keyword: "Protocol",
    meaning: "Intent",
    image: "/miniapps/on-chain-tarot/cards/01-the-magician.svg",
  },
  {
    id: 2,
    name: "The High Priestess",
    keyword: "Oracle",
    meaning: "Signal",
    image: "/miniapps/on-chain-tarot/cards/02-the-high-priestess.svg",
  },
];
