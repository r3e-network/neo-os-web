import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, BadgeDollarSign, Store, Wallet } from "lucide-react";
import { CoinArt } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface Listing {
  id: string;
  priceGas?: string;
  price?: string;
  title?: string;
  status?: string;
  isMine?: boolean;
  myPendingPayment?: string;
  accountIdHash?: string;
}

const EMPTY_LISTINGS: Listing[] = [];

function compact(value: string, fallback = "-"): string {
  const trimmed = value.trim();
  return trimmed ? formatHash(trimmed, 6) : fallback;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, num, val } = useStateBindings(state);
  const listingsValue = val<Listing[]>("listings", EMPTY_LISTINGS);
  const listings = useMemo(() => listingsValue ?? EMPTY_LISTINGS, [listingsValue]);
  const walletAddress = str("walletAddress");
  const marketHash = str("marketHash");
  const marketHashDisplay = str("marketHashDisplay") || compact(marketHash, t("unset"));
  const walletDisplay = str("walletDisplay") || compact(walletAddress, t("notConnected"));
  const selectedListingId = str("selectedListingId");
  const selectedListing = (val<Listing | null>("selectedListing", null) ?? null) as Listing | null;
  const selectedListingDisplay = str("selectedListingDisplay") || (selectedListing ? `#${selectedListing.id}` : t("unset"));
  const activeListingsDisplay = num("activeListingsDisplay", listings.filter((listing) => listing.status === "active").length);
  const totalListingsDisplay = num("totalListingsDisplay", listings.length);
  const canBuySelectedListing = bool("canBuySelectedListing");
  const canManageSelectedListing = bool("canManageSelectedListing");
  const selectedListingHasPendingRefund = bool("selectedListingHasPendingRefund");
  const isLoading = bool("isLoading");
  const isBuying = bool("isBuying");
  const isCancelling = bool("isCancelling");
  const isRefunding = bool("isRefunding");
  const isWalletConnecting = bool("isWalletConnecting");

  const [marketInput, setMarketInput] = useState(marketHash);
  const [newBackupOwner, setNewBackupOwner] = useState(str("newBackupOwner") || walletAddress);
  const [tradePulse, setTradePulse] = useState(0);
  const tradeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMarketInput(marketHash), [marketHash]);
  useEffect(() => {
    if (!newBackupOwner && walletAddress) setNewBackupOwner(walletAddress);
  }, [newBackupOwner, walletAddress]);
  useEffect(() => () => {
    if (tradeTimeout.current) clearTimeout(tradeTimeout.current);
  }, []);

  const busy = isLoading || isBuying || isCancelling || isRefunding || isWalletConnecting;
  const activeListing = useMemo(
    () => selectedListing || listings.find((listing) => listing.id === selectedListingId) || listings[0],
    [listings, selectedListing, selectedListingId],
  );
  const routeState = busy
    ? "working"
    : activeListing
      ? "selected"
      : listings.length
        ? "loaded"
        : walletAddress
          ? "ready"
          : "needs-wallet";
  const routeStatusText = busy
    ? t("marketRouteWorking")
    : routeState === "selected"
      ? t("marketRouteSelected")
      : routeState === "loaded"
        ? t("marketRouteListings")
        : routeState === "ready"
          ? t("marketRouteReady")
          : t("marketRouteNeedsWallet");
  const deskTitle = activeListing?.title || (activeListing ? `#${activeListing.id}` : t("marketDeskTitle"));
  const deskDetail = activeListing
    ? t("buyEscrowExplainer", { price: activeListing.priceGas || activeListing.price || "-" })
    : t("marketDeskCaption");
  const routeSteps = [
    { key: "wallet", label: t("marketRouteWallet"), done: Boolean(walletAddress), icon: <Wallet size={18} /> },
    { key: "read", label: t("marketRouteRead"), done: listings.length > 0 || isLoading, icon: <Store size={18} /> },
    { key: "list", label: t("marketRouteList"), done: Boolean(activeListing), icon: <BadgeDollarSign size={18} /> },
    { key: "settle", label: t("marketRouteSettle"), done: isBuying || routeState === "selected", icon: <ArrowRightLeft size={18} /> },
  ];

  const startTradePulse = () => {
    setTradePulse((tick) => tick + 1);
    if (tradeTimeout.current) clearTimeout(tradeTimeout.current);
    tradeTimeout.current = setTimeout(() => {
      tradeTimeout.current = null;
    }, 1100);
  };

  const syncMarketInput = (value: string) => {
    setMarketInput(value);
    state.marketHash?.set(value);
  };

  const syncBackupOwner = (value: string) => {
    setNewBackupOwner(value);
    state.newBackupOwner?.set(value);
  };

  const loadListings = async () => {
    if (!walletAddress) {
      await dispatch("connectWallet");
      return;
    }
    await dispatch("loadListings", marketInput.trim());
  };

  const selectListing = (listing: Listing) => {
    void dispatch("selectListing", listing.id);
  };

  const buySelected = async () => {
    if (!activeListing || !canBuySelectedListing) return;
    startTradePulse();
    await dispatch("buySelected", newBackupOwner.trim() || walletAddress);
  };

  const scene = (
    <div className="market-scene" data-state={routeState} data-pulse={tradePulse}>
      <figure className="market-scene__desk-card" aria-label={t("marketDeskLabel")}>
        <img className="market-scene__desk-image" src="./market-escrow-desk.webp" alt={t("marketHeroVisualAlt")} />
        <figcaption className="market-scene__desk-caption">
          <span>{t("marketHeroVisualBadge")}</span>
          <strong>{deskTitle}</strong>
          <small>{deskDetail}</small>
        </figcaption>
        <dl className="market-scene__desk-stats" aria-label={t("marketMetricsLabel")}>
          <div>
            <dt>{t("marketMetricListings")}</dt>
            <dd>{totalListingsDisplay}</dd>
          </div>
          <div>
            <dt>{t("marketMetricActive")}</dt>
            <dd>{activeListingsDisplay}</dd>
          </div>
        </dl>
      </figure>

      <section className="market-scene__trade-panel" aria-label={t("marketRouteTitle")}>
        <header className="market-scene__trade-head">
          <span>{t("marketRouteEyebrow")}</span>
          <strong>{routeStatusText}</strong>
        </header>

        <div className="market-scene__route" aria-label={t("marketRouteStepsLabel")}>
          {routeSteps.map((step, index) => (
            <span key={step.key} className={step.done ? "is-done" : ""}>
              <i aria-hidden="true">{step.icon}</i>
              <strong>{step.label}</strong>
              {index < routeSteps.length - 1 && <em aria-hidden="true" />}
            </span>
          ))}
        </div>

        <div className="market-scene__shelf">
          {listings.length ? (
            listings.slice(0, 5).map((listing, index) => {
              const selected = activeListing?.id === listing.id;
              return (
                <button
                  key={listing.id}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  style={{ animationDelay: `${index * 65}ms` }}
                  onClick={() => selectListing(listing)}
                >
                  <span className="market-scene__listing-face">
                    <CoinArt size={28} variant="gas" />
                  </span>
                  <span className="market-scene__listing-copy">
                    <strong>{listing.title || `#${listing.id}`}</strong>
                    <small>{listing.priceGas || listing.price || "-"} GAS</small>
                  </span>
                  <em>{selected ? t("selected") : t("selectListing")}</em>
                </button>
              );
            })
          ) : (
            <div className="market-scene__empty">
              <Store size={30} />
              <strong>{walletAddress ? t("emptyStateNoListingsTitle") : t("emptyStateConnectTitle")}</strong>
              <span>{walletAddress ? t("marketRouteReady") : t("marketRouteNeedsWallet")}</span>
            </div>
          )}
        </div>
      </section>

      <p className="market-scene__status" aria-live="polite">
        {routeStatusText}
      </p>
    </div>
  );

  const drawer = (
    <div className="market-drawer">
      <OpenUiPanel
        className="market-drawer__panel market-drawer__panel--wide"
        icon={<Wallet size={16} />}
        title={t("walletAndMarket")}
        subtitle={walletAddress ? walletDisplay : t("marketRouteNeedsWallet")}
        titleId="market-drawer-wallet"
      >
        <OpenUiTextField
          className="market-drawer__field"
          label={t("marketHash")}
          value={marketInput}
          onChange={(event) => syncMarketInput(event.target.value)}
          placeholder={t("marketHashPlaceholder")}
          disabled={busy}
          mono
        />
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost"
          onClick={() => void loadListings()}
          disabled={!walletAddress ? isWalletConnecting : !marketInput.trim() || isLoading}
        >
          {!walletAddress ? t("connectWallet") : isLoading ? t("loadingListings") : t("loadListings")}
        </button>
      </OpenUiPanel>

      <OpenUiPanel
        className="market-drawer__panel"
        icon={<Store size={16} />}
        title={t("marketBoardTitle")}
        subtitle={`${listings.length} ${t("marketMetricListings")}`}
        titleId="market-drawer-board"
      >
        {listings.length ? (
          <div className="market-list">
            {listings.slice(0, 10).map((listing) => (
              <button
                key={listing.id}
                type="button"
                className={activeListing?.id === listing.id ? "is-selected" : ""}
                onClick={() => selectListing(listing)}
              >
                <span>#{listing.id}</span>
                <strong>{listing.title || t("untitledListing")}</strong>
                <em>{listing.priceGas || listing.price || "-"} GAS</em>
              </button>
            ))}
          </div>
        ) : (
          <OpenUiNotice
            className="market-drawer__notice"
            icon={<Store size={17} />}
            title={walletAddress ? t("emptyStateNoListingsTitle") : t("emptyStateConnectTitle")}
          >
            {walletAddress ? t("emptyStateNoListings") : t("emptyStateConnect")}
          </OpenUiNotice>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="market-drawer__panel"
        icon={<BadgeDollarSign size={16} />}
        title={t("selectedListingLabel")}
        subtitle={selectedListingDisplay}
        titleId="market-drawer-selected"
      >
        <dl className="market-facts">
          <div><dt>{t("selectedListingLabel")}</dt><dd>{selectedListingDisplay}</dd></div>
          <div><dt>{t("priceLabel")}</dt><dd>{activeListing?.priceGas || activeListing?.price || "-"}</dd></div>
          <div><dt>{t("accountIdLabel")}</dt><dd>{compact(activeListing?.accountIdHash || "", t("unset"))}</dd></div>
        </dl>
        <OpenUiTextField
          className="market-drawer__field"
          label={t("newBackupOwnerInput")}
          value={newBackupOwner}
          onChange={(event) => syncBackupOwner(event.target.value)}
          placeholder={t("newBackupOwnerPlaceholder")}
          disabled={busy}
          mono
        />
        <div className="market-drawer__actions">
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void buySelected()} disabled={!canBuySelectedListing || busy}>
            {isBuying ? t("loadingListings") : t("buyListingCta")}
          </button>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("cancelSelected")} disabled={!canManageSelectedListing || busy}>
            {t("cancelListingCta")}
          </button>
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("refundSelected")} disabled={!selectedListingHasPendingRefund || busy}>
            {t("refundPendingCta")}
          </button>
        </div>
      </OpenUiPanel>
    </div>
  );

  return (
    <div className="aa-market-play-area mx2 mx2-cat-defi">
      <OpenUiProvider>
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("marketRouteEyebrow"),
            title: t("marketHeroTitle"),
            subtitle: t("marketRouteCopy"),
            badges: (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" /> {activeListingsDisplay} {t("statusActive")}
              </span>
            ),
          }}
          scene={scene}
          score={[
            { label: t("marketMetricListings"), value: String(totalListingsDisplay), accent: true },
            { label: t("walletLabel"), value: walletDisplay },
            { label: t("marketHash"), value: marketHashDisplay },
          ]}
          actions={{
            primary: !walletAddress
              ? {
                  label: t("connectWallet"),
                  onClick: () => void dispatch("connectWallet"),
                  loading: isWalletConnecting,
                  icon: <Wallet size={17} />,
                }
              : canBuySelectedListing
                ? {
                    label: isBuying ? t("marketRouteWorking") : t("buyListingCta"),
                    onClick: () => void buySelected(),
                    disabled: busy,
                    loading: isBuying,
                    icon: <ArrowRightLeft size={17} />,
                  }
                : {
                    label: isLoading ? t("loadingListings") : t("loadListings"),
                    onClick: () => void loadListings(),
                    disabled: !marketInput.trim() || busy,
                    loading: isLoading,
                    icon: <Store size={17} />,
                  },
            secondary: walletAddress && canManageSelectedListing
              ? [{ label: t("cancelListingCta"), onClick: () => void dispatch("cancelSelected"), disabled: busy }]
              : undefined,
          }}
          drawerToggleLabel={t("marketBoardTitle")}
          drawer={{ title: t("marketBoardTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
