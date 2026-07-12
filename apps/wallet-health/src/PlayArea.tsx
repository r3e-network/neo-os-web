/** Wallet Health — evidence-led, read-only wallet checkup. */
import { useCallback, useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCheck,
  Copy,
  Database,
  Eye,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { officialGasTokenUrl, officialNeoTokenUrl } from "@shared/art/token-assets";
import type { WalletEvidenceStatus } from "./composables/useWalletAnalysis";
import "./PlayArea.scss";

const SCANNER_IMAGE = "./wallet-health-scanner.webp";
const PRIMARY_CHECK_IDS = new Set(["backup", "gas", "permissions"]);

type Translate = (key: string, p?: Record<string, string | number>) => string;
type DataStatus = "disconnected" | "idle" | "connecting" | "refreshing" | "fresh" | "partial" | "error";

interface PlayAreaProps {
  t: Translate;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface ChecklistItem {
  id: string;
  title?: string;
  label?: string;
  desc?: string;
  done: boolean;
  auto?: boolean;
  pending?: boolean;
}

interface HealthStat {
  label: string;
  value: string;
}

interface EvidenceRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  outcome: WalletEvidenceStatus | "attention";
}

interface ChecklistRowProps {
  item: ChecklistItem;
  t: Translate;
  onToggle: (id: string) => void;
}

const EMPTY_CHECKLIST: ChecklistItem[] = [];
const EMPTY_STATS: HealthStat[] = [];
const EMPTY_RECOMMENDATIONS: string[] = [];

function compactAddress(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 24 ? `${text.slice(0, 10)}…${text.slice(-8)}` : text;
}

function EvidenceRow({ icon, label, value, outcome }: EvidenceRowProps) {
  return (
    <li className="health-evidence-row" data-outcome={outcome}>
      <span className="health-evidence-row__icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

function readOutcomeLabel(
  t: Translate,
  status: WalletEvidenceStatus,
  hasPreviousValue: boolean,
): string {
  if (status === "reading") return t("checkReading");
  if (status === "failed") {
    return hasPreviousValue ? t("checkFailedPrevious") : t("checkFailed");
  }
  if (status === "zero") return t("checkZero");
  if (status === "pass") return t("checkPass");
  return t("checkUnknown");
}

function ChecklistRow({ item, t, onToggle }: ChecklistRowProps) {
  const title = item.title ?? item.label ?? item.id;
  const status = item.pending
    ? t("checklistConnectToCheck")
    : item.auto
      ? item.done ? t("reserveAvailable") : t("reserveLow")
      : item.done ? t("selfReported") : t("reportPending");

  return (
    <button
      type="button"
      className="health-check"
      data-done={item.done ? "true" : undefined}
      data-pending={item.pending ? "true" : undefined}
      data-auto={item.auto ? "true" : undefined}
      onClick={() => onToggle(item.id)}
      disabled={Boolean(item.auto || item.pending)}
      aria-pressed={item.auto ? undefined : item.done}
    >
      <span className="health-check__box" aria-hidden="true">
        {item.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </span>
      <span className="health-check__body">
        <strong>{title}</strong>
        {item.desc ? <span>{item.desc}</span> : null}
      </span>
      <span className="health-check__status">{status}</span>
    </button>
  );
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, num, val } = useStateBindings(state);
  const address = str("address");
  const isConnected = bool("isConnected");
  const isConnecting = bool("isConnecting");
  const isRefreshing = bool("isRefreshing");
  const dataStatus = str("dataStatus", isConnected ? "idle" : "disconnected") as DataStatus;
  const lastUpdatedAt = num("lastUpdatedAt");
  const lastError = str("lastError");
  const neoObservedAt = num("neoObservedAt");
  const gasObservedAt = num("gasObservedAt");
  const neoReadStatus = str("neoReadStatus", "unknown") as WalletEvidenceStatus;
  const gasReadStatus = str("gasReadStatus", "unknown") as WalletEvidenceStatus;
  const networkReadStatus = str("networkReadStatus", "unknown") as WalletEvidenceStatus;
  const walletNetworkLabel = str("walletNetworkLabel", "—");
  const networkMismatch = bool("networkMismatch");
  const storageAvailable = val<boolean>("storageAvailable") ?? true;
  const connectionStatus = str("connectionStatus", t(isConnected ? "statusConnected" : "statusDisconnected"));
  const networkLabel = str("networkLabel", "Neo N3");
  const neoDisplay = str("neoDisplay", "—");
  const gasDisplay = str("gasDisplay", "—");
  const reviewProgress = num("safetyScore");
  const reviewLabel = str("riskLabel", t("reviewNotStarted"));
  const completedCount = num("completedChecklistCount");
  const totalCount = num("totalChecklistCount");
  const rawChecklistItems = val("checklistItems") as ChecklistItem[] | undefined;
  const rawHealthStats = val("healthStats") as HealthStat[] | undefined;
  const rawRecommendations = val("recommendations") as string[] | undefined;
  const checklistItems = useMemo(() => rawChecklistItems ?? EMPTY_CHECKLIST, [rawChecklistItems]);
  const healthStats = useMemo(() => rawHealthStats ?? EMPTY_STATS, [rawHealthStats]);
  const recommendations = useMemo(
    () => rawRecommendations ?? EMPTY_RECOMMENDATIONS,
    [rawRecommendations],
  );

  const primaryChecklist = useMemo(
    () => checklistItems.filter((item) => PRIMARY_CHECK_IDS.has(item.id)),
    [checklistItems],
  );
  const secondaryChecklist = useMemo(
    () => checklistItems.filter((item) => !PRIMARY_CHECK_IDS.has(item.id)),
    [checklistItems],
  );
  const visibleRecommendations = recommendations.slice(0, 2);
  const moreRecommendationCount = Math.max(0, recommendations.length - visibleRecommendations.length);
  const gasCheck = checklistItems.find((item) => item.id === "gas");
  const hasObservedBalances = isConnected && (neoObservedAt > 0 || gasObservedAt > 0);
  const hasReadError = dataStatus === "error";
  const hasPartialRead = dataStatus === "partial";
  const hasReadProblem = hasReadError || hasPartialRead;
  const hasNetworkProblem = isConnected && dataStatus === "fresh" && networkReadStatus !== "pass";
  const lastReadTime = useMemo(() => {
    if (!lastUpdatedAt) return "";
    const date = new Date(lastUpdatedAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastUpdatedAt]);
  const progressText = t("checklistProgress", { completed: completedCount, total: totalCount });

  const statusText = isConnecting
    ? t("walletConnecting")
    : isRefreshing || dataStatus === "refreshing"
      ? t("diagnosticStatusScanning")
      : hasReadError
        ? t("diagnosticStatusError")
        : hasPartialRead
          ? t("diagnosticStatusPartial")
          : hasNetworkProblem
            ? t("diagnosticStatusNetworkMismatch")
        : hasObservedBalances
          ? t("diagnosticStatusReady")
          : t("diagnosticStatusIdle");
  const statusDetail = hasReadProblem
    ? [lastError || t("refreshFailed"), hasObservedBalances && lastReadTime
        ? `${t("previousRead")}: ${lastReadTime}`
        : ""].filter(Boolean).join(" · ")
    : networkMismatch
      ? t("networkMismatchDetail", { expected: networkLabel, actual: walletNetworkLabel })
      : hasNetworkProblem
        ? networkReadStatus === "failed" ? t("networkReadFailedDetail") : t("networkUnknownDetail")
    : hasObservedBalances
      ? `${t("lastUpdated")}: ${lastReadTime}`
      : t("connectHint");
  const primaryLabel = isConnecting
    ? t("walletConnecting")
    : isRefreshing ? t("diagnosticStatusScanning")
      : hasReadProblem ? t("retry")
        : isConnected ? t("refreshBalances") : t("connectToScore");

  const buildReport = useCallback(() => {
    const lines = [
      t("reportTitle"),
      t("reportDisclaimer"),
      `${t("reportGeneratedAt")}: ${new Date().toISOString()}`,
      `${t("walletAddress")}: ${address || t("notConnected")}`,
      `${t("statTargetNetwork")}: ${networkLabel}`,
      `${t("statWalletNetwork")}: ${walletNetworkLabel}`,
      `${t("diagnosticReportStep")}: ${statusText}`,
      `${t("statScore")}: ${reviewProgress}% (${reviewLabel})`,
      `${t("statNeo")}: ${neoDisplay} (${readOutcomeLabel(t, neoReadStatus, neoObservedAt > 0)})`,
      `${t("statGas")}: ${gasDisplay} (${readOutcomeLabel(t, gasReadStatus, gasObservedAt > 0)})`,
      "",
      t("reportChecklist"),
      ...checklistItems.map((item) => {
        const title = item.title ?? item.label ?? item.id;
        const itemStatus = item.pending
          ? t("checklistConnectToCheck")
          : item.done ? t("reportDone") : t("reportPending");
        return `- ${title}: ${itemStatus}`;
      }),
    ];
    if (recommendations.length > 0) {
      lines.push("", t("recommendationsTitle"), ...recommendations.map((item) => `- ${item}`));
    }
    return lines.join("\n");
  }, [
    address,
    checklistItems,
    gasDisplay,
    gasObservedAt,
    gasReadStatus,
    neoDisplay,
    neoObservedAt,
    neoReadStatus,
    networkLabel,
    recommendations,
    reviewLabel,
    reviewProgress,
    statusText,
    t,
    walletNetworkLabel,
  ]);

  const toggleChecklist = useCallback(
    (id: string) => { void dispatch("toggleChecklist", id); },
    [dispatch],
  );
  const runRead = useCallback(
    () => { void dispatch(isConnected ? "refreshBalances" : "connectWallet"); },
    [dispatch, isConnected],
  );

  const gasReserveOutcome: EvidenceRowProps["outcome"] = gasReadStatus === "reading"
    ? "reading"
    : gasReadStatus === "failed"
      ? "failed"
      : gasReadStatus === "unknown"
        ? "unknown"
        : gasReadStatus === "zero"
          ? "zero"
          : gasCheck?.done ? "pass" : "attention";

  const evidenceRows: EvidenceRowProps[] = [
    {
      icon: <WalletCards size={16} />,
      label: t("evidenceConnection"),
      value: isConnected ? t("verified") : t("notRead"),
      outcome: isConnected ? "pass" : "unknown",
    },
    {
      icon: <Database size={16} />,
      label: t("evidenceWalletNetwork"),
      value: networkMismatch
        ? t("networkMismatch")
        : networkReadStatus === "pass"
          ? walletNetworkLabel
          : readOutcomeLabel(t, networkReadStatus, false),
      outcome: networkReadStatus,
    },
    {
      icon: <img src={officialNeoTokenUrl} alt="" />,
      label: t("statNeo"),
      value: readOutcomeLabel(t, neoReadStatus, neoObservedAt > 0),
      outcome: neoReadStatus,
    },
    {
      icon: <img src={officialGasTokenUrl} alt="" />,
      label: t("statGas"),
      value: readOutcomeLabel(t, gasReadStatus, gasObservedAt > 0),
      outcome: gasReadStatus,
    },
    {
      icon: <ShieldCheck size={16} />,
      label: t("evidenceGasReserve"),
      value: gasReserveOutcome === "reading"
        ? t("checkReading")
        : gasReserveOutcome === "failed"
          ? t("checkFailed")
          : gasReserveOutcome === "unknown"
            ? t("notRead")
            : gasReserveOutcome === "zero"
              ? t("reserveZero")
              : gasReserveOutcome === "pass" ? t("reserveAvailable") : t("reserveLow"),
      outcome: gasReserveOutcome,
    },
  ];

  const scene = (
    <div className="health-console" data-status={dataStatus}>
      <section className="health-overview" aria-labelledby="wallet-checkup-status">
        <header className="health-overview__head">
          <span className="health-connection" data-connected={isConnected ? "true" : undefined}>
            <WalletCards size={16} aria-hidden="true" />
            {connectionStatus}
          </span>
          <strong>{networkLabel || "Neo N3"}</strong>
        </header>

        <div className="health-overview__main">
          <figure className="health-scanner-art">
            <img src={SCANNER_IMAGE} alt={t("scannerArtAlt")} loading="eager" decoding="async" />
          </figure>
          <div className="health-overview__copy" aria-live="polite">
            <h3 id="wallet-checkup-status">{statusText}</h3>
            <p>{statusDetail}</p>
            <div className="health-boundaries" aria-label={t("privacyTitle")}>
              <span><Eye size={14} aria-hidden="true" />{t("readOnlyBadge")}</span>
              <span><LockKeyhole size={14} aria-hidden="true" />{t("localOnlyBadge")}</span>
            </div>
            <button
              type="button"
              className="health-primary-action"
              onClick={runRead}
              disabled={isConnecting || isRefreshing}
              aria-busy={isConnecting || isRefreshing || undefined}
            >
              {isConnecting || isRefreshing
                ? <span className="mx2-spinner" aria-hidden="true" />
                : isConnected ? <RefreshCw size={16} aria-hidden="true" /> : <WalletCards size={16} aria-hidden="true" />}
              <span>{primaryLabel}</span>
            </button>
          </div>
        </div>

        {hasReadProblem ? (
          <div className="health-error" data-partial={hasPartialRead ? "true" : undefined} role="alert">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>{lastError || t("refreshFailed")}</span>
          </div>
        ) : null}

        <div className="health-balance-strip" aria-label={t("balanceStripTitle")}>
          <div data-outcome={neoReadStatus}>
            <img src={officialNeoTokenUrl} alt="" aria-hidden="true" />
            <span>{t("statNeo")}</span>
            <strong>{neoDisplay}</strong>
            <small>{readOutcomeLabel(t, neoReadStatus, neoObservedAt > 0)}</small>
          </div>
          <div data-outcome={gasReadStatus}>
            <img src={officialGasTokenUrl} alt="" aria-hidden="true" />
            <span>{t("statGas")}</span>
            <strong>{gasDisplay}</strong>
            <small>{readOutcomeLabel(t, gasReadStatus, gasObservedAt > 0)}</small>
          </div>
        </div>

        <div className="health-progress-block">
          <div>
            <span>{t("reviewProgress")}</span>
            <strong>{progressText}</strong>
          </div>
          <div
            className="health-progress"
            role="progressbar"
            aria-label={t("reviewProgress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={reviewProgress}
          >
            <span style={{ width: `${Math.max(0, Math.min(100, reviewProgress))}%` }} />
          </div>
          <p>{t("scoreSelfAssessCaption")}</p>
        </div>

        <section className="health-evidence" aria-labelledby="health-evidence-title">
          <h3 id="health-evidence-title">{t("evidenceTitle")}</h3>
          <ul>{evidenceRows.map((row) => <EvidenceRow key={row.label} {...row} />)}</ul>
          <div className="health-unavailable">
            <strong>{t("unavailableTitle")}</strong>
            <span>{t("unavailableCopy")}</span>
          </div>
        </section>
      </section>

      <section className="health-checklist-card" aria-labelledby="health-self-check-title">
        <header className="health-section-head">
          <span id="health-self-check-title"><ClipboardCheck size={17} aria-hidden="true" />{t("selfCheckTitle")}</span>
          <strong>{reviewLabel}</strong>
        </header>
        <div className="health-checklist">
          {primaryChecklist.map((item) => (
            <ChecklistRow key={item.id} item={item} t={t} onToggle={toggleChecklist} />
          ))}
        </div>
        {secondaryChecklist.length > 0 ? (
          <details className="health-more-checks">
            <summary>
              <span>{t("moreChecks", { count: secondaryChecklist.length })}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className="health-checklist">
              {secondaryChecklist.map((item) => (
                <ChecklistRow key={item.id} item={item} t={t} onToggle={toggleChecklist} />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className="health-next-card" aria-labelledby="health-next-actions-title">
        <header className="health-section-head">
          <span id="health-next-actions-title"><AlertTriangle size={17} aria-hidden="true" />{t("recommendationsTitle")}</span>
          {moreRecommendationCount > 0
            ? <strong>{t("moreActions", { count: moreRecommendationCount })}</strong>
            : null}
        </header>
        {visibleRecommendations.length > 0 ? (
          <ol className="health-recommendations">
            {visibleRecommendations.map((item, index) => (
              <li key={`${item}-${index}`}><span>{index + 1}</span><p>{item}</p></li>
            ))}
          </ol>
        ) : (
          <p className="health-empty">{t("allSet")}</p>
        )}
      </section>

      <aside className="health-privacy" aria-label={t("privacyTitle")}>
        <LockKeyhole size={18} aria-hidden="true" />
        <div>
          <strong>{t("privacyTitle")}</strong>
          <p>{storageAvailable ? t("privacyCopy") : t("storageUnavailable")}</p>
        </div>
      </aside>
    </div>
  );

  return (
    <div className="wallet-health-play-area mx2 mx2-cat-tool">
      <PlayStage
        category="tool"
        className="wallet-health-stage"
        stage={{
          title: t("title"),
          subtitle: t("diagnosticStageCopy"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <Eye size={14} aria-hidden="true" /> {t("readOnlyBadge")}
            </span>
          ),
        }}
        scene={scene}
        actions={{
          secondary: [{
            label: t("copyReport"),
            onClick: () => { void dispatch("copy", buildReport(), "reportCopied"); },
            icon: <Copy size={16} />,
          }],
        }}
        drawerToggleLabel={t("diagnosticReportStep")}
        drawer={{
          title: t("diagnosticReportStep"),
          children: (
            <div className="health-report">
              <p className="health-report__disclaimer">{t("reportDisclaimer")}</p>
              <section>
                <h4>{t("networkReadiness")}</h4>
                {healthStats.length > 0
                  ? healthStats.map((stat) => (
                      <p className="health-report__row" key={stat.label}>
                        <span>{stat.label}</span><strong>{stat.value}</strong>
                      </p>
                    ))
                  : (
                    <>
                      <p className="health-report__row">
                        <span>{t("statTargetNetwork")}</span><strong>{networkLabel || "Neo N3"}</strong>
                      </p>
                      <p className="health-report__row">
                        <span>{t("statWalletNetwork")}</span><strong>{walletNetworkLabel}</strong>
                      </p>
                    </>
                    )}
                {address ? (
                  <div className="health-report__address">
                    <span>{t("walletAddress")}</span>
                    <strong>{compactAddress(address)}</strong>
                    <button
                      type="button"
                      onClick={() => { void dispatch("copy", address, "addressCopied"); }}
                    >
                      <Copy size={15} aria-hidden="true" />{t("copyAddress")}
                    </button>
                  </div>
                ) : null}
              </section>
              <section>
                <h4>{t("sectionRecommendations")}</h4>
                {recommendations.length > 0
                  ? recommendations.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
                  : <p>{t("allSet")}</p>}
              </section>
            </div>
          ),
        }}
      />
    </div>
  );
}
