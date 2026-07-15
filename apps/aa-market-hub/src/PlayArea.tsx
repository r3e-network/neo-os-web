import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Wallet,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteSegmented as OpenUiSegmented,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatHash } from "@shared/utils/format";
import "./PlayArea.scss";

interface Props {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface Listing {
  id: string;
  priceRaw?: string;
  priceGas?: string;
  title?: string;
  metadataUri?: string;
  status?: string;
  isMine?: boolean;
  isCanonicalAA?: boolean;
  pendingPaymentKnown?: boolean;
  myPendingPayment?: string;
  accountIdHash?: string;
  seller?: string;
  buyer?: string;
  updatedAt?: string;
}

interface PendingOperation {
  kind?: string;
  txid?: string;
  createdAt?: number;
}

const EMPTY_LISTINGS: Listing[] = [];
const PRICE_PRESETS = ["0.1", "1", "10"];

function compact(value: string, fallback = "—"): string {
  const trimmed = value.trim();
  return trimmed ? formatHash(trimmed, 6) : fallback;
}

function listingName(listing: Listing, t: Props["t"]): string {
  return listing.title?.trim() || `${t("aaShellLabel")} #${listing.id}`;
}

function safeMetadataUrl(value: string | undefined): string {
  const candidate = value?.trim() || "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export default function PlayArea({ t, state, dispatch }: Props) {
  const { str, bool, num, val } = useStateBindings(state);
  const mode = str("mode") === "sell" ? "sell" : "explore";
  const network = str("network") || "mainnet";
  const walletAddress = str("walletAddress");
  const walletDisplay = str("walletDisplay") || compact(walletAddress, t("notConnected"));
  const marketHash = str("marketHash");
  const marketHashDisplay = str("marketHashDisplay") || compact(marketHash);
  const listingsValue = val<Listing[]>("listings", EMPTY_LISTINGS);
  const listings = useMemo(() => listingsValue ?? EMPTY_LISTINGS, [listingsValue]);
  const selectedListing = val<Listing | null>("selectedListing", null);
  const pendingOperation = val<PendingOperation | null>("pendingOperation", null);
  const dataSource = str("dataSource") || "idle";
  const lastError = str("lastError");
  const lastSuccess = str("lastSuccess");
  const transactionNotice = str("transactionNotice");
  const recoveryStorageHealthy = bool("recoveryStorageHealthy");
  const activeAction = str("activeAction");
  const cancelConfirmationId = str("cancelConfirmationId");
  const listingsNotice = str("listingsTruncatedNotice");
  const totalListings = num("totalListingsDisplay", listings.length);
  const activeListings = num(
    "activeListingsDisplay",
    listings.filter((listing) => listing.status === "active").length,
  );
  const isLoading = bool("isLoading");
  const isSubmitting = bool("isSubmitting");
  const isRecovering = bool("isRecovering");
  const isWalletConnecting = bool("isWalletConnecting");
  const canBuySelectedListing = bool("canBuySelectedListing");
  const canManageSelectedListing = bool("canManageSelectedListing");
  const hasPendingRefund = bool("selectedListingHasPendingRefund");

  const [accountId, setAccountId] = useState(str("accountIdHash"));
  const [price, setPrice] = useState(str("priceGas") || "1");
  const [title, setTitle] = useState(str("listingTitle"));
  const [metadata, setMetadata] = useState(str("metadataUri"));
  const [nextPrice, setNextPrice] = useState(str("nextPriceGas"));
  const [backupOwner, setBackupOwner] = useState(str("newBackupOwner") || walletAddress);

  useEffect(() => {
    if (selectedListing?.priceGas) setNextPrice(selectedListing.priceGas);
  }, [selectedListing?.id, selectedListing?.priceGas]);
  useEffect(() => {
    if (!backupOwner && walletAddress) setBackupOwner(walletAddress);
  }, [backupOwner, walletAddress]);

  const visibleListings = useMemo(() => {
    const active = listings.filter((listing) => listing.status === "active");
    return (active.length ? active : listings).slice(0, 8);
  }, [listings]);
  const busy = isLoading || isSubmitting || isRecovering || isWalletConnecting;
  const numericPrice = Number(price);
  const createDraftValid = /^(?:0x)?[0-9a-fA-F]{40}$/.test(accountId.trim()) &&
    /^\d+(?:\.\d{1,8})?$/.test(price.trim()) &&
    Number.isFinite(numericPrice) && numericPrice >= 0.01 && numericPrice <= 1000;
  const selectedPrice = selectedListing?.priceGas || "—";
  const selectedMetadataUrl = safeMetadataUrl(selectedListing?.metadataUri);
  const selectedName = selectedListing ? listingName(selectedListing, t) : t("selectListingPrompt");
  const sourceLabel = dataSource === "chain"
    ? t("chainLive")
    : dataSource === "partial"
      ? t("chainPartial")
      : dataSource === "failed"
        ? t("chainUnavailable")
        : t("chainLoading");

  const setMode = (next: "explore" | "sell") => void dispatch("setMode", next);
  const selectListing = (listing: Listing) => void dispatch("selectListing", listing.id);
  const refresh = () => void dispatch("loadListings");
  const connect = () => void dispatch("connectWallet");
  const recover = () => void dispatch("recoverPending");
  const buy = () => void dispatch("buySelected", backupOwner.trim() || walletAddress);
  const refund = () => void dispatch("refundSelected");
  const create = () => void dispatch(
    "createListing",
    accountId.trim(),
    price.trim(),
    title.trim(),
    metadata.trim(),
  );

  const primaryAction = pendingOperation
    ? {
        label: isRecovering ? t("checkingConfirmation") : t("checkConfirmation"),
        onClick: recover,
        loading: isRecovering,
        disabled: isRecovering,
        icon: <RefreshCw size={17} />,
      }
    : mode === "sell"
      ? !walletAddress
        ? {
            label: t("connectToList"),
            onClick: connect,
            loading: isWalletConnecting,
            icon: <Wallet size={17} />,
          }
        : {
            label: activeAction === "create" ? t("submittingListing") : t("publishListing"),
            onClick: create,
            loading: activeAction === "create",
            disabled: !createDraftValid || busy,
            icon: <Plus size={17} />,
          }
      : hasPendingRefund
        ? {
            label: activeAction === "refund" ? t("checkingConfirmation") : t("recoverPayment"),
            onClick: refund,
            loading: activeAction === "refund",
            disabled: busy,
            icon: <RotateCcw size={17} />,
          }
        : !walletAddress && selectedListing
          ? {
              label: t("connectToBuy"),
              onClick: connect,
              loading: isWalletConnecting,
              icon: <Wallet size={17} />,
            }
          : canBuySelectedListing
            ? {
                label: activeAction === "buy"
                  ? t("checkingConfirmation")
                  : t("buyForGas", { price: selectedPrice }),
                onClick: buy,
                loading: activeAction === "buy",
                disabled: busy,
                icon: <ShoppingBag size={17} />,
              }
            : {
                label: isLoading ? t("loadingListings") : t("refreshMarket"),
                onClick: refresh,
                loading: isLoading,
                disabled: busy,
                icon: <RefreshCw size={17} />,
              };

  const hero = (
    <section className="aa-market-hero" aria-label={t("marketHeroVisualAlt")}>
      <img
        className="aa-market-hero__image"
        src="./market-escrow-desk.webp"
        alt={t("marketHeroVisualAlt")}
        loading="eager"
      />
      <div className="aa-market-hero__legibility" />
      <div className="aa-market-hero__copy">
        <span><ShieldCheck size={15} /> {t("canonicalEscrow")}</span>
        <strong>{mode === "sell" ? t("sellHeroTitle") : t("exploreHeroTitle")}</strong>
        <p>{mode === "sell" ? t("sellHeroCopy") : t("exploreHeroCopy")}</p>
      </div>
      <div className="aa-market-hero__metrics">
        <span><strong>{activeListings}</strong><small>{t("marketMetricActive")}</small></span>
        <span><strong>{totalListings}</strong><small>{t("marketMetricListings")}</small></span>
      </div>
    </section>
  );

  const exploreWorkbench = (
    <section className="aa-market-workbench" aria-label={t("exploreMarket") }>
      <header className="aa-market-workbench__head">
        <div>
          <span className={`aa-market-source aa-market-source--${dataSource}`}>
            <i /> {sourceLabel}
          </span>
          <strong>{t("liveListingsTitle")}</strong>
          <small>{t("liveListingsCopy")}</small>
        </div>
        <button type="button" className="aa-market-icon-btn" onClick={refresh} disabled={busy} aria-label={t("refreshMarket")}>
          <RefreshCw size={17} className={isLoading ? "is-spinning" : undefined} />
        </button>
      </header>

      {listingsNotice && <p className="aa-market-inline-note">{listingsNotice}</p>}
      <div className="aa-market-listings">
        {visibleListings.length ? visibleListings.map((listing, index) => {
          const selected = selectedListing?.id === listing.id;
          const unavailable = listing.status !== "active" || !listing.isCanonicalAA;
          return (
            <button
              type="button"
              key={listing.id}
              className={["aa-market-listing", selected ? "is-selected" : "", unavailable ? "is-unavailable" : ""].filter(Boolean).join(" ")}
              style={{ animationDelay: `${index * 45}ms` }}
              onClick={() => selectListing(listing)}
              aria-pressed={selected}
            >
              <span className="aa-market-listing__asset"><PackageCheck size={23} /></span>
              <span className="aa-market-listing__body">
                <small>AA #{listing.id}</small>
                <strong>{listingName(listing, t)}</strong>
                <span>{compact(listing.accountIdHash || "")}</span>
              </span>
              <span className="aa-market-listing__price">
                <CoinArt size={25} variant="gas" />
                <strong>{listing.priceGas || "—"}</strong>
                <small>GAS</small>
              </span>
              <span className="aa-market-listing__badges">
                {listing.isMine && <em>{t("mine")}</em>}
                {!listing.isCanonicalAA && <em className="is-warning">{t("unverified")}</em>}
              </span>
            </button>
          );
        }) : (
          <div className="aa-market-empty">
            <Store size={34} />
            <strong>{isLoading ? t("emptyStateLoadingTitle") : t("emptyStateNoListingsTitle")}</strong>
            <span>{isLoading ? t("emptyStateLoading") : t("emptyMarketDiscovery")}</span>
            {!isLoading && <button type="button" onClick={refresh}>{t("refreshMarket")}</button>}
          </div>
        )}
      </div>

      <aside className="aa-market-checkout" aria-label={t("selectedListingLabel")}>
        <div className="aa-market-checkout__asset"><Sparkles size={28} /></div>
        <div className="aa-market-checkout__copy">
          <small>{selectedListing ? `AA #${selectedListing.id}` : t("marketSelection")}</small>
          <strong>{selectedName}</strong>
          <span>{selectedListing ? compact(selectedListing.accountIdHash || "") : t("selectListingHelp")}</span>
        </div>
        <div className="aa-market-checkout__price">
          <span><CoinArt size={30} variant="gas" /><strong>{selectedPrice}</strong><small>GAS</small></span>
          {selectedListing?.isCanonicalAA === false && <em>{t("nonCanonicalListing")}</em>}
          {selectedListing?.isMine && <em>{t("yourListing")}</em>}
        </div>
      </aside>
    </section>
  );

  const sellWorkbench = (
    <section className="aa-market-workbench aa-market-workbench--sell" aria-label={t("createListingTitle")}>
      <div className="aa-market-builder">
        <header>
          <span><Tag size={15} /> {t("listingStudio")}</span>
          <strong>{t("buildListingTitle")}</strong>
          <p>{t("buildListingCopy")}</p>
        </header>

        <OpenUiTextField
          className="aa-market-field aa-market-field--account"
          label={t("accountIdInput")}
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          placeholder={t("accountIdHashPlaceholder")}
          disabled={busy}
          mono
        />

        <div className="aa-market-price-editor">
          <span>{t("choosePrice")}</span>
          <div className="aa-market-price-presets">
            {PRICE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={price === preset ? "is-selected" : ""}
                onClick={() => setPrice(preset)}
                disabled={busy}
              >
                <CoinArt size={20} variant="gas" /> {preset} GAS
              </button>
            ))}
          </div>
          <OpenUiTextField
            className="aa-market-field aa-market-field--price"
            label={t("customPrice")}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={t("pricePlaceholder")}
            inputMode="decimal"
            disabled={busy}
          />
          <small>{t("priceBoundsHint")}</small>
        </div>

