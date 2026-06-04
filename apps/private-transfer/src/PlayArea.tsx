import { useCallback, useState } from "react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  buildConfidentialTransferPackage,
  encryptJsonWithOraclePublicKey,
} from "@shared/utils/morpheus-confidential-envelope";
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
  | { status: "error"; message: string };

const AMOUNT_PRESETS = ["0.1", "1", "5"];
const NEO_AMOUNT_PRESETS = ["1", "5", "10"];
const MORPHEUS_ENCRYPTION_ALGORITHM = "X25519-HKDF-SHA256-AES-256-GCM";
const MEMO_MAX_LENGTH = 160;
// GAS on Neo N3 carries 8 decimal places; finer precision can never settle.
const GAS_DECIMALS = 8;

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

function userFacingSealError(
  error: unknown,
  sealPhase: "key" | "store" | "package" = "package",
) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (
    sealPhase === "key" ||
    /public key|contract.*configured|not configured|network|404|not found/i.test(raw)
  ) {
    return "Morpheus sealing is unavailable for this network. Your transfer details remain local.";
  }
  if (/algorithm|X25519|HKDF|AES/i.test(raw)) {
    return "The selected Morpheus key cannot be used by this client. Your transfer details remain local.";
  }
  if (
    sealPhase === "store" ||
    /secret reference|secret_ref|store|inline_fallback/i.test(raw)
  ) {
    return "Morpheus confidential storage is temporarily unavailable. Your transfer details remain local.";
  }
  return "Private transfer sealing is unavailable right now. Your transfer details remain local.";
}

function setObservable(state: PlayAreaProps["state"], key: string, value: unknown) {
  const observable = state[key];
  if (observable && typeof observable.set === "function") {
    observable.set(value);
  }
}

