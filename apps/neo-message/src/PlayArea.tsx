/** PlayArea.tsx — Neo Message sealing desk */
import {
  useId,
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Clock3, LockKeyhole, MailCheck, RadioTower, RefreshCw, SendHorizontal, ShieldCheck, Stamp } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
// Was a byte-identical local copy. The copy wore Semi's checkbox class
// contract without the CSS behind it, so the native OS checkbox rendered on
// top of the styled card; the shared component carries that CSS.
import { OpenUiLiteCardCheckbox } from "@shared/components-react/v2/OpenUiLite";
import {
  MAX_BODY_LENGTH,
  formatUnlock,
  isMessageRecipient,
  messageStatus,
  needsPublicRevealAck,
  shortAddress,
  validateCompose,
  type ComposeForm,
  type LockMode,
  type MessageView,
} from "./message-logic";
import {
  pendingDeliveryIsStale,
  type PendingDelivery,
} from "./pending-delivery";
import "./PlayArea.scss";

const sealedDeskUrl = new URL("../public/sealed-message-desk.webp", import.meta.url).href;

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const EMPTY_FORM: ComposeForm = {
  recipient: "",
  body: "",
  lockMode: "recipient",
  revealDate: "",
  publicRevealAcknowledged: false,
};

type DrawerMode = "delivery" | "inbox" | "sent" | "network";

