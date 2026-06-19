/**
 * PlayArea.tsx - Neo Treasury
 *
 * Treasury dashboard and connected-wallet disbursement workspace.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput, NeoSelect } from "@shared/components-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { getLaunchParam } from "@shared/utils/launch-params";
import {
  DA_HONGFEI_ADDRESSES,
  ERIK_ZHANG_ADDRESSES,
} from "./utils/treasury";
import {
  buildTreasuryDisbursementPreview,
  type TreasuryAsset,
  type TreasuryDisbursementPreview,
  type TreasuryTransferIntent,
} from "./utils/treasuryOperations";
import TreasuryLoadingState from "./components/TreasuryLoadingState";
import "./PlayArea.scss";

interface TreasuryData {
  totalUsd: number | null;
  totalNeo: number;
  totalGas: number;
  lastUpdated: number | string;
  prices: Record<string, unknown> | null;
  failedCount?: number;
  categories: Array<{
    name: string;
    failedCount?: number;
    totalUsd?: number | null;
    wallets?: Array<{
      address?: string;
      label?: string;
      neo?: number;
      gas?: number;
      failed?: boolean;
    }>;
    [key: string]: unknown;
  }>;
}

function formatNumber(value: unknown, maximumFractionDigits = 2) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits });
}

function formatLastUpdated(value: number | string | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function compactAddress(address: string) {
  if (address.length <= 16) return address;
  return `${address.slice(0, 7)}...${address.slice(-6)}`;
}

function compactTxid(txid: string) {
  if (!txid) return "";
  return txid.length > 18 ? `${txid.slice(0, 10)}...${txid.slice(-8)}` : txid;
}

function formatInlineError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const AMOUNT_PRESETS = ["0.1", "1", "5"];

export default function PlayArea({ t, state, dispatch, launchContext, setStatus }: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);

  const data = val<TreasuryData>("data");
  const loading = bool("loading");
  const stale = bool("stale");
  const error = str("error");
  const address = str("address");
  const disbursementSubmitting = bool("disbursementSubmitting");
  const disbursementStatus = str("disbursementStatus");
  const disbursementError = str("disbursementError");
  const lastTxid = str("lastTxid");
  const lastIntent = val<TreasuryTransferIntent | null>("lastIntent", null);
  const totalUsdDisplay = str("totalUsdDisplay");
  const totalNeoDisplay = str("totalNeoDisplay");
  const totalGasDisplay = str("totalGasDisplay");
  const hasLiveData = Boolean(data);
  // Cached figures from a failed fresh fetch are shown with an amber "cached"
  // signal, not the green "live synced" one (which would imply fresh data).
  const isStale = hasLiveData && stale;
  const failedCount = Number(data?.failedCount ?? 0);
  const priceFeedDown = hasLiveData && data?.totalUsd == null;
  const watchedAddressCount =
    DA_HONGFEI_ADDRESSES.length + ERIK_ZHANG_ADDRESSES.length;
  const lastUpdated = formatLastUpdated(data?.lastUpdated);
  const signalLabel = isStale
    ? t("treasuryStale")
    : hasLiveData
      ? t("treasuryLiveSynced")
      : loading
        ? t("treasuryLiveLoading")
        : t("treasuryLivePending");
  const isRefreshing = loading && hasLiveData;
  const [asset, setAsset] = useState<TreasuryAsset>("GAS");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");

  // Watchdog: if the first balance load has not resolved within this window
  // (e.g. no chain/host context, or every RPC endpoint is unreachable), drop the
  // indefinite spinner and surface an actionable empty state with Retry.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const firstLoadPending = loading && !hasLiveData;
  useEffect(() => {
    if (!firstLoadPending) {
      setLoadTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setLoadTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [firstLoadPending]);
  const showFirstLoadSpinner = firstLoadPending && !loadTimedOut;

  useEffect(() => {
    const launchedAsset = getLaunchParam(launchContext, ["asset", "token"], "GAS").toUpperCase();
    setAsset(launchedAsset === "NEO" ? "NEO" : "GAS");
    setAmount(getLaunchParam(launchContext, ["amount", "value", "total"], ""));
    setRecipient(getLaunchParam(launchContext, ["recipient", "to", "address"], ""));
    setMemo(getLaunchParam(launchContext, ["memo", "note", "purpose"], "treasury-disbursement"));
  }, [launchContext.signature]);

  const networkLabel = launchContext.network === "testnet"
    ? t("networkTestnet")
    : t("networkMainnet");
  const submitDisabled = disbursementSubmitting || !amount.trim() || !recipient.trim();
  const assetOptions = useMemo(
    () => [
      { value: "GAS", label: "GAS" },
      { value: "NEO", label: "NEO" },
    ],
    [],
  );
  const hasDraftFields = Boolean(amount.trim() && recipient.trim());
  const draftReview = useMemo<{
    preview: TreasuryDisbursementPreview | null;
    error: string;
  }>(() => {
    if (!hasDraftFields) return { preview: null, error: "" };
    try {
      return {
        preview: buildTreasuryDisbursementPreview(
          { asset, amount, recipient, memo },
          address || undefined,
        ),
        error: "",
      };
    } catch (error) {
      return { preview: null, error: formatInlineError(error) };
    }
  }, [address, amount, asset, hasDraftFields, memo, recipient]);
  const submitBlocked = submitDisabled || Boolean(draftReview.error);
  const submitLabel = address ? t("submitDisbursement") : t("connectAndSignDisbursement");
  // Disconnected with nothing drafted yet -> the only sensible next step is to
  // connect a wallet, so the action slot shows a single "Connect Wallet" CTA.
  const showConnectOnly = !address && !hasDraftFields;

  // Use the same currency prefix as the hero metric (t('currencySymbol')) and
  // render the em-dash when USD is unavailable (price feed down).
  const currencySymbol = t("currencySymbol");
  const formatUsd = (value: number | null | undefined) =>
    typeof value === "number" ? `${currencySymbol}${formatNumber(value, 2)}` : "—";
  const PLACEHOLDER = "—";

  const watchGroups = data?.categories?.length
    ? data.categories.map((category) => ({
        name: String(category.name || t("treasuryGroup")),
        addresses: Array.isArray(category.wallets)
          ? category.wallets.length
          : 0,
        failedCount: Number(category.failedCount ?? 0),
        neo: `${formatNumber(category.totalNeo, 4)} NEO`,
        gas: `${formatNumber(category.totalGas, 4)} GAS`,
        usd: formatUsd(category.totalUsd),
        wallets: Array.isArray(category.wallets)
          ? category.wallets.map((wallet, index) => ({
              label: wallet.label || `${t("wallet")} ${index + 1}`,
              address: wallet.address || "",
              // A failed RPC read is shown as an em-dash, not a misleading 0.
              neo: wallet.failed ? PLACEHOLDER : `${formatNumber(wallet.neo, 4)} NEO`,
              gas: wallet.failed ? PLACEHOLDER : `${formatNumber(wallet.gas, 4)} GAS`,
            }))
          : [],
      }))
    : [
        {
          name: "Da Hongfei",
          addresses: DA_HONGFEI_ADDRESSES.length,
          failedCount: 0,
          neo: t("treasuryLivePending"),
          gas: t("treasuryLivePending"),
          usd: t("treasuryLivePending"),
          wallets: [],
        },
        {
          name: "Erik Zhang",
          addresses: ERIK_ZHANG_ADDRESSES.length,
          failedCount: 0,
          neo: t("treasuryLivePending"),
          gas: t("treasuryLivePending"),
          usd: t("treasuryLivePending"),
          wallets: [],
        },
      ];

  const handleRefresh = async () => {
    await dispatch("refresh");
  };

  const handleConnect = async () => {
    await dispatch("connectWallet");
  };

  const handleDisbursement = async () => {
    try {
      await dispatch("submitDisbursement", { asset, amount, recipient, memo });
      // Only emit the success toast on the success path. On failure the
      // registered action re-throws and the error is already surfaced via the
      // disbursementError observable, so we just swallow the rejection here to
      // avoid an unhandled promise rejection (NeoButton does not await onClick).
      setStatus(t("disbursementSubmitted"), "success");
    } catch {
      /* error already shown via disbursementError */
    }
  };

  return (
    <div className="treasury-play-area">
      <section className="treasury-hero" aria-label={t("title")}>
        <div className="treasury-hero__copy">
          <div className="treasury-hero__heading">
            <span className="treasury-hero__badge" aria-hidden="true">
              N
            </span>
            <div className="treasury-hero__titles">
              <span className="treasury-eyebrow">{t("docSubtitle")}</span>
              <h2>{t("title")}</h2>
            </div>
          </div>
          <p>{t("docDescription")}</p>
          <p className="treasury-hero__signal">
            <span
              className={[
                "treasury-hero__dot",
                isStale
                  ? "treasury-hero__dot--stale"
                  : hasLiveData
                    ? "treasury-hero__dot--live"
                    : "",
              ].filter(Boolean).join(" ")}
              aria-hidden="true"
            />
            <span className="treasury-hero__signal-text">
              {signalLabel}
              {lastUpdated ? ` · ${t("lastUpdated")} ${lastUpdated}` : ""}
            </span>
            {/* Single refresh affordance, co-located with the live-sync signal.
                The former bottom-card "Refresh Data" primary button is removed
                so the page keeps one obvious primary action (the disbursement
                CTA) instead of three competing buttons. */}
            <button
              type="button"
              className="treasury-hero__refresh"
              disabled={isRefreshing}
              onClick={handleRefresh}
              aria-label={isRefreshing ? t("refreshing") : t("refreshData")}
            >
              {isRefreshing ? t("refreshing") : t("refresh")}
            </button>
          </p>
          {failedCount > 0 && (
            <p className="treasury-hero__warning" role="status">
              {t("treasuryWalletsUnreachable", { count: failedCount })}
            </p>
          )}
          {priceFeedDown && (
            <p className="treasury-hero__warning" role="status">
              {t("treasuryPriceFeedUnavailable")}
            </p>
          )}
          {/* Price source disclosure: USD totals come from a Morpheus on-chain
              data feed that can lag the live market. */}
          {hasLiveData && !priceFeedDown && (
            <p className="treasury-hero__source" role="note">
              {t("priceFeedSourceNote")}
            </p>
          )}
        </div>
        <div className="treasury-hero__metrics" aria-label={t("treasuryInfo")}>
          <div className="treasury-metric">
            <span>{t("sidebarTotalUsd")}</span>
            <strong>{hasLiveData ? totalUsdDisplay : t("treasuryLivePending")}</strong>
          </div>
          <div className="treasury-metric">
            <span>{t("tokenNeo")}</span>
            <strong>{hasLiveData ? totalNeoDisplay : "—"}</strong>
          </div>
          <div className="treasury-metric">
            <span>{t("tokenGas")}</span>
            <strong>{hasLiveData ? totalGasDisplay : "—"}</strong>
          </div>
        </div>
      </section>

      <section className="treasury-ops" aria-label={t("operationsTitle")}>
        <NeoCard variant="erobo" className="treasury-operation-card">
          <div className="treasury-section-heading">
            <span>{t("operationsEyebrow")}</span>
            <strong>{t("disbursementTitle")}</strong>
            <p>{t("disbursementBoundary")}</p>
          </div>

          <div className="treasury-wallet-strip">
            <div>
              {/* Source clarity: payouts are funded by the connected wallet, not
                  the watched foundation treasury. */}
              <span>{t("fromYourWallet")}</span>
              <strong title={address || t("walletRequired")}>
                {address ? compactAddress(address) : t("walletRequired")}
              </strong>
            </div>
            <div>
              <span>{t("network")}</span>
              <strong>{networkLabel}</strong>
            </div>
            <div>
              <span>{t("status")}</span>
              <strong>{disbursementStatus}</strong>
            </div>
          </div>

          <div className="treasury-form-grid">
            <NeoSelect
              label={t("asset")}
              value={asset}
              options={assetOptions}
              onChange={(value) => setAsset(value === "NEO" ? "NEO" : "GAS")}
              required
            />
            <NeoInput
              label={t("amount")}
              value={amount}
              type="text"
              suffix={asset}
              placeholder="1"
              required
              onChange={setAmount}
            />
            <NeoInput
              className="treasury-form-grid__wide"
              label={t("recipient")}
              value={recipient}
              placeholder="N..."
              required
              onChange={setRecipient}
            />
            <p className="treasury-form-grid__wide treasury-recipient-caption">
              {t("recipientCaption")}
            </p>
            <NeoInput
              className="treasury-form-grid__wide"
              label={t("memo")}
              value={memo}
              type="textarea"
              placeholder="treasury-disbursement"
              onChange={setMemo}
            />
          </div>

          <div className="treasury-presets" aria-label={t("amountPresets")}>
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
              >
                {preset} {asset}
              </button>
            ))}
          </div>

          {/* The Asset/Amount/Recipient "Transfer review" strip was a verbatim
              echo of the form fields directly above it. The derived signing
              intent below (contract / fixed-8 amount / recipient hash) is the
              non-redundant summary, so the duplicate review row is dropped to
              shorten the console and give the editable form clear priority. */}

          <details
            className={[
              "treasury-intent-panel",
              draftReview.error ? "treasury-intent-panel--error" : "",
            ].filter(Boolean).join(" ")}
            open={Boolean(draftReview.error)}
          >
            <summary aria-label={t("intentTitle")}>
              <span className="treasury-intent-panel__head">
                <span>{t("intentTitle")}</span>
                <strong>
                  {draftReview.error
                    ? t("intentIssue")
                    : draftReview.preview
                      ? t("intentReady")
                      : t("intentWaiting")}
                </strong>
              </span>
              <span className="treasury-intent-panel__chevron" aria-hidden="true" />
            </summary>
            <div className="treasury-intent-panel__body" aria-live="polite">
              {draftReview.error && (
                <p className="treasury-error">{draftReview.error}</p>
              )}
              {!draftReview.error && !draftReview.preview && (
                <p>{t("intentWaitingCopy")}</p>
              )}
              {draftReview.preview && (
                <dl>
                  <div>
                    <dt>{t("intentContract")}</dt>
                    <dd title={draftReview.preview.scriptHash}>
                      {compactAddress(draftReview.preview.scriptHash)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("intentFixed8")}</dt>
                    <dd>{draftReview.preview.scaledAmount}</dd>
                  </div>
                  <div>
                    <dt>{t("intentRecipientHash")}</dt>
                    <dd title={draftReview.preview.recipientHash}>
                      {compactAddress(draftReview.preview.recipientHash)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("intentSigner")}</dt>
                    <dd title={draftReview.preview.senderHash || t("intentSignerConnect")}>
                      {draftReview.preview.senderHash
                        ? compactAddress(draftReview.preview.senderHash)
                        : t("intentSignerConnect")}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </details>

          {disbursementError && <p className="treasury-error">{disbursementError}</p>}

          {/* Single staged primary action. When disconnected with no draft yet,
              the only next step is to connect; once a payout is drafted (or the
              wallet is connected) the same slot becomes the progressive
              connect-and-sign / sign button. This replaces the two co-equal
              "Connect" / "Connect & Sign" CTAs so there is one obvious step. */}
          <div className="treasury-actions">
            {showConnectOnly ? (
              <NeoButton
                size="lg"
                variant="primary"
                className="op-btn"
                onClick={handleConnect}
                aria-label={t("connectWallet")}
              >
                {t("connectWallet")}
              </NeoButton>
            ) : (
              <NeoButton
                size="lg"
                variant="primary"
                className="op-btn"
                disabled={submitBlocked}
                loading={disbursementSubmitting}
                onClick={handleDisbursement}
                aria-label={submitLabel}
              >
                {submitLabel}
              </NeoButton>
            )}
            {address && (
              <button
                type="button"
                className="treasury-reconnect"
                onClick={handleConnect}
              >
                {t("connectWallet")}
              </button>
            )}
          </div>

          {lastTxid && (
            <div className="treasury-tx-receipt">
              <span>{t("lastTx")}</span>
              <strong title={lastTxid}>{compactTxid(lastTxid)}</strong>
              {lastIntent && (
                <p>
                  {lastIntent.amount} {lastIntent.asset}{" -> "}
                  {compactAddress(lastIntent.recipientHash)}
                </p>
              )}
            </div>
          )}
        </NeoCard>
      </section>

      {/* Initial-load skeleton (and retry-on-error) — fills the gap where the
          watchlist would otherwise paint empty "Live data pending" placeholders
          before the first fetch resolves. After the watchdog timeout it drops to
          an actionable empty state instead of an indefinite spinner. */}
      <TreasuryLoadingState
        t={t}
        loading={firstLoadPending}
        error={!hasLiveData ? error : ""}
        hasData={hasLiveData}
        timedOut={loadTimedOut}
        onRetry={handleRefresh}
      />

      {/* Resting / pre-load viewport: a compact, scannable reference of what the
          watchlist contains, instead of two heavy "Live data pending" cards or a
          blank gap. The full group cards take over once balances resolve. */}
      {!hasLiveData && !showFirstLoadSpinner && (
        <NeoCard variant="erobo" className="treasury-reference-card">
          <div className="treasury-reference-card__head">
            <span>{t("treasuryWatchlistNetwork")}</span>
            <strong>{t("watchlistReference")}</strong>
            <p>{t("watchlistReferenceHint")}</p>
          </div>
          <dl className="treasury-reference-card__groups">
            <div>
              <dt>Da Hongfei</dt>
              <dd>{DA_HONGFEI_ADDRESSES.length} {t("addresses")}</dd>
            </div>
            <div>
              <dt>Erik Zhang</dt>
              <dd>{ERIK_ZHANG_ADDRESSES.length} {t("addresses")}</dd>
            </div>
          </dl>
        </NeoCard>
      )}

      {hasLiveData && (
      <section className="treasury-watchlist" aria-label={t("treasuryWatchlist")}>
        <p className="treasury-watchlist__tag">{t("treasuryWatchlistNetwork")}</p>
        {watchGroups.map((group) => (
          <NeoCard variant="erobo" className="treasury-group-card" key={group.name}>
            <div className="treasury-group-header">
              <span>{group.name}</span>
              <strong>
                {group.addresses} {t("addresses")}
              </strong>
              {group.failedCount > 0 && (
                <span className="treasury-group-warning" role="status">
                  {t("treasuryWalletsUnreachable", { count: group.failedCount })}
                </span>
              )}
            </div>
            <dl>
              <div>
                <dt>{t("tokenNeo")}</dt>
                <dd>{group.neo}</dd>
              </div>
              <div>
                <dt>{t("tokenGas")}</dt>
                <dd>{group.gas}</dd>
              </div>
              <div>
                <dt>{t("sidebarTotalUsd")}</dt>
                <dd>{group.usd}</dd>
              </div>
            </dl>
            {group.wallets.length > 0 && (
              <div
                className="treasury-wallet-list"
                aria-label={`${group.name} ${t("walletList")}`}
              >
                {group.wallets.map((wallet, walletIndex) => (
                  <div
                    className="treasury-wallet-row"
                    key={wallet.address || `${group.name}-${walletIndex}`}
                  >
                    <div>
                      <strong>{wallet.label}</strong>
                      <code title={wallet.address}>
                        {compactAddress(wallet.address)}
                      </code>
                    </div>
                    <div className="treasury-wallet-row__right">
                      <span>
                        {wallet.neo} / {wallet.gas}
                      </span>
                      {/* Connects the dashboard to the payout console: fill the
                          recipient with this watched address (pays TO it from
                          your wallet). */}
                      {wallet.address && (
                        <button
                          type="button"
                          className="treasury-use-recipient"
                          onClick={() => setRecipient(wallet.address)}
                        >
                          {t("useAsRecipient")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </NeoCard>
        ))}
      </section>
      )}

      {/* Slim read-only route footer. The former "Refresh Data" primary button
          is gone: refresh is now the single compact affordance beside the hero
          live-sync signal, so the page keeps one primary action. */}
      <NeoCard variant="erobo" className="treasury-action-card">
        <div className="treasury-readonly-note">
          <span>{t("treasuryReadOnlyRoute")}</span>
          <strong>{watchedAddressCount} {t("addresses")}</strong>
          <p>{t("feature3Desc")}</p>
          {error && hasLiveData && <p className="treasury-error">{error}</p>}
        </div>
      </NeoCard>
    </div>
  );
}