export default function PlayArea({ state, setStatus }: PlayAreaProps) {
  const [recipient, setRecipient] = useState("");
  const [asset, setAsset] = useState("GAS");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [network, setNetwork] = useState("testnet");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: "Ready to seal private transfer details locally.",
  });
  const isNeo = asset.trim().toUpperCase() === "NEO";
  const recipientInvalid =
    recipient.trim().length > 0 && !isValidNeoAddress(recipient);
  const amountInvalid =
    amount.trim().length > 0 && !isPositiveAmount(amount, asset);
  const canSeal =
    isValidNeoAddress(recipient) && isPositiveAmount(amount, asset);

  const sealTransfer = useCallback(async () => {
    if (!canSeal) {
      const message =
        "Enter a valid Neo N3 recipient and a positive transfer amount before sealing.";
      setStatus(message, "error");
      setSubmitState({ status: "error", message });
      return;
    }
    setSubmitState({
      status: "sealing",
      message:
        "Fetching Morpheus key, encrypting locally, and storing ciphertext.",
    });
    setStatus("Sealing private transfer", "info");

    let sealPhase: "key" | "store" | "package" = "key";
    try {
      const keyResponse = await fetch(
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
      const storeResponse = await fetch("/api/morpheus/confidential/store", {
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
      if (!storeResponse.ok) {
        throw new Error(
          stored?.error ||
            stored?.message ||
            "Morpheus confidential store is unavailable",
        );
      }
      const secretRef = String(
        stored.secret_ref || stored.id || stored.ref || "",
      ).trim();
      if (!secretRef) {
        throw new Error("Morpheus confidential store did not return a secret reference");
      }

      const requestCount = Number(state.requestCount?.get?.() ?? 0) + 1;
      setObservable(state, "requestCount", requestCount);
      setObservable(state, "lastStatus", "Sealed");
      setObservable(
        state,
        "lastDigest",
        transferPackage.publicEnvelope.note_commitment,
      );
      setStatus("Private transfer sealed", "success");
      setSubmitState({
        status: "stored",
        message:
          "Ciphertext stored. Morpheus confidential compute can now decrypt and validate the private transfer payload inside the TEE.",
        secretRef,
        noteCommitment: transferPackage.publicEnvelope.note_commitment,
        nullifier: transferPackage.publicEnvelope.nullifier_hash,
      });
    } catch (error) {
      const message = userFacingSealError(error, sealPhase);
      console.warn(`[private-transfer] seal failed during ${sealPhase} phase`);
      setStatus(message, "error");
      setSubmitState({ status: "error", message });
    }
  }, [amount, asset, canSeal, memo, network, recipient, setStatus, state]);

  const sealed = submitState.status !== "idle";

  return (
    <div className="private-transfer">
      <section className="private-transfer__hero">
        <div className="private-transfer__hero-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1" />
          </svg>
        </div>
        <div className="private-transfer__hero-body">
          <span className="private-transfer__eyebrow">
            Neo N3 private payments
          </span>
          <h2>Confidential transfer desk</h2>
          <p>
            Seal recipient, amount, memo, and note secret in the browser, then
            Morpheus runs the private compute path.
          </p>
          <div className="private-transfer__hero-facts">
            <span>
              {network === "mainnet" ? "Mainnet" : "Testnet"} · {asset}
            </span>
            <span className="private-transfer__badge">
              No on-chain zk curve dependency
            </span>
          </div>
        </div>
      </section>

      <section
        className={`private-transfer__grid${
          sealed ? "" : " private-transfer__grid--solo"
        }`}
      >
        <div className="private-transfer__panel">
          <div className="private-transfer__form-grid">
            <label>
              <span>Network</span>
              <select
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </label>
            <label>
              <span>Asset</span>
              <select
                value={asset}
                onChange={(event) => setAsset(event.target.value)}
              >
                <option>GAS</option>
                <option>NEO</option>
              </select>
            </label>
            <label className="private-transfer__wide">
              <span>Recipient</span>
              <input
                value={recipient}
                placeholder="N..."
                aria-invalid={recipientInvalid || undefined}
                onChange={(event) => setRecipient(event.target.value)}
              />
              {recipientInvalid && (
                <small className="private-transfer__field-error">
                  Enter a valid Neo N3 address.
                </small>
              )}
            </label>
            <label>
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step={isNeo ? "1" : "0.00000001"}
                value={amount}
                aria-invalid={amountInvalid || undefined}
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountInvalid && (
                <small className="private-transfer__field-error">
                  {isNeo
                    ? "NEO is indivisible — enter a whole number greater than zero."
                    : "Enter an amount greater than zero."}
                </small>
              )}
              <div
                className="private-transfer__presets"
                aria-label="Amount presets"
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
              <span>Private memo</span>
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
          {!canSeal && (
            <div className="private-transfer__validation" role="status">
              Add a valid recipient and positive amount to enable local sealing.
            </div>
          )}
          <button
            type="button"
            className="private-transfer__seal-button"
            onClick={sealTransfer}
            disabled={submitState.status === "sealing" || !canSeal}
            aria-label={
              submitState.status === "sealing"
                ? "Sealing private transfer"
                : "Seal private transfer"
            }
          >
            {submitState.status === "sealing" ? "Sealing..." : "Seal private transfer"}
          </button>
        </div>

        {sealed && (
        <aside
          className={`private-transfer__status private-transfer__status--${submitState.status}`}
        >
          <div className="private-transfer__status-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2 4 6v6c0 5 3.4 7.7 8 10 4.6-2.3 8-5 8-10V6l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <span>Morpheus confidential compute</span>
          <strong>{submitState.message}</strong>
          {submitState.status === "error" && (
            <p className="private-transfer__safe-copy">
              Nothing was sent on-chain. Fix the inputs or try again when the
              Morpheus service is available.
            </p>
          )}
          {submitState.status === "stored" && (
            <dl>
              <div>
                <dt>Secret ref</dt>
                <dd>{submitState.secretRef}</dd>
              </div>
              <div>
                <dt>Commitment</dt>
                <dd>{submitState.noteCommitment}</dd>
              </div>
              <div>
                <dt>Nullifier</dt>
                <dd>{submitState.nullifier}</dd>
              </div>
            </dl>
          )}
        </aside>
        )}
      </section>

      <details className="private-transfer__steps" open>
        <summary>
          <span>How a confidential transfer settles</span>
          <span className="private-transfer__steps-chevron" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <div className="private-transfer__steps-grid">
          {[
            ["1", "Deposit or wallet intent", "The public side only needs an asset lock or signed payment intent."],
            ["2", "Local encryption", "The private fields are sealed with X25519-HKDF-SHA256-AES-256-GCM."],
            ["3", "TEE validation", "Morpheus decrypts, checks nullifier reuse, and signs the settlement envelope."],
            ["4", "Release or refund", "The user submits the returned settlement intent through the wallet."],
          ].map(([index, title, body]) => (
            <article key={title}>
              <span>{index}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
