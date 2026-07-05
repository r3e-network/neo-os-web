/**
 * PlayArea.tsx — Oracle Price Console (v2 scene-driven rebuild)
 * Oracle/DeFi identity. The market feed IS the scene: a foreground price ticket,
 * a clean market visual, and a compact watchlist. Fetch is primary; contract
 * and reference details stay tucked behind drawer tabs.
 */
import { type ReactNode, useState } from "react";
import { LineChart, RadioTower, ShieldCheck, type LucideIcon } from "lucide-react";
import { CoinArt } from "@shared/art";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { OpenUiPanel, OpenUiProvider, OpenUiSegmented, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface PlayAreaProps { t: (key: string, p?: Record<string, string | number>) => string; state: Record<string, Observable>; dispatch: (n: string, ...a: unknown[]) => Promise<void>; }

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

function assetIcon(symbol: string): LucideIcon {
  const key = symbol.trim().toUpperCase();
  if (key === "BTC") return LineChart;
  if (key === "GAS") return ShieldCheck;
  return RadioTower;
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
  const asset = str("asset", "NEO");
  const priceDisplay = str("priceDisplay", t("notAvailable"));
  const networkDisplay = str("networkDisplay", "");
  const datafeedShort = str("datafeedShort", "");
  const datafeedHash = str("datafeedHash", "");
  const sourceLabel = str("sourceLabel", "");
  const errorMsg = str("errorMsg", "");
  const isRequesting = bool("isRequesting");
  const freshnessLabel = str("freshnessLabel", t("priceStatusReady"));
  const freshnessTimestamp = str("freshnessTimestamp", "");
  const availablePairs = (val("availablePairs") ?? []) as string[];
  const pairOptions = (availablePairs.length > 0 ? availablePairs : ASSETS).slice(0, 6);
  const feedContractLabel = datafeedShort || datafeedHash || t("priceRouteFeedPending");
  const activeCoinVariant = assetCoinVariant(asset);
  const routeState = isRequesting
    ? t("priceRouteReading")
    : freshnessTimestamp
      ? t("priceStatusLive")
      : t("priceRouteQueued");
  const drawerModes: Array<{ mode: DrawerMode; label: string; value: string; icon: LucideIcon }> = [
    { mode: "signal", label: t("priceSignalTitle"), value: priceDisplay, icon: LineChart },
    { mode: "contract", label: t("feedTicketContract"), value: feedContractLabel, icon: RadioTower },
    { mode: "reference", label: t("priceReferenceTitle"), value: routeState, icon: ShieldCheck },
  ];
  const setDrawerModeSafe = (mode: string) => {
    if (drawerModes.some((item) => item.mode === mode)) setDrawerMode(mode as DrawerMode);
  };
  const activeDrawerMode = drawerModes.find((item) => item.mode === drawerMode) ?? drawerModes[0];
  const ActiveDrawerIcon = activeDrawerMode.icon;

  const scene = (
    <div className="price-station" data-state={isRequesting ? "fetching" : errorMsg ? "error" : freshnessTimestamp ? "live" : "idle"}>
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
          <strong>{priceDisplay}</strong>
        </div>
        <div className="price-ticket__meta">
          <span className="price-ticket__freshness">
            <span className="price-ticket__dot" />
            {freshnessLabel}
          </span>
          <span>{sourceLabel || t("priceRouteSourceFallback")}</span>
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
              onClick={() => void dispatch("updateAsset", sym)}
              disabled={isRequesting}
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
        <div><dt>{t("latestPrice")}</dt><dd>{priceDisplay}</dd></div>
        <div><dt>{t("freshnessLabel")}</dt><dd>{freshnessLabel}</dd></div>
        <div><dt>{t("sourceLabel")}</dt><dd>{sourceLabel || t("priceRouteSourceFallback")}</dd></div>
        {freshnessTimestamp && <div><dt>{t("ageJustNow")}</dt><dd>{freshnessTimestamp}</dd></div>}
      </dl>
    ),
    contract: (
      <dl className="price-drawer-list">
        <div><dt>{t("feedTicketContract")}</dt><dd>{feedContractLabel}</dd></div>
        <div><dt>{t("priceReferenceContract")}</dt><dd>{datafeedHash ? <code>{datafeedShort || datafeedHash}</code> : t("priceRouteFeedPending")}</dd></div>
        <div><dt>{t("priceRouteFeed")}</dt><dd>{datafeedHash || t("priceRouteFeedPending")}</dd></div>
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
          actions={{ primary: { label: isRequesting ? t("readingPair", { pair: asset }) : t("fetchPair", { pair: asset }), onClick: () => void dispatch("fetchPrice"), loading: isRequesting, disabled: isRequesting } }}
          drawerToggleLabel={t("feedTicketContract")}
          drawer={{
            title: t("feedTicketContract"),
            children: (
              <div className="price-drawer">
                <OpenUiSegmented
                  className="price-drawer-tabs"
                  segmentedClassName="price-drawer-tabs__group"
                  label={t("feedTicketContract")}
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
