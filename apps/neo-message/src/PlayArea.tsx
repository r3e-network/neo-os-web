/** PlayArea.tsx — Neo Message sealing desk */
import { useState } from "react";
import { Clock3, LockKeyhole, MailCheck, RadioTower, RefreshCw, SendHorizontal, ShieldCheck, Stamp } from "lucide-react";
import Checkbox from "@douyinfe/semi-ui/lib/es/checkbox";
import type { CheckboxEvent } from "@douyinfe/semi-ui/lib/es/checkbox";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { OpenUiNotice, OpenUiProvider, OpenUiSegmented, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import {
  MAX_BODY_LENGTH,
  formatUnlock,
  isEvmAddress,
  messageStatus,
  needsPublicRevealAck,
  shortAddress,
  type ComposeForm,
  type LockMode,
  type MessageView,
} from "./message-logic";
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
  t,
  dispatch,
}: {
  row: MessageView;
  type: "inbox" | "outbox";
  busy: boolean;
  t: P["t"];
  dispatch: P["dispatch"];
}) {
  const status = messageStatus(row);
  const isRecipientOnly = status === "recipient";
  const unlockLabel = formatUnlock(row.unlockTime);
  const canRevealRecipient = type === "inbox" && isRecipientOnly && !row.revealed;
  const canRequestReveal = status === "unlockable";
  const locked = status === "locked";

  return (
    <li className="neomsg-message">
      <div className="neomsg-message__top">
        <span className="neomsg-message__id">#{row.id}</span>
        <span className="neomsg-message__status" data-status={status}>
          {t(`statusBadge${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
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
        {row.plaintext || (locked ? t("notUnlockedYet") : t("onlyRecipientCanRead"))}
      </p>
      {(canRevealRecipient || canRequestReveal || locked) && (
        <button
          type="button"
          className="mx2-btn mx2-btn--ghost"
          disabled={busy || locked}
          onClick={() => void dispatch(canRevealRecipient ? "revealRecipient" : "requestTimedReveal", row)}
        >
          {locked ? t("notUnlockedYet") : canRevealRecipient ? t("revealForMe") : t("revealOnChain")}
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
  const hasMore = bool("hasMore");
  const lastStatus = str("lastStatus", t("statusReady"));
  const form = val<ComposeForm>("composeForm", EMPTY_FORM) ?? EMPTY_FORM;
  const inbox = val<MessageView[]>("inbox", []) ?? [];
  const outbox = val<MessageView[]>("outbox", []) ?? [];
  const busyIds = val<string[]>("busyIds", []) ?? [];
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("delivery");

  const lockMode = displayMode(form);
  const recipient = String(form.recipient ?? "");
  const body = String(form.body ?? "");
  const validRecipient = isEvmAddress(recipient);
  const bodyLength = body.trim().length;
  const bodyTooLong = bodyLength > MAX_BODY_LENGTH;
  const ackNeeded = needsPublicRevealAck(lockMode, Boolean(form.publicRevealAcknowledged));
  const readyToSend = connected && validRecipient && bodyLength > 0 && !bodyTooLong && !ackNeeded;
  const readinessValue = (() => {
    if (!hasWallet || (!networkSupported && !connected)) return t("notConnected");
    if (!validRecipient) return t("readinessNeedRecipient");
    if (bodyLength === 0) return t("readinessNeedMessage");
    if (bodyTooLong) return t("readinessDeskNeedsDetails");
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
          {rows.slice(0, 8).map((row) => (
            <MessageRow
              key={`${type}-${row.id}`}
              row={row}
              type={type}
              busy={busyIds.includes(row.id)}
              t={t}
              dispatch={dispatch}
            />
          ))}
        </ul>
      ) : (
        <OpenUiNotice
          className="neomsg-empty"
          icon={type === "inbox" ? <MailCheck size={17} strokeWidth={2.35} aria-hidden="true" /> : <SendHorizontal size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={connected ? (type === "inbox" ? t("inboxEmpty") : t("connectToView")) : t("connectToView")}
        />
      )}
      {type === "outbox" && hasMore && (
        <button type="button" className="mx2-btn mx2-btn--ghost neomsg-list__more" onClick={() => void dispatch("loadOlder")}>
          {t("loadOlder")}
        </button>
      )}
    </section>
  );

  const drawer = (
    <div className="neomsg-drawer">
      <OpenUiSegmented
        className="neomsg-drawer-tabs"
        label={t("inboxTitle")}
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
                onChange={(event) => updateForm({ revealDate: event.target.value, publicRevealAcknowledged: false })}
              />
              <Checkbox
                aria-label={t("timedAcknowledge")}
                checked={Boolean(form.publicRevealAcknowledged)}
                className="neomsg-timed__ack"
                onChange={(event: CheckboxEvent) => updateForm({ publicRevealAcknowledged: Boolean(event.target.checked) })}
                type="pureCard"
              >
                <span className="neomsg-timed__ack-content">
                  <ShieldCheck size={15} strokeWidth={2.35} aria-hidden="true" />
                  <span>{t("timedAcknowledge")}</span>
                </span>
              </Checkbox>
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
              onClick={() => void dispatch("connectAndLoad")}
              disabled={isLoading}
            >
              <RefreshCw size={15} strokeWidth={2.35} aria-hidden="true" />
              {t("refresh")}
            </button>
            <button
              type="button"
              className="mx2-btn mx2-btn--ghost"
              onClick={() => void dispatch("switchToNeoX")}
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
      <div className="neo-message-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
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
            primary: connected
              ? {
                  label: isSending ? t("sending") : lockMode === "timed" ? t("sendButtonTimed") : t("sendButton"),
                  onClick: () => void dispatch("sendMessage"),
                  loading: isSending,
                  disabled: !readyToSend || isSending,
                }
              : {
                  label: isLoading ? t("statusInboxLoaded") : t("connectWallet"),
                  onClick: () => void dispatch("connectAndLoad"),
                  loading: isLoading,
                },
          }}
          drawerToggleLabel={t("inboxTab")}
          drawer={{ title: t("inboxTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
