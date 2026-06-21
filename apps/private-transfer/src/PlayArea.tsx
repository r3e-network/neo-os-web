import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  Gem,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { StateView } from "@shared/components";
import { fetchWithTimeout } from "@shared/utils/fetch-timeout";
import {
  buildConfidentialTransferPackage,
  encryptJsonWithOraclePublicKey,
} from "@shared/utils/morpheus-confidential-envelope";
import {
  appendSealedIntent,
  clearSealedIntents,
  readSealedIntents,
  type SealedIntent,
} from "./history";
import "./PlayArea.scss";

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "sealing"; message: string }
  | {
      status: "stored";
      message: string;
      secretRef: string;
      noteCommitment: string;
      nullifier: string;
    }
  | { status: "error"; message: string; detail?: string };

type NetworkHealth = "checking" | "live" | "degraded";

const AMOUNT_PRESETS = ["0.1", "1", "5"];
const NEO_AMOUNT_PRESETS = ["1", "5", "10"];
const MORPHEUS_ENCRYPTION_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";
const MEMO_MAX_LENGTH = 160;
// GAS on Neo N3 carries 8 decimal places; finer precision can never settle.
const GAS_DECIMALS = 8;
const NETWORKS = ["testnet", "mainnet"] as const;
type TransferNetwork = (typeof NETWORKS)[number];
type TransferAsset = "GAS" | "NEO";

// Neo N3 addresses are Base58Check-encoded, so the Bitcoin/Base58 alphabet
// applies: the ambiguous glyphs 0 (zero), O, I, and l are NOT valid. The
// previous /[0-9A-Za-z]/ class let an O-for-0 typo slip into the sealed
// payload; restricting to the real alphabet rejects clearly-malformed input.
const BASE58_BODY = "[1-9A-HJ-NP-Za-km-z]{33}";
const NEO_ADDRESS_PATTERN = new RegExp(`^N${BASE58_BODY}$`);

// Canonical, non-negative decimal only. Rejects scientific ("1e2"), hex
// ("0x10"), leading-dot (".5"), signs, and internal whitespace. The input is
// expected pre-trimmed by the caller.
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const isValidNeoAddress = (value: string) =>
  NEO_ADDRESS_PATTERN.test(value.trim());