// These semantic adapters preserve the shared mx2/Open UI class contract while
// avoiding the full Semi UI runtime in a focused embedded MiniApp.
function OpenUiProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function OpenUiNotice({
  className,
  icon,
  title,
  children,
  type = "info",
}: {
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  type?: "info" | "warning" | "error";
}) {
  return (
    <div
      className={["mx2-open-notice", "semi-banner", `semi-banner-${type}`, className].filter(Boolean).join(" ")}
      role={type === "error" ? "alert" : "status"}
    >
      <div className="semi-banner-content-wrapper">
        <div className="semi-banner-content">
          {icon ? <span className="semi-banner-icon mx2-open-notice__icon">{icon}</span> : null}
          <div className="semi-banner-content-body">
            <div className="semi-banner-title">{title}</div>
            {children ? <div className="semi-banner-description">{children}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function OpenUiTextField({
  className,
  hint,
  inputClassName,
  label,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
  hint?: ReactNode;
  inputClassName?: string;
  label: ReactNode;
}) {
  const reactId = useId();
  const id = inputProps.id ?? `neomsg-field-${reactId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className={["mx2-open-field", className].filter(Boolean).join(" ")} htmlFor={id}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <span className={["mx2-open-field__control", "semi-input-wrapper", inputClassName].filter(Boolean).join(" ")}>
        <input
          {...inputProps}
          id={id}
          className="semi-input"
          aria-labelledby={inputProps["aria-labelledby"] ?? labelId}
          aria-describedby={inputProps["aria-describedby"] ?? hintId}
        />
      </span>
      {hint ? <span id={hintId} className="mx2-open-field__hint">{hint}</span> : null}
    </label>
  );
}

function OpenUiTextArea({
  className,
  hint,
  label,
  textareaClassName,
  ...textareaProps
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  className?: string;
  hint?: ReactNode;
  label: ReactNode;
  textareaClassName?: string;
}) {
  const reactId = useId();
  const id = textareaProps.id ?? `neomsg-textarea-${reactId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className={["mx2-open-field", "mx2-open-field--textarea", className].filter(Boolean).join(" ")} htmlFor={id}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <span className={[
        "mx2-open-field__control",
        "mx2-open-field__control--textarea",
        "semi-input-textarea-wrapper",
        textareaClassName,
      ].filter(Boolean).join(" ")}>
        <textarea
          {...textareaProps}
          id={id}
          className="semi-input-textarea"
          aria-labelledby={textareaProps["aria-labelledby"] ?? labelId}
          aria-describedby={textareaProps["aria-describedby"] ?? hintId}
        />
      </span>
      {hint ? <span id={hintId} className="mx2-open-field__hint">{hint}</span> : null}
    </label>
  );
}

function OpenUiSegmented({
  className,
  label,
  onChange,
  options,
  segmentedClassName,
  value,
}: {
  className?: string;
  label: ReactNode;
  onChange?: (value: string) => void;
  options: Array<{ disabled?: boolean; label: ReactNode; value: string }>;
  segmentedClassName?: string;
  value?: string;
}) {
  const labelId = `neomsg-segmented-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <div className={["mx2-open-field", "mx2-open-field--segmented", className].filter(Boolean).join(" ")}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <div
        className={["mx2-open-segmented", "semi-radioGroup", segmentedClassName].filter(Boolean).join(" ")}
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={["semi-radio", checked ? "semi-radio-checked" : "", option.disabled ? "semi-radio-disabled" : ""].filter(Boolean).join(" ")}
            >
              <input
                type="radio"
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange?.(option.value)}
              />
              <span className="semi-radio-addon-buttonRadio">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}


function bodyPreview(body: string, fallback: string): string {
  const trimmed = body.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 170 ? `${trimmed.slice(0, 170)}...` : trimmed;
}

function displayMode(form: ComposeForm): LockMode {
  return form.lockMode === "timed" ? "timed" : "recipient";
}

function MessageRow({
  row,
  type,
  busy,
  pending,
  t,
  dispatch,
}: {
  row: MessageView;
  type: "inbox" | "outbox";
  busy: boolean;
  pending: boolean;
  t: P["t"];
  dispatch: P["dispatch"];
}) {
  const status = messageStatus(row);
  const isRecipientOnly = status === "recipient";
  const privatelyOpened = isRecipientOnly && Boolean(row.plaintext);
  const unlockLabel = formatUnlock(row.unlockTime);
  const canRevealRecipient = type === "inbox" && isRecipientOnly && !row.revealed && !row.plaintext;
  const canRequestReveal = status === "unlockable";
  const locked = status === "locked";

  return (
    <li className="neomsg-message">
      <div className="neomsg-message__top">
        <span className="neomsg-message__id">#{row.id}</span>
        <span className="neomsg-message__status" data-status={pending ? "pending" : privatelyOpened ? "private-open" : status}>
          {pending
            ? t("statusBadgeRevealPending")
            : privatelyOpened
            ? t("statusBadgePrivateOpen")
            : t(`statusBadge${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
        </span>
      </div>
      <dl className="neomsg-message__meta">
        <div>
          <dt>{type === "inbox" ? t("fromLabel") : t("toLabel")}</dt>
          <dd>{shortAddress(type === "inbox" ? row.sender : row.recipient)}</dd>
        </div>
        <div>
          <dt>{row.timeLocked ? t("unlocksLabel") : t("deliveryPreviewLabel")}</dt>
          <dd>{row.timeLocked ? unlockLabel : t("recipientOnlyHint")}</dd>
        </div>
      </dl>
      <p className="neomsg-message__body">
        {row.plaintext || (
          locked
            ? t("notUnlockedYet")
            : status === "unlockable"
              ? t("readyToRevealBody")
              : t("onlyRecipientCanRead")
        )}
      </p>
      {(canRevealRecipient || canRequestReveal) && (
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost"
          disabled={busy || pending}
          onClick={() => dispatch(canRevealRecipient ? "revealRecipient" : "requestTimedReveal", row)}
        >
          {pending ? t("statusRevealPending") : canRevealRecipient ? t("revealForMe") : t("revealOnChain")}
        </button>
      )}
    </li>
  );
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, val } = useStateBindings(state);
  const address = str("address");
  const connected = Boolean(address);
  const networkSupported = bool("networkSupported");
  const hasWallet = bool("hasWallet");
  const isLoading = bool("isLoading");
  const isSending = bool("isSending");
  const isRecovering = bool("isRecovering");
  const pendingStorageHealthy = bool("pendingStorageHealthy");
  const lastStatus = str("lastStatus", t("statusReady"));
  const form = val<ComposeForm>("composeForm", EMPTY_FORM) ?? EMPTY_FORM;
  const inbox = val<MessageView[]>("inbox", []) ?? [];
  const outbox = val<MessageView[]>("outbox", []) ?? [];
  const busyIds = val<string[]>("busyIds", []) ?? [];
  const pendingRevealIds = val<string[]>("pendingRevealIds", []) ?? [];
  const pendingDelivery = val<PendingDelivery>("pendingDelivery");
  const hasMoreInbox = bool("hasMoreInbox");
  const hasMoreOutbox = bool("hasMoreOutbox");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("delivery");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const lockMode = displayMode(form);
  const recipient = String(form.recipient ?? "");
  const body = String(form.body ?? "");
  const validRecipient = isMessageRecipient(recipient);
  const bodyLength = body.length;
  const bodyTooLong = bodyLength > MAX_BODY_LENGTH;
  const ackNeeded = needsPublicRevealAck(lockMode, Boolean(form.publicRevealAcknowledged));
  const composeCheck = validateCompose(form, nowMs);
  const readyToSend = connected && networkSupported && !pendingDelivery && composeCheck.ok && !ackNeeded;
  const readinessValue = (() => {
    if (pendingDelivery) return t("statusSendPending");
    if (!hasWallet || !connected) return t("notConnected");
    if (!networkSupported) return t("switchToNeoX");
    if (!validRecipient) return t("readinessNeedRecipient");
    if (bodyLength === 0) return t("readinessNeedMessage");
    if (bodyTooLong) return t("readinessDeskNeedsDetails");
    if (lockMode === "timed" && !composeCheck.ok) return t("readinessDeskNeedsDate");
    if (ackNeeded) return t("readinessDeskNeedsAck");
    return t("readinessDeskReady");
  })();
  const drawerModes: Array<{ mode: DrawerMode; label: string; count?: number }> = [
    { mode: "delivery", label: t("deliveryTab") },
    { mode: "inbox", label: t("inboxTitle"), count: inbox.length },
    { mode: "sent", label: t("outboxTitle"), count: outbox.length },
    { mode: "network", label: t("networkCardTitle") },
  ];

  const updateForm = (patch: Partial<ComposeForm>) => {
    const next = { ...form, ...patch };
    state.composeForm?.set(next);
  };

  const setLockMode = (nextMode: LockMode) => {
    updateForm({
      lockMode: nextMode,
      revealDate: nextMode === "recipient" ? "" : form.revealDate ?? "",
      publicRevealAcknowledged: false,
    });
  };
  const setDrawerTab = (value: string) => {
    if (value === "delivery" || value === "inbox" || value === "sent" || value === "network") {
      setDrawerMode(value);
    }
  };
  const setDeliveryMode = (value: string) => {
    setLockMode(value === "timed" ? "timed" : "recipient");
  };
  const dispatchSafely: P["dispatch"] = async (name, ...args) => {
    try {
      await dispatch(name, ...args);
    } catch {
      // Actions already publish localized status. Keep rejected dispatches from
      // becoming unhandled promise rejections in the embedded host.
    }
  };

  const scene = (
    <div
      className={[
        "neomsg-desk",
        lockMode === "timed" ? "neomsg-desk--timed" : "neomsg-desk--recipient",
        isSending ? "neomsg-desk--sending" : null,
      ].filter(Boolean).join(" ")}
      data-ready={readyToSend ? "true" : undefined}
    >
      <section className="neomsg-mail-desk" aria-label={t("messageStageAria")}>
        <header className="neomsg-mail-desk__head">
          <span>
            <MailCheck size={16} />
            {t("composeTitle")}
          </span>
          <strong>{readinessValue}</strong>
        </header>

        <div className="neomsg-mail-desk__hero">
          <figure className="neomsg-mail-desk__art">
            <img src={sealedDeskUrl} alt="" loading="eager" decoding="async" />
            <figcaption>{lockMode === "timed" ? t("publicRevealLabel") : t("privateSealLabel")}</figcaption>
          </figure>

          <div className="neomsg-letter-card" data-ready={readyToSend ? "true" : undefined}>
            <div className="neomsg-envelope-card">
              <div className="neomsg-envelope-card__stamp" aria-hidden="true">
                <Stamp size={15} />
                <span>{lockMode === "timed" ? t("publicRevealLabel") : t("privateSealLabel")}</span>
              </div>
              <OpenUiTextField
                className="neomsg-recipient"
                inputClassName="neomsg-recipient__input"
                label={t("recipientPreviewLabel")}
                value={recipient}
                onChange={(event) => updateForm({ recipient: event.target.value })}
                maxLength={64}
                placeholder="0x..."
                autoComplete="off"
                inputMode="text"
                spellCheck={false}
                hint={(
                  <em data-valid={validRecipient ? "true" : undefined}>
                    {validRecipient ? shortAddress(recipient) : t("recipientPreviewEmpty")}
                  </em>
                )}
              />
              <OpenUiTextArea
                className="neomsg-note-sheet"
                textareaClassName="neomsg-note-sheet__input"
                label={t("messageLabel")}
                value={body}
                onChange={(event) => updateForm({ body: event.target.value, publicRevealAcknowledged: false })}
                maxLength={MAX_BODY_LENGTH}
                placeholder={t("messagePlaceholder")}
                rows={4}
              />
              <div className="neomsg-postmark" aria-live="polite">
                <span data-over={bodyTooLong ? "true" : undefined}>
                  {t("bodyCounter", { count: bodyLength, max: MAX_BODY_LENGTH })}
                </span>
                <strong>{readyToSend ? t("messageStageStepSend") : t("messageStageStepSeal")}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="neomsg-mail-desk__route">
          <span data-active={bodyLength > 0 ? "true" : undefined}>{t("messageStageStepWrite")}</span>
          <span data-active={validRecipient ? "true" : undefined}>{t("messageStageStepSeal")}</span>
          <span data-active={readyToSend ? "true" : undefined}>{t("messageStageStepSend")}</span>
        </div>

        <div className="neomsg-mail-desk__preview">
          <span>{t("messagePreviewTitle")}</span>
          <p>{bodyPreview(body, t("messageDraftEmpty"))}</p>
        </div>

        <div className="neomsg-mail-desk__status">
          <span>
            {readyToSend ? <ShieldCheck size={16} /> : <LockKeyhole size={16} />}
            {lockMode === "timed" ? t("publicRevealLabel") : t("privateSealLabel")}
          </span>
          <strong>{connected ? shortAddress(address) : t("notConnected")}</strong>
        </div>
      </section>
    </div>
  );

  const renderMessageList = (rows: MessageView[], type: "inbox" | "outbox") => (
    <section className="neomsg-drawer-panel neomsg-drawer-panel--list">
      <header className="neomsg-drawer-panel__head">
        <span>{type === "inbox" ? t("inboxTitle") : t("outboxTitle")}</span>
        <strong>{rows.length}</strong>
      </header>
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <MessageRow
              key={`${type}-${row.id}`}
              row={row}
              type={type}
              busy={busyIds.includes(row.id)}
              pending={pendingRevealIds.includes(row.id)}
              t={t}
              dispatch={dispatchSafely}
            />
          ))}
        </ul>
      ) : (
        <OpenUiNotice
          className="neomsg-empty"
          icon={type === "inbox" ? <MailCheck size={17} strokeWidth={2.35} aria-hidden="true" /> : <SendHorizontal size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={connected ? (type === "inbox" ? t("inboxEmpty") : t("outboxEmpty")) : t("connectToView")}
        />
      )}
      {(type === "inbox" ? hasMoreInbox : hasMoreOutbox) && (
        <button type="button" className="mx2-btn mx2-btn--ghost neomsg-list__more" onClick={() => dispatchSafely("loadOlder", type)}>
          {t("loadOlder")}
        </button>
      )}
    </section>
  );

  const drawer = (
    <div className="neomsg-drawer">
      {pendingDelivery && (
        <OpenUiNotice
          className="neomsg-pending-delivery"
          icon={<RefreshCw size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("pendingDeliveryTitle")}
          type="warning"
        >
          <span>{t("pendingDeliveryBody", { txid: shortAddress(pendingDelivery.txid) })}</span>
          {!pendingStorageHealthy && <strong>{t("pendingStorageWarning")}</strong>}
          <span className="neomsg-pending-delivery__actions">
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => dispatchSafely("recoverPendingDelivery")} disabled={isRecovering}>
              <RefreshCw size={14} strokeWidth={2.3} aria-hidden="true" />
              {isRecovering ? t("recoveringDelivery") : t("recoverDelivery")}
            </button>
            {pendingDeliveryIsStale(pendingDelivery) && (
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => dispatchSafely("clearStalePendingDelivery")} disabled={isRecovering}>
                {t("clearStaleDelivery")}
              </button>
            )}
          </span>
        </OpenUiNotice>
      )}
      <OpenUiSegmented
        className="neomsg-drawer-tabs"
        label={t("workspaceTitle")}
        onChange={setDrawerTab}
        options={drawerModes.map((item) => ({
          value: item.mode,
          label: (
            <span className="neomsg-drawer-tab-label">
              <span>{item.label}</span>
              {typeof item.count === "number" && <em>{item.count}</em>}
            </span>
          ),
        }))}
        segmentedClassName="neomsg-drawer-segmented"
        value={drawerMode}
      />

      {drawerMode === "delivery" && (
        <section className="neomsg-drawer-panel neomsg-drawer-panel--mode">
          <header className="neomsg-drawer-panel__head">
            <span>{t("deliveryModeLabel")}</span>
            <strong>{lockMode === "timed" ? t("publicRevealLabel") : t("privateSealLabel")}</strong>
          </header>
          <OpenUiSegmented
            className="neomsg-mode__choices"
            label={t("deliveryModeLabel")}
            onChange={setDeliveryMode}
            options={[
              {
                value: "recipient",
                label: (
                  <span className="neomsg-mode-card">
                    <span className="neomsg-mode__icon" aria-hidden="true">
                      <LockKeyhole size={17} strokeWidth={2.35} />
                    </span>
                    <strong>{t("modeRecipient")}</strong>
                    <span>{t("modeRecipientHint")}</span>
                  </span>
                ),
              },
              {
                value: "timed",
                label: (
                  <span className="neomsg-mode-card">
                    <span className="neomsg-mode__icon" aria-hidden="true">
                      <Clock3 size={17} strokeWidth={2.35} />
                    </span>
                    <strong>{t("modeTimed")}</strong>
                    <span>{t("modeTimedHint")}</span>
                  </span>
                ),
              },
            ]}
            segmentedClassName="neomsg-mode-segmented"
            value={lockMode}
          />
          {lockMode === "timed" && (
            <div className="neomsg-timed">
              <OpenUiTextField
                className="neomsg-timed__date"
                inputClassName="neomsg-timed__input"
                label={t("revealDateLabel")}
                type="datetime-local"
                value={String(form.revealDate ?? "")}
                min={new Date(nowMs - new Date(nowMs).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
                onChange={(event) => updateForm({ revealDate: event.target.value, publicRevealAcknowledged: false })}
              />
              <OpenUiLiteCardCheckbox
                checked={Boolean(form.publicRevealAcknowledged)}
                className="neomsg-timed__ack"
                label={t("timedAcknowledge")}
                onChange={(checked) => updateForm({ publicRevealAcknowledged: checked })}
              >
                <span className="neomsg-timed__ack-content">
                  <ShieldCheck size={15} strokeWidth={2.35} aria-hidden="true" />
                  <span>{t("timedAcknowledge")}</span>
                </span>
              </OpenUiLiteCardCheckbox>
              <OpenUiNotice
                className="neomsg-drawer__notice"
                icon={<Clock3 size={17} strokeWidth={2.35} aria-hidden="true" />}
                title={t("publicRevealLabel")}
                type="warning"
              >
                {t("timedPublicWarning")}
              </OpenUiNotice>
            </div>
          )}
          <p className="neomsg-mode__note">{lockMode === "timed" ? t("timedNote") : t("recipientNote")}</p>
        </section>
      )}

      {drawerMode === "inbox" && renderMessageList(inbox, "inbox")}
      {drawerMode === "sent" && renderMessageList(outbox, "outbox")}

      {drawerMode === "network" && (
        <section className="neomsg-drawer-panel neomsg-drawer-panel--network">
          <header className="neomsg-drawer-panel__head">
            <span>{t("networkCardTitle")}</span>
            <strong>{connected ? shortAddress(address) : t("notConnected")}</strong>
          </header>
          <div className="neomsg-drawer__summary">
            <span className="neomsg-drawer__chip" data-active={connected ? "true" : undefined}>
              <ShieldCheck size={15} strokeWidth={2.35} aria-hidden="true" />
              {connected ? shortAddress(address) : t("notConnected")}
            </span>
            <span className="neomsg-drawer__chip" data-active={networkSupported ? "true" : undefined}>
              <RadioTower size={15} strokeWidth={2.35} aria-hidden="true" />
              {networkSupported ? t("statusReady") : t("switchToNeoX")}
            </span>
          </div>
          <div className="neomsg-drawer__actions" aria-label={t("networkCardTitle")}>
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => dispatchSafely("connectAndLoad")}
              disabled={isLoading}
            >
              <RefreshCw size={15} strokeWidth={2.35} aria-hidden="true" />
              {t("refresh")}
            </button>
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => dispatchSafely("switchToNeoX")}
              disabled={isLoading}
            >
              <RadioTower size={15} strokeWidth={2.35} aria-hidden="true" />
              {t("switchToNeoX")}
            </button>
          </div>
        </section>
      )}

      <OpenUiNotice
        className="neomsg-last-status"
        icon={<MailCheck size={17} strokeWidth={2.35} aria-hidden="true" />}
        title={lastStatus}
      />
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="neo-message-play-area mx2 mx2-cat-social">
        <PlayStage
          category="social"
          className="neo-message-playstage"
          stage={{
            eyebrow: t("heroEyebrow"),
            title: t("heroTitle"),
            subtitle: t("composeLead"),
            badges: (
              <span className="mx2-badge" data-tone={connected ? "accent" : undefined}>
                {connected ? shortAddress(address) : t("notConnected")}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary: pendingDelivery
              ? {
                  label: isRecovering ? t("recoveringDelivery") : t("recoverDelivery"),
                  onClick: () => dispatchSafely("recoverPendingDelivery"),
                  loading: isRecovering,
                }
              : connected && networkSupported
              ? {
                  label: isSending ? t("sending") : lockMode === "timed" ? t("sendButtonTimed") : t("sendButton"),
                  onClick: () => dispatchSafely("sendMessage"),
                  loading: isSending,
                  disabled: !readyToSend || isSending,
                }
              : connected
                ? {
                    label: t("switchToNeoX"),
                    onClick: () => dispatchSafely("switchToNeoX"),
                    loading: isLoading,
                  }
                : {
                  label: isLoading ? t("connectingWallet") : t("connectWallet"),
                  onClick: () => dispatchSafely("connectAndLoad"),
                  loading: isLoading,
                },
          }}
          drawerToggleLabel={t("workspaceTitle")}
          drawer={{ title: t("workspaceTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
