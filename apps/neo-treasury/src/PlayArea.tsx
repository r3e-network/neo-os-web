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
import "./PlayArea.scss";

interface TreasuryData {
  totalUsd: number;
  totalNeo: number;
  totalGas: number;
  lastUpdated: number | string;
  prices: Record<string, unknown>;
  categories: Array<{
    name: string;
    wallets?: Array<{
      address?: string;
      label?: string;
      neo?: number;
      gas?: number;
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
  const watchedAddressCount =
    DA_HONGFEI_ADDRESSES.length + ERIK_ZHANG_ADDRESSES.length;
  const lastUpdated = formatLastUpdated(data?.lastUpdated);
  const signalLabel = hasLiveData
    ? t("treasuryLiveSynced")
    : loading
      ? t("treasuryLiveLoading")
      : t("treasuryLivePending");
  const isRefreshing = loading && hasLiveData;
  const [asset, setAsset] = useState<TreasuryAsset>("GAS");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [memo, setMemo] = useState("");

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

  const watchGroups = data?.categories?.length
    ? data.categories.map((category) => ({
        name: String(category.name || t("treasuryGroup")),
        addresses: Array.isArray(category.wallets)
          ? category.wallets.length
          : 0,
        neo: `${formatNumber(category.totalNeo, 4)} NEO`,
        gas: `${formatNumber(category.totalGas, 4)} GAS`,
        usd: `$${formatNumber(category.totalUsd, 2)}`,
        wallets: Array.isArray(category.wallets)
          ? category.wallets.map((wallet, index) => ({
              label: wallet.label || `${t("wallet")} ${index + 1}`,
              address: wallet.address || "",
              neo: `${formatNumber(wallet.neo, 4)} NEO`,
              gas: `${formatNumber(wallet.gas, 4)} GAS`,
            }))
          : [],
      }))
    : [
        {
          name: "Da Hongfei",
          addresses: DA_HONGFEI_ADDRESSES.length,
          neo: t("treasuryLivePending"),
          gas: t("treasuryLivePending"),
          usd: t("treasuryLivePending"),
          wallets: [],
        },
        {
          name: "Erik Zhang",
          addresses: ERIK_ZHANG_ADDRESSES.length,
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
    await dispatch("submitDisbursement", { asset, amount, recipient, memo });
    setStatus(t("disbursementSubmitted"), "success");
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
        </div>
        <div className="treasury-hero__metrics" aria-label={t("treasuryInfo")}>
          <div className="treasury-metric">
            <span>{t("sidebarTotalUsd")}</span>
            <strong>{hasLiveData ? totalUsdDisplay : t("treasuryLivePending")}</strong>
          </div>
          <div className="treasury-metric">
            <span>{t("tokenNeo")}</span>
            <strong>{hasLiveData ? totalNeoDisplay : "--"}</strong>
          </div>
          <div className="treasury-metric">
            <span>{t("tokenGas")}</span>
            <strong>{hasLiveData ? totalGasDisplay : "--"}</strong>
          </div>
        </div>
      </section>

      <section className="treasury-signal-card" aria-label={t("treasuryLiveStatus")}>
        <div className="treasury-token" aria-hidden="true">
          N
        </div>
        <div className="treasury-signal-card__copy">
          <span>{t("treasuryLiveStatus")}</span>
          <strong>{signalLabel}</strong>
          <p>
            {hasLiveData
              ? t("treasurySyncedHint")
              : t("treasuryPendingHint")}
          </p>
        </div>
      </section>

      <section className="treasury-ops-grid" aria-label={t("operationsTitle")}>
        <NeoCard variant="erobo" className="treasury-operation-card">
          <div className="treasury-section-heading">
            <span>{t("operationsEyebrow")}</span>
            <strong>{t("disbursementTitle")}</strong>
            <p>{t("disbursementBoundary")}</p>
          </div>

          <div className="treasury-wallet-strip">
            <div>
              <span>{t("wallet")}</span>
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

          <div className="treasury-review-panel" aria-label={t("reviewTitle")}>
            <div>
              <span>{t("reviewAsset")}</span>
              <strong>{asset}</strong>
            </div>
            <div>
              <span>{t("reviewAmount")}</span>
              <strong>{amount || "--"}</strong>
            </div>
            <div>
              <span>{t("reviewRecipient")}</span>
              <strong title={recipient}>{recipient ? compactAddress(recipient) : "--"}</strong>
            </div>
          </div>

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

          <div className="treasury-actions">
            <NeoButton
              size="lg"
              variant={address ? "secondary" : "primary"}
              className="op-btn"
              onClick={handleConnect}
              aria-label={t("connectWallet")}
            >
              {address ? t("walletConnected") : t("connectWallet")}
            </NeoButton>
            <NeoButton
              size="lg"
              variant="success"
              className="op-btn"
              disabled={submitBlocked}
              loading={disbursementSubmitting}
              onClick={handleDisbursement}
              aria-label={submitLabel}
            >
              {submitLabel}
            </NeoButton>
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

        <NeoCard variant="erobo" className="treasury-policy-card">
          <div className="treasury-section-heading">
            <span>{t("operationsGuardrail")}</span>
            <strong>{t("policyTitle")}</strong>
            <p>{t("policyCopy")}</p>
          </div>
          <div className="treasury-policy-steps">
            <div>
              <span>01</span>
              <strong>{t("policyStep1")}</strong>
            </div>
            <div>
              <span>02</span>
              <strong>{t("policyStep2")}</strong>
            </div>
            <div>
              <span>03</span>
              <strong>{t("policyStep3")}</strong>
            </div>
          </div>
        </NeoCard>
      </section>

      <section className="treasury-watchlist" aria-label={t("treasuryWatchlist")}>
        {watchGroups.map((group) => (
          <NeoCard variant="erobo" className="treasury-group-card" key={group.name}>
            <div className="treasury-group-header">
              <span>{group.name}</span>
              <strong>
                {group.addresses} {t("addresses")}
              </strong>
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
                {group.wallets.map((wallet) => (
                  <div className="treasury-wallet-row" key={wallet.address}>
                    <div>
                      <strong>{wallet.label}</strong>
                      <code title={wallet.address}>
                        {compactAddress(wallet.address)}
                      </code>
                    </div>
                    <span>
                      {wallet.neo} / {wallet.gas}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </NeoCard>
        ))}
      </section>

      <section className="treasury-route" aria-label={t("treasuryReadOnlyRoute")}>
        <div>
          <span>01</span>
          <strong>{t("step1")}</strong>
        </div>
        <div>
          <span>02</span>
          <strong>{t("step2")}</strong>
        </div>
        <div>
          <span>03</span>
          <strong>{t("step4")}</strong>
        </div>
      </section>

      <NeoCard variant="erobo" className="treasury-action-card">
        <div className="treasury-readonly-note">
          <span>{t("treasuryReadOnlyRoute")}</span>
          <strong>{watchedAddressCount} {t("addresses")}</strong>
          <p>{t("feature3Desc")}</p>
          {error && <p className="treasury-error">{error}</p>}
          {lastUpdated && (
            <p className="treasury-updated">
              {t("lastUpdated")}: {lastUpdated}
            </p>
          )}
        </div>
        <NeoButton
          size="lg"
          variant="primary"
          className="op-btn"
          disabled={isRefreshing}
          onClick={handleRefresh}
          aria-label={isRefreshing ? t("refreshing") : t("refreshData")}
        >
          {isRefreshing ? t("refreshing") : t("refreshData")}
        </NeoButton>
      </NeoCard>
    </div>
  );
}
