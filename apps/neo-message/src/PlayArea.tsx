/**
 * PlayArea.tsx — Neo Message UI (compose + inbox/outbox).
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  messageStatus,
  formatUnlock,
  shortAddress,
  addressesEqual,
  MAX_BODY_LENGTH,
  type ComposeForm,
  type MessageView,
} from "./message-logic";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const EMPTY_FORM: ComposeForm = { recipient: "", body: "", lockMode: "recipient", revealDate: "" };

// Local datetime-local min: now, formatted as YYYY-MM-DDTHH:mm (no seconds/zone)
// so the native picker rejects past instants up front.
function localDateTimeMin(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { bool, val } = useStateBindings(state);

  const address = val<string>("address", "") ?? "";
  const networkSupported = bool("networkSupported");
  const hasWallet = bool("hasWallet");
  const isLoading = bool("isLoading");
  const isSending = bool("isSending");
  const busyIds = val<string[]>("busyIds", []) ?? [];
  const hasMore = bool("hasMore");
  const inbox = val<MessageView[]>("inbox", []) ?? [];
  const outbox = val<MessageView[]>("outbox", []) ?? [];
  const form = val<ComposeForm>("composeForm", EMPTY_FORM) ?? EMPTY_FORM;

  const setForm = (patch: Partial<ComposeForm>) => {
    if (state.composeForm) state.composeForm.set({ ...form, ...patch });
  };

  const isTimed = form.lockMode === "timed";
  const connected = address.length > 0;
  const bodyLength = (form.body ?? "").length;
  const dateMin = localDateTimeMin();

  const renderMessage = (msg: MessageView, box: "inbox" | "outbox") => {
    const status = messageStatus(msg);
    const unlockLabel = formatUnlock(msg.unlockTime);
    const youAreRecipient = addressesEqual(address, msg.recipient);
    const isBusy = busyIds.includes(msg.id);
    return (
      <div key={`${box}-${msg.id}`} className={`nm-item nm-${status}`}>
        <div className="nm-item-head">
          <span className="nm-id">#{msg.id}</span>
          <span className={`nm-badge nm-badge-${status}`}>
            {status === "revealed"
              ? t("statusBadgeRevealed")
              : status === "recipient"
                ? t("statusBadgeSealed")
                : status === "unlockable"
                  ? t("statusBadgeUnlockable")
                  : t("statusBadgeLocked")}
          </span>
        </div>

        <p className="nm-meta">
          {box === "inbox"
            ? `${t("fromLabel")}: ${shortAddress(msg.sender)}`
            : `${t("toLabel")}: ${shortAddress(msg.recipient)}`}
        </p>
        {msg.timeLocked && unlockLabel ? (
          <p className="nm-meta nm-unlock">{t("unlocksLabel")}: {unlockLabel}</p>
        ) : (
          <p className="nm-meta nm-mode">{t("recipientOnlyHint")}</p>
        )}

        {msg.revealed && msg.plaintext ? (
          <p className="nm-plaintext">{msg.plaintext}</p>
        ) : null}

        {/* Recipient-only, not yet locally revealed: only the recipient can read */}
        {status === "recipient" && box === "inbox" && !msg.plaintext ? (
          youAreRecipient ? (
            <NeoButton
              variant="primary"
              size="sm"
              loading={isBusy}
              disabled={isBusy}
              onClick={() => dispatch("revealRecipient", msg)}
            >
              {t("revealForMe")}
            </NeoButton>
          ) : (
            <span className="nm-hint">{t("onlyRecipientCanRead")}</span>
          )
        ) : null}

        {/* Time-locked + past unlock: anyone may trigger the on-chain reveal */}
        {status === "unlockable" ? (
          <NeoButton
            variant="primary"
            size="sm"
            loading={isBusy}
            disabled={isBusy}
            onClick={() => dispatch("requestTimedReveal", msg)}
          >
            {t("revealOnChain")}
          </NeoButton>
        ) : null}

        {status === "locked" ? <span className="nm-hint">{t("notUnlockedYet")}</span> : null}
      </div>
    );
  };

  return (
    <div className="nm-play-area">
      <div className="nm-hero">
        <h2 className="nm-hero-title">{t("heroTitle")}</h2>
        <p className="nm-hero-sub">{t("heroSubtitle")}</p>
      </div>

      {!networkSupported ? (
        <NeoCard title={t("networkCardTitle")}>
          <p className="nm-network-warning">
            {hasWallet ? t("errorWrongNetwork") : t("errorNoEvmWallet")}
          </p>
          {hasWallet ? (
            <NeoButton
              variant="primary"
              size="sm"
              loading={isLoading}
              disabled={isLoading}
              onClick={() => dispatch("switchToNeoX")}
            >
              {t("switchToNeoX")}
            </NeoButton>
          ) : null}
        </NeoCard>
      ) : null}

      <NeoCard title={t("composeTitle")}>
        <div className="nm-form">
          <NeoInput
            label={t("recipientLabel")}
            placeholder="0x…"
            value={form.recipient ?? ""}
            onChange={(v) => setForm({ recipient: v })}
          />
          <NeoInput
            type="textarea"
            label={t("messageLabel")}
            placeholder={t("messagePlaceholder")}
            value={form.body ?? ""}
            hint={t("bodyCounter", { count: bodyLength, max: MAX_BODY_LENGTH })}
            error={
              bodyLength > MAX_BODY_LENGTH ? t("bodyTooLong") : undefined
            }
            onChange={(v) => setForm({ body: v.slice(0, MAX_BODY_LENGTH) })}
          />

          <div className="nm-mode-toggle" role="radiogroup" aria-label={t("deliveryModeLabel")}>
            <button
              type="button"
              className={`nm-mode-option ${!isTimed ? "active" : ""}`}
              aria-pressed={!isTimed}
              onClick={() => setForm({ lockMode: "recipient" })}
            >
              <strong>{t("modeRecipient")}</strong>
              <span>{t("modeRecipientHint")}</span>
            </button>
            <button
              type="button"
              className={`nm-mode-option ${isTimed ? "active" : ""}`}
              aria-pressed={isTimed}
              onClick={() => setForm({ lockMode: "timed" })}
            >
              <strong>{t("modeTimed")}</strong>
              <span>{t("modeTimedHint")}</span>
            </button>
          </div>

          {isTimed ? (
            <label className="nm-date-field">
              <span>{t("revealDateLabel")}</span>
              <input
                type="datetime-local"
                min={dateMin}
                value={form.revealDate ?? ""}
                onChange={(e) => setForm({ revealDate: e.target.value })}
              />
            </label>
          ) : null}

          <p className="nm-note">{isTimed ? t("timedNote") : t("recipientNote")}</p>

          <NeoButton
            variant="primary"
            size="lg"
            block
            loading={isSending}
            disabled={isSending}
            onClick={() => dispatch("sendMessage")}
          >
            {isSending ? t("sending") : t("sendButton")}
          </NeoButton>
        </div>
      </NeoCard>

      <NeoCard title={t("inboxTitle")}>
        <div className="nm-inbox-head">
          <span className="nm-account">{connected ? shortAddress(address) : t("notConnected")}</span>
          <NeoButton
            variant="secondary"
            size="sm"
            loading={isLoading}
            disabled={isLoading}
            onClick={() => dispatch("connectAndLoad")}
          >
            {connected ? t("refresh") : t("connectWallet")}
          </NeoButton>
        </div>
        {inbox.length === 0 ? (
          <p className="nm-empty">{connected ? t("inboxEmpty") : t("connectToView")}</p>
        ) : (
          <div className="nm-list">{inbox.map((m) => renderMessage(m, "inbox"))}</div>
        )}
        {connected && hasMore ? (
          <div className="nm-load-more">
            <NeoButton
              variant="secondary"
              size="sm"
              loading={isLoading}
              disabled={isLoading}
              onClick={() => dispatch("loadOlder")}
            >
              {t("loadOlder")}
            </NeoButton>
          </div>
        ) : null}
      </NeoCard>

      {outbox.length > 0 ? (
        <NeoCard title={t("outboxTitle")}>
          <div className="nm-list">{outbox.map((m) => renderMessage(m, "outbox"))}</div>
        </NeoCard>
      ) : null}
    </div>
  );
}
