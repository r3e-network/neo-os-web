/**
 * PlayArea.tsx — Oracle Price Console (v2 scene-driven rebuild)
 * Oracle/DeFi identity. The market feed IS the scene: a foreground price ticket,
 * a clean market visual, and a compact watchlist. Fetch is primary; contract
 * and reference details stay tucked behind drawer tabs.
 */
import { type ReactNode, useCallback, useState } from "react";
import { Flame, Gem, LineChart, RadioTower, Sun, ShieldCheck, type LucideIcon } from "lucide-react";
import { CoinArt } from "@shared/art";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { OpenUiPanel, OpenUiProvider, OpenUiSegmented, PhaseValue, PlayStage, resolvePhase } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps { t: (key: string, p?: Record<string, string | number>) => string; state: Record<string, Observable>; dispatch: (n: string, ...a: unknown[]) => Promise<unknown>; }

const ASSETS = ["NEO", "GAS", "BTC"];
const MARKET_STAGE_IMAGE = "oracle-market-stage.webp";
type DrawerMode = "signal" | "contract" | "reference";

function assetHintKey(symbol: string) {
  const key = symbol.trim().toUpperCase();
  if (key === "NEO") return "assetHintNeo";
  if (key === "GAS") return "assetHintGas";
  if (key === "BTC") return "assetHintBtc";
  return "assetHintGeneric";
}

/**
 * Watchlist glyphs.
 *
 * NEO and GAS render CoinArt (see `assetCoinVariant`); everything else lands
 * here. This map used to name only BTC, so every other pair the catalog
 * discovers — FLM, ETH, SOL — collapsed onto the same RadioTower antenna and
 * the second half of the grid read as unfinished placeholder rows.
 *
 * These are mnemonics for the pairs the mainnet catalog actually publishes, not
 * claims about them: Flamingo's flame, Ethereum's diamond, Solana's sun.
 * RadioTower stays the honest fallback for a pair we have no glyph for — an
 * unnamed feed signal is exactly what it depicts.
 */
const ASSET_ICONS: Record<string, LucideIcon> = {
  BTC: LineChart,
  GAS: ShieldCheck,
  FLM: Flame,
  ETH: Gem,
  SOL: Sun,
};

function assetIcon(symbol: string): LucideIcon {
  return ASSET_ICONS[symbol.trim().toUpperCase()] ?? RadioTower;
}