        <OpenUiTextField
          className="aa-market-field"
          label={t("titleInput")}
          value={title}
          onChange={(event) => setTitle(event.target.value.slice(0, 80))}
          placeholder={t("titlePlaceholder")}
          disabled={busy}
          maxLength={80}
        />

        <details className="aa-market-advanced">
          <summary>{t("optionalListingDetails")}</summary>
          <OpenUiTextField
            className="aa-market-field"
            label={t("metadataInput")}
            value={metadata}
            onChange={(event) => setMetadata(event.target.value.slice(0, 240))}
            placeholder={t("metadataPlaceholder")}
            disabled={busy}
            maxLength={240}
          />
          <dl>
            <div><dt>{t("aaContractLabel")}</dt><dd>{compact(str("aaContractHash"))}</dd></div>
            <div><dt>{t("marketHash")}</dt><dd>{marketHashDisplay}</dd></div>
          </dl>
        </details>
      </div>

      <aside className="aa-market-preview" aria-label={t("createPreviewLabel")}>
        <span className="aa-market-preview__badge"><BadgeCheck size={15} /> {t("canonicalAsset")}</span>
        <div className="aa-market-preview__asset"><PackageCheck size={50} /></div>
        <small>{t("createPreviewLabel")}</small>
        <strong>{title.trim() || t("previewTitlePlaceholder")}</strong>
        <span>{compact(accountId, t("previewAccountPlaceholder"))}</span>
        <div><CoinArt size={34} variant="gas" /><strong>{price || "—"}</strong><small>GAS</small></div>
        <p>{t("createNoFeeNote")}</p>
      </aside>
    </section>
  );

  const scene = (
    <div className="aa-market-scene">
      <div className="aa-market-mode-row">
        <OpenUiSegmented
          className="aa-market-mode"
          label={t("marketMode")}
          value={mode}
          onChange={(value) => setMode(value === "sell" ? "sell" : "explore")}
          options={[
            { value: "explore", label: <span><ShoppingBag size={16} /> {t("exploreMarket")}</span> },
            { value: "sell", label: <span><Tag size={16} /> {t("sellAnAddress")}</span> },
          ]}
        />
        <span className="aa-market-network"><i /> Neo N3 {network}</span>
      </div>

      {(lastError || lastSuccess || transactionNotice || !recoveryStorageHealthy) && (
        <div className={`aa-market-feedback ${lastError ? "is-error" : lastSuccess ? "is-success" : "is-pending"}`} role={lastError ? "alert" : "status"}>
          <span>
            {lastError ? <CircleDollarSign size={17} /> : lastSuccess ? <BadgeCheck size={17} /> : <Clock3 size={17} />}
            <strong>{lastError || lastSuccess || transactionNotice || t("pendingStorageUnavailable")}</strong>
            {pendingOperation?.txid && <small>{compact(pendingOperation.txid)}</small>}
            {!recoveryStorageHealthy && (lastError || lastSuccess || transactionNotice) && (
              <small>{t("pendingStorageUnavailable")}</small>
            )}
          </span>
          {pendingOperation && (
            <button type="button" onClick={recover} disabled={isRecovering}>
              <RefreshCw size={14} className={isRecovering ? "is-spinning" : undefined} />
              {isRecovering ? t("checkingConfirmation") : t("checkConfirmation")}
            </button>
          )}
        </div>
      )}

      <div className="aa-market-layout">
        {hero}
        {mode === "sell" ? sellWorkbench : exploreWorkbench}
      </div>
    </div>
  );

  const drawer = (
    <div className="aa-market-drawer">
      <OpenUiPanel
        className="aa-market-drawer__panel"
        icon={<ShoppingBag size={16} />}
        title={t("selectedListingLabel")}
        subtitle={selectedListing ? `#${selectedListing.id}` : t("selectListingPrompt")}
        titleId="aa-market-selected"
      >
        {selectedListing ? (
          <>
            <dl className="aa-market-facts">
              <div><dt>{t("priceLabel")}</dt><dd>{selectedPrice} GAS</dd></div>
              <div><dt>{t("accountIdLabel")}</dt><dd>{compact(selectedListing.accountIdHash || "")}</dd></div>
              <div><dt>{t("sellerLabel")}</dt><dd>{compact(selectedListing.seller || "")}</dd></div>
              <div><dt>{t("statusLabel")}</dt><dd>{t(`status${(selectedListing.status || "unknown").replace(/^./, (letter) => letter.toUpperCase())}`)}</dd></div>
            </dl>
            <details className="aa-market-advanced aa-market-advanced--drawer">
              <summary>{t("buyerControlDetails")}</summary>
              <OpenUiTextField
                className="aa-market-field"
                label={t("newBackupOwnerInput")}
                value={backupOwner}
                onChange={(event) => setBackupOwner(event.target.value)}
                placeholder={t("newBackupOwnerPlaceholder")}
                disabled={busy}
                mono
              />
              <p>{t("buyShellOnlyCaveat")}</p>
            </details>
            {selectedMetadataUrl && (
              <a className="aa-market-metadata" href={selectedMetadataUrl} target="_blank" rel="noreferrer">
                {t("viewMetadata")} <ExternalLink size={13} />
              </a>
            )}
          </>
        ) : (
          <OpenUiNotice icon={<Store size={17} />} title={t("selectListingPrompt")}>
            {t("selectListingHelp")}
          </OpenUiNotice>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="aa-market-drawer__panel"
        icon={<Tag size={16} />}
        title={t("sellerTools")}
        subtitle={canManageSelectedListing ? t("yourListing") : t("sellerToolsHint")}
        titleId="aa-market-manage"
      >
        <OpenUiTextField
          className="aa-market-field"
          label={t("newPriceInput")}
          value={nextPrice}
          onChange={(event) => setNextPrice(event.target.value)}
          placeholder={t("newPricePlaceholder")}
          inputMode="decimal"
          disabled={!canManageSelectedListing || busy}
        />
        <div className="aa-market-drawer__actions">
          <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("updatePrice", nextPrice)} disabled={!canManageSelectedListing || busy}>
            {activeAction === "update" ? t("checkingConfirmation") : t("updatePriceCta")}
          </button>
          <button type="button" className="aa-market-danger" onClick={() => void dispatch("cancelSelected")} disabled={!canManageSelectedListing || busy}>
            {cancelConfirmationId === selectedListing?.id ? t("confirmCancellation") : t("cancelListingCta")}
          </button>
        </div>
        {cancelConfirmationId === selectedListing?.id && <p className="aa-market-cancel-warning">{t("cancelConfirmationCopy")}</p>}
        {hasPendingRefund && (
          <button type="button" className="aa-market-refund" onClick={refund} disabled={busy}>
            <RotateCcw size={15} /> {t("recoverPayment")}
          </button>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="aa-market-drawer__panel aa-market-drawer__panel--trust"
        icon={<ShieldCheck size={16} />}
        title={t("contractTrust")}
        subtitle={t("directWalletOnly")}
        titleId="aa-market-trust"
      >
        <div className="aa-market-trust-list">
          <span><BadgeCheck size={15} /><strong>{t("canonicalMarket")}</strong><small>{marketHashDisplay}</small></span>
          <span><Wallet size={15} /><strong>{t("walletWrites")}</strong><small>{walletDisplay}</small></span>
          <span><ArrowRight size={15} /><strong>{t("confirmationModel")}</strong><small>{t("confirmationModelCopy")}</small></span>
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
            eyebrow: t("marketHeroEyebrow"),
            title: t("marketHeroTitle"),
            subtitle: t("marketHeroSubtitle"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {sourceLabel}</span>,
          }}
          scene={scene}
          score={[
            { label: t("marketMetricActive"), value: String(activeListings), accent: true },
            { label: t("networkLabel"), value: network },
            { label: t("walletLabel"), value: walletDisplay },
          ]}
          actions={{
            primary: primaryAction,
            secondary: mode === "explore" && selectedListing
              ? [{ label: t("refreshMarket"), onClick: refresh, disabled: busy }]
              : undefined,
          }}
          drawerToggleLabel={t("marketControls")}
          drawer={{ title: t("marketControls"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
