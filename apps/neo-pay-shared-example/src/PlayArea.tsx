/**
 * Neo Pay shared runtime -- compact payment stream desk.
 */
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, HandCoins, UserRound, Wallet } from "lucide-react";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { deriveSchedulePreview } from "../../neo-pay/src/streamDisplay";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface Stream {
  id: string | number;
  recipient?: string;
  beneficiary?: string;
  amount?: string;
  status?: string;
  assetSymbol?: "GAS" | "NEO";
  [key: string]: unknown;
}

type AssetSymbol = "GAS" | "NEO";

const DURATION_PRESETS = [7, 30, 90];
const AMOUNT_PRESETS = ["10", "50", "100"];

function positiveNumber(value: string): boolean {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function normalizeAmountForAsset(value: string, asset: AssetSymbol): string {
  const text = String(value ?? "");
  if (asset === "NEO") {
    return text.split(/[.,]/)[0].replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function positiveAmountForAsset(value: string, asset: AssetSymbol): boolean {
  if (asset === "NEO") return /^[1-9]\d*$/.test(value.trim());
  return positiveNumber(value);
}

function compactAddress(value: string | undefined, empty = "-"): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return empty;
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const activeCount = num("activeCount");
  const createdStreamCount = num("createdStreamCount");
  const beneficiaryStreamCount = num("beneficiaryStreamCount");
  const isCreating = bool("isCreating");
  const isLoading = bool("isLoading");
  const serviceNotice = str("serviceNotice");
  const allStreams = val<Stream[]>("allStreams", []) ?? [];

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30");
  const [asset, setAsset] = useState<AssetSymbol>("GAS");
  const setAssetAndNormalizeAmount = (nextAsset: AssetSymbol) => {
    setAsset(nextAsset);
    setAmount((current) => normalizeAmountForAsset(current, nextAsset));
  };

  const schedulePreview = useMemo(
    () => deriveSchedulePreview(amount, duration, asset),
    [amount, duration, asset],
  );
  const featuredStream = allStreams[0] ?? null;
  const readyToCreate = recipient.trim().length > 0 && positiveAmountForAsset(amount, asset) && positiveNumber(duration);
  const busy = isCreating || isLoading;
  const draftStatus = isCreating
    ? t("streamDraftSigning")
    : readyToCreate
      ? t("streamDraftReady")
      : t("streamDraftIdle");
  const destinationLabel = recipient.trim()
    ? compactAddress(recipient, t("recipient"))
    : compactAddress(featuredStream?.beneficiary ?? featuredStream?.recipient, t("recipient"));
  const releaseLabel = schedulePreview
    ? schedulePreview.kind === "cliff"
      ? t("releaseCliff", { amount: schedulePreview.amount, token: asset, days: schedulePreview.days })
      : t("releaseLinear", { amount: schedulePreview.amount, token: asset })
    : t("reviewStream");

  const handleCreate = () => {
    if (!readyToCreate || busy) return;
    void dispatch("createStream", {
      recipient,
      amount,
      duration,
      token: asset,
    });
  };

  const scene = (
    <div className="neopay-shared-desk" data-state={isCreating ? "creating" : readyToCreate ? "ready" : "idle"}>
      <section className="neopay-ticket-board" aria-label={t("sharedPaymentStage")}>
        <div className="neopay-ticket-board__screen">
          <span>
            <CoinArt size={28} variant={asset === "GAS" ? "gas" : "neo"} />
            {t("streamTicket")}
          </span>
          <strong>{amount || "0"} {asset}</strong>
          <em>{releaseLabel}</em>
        </div>

        <div className="neopay-route" aria-label={t("sharedStreamRoute")}>
          <div className="neopay-node neopay-node--wallet">
            <span className="neopay-node__icon"><Wallet size={20} /></span>
            <span>{t("walletFunding")}</span>
            <strong>{amount || "0"}</strong>
            <em>{asset}</em>
          </div>

          <div className="neopay-flow" aria-hidden="true">
            <span className="neopay-flow__rail" />
            <span className="neopay-flow__orb neopay-flow__orb--one" />
            <span className="neopay-flow__orb neopay-flow__orb--two" />
            <ArrowRight size={22} />
          </div>

          <div className="neopay-node neopay-node--recipient">
            <span className="neopay-node__icon"><UserRound size={20} /></span>
            <span>{t("recipient")}</span>
            <strong>{destinationLabel}</strong>
            <em>{releaseLabel}</em>
          </div>
        </div>

        <div className="neopay-receipt-strip">
          <span>{t("recipient")}</span>
          <strong>{destinationLabel}</strong>
          <span>{t("releasePlan")}</span>
          <strong>{releaseLabel}</strong>
        </div>

        <div className="neopay-route__status">
          <span><Clock3 size={15} /> {draftStatus}</span>
          <strong>{releaseLabel}</strong>
        </div>
      </section>

      <section className="neopay-ticket" aria-label={t("streamTicket")}>
        {serviceNotice && <p className="neopay-ticket__notice" role="status">{serviceNotice}</p>}

        <header className="neopay-ticket__head">
          <span>{t("streamTicket")}</span>
          <strong>{draftStatus}</strong>
        </header>

        <div className="neopay-ticket__summary" aria-hidden="true">
          <span><HandCoins size={16} /></span>
          <strong>{amount || "0"} {asset}</strong>
          <em>{duration || "0"}d</em>
        </div>

        <div className="neopay-ticket__amount">
          <label htmlFor="neopay-shared-amount">{t("totalAmount")}</label>
          <div className="neopay-amount-row">
            <input
              id="neopay-shared-amount"
              value={amount}
              onChange={(event) => setAmount(normalizeAmountForAsset(event.target.value, asset))}
              placeholder="0"
              inputMode={asset === "NEO" ? "numeric" : "decimal"}
              disabled={busy}
            />
            <div className="neopay-asset-toggle" role="radiogroup" aria-label={t("assetType")}>
              {(["GAS", "NEO"] as const).map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  className={asset === symbol ? "is-active" : undefined}
                  onClick={() => setAssetAndNormalizeAmount(symbol)}
                  aria-pressed={asset === symbol}
                  disabled={busy}
                >
                  <CoinArt size={22} variant={symbol === "GAS" ? "gas" : "neo"} />
                  <span>{symbol}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="neopay-amount-presets" aria-label={t("totalAmount")}>
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={amount === preset ? "is-active" : undefined}
                onClick={() => setAmount(preset)}
                disabled={busy}
              >
                {preset} {asset}
              </button>
            ))}
          </div>
        </div>

        <label className="neopay-recipient-field" htmlFor="neopay-shared-recipient">
          <span><UserRound size={15} /> {t("recipient")}</span>
          <input
            id="neopay-shared-recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder={t("beneficiaryPlaceholder")}
            disabled={busy}
            spellCheck={false}
          />
        </label>

        <div className="neopay-duration">
          <div className="neopay-duration__head">
            <span><CalendarDays size={15} /> {t("duration")}</span>
            <strong>{duration || "0"}d</strong>
          </div>
          <div className="neopay-duration__grid">
            {DURATION_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                className={duration === String(days) ? "is-active" : undefined}
                onClick={() => setDuration(String(days))}
                disabled={busy}
              >
                {days}d
              </button>
            ))}
            <input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              inputMode="numeric"
              disabled={busy}
              aria-label={t("customDays")}
            />
          </div>
        </div>

        <p className="neopay-ticket__review">
          <CheckCircle2 size={15} />
          {t("transactionPreviewHint")}
        </p>
      </section>
    </div>
  );

  const drawer = (
    <div className="neopay-shared-drawer">
      {allStreams.length > 0 ? (
        <ul className="mx2-history">
          {allStreams.slice(0, 8).map((stream) => (
            <li key={String(stream.id)} className="mx2-history__item">
              <span className="mx2-history__face">{compactAddress(stream.beneficiary ?? stream.recipient)}</span>
              <span className="mx2-history__stake">{String(stream.amount ?? stream.assetSymbol ?? "")}</span>
              <span className="mx2-history__result">{stream.status ?? "active"}</span>
              <button
                type="button"
                className="mx2-btn mx2-btn--ghost"
                onClick={() => void dispatch("claimStream", String(stream.id))}
              >
                {t("claim")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No streams yet.</p>
      )}
    </div>
  );

  return (
    <div className="neo-pay-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{
          eyebrow: "Neo Pay",
          title: "Payment Streams",
          subtitle: t("docSubtitle"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {activeCount} {t("active")}</span>,
        }}
        scene={scene}
        score={[
          { label: "Active", value: String(activeCount), accent: true },
          { label: "Created", value: String(createdStreamCount) },
          { label: "Beneficiary", value: String(beneficiaryStreamCount) },
        ]}
        actions={{
          primary: {
            label: isCreating ? "Creating stream" : "Create Stream",
            onClick: handleCreate,
            disabled: busy || !readyToCreate,
            loading: isCreating,
          },
        }}
        drawerToggleLabel="Streams"
        drawer={{ title: "Streams", children: drawer }}
      />
    </div>
  );
}