// Render a Neo N3 address as a short, scannable head…tail form for the confirm
// summary so the user can verify the recipient at a glance without horizontal
// scrolling. The full value is still validated and sealed verbatim.
function shortAddress(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`;
}

function isPositiveAmount(value: string, asset = "GAS") {
  const trimmed = value.trim();
  // Reject scientific/hex/whitespace/leading-dot strings up front so a value
  // like "1e2" or "0x10" can never reach the sealed payload verbatim.
  if (!DECIMAL_PATTERN.test(trimmed)) {
    return false;
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }
  if (asset.trim().toUpperCase() === "NEO") {
    // NEO on Neo N3 is indivisible: only whole integer units can ever settle.
    return !trimmed.includes(".");
  }
  // GAS settles at 8-decimal precision; finer amounts (e.g. "1e-9" worth of
  // GAS, here written as a long decimal) can never be released.
  const fraction = trimmed.split(".")[1] ?? "";
  return fraction.length <= GAS_DECIMALS;
}

// Normalize a validated amount to a canonical decimal string (strip redundant
// leading/trailing zeros) so the downstream TEE/settlement consumer parses a
// single unambiguous representation. Callers MUST validate first.
function normalizeAmount(value: string, asset = "GAS") {
  const trimmed = value.trim();
  if (asset.trim().toUpperCase() === "NEO") {
    // Integer-only; drop any leading zeros.
    return String(BigInt(trimmed));
  }
  const [whole, fractionRaw = ""] = trimmed.split(".");
  const normalizedWhole = String(BigInt(whole || "0"));
  const fraction = fractionRaw.replace(/0+$/, "");
  return fraction ? `${normalizedWhole}.${fraction}` : normalizedWhole;
}

// Map the wallet's detected chain id (e.g. "neo-n3-testnet", "neo-x-mainnet")
// onto the two networks this sealing desk targets. Anything that doesn't name
// "mainnet" — including the generic "neo-n3" default — falls back to mainnet,
// the only lane currently serving a live Morpheus key.
function networkFromChainId(chainId: string | null | undefined): "testnet" | "mainnet" {
  const id = String(chainId ?? "").toLowerCase();
  if (id.includes("test")) {
    return "testnet";
  }
  return "mainnet";
}

function networkHealthKey(health: NetworkHealth) {
  if (health === "live") return "networkStatusLive";
  if (health === "degraded") return "networkStatusDegraded";
  return "networkStatusChecking";
}

function networkHealthIcon(health: NetworkHealth): LucideIcon {
  if (health === "live") return ShieldCheck;
  if (health === "degraded") return CircleAlert;
  return Clock3;
}

function setObservable(state: PlayAreaProps["state"], key: string, value: unknown) {
  const observable = state[key];
  if (observable && typeof observable.set === "function") {
    observable.set(value);
  }
}

export default function PlayArea({ t, state, services, setStatus }: PlayAreaProps) {
  const [recipient, setRecipient] = useState("");
  const [asset, setAsset] = useState<TransferAsset>("GAS");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [network, setNetwork] = useState<TransferNetwork>("mainnet");
  const [networkHealth, setNetworkHealth] = useState<Record<string, NetworkHealth>>({
    testnet: "checking",
    mainnet: "checking",
  });
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: t("statusInitial"),
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [history, setHistory] = useState<SealedIntent[]>(() => readSealedIntents());

  const userFacingSealError = useCallback(
    (error: unknown, sealPhase: "key" | "store" | "package") => {
      const raw = error instanceof Error ? error.message : String(error ?? "");
      // The phase we actually failed in is authoritative: a store-phase 404
      // ("not found") must not be misclassified by the key-phase message regex.
      if (sealPhase === "store") {
        return t("sealErrorStore");
      }
      if (sealPhase === "key") {
        return t("sealErrorKey");
      }
      if (/algorithm|X25519|HKDF|AES/i.test(raw)) {
        return t("sealErrorAlgorithm");
      }
      if (/public key|contract.*configured|not configured|network|404|not found/i.test(raw)) {
        return t("sealErrorKey");
      }
      if (/secret reference|secret_ref|store|inline_fallback/i.test(raw)) {
        return t("sealErrorStore");
      }
      return t("sealErrorGeneric");
    },
    [t],
  );

  const networkLabelFor = useCallback(
    (value: string) => (value === "mainnet" ? t("networkMainnet") : t("networkTestnet")),
    [t],
  );

  // Default the form network from the connected wallet's chain (falling back to
  // mainnet — the lane that currently serves a live Morpheus key) instead of
  // hardcoding the degraded testnet lane, so the default-path user does not fail
  // at the very first fetch.
  useEffect(() => {
    let cancelled = false;
    const detect = services?.chain?.detectNetwork;
    if (typeof detect !== "function") {
      return;
    }
    void Promise.resolve(detect.call(services.chain))
      .then((chainId) => {
        if (cancelled) {
          return;
        }
        const resolved = networkFromChainId(chainId);
        setNetwork(resolved);
        setObservable(state, "networkLabel", networkLabelFor(resolved));
      })
      .catch(() => {
        // Detection unavailable — keep the mainnet default already in state.
      });
    return () => {
      cancelled = true;
    };
  }, [networkLabelFor, services, state]);

  // Ping each network's Morpheus public-key endpoint once so the Network select
  // can badge live vs degraded lanes and the user can avoid the dead one.
  useEffect(() => {
    let cancelled = false;
    NETWORKS.forEach((net) => {
      void fetchWithTimeout(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(net)}`,
      )
        .then(async (response) => {
          const meta = await response.json().catch(() => ({}));
          return Boolean(response.ok && meta?.public_key);
        })
        .catch(() => false)
        .then((live) => {
          if (cancelled) {
            return;
          }
          setNetworkHealth((current) => ({
            ...current,
            [net]: live ? "live" : "degraded",
          }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the header "Network" stat tile in lock-step with the in-form select so
  // the visible indicator always names the network the ciphertext targets.
  useEffect(() => {
    setObservable(state, "networkLabel", networkLabelFor(network));
  }, [network, networkLabelFor, state]);

  const handleNetworkChange = useCallback(
    (value: string) => {
      const next = value === "mainnet" ? "mainnet" : "testnet";
      setNetwork(next);
      setObservable(state, "networkLabel", networkLabelFor(next));
    },
    [networkLabelFor, state],
  );

  // Switching GAS -> NEO leaves a fractional amount (e.g. "1.5") that NEO can
  // never settle, plus a now-stale GAS preset highlight. Re-floor to the whole
  // unit so the field matches the new asset's constraints instead of forcing an
  // invalid-input round trip.
  const handleAssetChange = useCallback((value: TransferAsset) => {
    setAsset(value);
    const nextIsNeo = value.trim().toUpperCase() === "NEO";
    if (nextIsNeo) {
      setAmount((current) => {
        const trimmed = current.trim();
        if (!trimmed || !trimmed.includes(".")) {
          return current;
        }
        const whole = trimmed.split(".")[0] ?? "";
        return /^\d+$/.test(whole) && BigInt(whole) > 0n ? whole : "";
      });
    }
  }, []);

  const copyValue = useCallback(async (field: string, value: string) => {
    if (!value || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, 1500);
    } catch {
      setCopiedField(null);
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    clearSealedIntents();
    setHistory([]);
    setObservable(state, "requestCount", 0);
    setObservable(state, "lastDigest", t("digestPlaceholder"));
    setObservable(state, "lastStatus", t("statusReady"));
  }, [state, t]);

  const isNeo = asset.trim().toUpperCase() === "NEO";
  const recipientInvalid =
    recipient.trim().length > 0 && !isValidNeoAddress(recipient);
  const amountInvalid =
    amount.trim().length > 0 && !isPositiveAmount(amount, asset);
  const canSeal =
    isValidNeoAddress(recipient) && isPositiveAmount(amount, asset);

  // When the selected lane is degraded but the other lane reports live, offer a
  // one-tap switch so the default-path user is not dead-ended on the paused
  // network. Only surfaces once both health probes have resolved.
  const otherNetwork: "testnet" | "mainnet" =
    network === "mainnet" ? "testnet" : "mainnet";
  const showLiveSwitch =
    networkHealth[network] === "degraded" &&
    networkHealth[otherNetwork] === "live";

  const sealTransfer = useCallback(async () => {
    if (!canSeal) {
      const message = t("errorMissingInputs");
      setStatus(message, "error");
      setSubmitState({ status: "error", message });
      return;
    }
    setSubmitState({
      status: "sealing",
      message: t("statusSealingProgress"),
    });
    setStatus(t("statusSealingShort"), "info");

    let sealPhase: "key" | "store" | "package" = "key";
    try {
      const keyResponse = await fetchWithTimeout(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(
          keyMeta?.error || "Morpheus oracle public key is unavailable",
        );
      }
      if (
        keyMeta.algorithm &&
        keyMeta.algorithm !== MORPHEUS_ENCRYPTION_ALGORITHM
      ) {
        sealPhase = "package";
        throw new Error(
          `Unsupported Morpheus encryption algorithm: ${keyMeta.algorithm}`,
        );
      }

      sealPhase = "package";
      const transferPackage = await buildConfidentialTransferPackage({
        appId: "miniapp-private-transfer",
        network,
        recipient: recipient.trim(),
        asset,
        amount: normalizeAmount(amount, asset),
        memo,
      });
      const ciphertext = await encryptJsonWithOraclePublicKey(
        String(keyMeta.public_key),
        transferPackage.confidentialPayload,
      );

      sealPhase = "store";
      const storeResponse = await fetchWithTimeout("/api/morpheus/confidential/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          target_chain: "neo_n3",
          app_id: "miniapp-private-transfer",
          name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
          ciphertext,
          public_envelope: transferPackage.publicEnvelope,
        }),
      });
      const stored = await storeResponse.json().catch(() => ({}));
      // The host proxy converts an upstream failure into a 200 body carrying
      // inline_fallback:true with no secret_ref; surface the upstream detail
      // so the failure is diagnosable rather than always-generic.
      const upstreamDetail = String(
        stored?.error || stored?.message || "",
      ).trim();
      const upstreamStatus = stored?.upstream_status;
      if (!storeResponse.ok || stored?.inline_fallback || stored?.store_available === false) {
        const reason = upstreamDetail || "Morpheus confidential store is unavailable";
        const error = new Error(reason);
        (error as Error & { detail?: string }).detail = upstreamStatus
          ? `${reason} (${upstreamStatus})`
          : reason;
        throw error;
      }
      const secretRef = String(
        stored.secret_ref || stored.id || stored.ref || "",
      ).trim();
      if (!secretRef) {
        throw new Error("Morpheus confidential store did not return a secret reference");
      }

      const commitment = transferPackage.publicEnvelope.note_commitment;
      const nullifier = transferPackage.publicEnvelope.nullifier_hash;
      const nextHistory = appendSealedIntent({
        secretRef,
        commitment,
        nullifier,
        network,
        asset,
        ts: Date.now(),
      });
      setHistory(nextHistory);
      setObservable(state, "requestCount", nextHistory.length);
      setObservable(state, "lastStatus", t("statusSealed"));
      setObservable(state, "lastDigest", commitment);
      setStatus(t("statusSealedToast"), "success");
      setSubmitState({
        status: "stored",
        message: t("statusStored"),
        secretRef,
        noteCommitment: commitment,
        nullifier,
      });
    } catch (error) {
      const message = userFacingSealError(error, sealPhase);
      const detail = (error as Error & { detail?: string })?.detail;
      console.warn(
        `[private-transfer] seal failed during ${sealPhase} phase`,
        error,
      );
      setStatus(message, "error");
      setSubmitState({ status: "error", message, detail });
    }
  }, [
    amount,
    asset,
    canSeal,
    memo,
    network,
    recipient,
    setStatus,
    state,
    t,
    userFacingSealError,
  ]);

  const sealed = submitState.status !== "idle";
  const assetOptions: Array<{
    value: TransferAsset;
    label: string;
    meta: string;
    icon: LucideIcon;
  }> = [
    {
      value: "GAS",
      label: "GAS",
      meta: t("assetGasMeta"),
      icon: Gem,
    },
    {
      value: "NEO",
      label: "NEO",
      meta: t("assetNeoMeta"),
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="private-transfer">
      <section className="private-transfer__hero">
        <div className="private-transfer__hero-body">
          <span className="private-transfer__eyebrow">{t("heroEyebrow")}</span>
          <h2>{t("heroTitle")}</h2>
          <p>{t("heroBody")}</p>
          <div className="private-transfer__hero-facts">
            <span>
              {t("heroFacts", { network: networkLabelFor(network), asset })}
            </span>
            <span className="private-transfer__badge">{t("heroBadge")}</span>
          </div>
        </div>
        <figure className="private-transfer__stage" aria-label={t("heroStageAria")}>
          <img
            src="./private-transfer-stage.jpg"
            alt=""
            decoding="async"
            loading="eager"
          />
          <figcaption>
            <span>{t("statusBlockHeader")}</span>
            <strong>{t("heroStageTitle")}</strong>
          </figcaption>
        </figure>
      </section>

      <section className="private-transfer__grid">
        <div className="private-transfer__panel">
          <div className="private-transfer__composer-head">
            <div>
              <span>{t("composerTitle")}</span>
              <strong>{t("composerSubtitle")}</strong>
            </div>
            <em>{networkLabelFor(network)} · {asset}</em>
          </div>
          <div className="private-transfer__form-grid">
            <section className="private-transfer__choice-field" aria-label={t("formNetworkLabel")}>
              <div className="private-transfer__choice-head">
                <span>{t("formNetworkLabel")}</span>
                <strong>{networkLabelFor(network)}</strong>
              </div>
              <div
                className="private-transfer__choice-grid"
                role="radiogroup"
                aria-label={t("formNetworkLabel")}
              >
                {NETWORKS.map((net) => {
                  const health = networkHealth[net];
                  const StatusIcon = networkHealthIcon(health);
                  const selected = net === network;
                  const label = networkLabelFor(net);
                  const statusLabel = t(networkHealthKey(health));

                  return (
                    <button
                      key={net}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${t("formNetworkLabel")}: ${label} · ${statusLabel}`}
                      className={`private-transfer__choice-card private-transfer__choice-card--${health}${
                        selected ? " is-active" : ""
                      }`}
                      onClick={() => handleNetworkChange(net)}
                    >
                      <span className="private-transfer__choice-icon" aria-hidden="true">
                        {net === "mainnet" ? <ShieldCheck size={17} /> : <Globe2 size={17} />}
                      </span>
                      <span className="private-transfer__choice-copy">
                        <strong>{label}</strong>
                        <small className={`private-transfer__choice-status is-${health}`}>
                          <StatusIcon size={12} aria-hidden="true" />
                          {statusLabel}
                        </small>
                      </span>
                      {selected ? (
                        <span className="private-transfer__choice-check" aria-hidden="true">
                          <Check size={14} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {networkHealth[network] === "degraded" && (
                <div className="private-transfer__network-alert" role="status">
                  <small className="private-transfer__network-hint">
                    {t("networkDegradedHint")}
                  </small>
                  <small className="private-transfer__network-note">
                    {t("networkDegradedNote")}
                  </small>
                  {showLiveSwitch && (
                    <button
                      type="button"
                      className="private-transfer__network-switch"
                      onClick={() => handleNetworkChange(otherNetwork)}
                      aria-label={t("networkSwitchAria", {
                        network: networkLabelFor(otherNetwork),
                      })}
                    >
                      {t("networkSwitchCta", {
                        network: networkLabelFor(otherNetwork),
                      })}
                    </button>
                  )}
                </div>
              )}
            </section>
            <section className="private-transfer__choice-field" aria-label={t("formAssetLabel")}>
              <div className="private-transfer__choice-head">
                <span>{t("formAssetLabel")}</span>
                <strong>{asset}</strong>
              </div>
              <div
                className="private-transfer__choice-grid private-transfer__choice-grid--asset"
                role="radiogroup"
                aria-label={t("formAssetLabel")}
              >
                {assetOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = option.value === asset;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${t("formAssetLabel")}: ${option.label}`}
                      className={`private-transfer__choice-card${
                        selected ? " is-active" : ""
                      }`}
                      onClick={() => handleAssetChange(option.value)}
                    >
                      <span className="private-transfer__choice-icon" aria-hidden="true">
                        <Icon size={17} />
                      </span>
                      <span className="private-transfer__choice-copy">
                        <strong>{option.label}</strong>
                        <small>{option.meta}</small>
                      </span>
                      {selected ? (
                        <span className="private-transfer__choice-check" aria-hidden="true">
                          <Check size={14} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
            <label className="private-transfer__wide">
              <span>{t("formRecipientLabel")}</span>
              <input
                value={recipient}
                placeholder={t("formRecipientPlaceholder")}
                aria-invalid={recipientInvalid || undefined}
                onChange={(event) => setRecipient(event.target.value)}
              />
              {recipientInvalid && (
                <small className="private-transfer__field-error">
                  {t("errorInvalidAddress")}
                </small>
              )}
            </label>
            <label>
              <span>{t("formAmountLabel")}</span>
              <input
                type="number"
                min="0"
                step={isNeo ? "1" : "0.00000001"}
                value={amount}
                aria-invalid={amountInvalid || undefined}
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountInvalid ? (
                <small className="private-transfer__field-error">
                  {isNeo ? t("errorInvalidNeoAmount") : t("errorInvalidAmount")}
                </small>
              ) : (
                <small className="private-transfer__field-hint">
                  {isNeo ? t("amountHintNeo") : t("amountHintGas")}
                </small>
              )}
              <div
                className="private-transfer__presets"
                aria-label={t("presetsLabel")}
              >
                {(isNeo ? NEO_AMOUNT_PRESETS : AMOUNT_PRESETS).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`private-transfer__preset${
                      amount === preset ? " is-active" : ""
                    }`}
                    onClick={() => setAmount(preset)}
                  >
                    {preset} {asset}
                  </button>
                ))}
              </div>
            </label>
            <label className="private-transfer__wide">
              <span className="private-transfer__label-row">
                {t("formMemoLabel")}
                <em className="private-transfer__label-optional">
                  {t("formMemoOptional")}
                </em>
              </span>
              <input
                value={memo}
                maxLength={MEMO_MAX_LENGTH}
                onChange={(event) =>
                  setMemo(event.target.value.slice(0, MEMO_MAX_LENGTH))
                }
              />
              <small
                className="private-transfer__memo-count"
                aria-live="polite"
              >
                {memo.length}/{MEMO_MAX_LENGTH}
              </small>
            </label>
          </div>
          {canSeal ? (
            <div className="private-transfer__summary" role="group">
              <span className="private-transfer__summary-title">
                {t("summaryTitle")}
              </span>
              <dl className="private-transfer__summary-grid">
                <div>
                  <dt>{t("summaryRecipient")}</dt>
                  <dd title={recipient.trim()}>{shortAddress(recipient)}</dd>
                </div>
                <div>
                  <dt>{t("summaryAmount")}</dt>
                  <dd className="private-transfer__summary-amount">
                    {t("summaryAmountValue", {
                      amount: normalizeAmount(amount, asset),
                      asset,
                    })}
                  </dd>
                </div>
                <div>
                  <dt>{t("summaryNetwork")}</dt>
                  <dd>{networkLabelFor(network)}</dd>
                </div>
                <div>
                  <dt>{t("summaryEncryption")}</dt>
                  <dd className="private-transfer__summary-algo">
                    {MORPHEUS_ENCRYPTION_ALGORITHM}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="private-transfer__validation" role="status">
              {t("validationHint")}
            </div>
          )}
          <div className="private-transfer__no-funds" role="note">
            {t("noFundsBanner")}
          </div>
          <button
            type="button"
            className="private-transfer__seal-button"
            onClick={sealTransfer}
            disabled={submitState.status === "sealing" || !canSeal}
            aria-label={
              submitState.status === "sealing"
                ? t("sealAriaBusy")
                : t("sealAriaIdle")
            }
          >
            {submitState.status === "sealing" ? t("sealing") : t("sealButton")}
          </button>
        </div>

        {!sealed && (
        <aside className="private-transfer__intro">
          <div className="private-transfer__intro-icon" aria-hidden="true">
            <LockKeyhole size={20} />
          </div>
          <strong className="private-transfer__intro-title">
            {t("introTitle")}
          </strong>
          <p className="private-transfer__intro-body">{t("introBody")}</p>
          <ul className="private-transfer__intro-points">
            {(
              [
                [t("introPointLocal"), t("introPointLocalDesc")],
                [t("introPointTee"), t("introPointTeeDesc")],
                [t("introPointNoFunds"), t("introPointNoFundsDesc")],
              ] as const
            ).map(([title, desc]) => (
              <li key={title}>
                <span aria-hidden="true" className="private-transfer__intro-tick">
                  <Check size={13} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        )}

        {sealed && (
        <aside
          className={`private-transfer__status private-transfer__status--${submitState.status}`}
        >
          <div className="private-transfer__status-icon" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <span>{t("statusBlockHeader")}</span>
          <strong>{submitState.message}</strong>
          {submitState.status === "error" && (
            <>
              <p className="private-transfer__safe-copy">{t("safeCopy")}</p>
              {submitState.detail && (
                <p className="private-transfer__error-detail">
                  {t("errorDetailLabel")}: {submitState.detail}
                </p>
              )}
            </>
          )}
          {submitState.status === "stored" && (
            <dl>
              {(
                [
                  ["secretRef", t("resultSecretRef"), submitState.secretRef, t("resultSecretRefHint")],
                  ["commitment", t("resultCommitment"), submitState.noteCommitment, t("resultCommitmentHint")],
                  ["nullifier", t("resultNullifier"), submitState.nullifier, t("resultNullifierHint")],
                ] as const
              ).map(([field, label, value, hint]) => (
                <div key={field}>
                  <dt>{label}</dt>
                  <div className="private-transfer__copy-row">
                    <dd>{value}</dd>
                    <button
                      type="button"
                      className="private-transfer__copy-button"
                      onClick={() => copyValue(field, value)}
                      aria-label={
                        copiedField === field
                          ? t("copiedAria", { label })
                          : t("copyAria", { label })
                      }
                      title={copiedField === field ? t("copiedAction") : t("copyAction")}
                    >
                      {copiedField === field ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
                      <span>{copiedField === field ? t("copiedAction") : t("copyAction")}</span>
                    </button>
                  </div>
                  <p className="private-transfer__result-hint">{hint}</p>
                </div>
              ))}
            </dl>
          )}
        </aside>
        )}
      </section>

      <section className="private-transfer__history">
        <div className="private-transfer__history-head">
          <div>
            <span className="private-transfer__eyebrow">{t("historyTitle")}</span>
            <p className="private-transfer__history-sub">{t("historySubtitle")}</p>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              className="private-transfer__history-clear"
              onClick={handleClearHistory}
              aria-label={t("historyClearAria")}
            >
                {t("historyClear")}
              </button>
            )}
          </div>
        {history.length === 0 ? (
          <StateView
            kind="empty"
            className="private-transfer__history-empty"
            title={t("historyEmpty")}
          />
        ) : (
          <ul className="private-transfer__history-list">
            {history.map((intent) => (
              <li key={`${intent.secretRef}:${intent.ts}`} className="private-transfer__history-item">
                <div className="private-transfer__history-meta">
                  <span>
                    {t("historyMetaNetwork")}: {networkLabelFor(intent.network)}
                  </span>
                  <span>
                    {t("historyMetaAsset")}: {intent.asset}
                  </span>
                </div>
                <dl>
                  {(
                    [
                      ["secretRef", t("resultSecretRef"), intent.secretRef],
                      ["commitment", t("resultCommitment"), intent.commitment],
                    ] as const
                  ).map(([field, label, value]) => {
                    const rowKey = `${intent.secretRef}:${field}`;
                    return (
                      <div key={field}>
                        <dt>{label}</dt>
                        <div className="private-transfer__copy-row">
                          <dd>{value}</dd>
                          <button
                            type="button"
                            className="private-transfer__copy-button"
                            onClick={() => copyValue(rowKey, value)}
                            aria-label={
                              copiedField === rowKey
                                ? t("copiedAria", { label })
                                : t("copyAria", { label })
                            }
                            title={copiedField === rowKey ? t("copiedAction") : t("copyAction")}
                          >
                            {copiedField === rowKey ? (
                              <Check size={13} aria-hidden="true" />
                            ) : (
                              <Copy size={13} aria-hidden="true" />
                            )}
                            <span>{copiedField === rowKey ? t("copiedAction") : t("copyAction")}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="private-transfer__steps">
        <summary>
          <span>{t("stepsTitle")}</span>
          <ChevronDown
            className="private-transfer__steps-chevron"
            size={16}
            aria-hidden="true"
          />
        </summary>
        <div className="private-transfer__steps-grid">
          {(
            [
              ["1", t("step1Title"), t("step1Body"), false],
              ["2", t("step2Title"), t("step2Body"), true],
              ["3", t("step3Title"), t("step3Body"), true],
              ["4", t("step4Title"), t("step4Body"), false],
            ] as const
          ).map(([index, title, body, inApp]) => (
            <article
              key={index}
              className={inApp ? "is-in-app" : "is-external"}
            >
              <span>{index}</span>
              <strong>{title}</strong>
              <span
                className={`private-transfer__step-tag${
                  inApp ? " is-in-app" : ""
                }`}
              >
                {inApp ? t("stepInApp") : t("stepNotInApp")}
              </span>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