function assetCoinVariant(symbol: string): "neo" | "gas" | null {
  const key = symbol.trim().toUpperCase();
  if (key === "NEO") return "neo";
  if (key === "GAS") return "gas";
  return null;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("signal");
  const dispatchSafely = useCallback((name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  }, [dispatch]);
  const asset = str("asset", "NEO");
  const priceDisplay = str("priceDisplay", "");
  const networkDisplay = str("networkDisplay", "");
  const datafeedShort = str("datafeedShort", "");
  const datafeedHash = str("datafeedHash", "");
  const sourceLabel = str("sourceLabel", "");
  const errorMsg = str("errorMsg", "");
  const isRequesting = bool("isRequesting");
  const priceSettled = bool("priceSettled");
  const freshness = str("freshness", "idle");
  const freshnessLabel = str("freshnessLabel", "");
  const freshnessTimestamp = str("freshnessTimestamp", "");
  const sourceFreshness = str("sourceFreshness", "idle");
  const sourceFreshnessLabel = str("sourceFreshnessLabel", t("sourceTimestampPending"));
  const sourceTimestampDisplay = str("sourceTimestampDisplay", "");
  const feedKey = str("feedKey", "");
  const rpcEndpoint = str("rpcEndpoint", "");
  const availablePairs = (val("availablePairs") ?? []) as string[];
  const pairOptions = [...new Set([asset, ...(availablePairs.length > 0 ? availablePairs : ASSETS)])]
    .filter((symbol) => /^[A-Z0-9]{1,12}$/.test(symbol))
    .slice(0, 6);
  const feedContractLabel = datafeedShort || datafeedHash || t("priceRouteFeedPending");
  const activeCoinVariant = assetCoinVariant(asset);
  const routeState = isRequesting
    ? t("priceRouteReading")
    : freshness === "fresh"
      ? t("priceStatusLive")
      : freshness === "stale"
        ? freshnessLabel
        : t("priceRouteQueued");
  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; icon: LucideIcon }> = [
    { mode: "signal", label: t("priceSignalTitle"), value: priceDisplay || t("priceSignalIdle"), icon: LineChart },
    { mode: "contract", label: t("feedTicketContract"), value: feedContractLabel, icon: RadioTower },
    { mode: "reference", label: t("priceReferenceTitle"), value: routeState, icon: ShieldCheck },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.mode === mode)) setDrawerMode(mode as DrawerMode);
  };
  // drawerModes is a non-empty literal, so the fallback always exists.
  const activeDrawerMode = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0]!;
  const ActiveDrawerIcon = activeDrawerMode.icon;

  // ── Honest read phase for the headline quote ─────────────────────────────
  // The pair price is a public contract read that fires for every visitor on
  // arrival — no wallet, ~300ms. Until it settles, "no price" means "still
  // asking", so the hero shimmers instead of printing "N/A" beside a "Ready for
  // a fresh read" badge the console had not earned. `isRequesting` alone cannot
  // carry this: it is still false on the very first frame, before lifecycle
  // mount fires the read, which is precisely when the void was widest.
  const pricePhase = resolvePhase({
    loading: isRequesting || !priceSettled,
    settled: priceSettled,
    hasData: Boolean(priceDisplay),
  });

  const scene = (
    <div
      className="price-station"
      data-state={isRequesting ? "fetching" : errorMsg ? "error" : freshness === "fresh" ? "live" : freshness === "stale" ? "stale" : "idle"}
      aria-busy={isRequesting}
    >
      <section className="price-ticket" aria-label={t("marketBoardTitle")}>
        {activeCoinVariant && <CoinArt className="price-ticket__watermark" size={116} variant={activeCoinVariant} decorative />}
        <div className="price-ticket__head">
          <span>{t("stationPair")}</span>
          <strong className="price-ticket__pair">
            {activeCoinVariant && <CoinArt size={20} variant={activeCoinVariant} decorative />}
            {asset}/USD
          </strong>
        </div>
        <div className="price-ticket__quote">
          <span>{t("latestPrice")}</span>
          <strong>
            <PhaseValue phase={pricePhase} placeholder={t("priceSignalIdle")} skeletonWidth="4em">
              {priceDisplay}
            </PhaseValue>
          </strong>
        </div>
        <div className="price-ticket__meta">
          {freshnessLabel && (
            <span className="price-ticket__freshness">
              <span className="price-ticket__dot" />
              {freshnessLabel}
            </span>
          )}
          <span data-tone={sourceFreshness === "stale" ? "warning" : undefined}>{sourceFreshnessLabel || sourceLabel || t("priceRouteSourceFallback")}</span>
        </div>
        {errorMsg && <p className="price-ticket__error" role="alert">{errorMsg}</p>}
      </section>

      <aside className="price-feed-panel" aria-label={t("priceRouteTitle")}>
        <div className="price-station__market" aria-hidden="true">
          <img src={MARKET_STAGE_IMAGE} alt="" loading="eager" decoding="async" />
        </div>
      </aside>
    </div>
  );

  const controls = (
    <section className="price-watchlist" aria-label={t("watchlistTitle")}>
      <div className="price-watchlist__head">
        <span>{t("watchlistTitle")}</span>
        <strong>{t("pairPickerSubtitle", { pair: asset })}</strong>
      </div>
      <div className="price-watchlist__grid">
        {pairOptions.map((sym) => {
          const Icon = assetIcon(sym);
          const coinVariant = assetCoinVariant(sym);
          const active = asset === sym;
          return (
            <button
              key={sym}
              type="button"
              className={["price-pair-card", active ? "price-pair-card--active" : null].filter(Boolean).join(" ")}
              onClick={() => dispatchSafely("updateAsset", sym)}
              aria-pressed={active}
            >
              <span className="price-pair-card__icon">
                {coinVariant ? <CoinArt size={32} variant={coinVariant} decorative /> : <Icon size={17} strokeWidth={2.25} />}
              </span>
              <span className="price-pair-card__copy">
                <strong>{sym}/USD</strong>
                <em>{active ? t("pairSelected") : t(assetHintKey(sym))}</em>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const drawerPanels: Record<DrawerMode, ReactNode> = {
    signal: (
      <dl className="price-drawer-list">
        <div><dt>{t("asset")}</dt><dd>{asset}/USD</dd></div>
        <div><dt>{t("latestPrice")}</dt><dd><PhaseValue phase={pricePhase} placeholder={t("priceSignalIdle")} skeletonWidth="4em">{priceDisplay}</PhaseValue></dd></div>
        <div><dt>{t("freshnessLabel")}</dt><dd>{freshnessLabel || t("priceSignalIdle")}</dd></div>
        <div><dt>{t("sourceLabel")}</dt><dd>{sourceLabel || t("priceRouteSourceFallback")}</dd></div>
        <div><dt>{t("resolvedFeedKey")}</dt><dd>{feedKey ? <code>{feedKey}</code> : t("feedRoutePending")}</dd></div>
        {freshnessTimestamp && <div><dt>{t("recordTimestampLabel")}</dt><dd>{freshnessTimestamp}</dd></div>}
        <div data-tone={sourceFreshness === "stale" ? "warning" : undefined}><dt>{t("sourceTimestampLabel")}</dt><dd>{sourceTimestampDisplay || sourceFreshnessLabel}</dd></div>
      </dl>
    ),
    contract: (
      <dl className="price-drawer-list">
        <div><dt>{t("priceMetricNetwork")}</dt><dd>{networkDisplay || "—"}</dd></div>
        <div><dt>{t("priceReferenceContract")}</dt><dd>{datafeedHash ? <code>{datafeedHash}</code> : t("priceRouteFeedPending")}</dd></div>
        <div><dt>{t("resolvedFeedKey")}</dt><dd>{feedKey ? <code>{feedKey}</code> : t("feedRoutePending")}</dd></div>
        <div><dt>{t("rpcEndpointLabel")}</dt><dd>{rpcEndpoint ? <code>{rpcEndpoint}</code> : t("priceRouteFeedPending")}</dd></div>
      </dl>
    ),
    reference: (
      <dl className="price-drawer-list">
        <div><dt>{t("priceReferenceMethod")}</dt><dd>{t("priceReferenceMethodValue")}</dd></div>
        <div><dt>{t("priceReferenceQuote")}</dt><dd>{t("priceReferenceQuoteValue")}</dd></div>
        <div><dt>{t("priceRouteFreshness")}</dt><dd>{routeState}</dd></div>
      </dl>
    ),
  };

  return (
    <OpenUiProvider>
      <div className="oracle-price-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("oracleStationEyebrow"),
            title: t("oracleStationTitle", { pair: `${asset}/USD` }),
            subtitle: t("priceRouteHint"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {networkDisplay || "—"}</span>,
          }}
          scene={<div className="price-stage-stack">{scene}{controls}</div>}
          actions={{ primary: { label: isRequesting ? t("readingPair", { pair: asset }) : t("fetchPair", { pair: asset }), onClick: () => dispatchSafely("fetchPrice"), loading: isRequesting, disabled: isRequesting } }}
          drawerToggleLabel={t("feedDetails")}
          drawer={{
            title: t("feedDetails"),
            children: (
              <div className="price-drawer">
                <OpenUiSegmented
                  className="price-drawer-tabs"
                  segmentedClassName="price-drawer-tabs__group"
                  label={t("feedDetails")}
                  value={drawerMode}
                  onChange={setDrawerModeSafe}
                  options={drawerModes.map((item) => ({
                    value: item.mode,
                    label: (
                      <span className="price-drawer-tab">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </span>
                    ),
                  }))}
                />
                <OpenUiPanel
                  className="price-drawer__panel"
                  icon={<ActiveDrawerIcon size={18} strokeWidth={2.35} aria-hidden="true" />}
                  title={activeDrawerMode.label}
                  subtitle={activeDrawerMode.value}
                >
                  <div className="price-drawer__panel-body" data-mode={drawerMode}>
                    {drawerPanels[drawerMode]}
                  </div>
                </OpenUiPanel>
              </div>
            ),
          }}
        />
      </div>
    </OpenUiProvider>
  );
}
