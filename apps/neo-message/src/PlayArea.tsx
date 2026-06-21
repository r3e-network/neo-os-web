/**
 * PlayArea.tsx — Neo Message UI (compose + inbox/outbox).
 */

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  MailPlus,
  MessageSquareText,
  SendHorizontal,
  ShieldCheck,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  messageStatus,
  formatUnlock,
  shortAddress,
  addressesEqual,
  needsPublicRevealAck,
  isEvmAddress,
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

// A friendly, warm palette for the per-address identicon. Deterministic from the
// address so the same correspondent always wears the same colour — a small
// visual identity for an otherwise faceless 0x… string. Display-only.
const IDENTICON_HUES = ["#5b6ef5", "#7b5bf5", "#e07b4f", "#0fb174", "#d6516e", "#3b9ae0", "#c08a18"];

function identiconColor(addr: string | undefined | null): string {
  const a = String(addr ?? "").toLowerCase();
  let hash = 0;
  for (let i = 0; i < a.length; i += 1) hash = (hash * 31 + a.charCodeAt(i)) % 100000;
  return IDENTICON_HUES[hash % IDENTICON_HUES.length];
}

// Two leading hex characters make a stable, glanceable monogram for an address.
function identiconLabel(addr: string | undefined | null): string {
  const a = String(addr ?? "").replace(/^0x/i, "");
  return (a.slice(0, 2) || "··").toUpperCase();
}

// Local-only nickname book. Maps a recipient address → a name the sender chose,
// stored on this device alone. It never touches the compose form, the dispatch
// path, or the on-chain payload — purely a human label for the UI.
const NICKNAME_STORE_KEY = "neo-message:nicknames";

function loadNicknames(): Record<string, string> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(NICKNAME_STORE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
  } catch {
    // Corrupt or unavailable storage falls back to an empty book.
  }
  return {};
}

function persistNicknames(book: Record<string, string>): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(NICKNAME_STORE_KEY, JSON.stringify(book));
    }
  } catch {
    // Storage may be full or blocked; the in-memory book still works this session.
  }
}

function nicknameFor(book: Record<string, string>, addr: string | undefined | null): string {
  const key = String(addr ?? "").toLowerCase();
  return key ? (book[key] ?? "").trim() : "";
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
  const recipientValue = String(form.recipient ?? "").trim();
  const recipientIsValid = isEvmAddress(recipientValue);
  const draftBody = String(form.body ?? "").trim();

  // Time-locked messages post their plaintext publicly on-chain, so require an
  // explicit acknowledgement before sending. Local UI state — never touches the
  // send path or the on-chain payload.
  const [publicRevealAck, setPublicRevealAck] = useState(false);
  const sendBlockedByAck = needsPublicRevealAck(form.lockMode, publicRevealAck);

  // Local-only nickname book. Lets the sender label a 0x… recipient with a human
  // name (Mom, Alex…) that is shown back on rows. Display-only: stored on this
  // device and never sent on-chain or through dispatch.
  const [nicknames, setNicknames] = useState<Record<string, string>>(loadNicknames);
  const [recipientNickname, setRecipientNickname] = useState("");

  const recipientKnownName = nicknameFor(nicknames, form.recipient);
  const recipientNicknameValue = recipientNickname || recipientKnownName;
  const recipientPreview =
    recipientNicknameValue.trim() ||
    (recipientIsValid ? shortAddress(recipientValue) : t("recipientPreviewEmpty"));
  const draftPreview = draftBody || t("messageDraftEmpty");
  const deliveryPreview = isTimed ? t("publicRevealLabel") : t("privateSealLabel");
  const readinessLabel = !recipientIsValid
    ? t("readinessNeedRecipient")
    : !draftBody
      ? t("readinessNeedMessage")
      : sendBlockedByAck
        ? t("readinessNeedAck")
        : t("readinessReady");

  const onRecipientNicknameChange = (value: string) => {
    setRecipientNickname(value);
    const key = String(form.recipient ?? "").toLowerCase();
    if (!/^0x[0-9a-fA-F]{40}$/.test(key)) return;
    setNicknames((prev) => {
      const next = { ...prev };
      const trimmed = value.trim();
      if (trimmed) next[key] = trimmed;
      else delete next[key];
      persistNicknames(next);
      return next;
    });
  };

  const Identicon = ({ addr }: { addr: string }) => (
    <span
      className="nm-identicon"
      aria-hidden="true"
      style={{ background: identiconColor(addr) }}
    >
      {identiconLabel(addr)}
    </span>
  );

  const renderMessage = (msg: MessageView, box: "inbox" | "outbox") => {
    const status = messageStatus(msg);
    const unlockLabel = formatUnlock(msg.unlockTime);
    const youAreRecipient = addressesEqual(address, msg.recipient);
    const isBusy = busyIds.includes(msg.id);
    const partyAddr = box === "inbox" ? msg.sender : msg.recipient;
    const partyName = nicknameFor(nicknames, partyAddr);
    const partyLabel = box === "inbox" ? t("fromLabel") : t("toLabel");
    return (
      <div key={`${box}-${msg.id}`} className={`nm-item nm-${status}`}>
        <div className="nm-item-head">
          <div className="nm-party">
            <Identicon addr={partyAddr} />
            <span className="nm-party-text">
              <span className="nm-party-name">{partyName || partyLabel}</span>
              <span className="nm-party-addr">{shortAddress(partyAddr)}</span>
            </span>
          </div>
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
        {msg.timeLocked && unlockLabel ? (
          <p className="nm-meta nm-unlock">{t("unlocksLabel")}: {unlockLabel}</p>
        ) : (
          <p className="nm-meta nm-mode">{t("recipientOnlyHint")}</p>
        )}

        {msg.revealed && msg.plaintext ? (
          <p className="nm-plaintext">{msg.plaintext}</p>
        ) : null}

        {/* Recipient-only plaintext is cached on this device only — it is
            re-derivable via a fresh wallet signature, not stored as readable
            text. Time-locked reveals are genuinely public on-chain, so the note
            applies only to recipient-only rows the connected wallet decrypted. */}
        {msg.revealed && msg.plaintext && !msg.timeLocked && youAreRecipient ? (
          <p className="nm-hint nm-device-note">{t("decryptedOnDevice")}</p>
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
        <div className="nm-hero-content">
          <div className="nm-hero-badge" aria-hidden="true">
            <picture>
              <source srcSet="./logo.avif" type="image/avif" />
              <source srcSet="./logo.webp" type="image/webp" />
              <img src="./logo.jpg" alt="" />
            </picture>
          </div>
          <div className="nm-hero-copy">
            <span className="nm-hero-eyebrow">{t("heroEyebrow")}</span>
            <h2 className="nm-hero-title">{t("heroTitle")}</h2>
            <p className="nm-hero-sub">{t("heroSubtitle")}</p>
          </div>
        </div>
        <picture className="nm-hero-media" aria-hidden="true">
          <source srcSet="./banner.avif" type="image/avif" />
          <source srcSet="./banner.webp" type="image/webp" />
          <img src="./banner.jpg" alt="" />
        </picture>
      </div>

      {!networkSupported ? (
        <NeoCard title={t("networkCardTitle")} className="nm-network-card">
          <div className="nm-network-warning" role="status">
            <AlertTriangle className="nm-network-warning-icon" aria-hidden="true" />
            <span>{hasWallet ? t("errorWrongNetwork") : t("errorNoEvmWallet")}</span>
          </div>
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

      <NeoCard title={t("composeTitle")} className="nm-compose-card">
        <div className="nm-compose-shell">
          <div className="nm-form">
            <div className="nm-compose-intro">
              <span className="nm-compose-intro__icon" aria-hidden="true">
                <MailPlus size={18} />
              </span>
              <div>
                <span className="nm-compose-intro__eyebrow">{t("composeEyebrow")}</span>
                <p>{t("composeLead")}</p>
              </div>
            </div>

            <div className="nm-recipient-row">
              <NeoInput
                label={t("recipientLabel")}
                placeholder="0x…"
                value={form.recipient ?? ""}
                onChange={(v) => setForm({ recipient: v })}
              />
              <NeoInput
                label={t("recipientNicknameLabel")}
                placeholder={t("recipientNicknamePlaceholder")}
                value={recipientNicknameValue}
                onChange={onRecipientNicknameChange}
              />
            </div>
            {recipientKnownName && !recipientNickname ? (
              <p className="nm-hint nm-saved-name">
                {t("savedNicknameNote", { name: recipientKnownName })}
              </p>
            ) : null}
            <div className={`nm-message-composer${bodyLength > MAX_BODY_LENGTH ? " nm-message-composer--error" : ""}`}>
              <div className="nm-message-composer__head">
                <span className="nm-message-composer__label" id="nm-message-body-label">
                  <MessageSquareText aria-hidden="true" />
                  {t("messageLabel")}
                </span>
                <span className="nm-message-composer__counter">
                  {t("bodyCounter", { count: bodyLength, max: MAX_BODY_LENGTH })}
                </span>
              </div>
              <textarea
                aria-labelledby="nm-message-body-label"
                placeholder={t("messagePlaceholder")}
                value={form.body ?? ""}
                onChange={(e) => setForm({ body: e.target.value.slice(0, MAX_BODY_LENGTH) })}
              />
              {bodyLength > MAX_BODY_LENGTH ? (
                <span className="nm-message-composer__error">{t("bodyTooLong")}</span>
              ) : null}
            </div>

            <div className="nm-mode-toggle" role="radiogroup" aria-label={t("deliveryModeLabel")}>
              <button
                type="button"
                className={`nm-mode-option ${!isTimed ? "active" : ""}`}
                role="radio"
                aria-checked={!isTimed}
                onClick={() => setForm({ lockMode: "recipient" })}
              >
                <span className="nm-mode-icon" aria-hidden="true">
                  <LockKeyhole />
                </span>
                <span className="nm-mode-text">
                  <strong>{t("modeRecipient")}</strong>
                  <span>{t("modeRecipientHint")}</span>
                </span>
              </button>
              <button
                type="button"
                className={`nm-mode-option ${isTimed ? "active" : ""}`}
                role="radio"
                aria-checked={isTimed}
                onClick={() => setForm({ lockMode: "timed" })}
              >
                <span className="nm-mode-icon" aria-hidden="true">
                  <Clock3 />
                </span>
                <span className="nm-mode-text">
                  <strong>{t("modeTimed")}</strong>
                  <span>{t("modeTimedHint")}</span>
                </span>
              </button>
            </div>

            {isTimed ? (
              <div className="nm-timed-panel">
                <div className="nm-public-warning" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <span>{t("timedPublicWarning")}</span>
                </div>
                <label className="nm-date-field">
                  <span>
                    <CalendarClock aria-hidden="true" />
                    {t("revealDateLabel")}
                  </span>
                  <input
                    type="datetime-local"
                    min={dateMin}
                    value={form.revealDate ?? ""}
                    onChange={(e) => setForm({ revealDate: e.target.value })}
                  />
                </label>
                <label className="nm-ack">
                  <input
                    type="checkbox"
                    checked={publicRevealAck}
                    onChange={(e) => setPublicRevealAck(e.target.checked)}
                  />
                  <span>{t("timedAcknowledge")}</span>
                </label>
              </div>
            ) : null}

            <div className="nm-send-panel">
              <p className="nm-note">
                <ShieldCheck aria-hidden="true" />
                <span>{isTimed ? t("timedNote") : t("recipientNote")}</span>
              </p>
              <div className="nm-send-panel__footer">
                <span className={`nm-readiness${readinessLabel === t("readinessReady") ? " is-ready" : ""}`}>
                  {readinessLabel}
                </span>
                <NeoButton
                  variant="primary"
                  size="lg"
                  loading={isSending}
                  disabled={isSending || sendBlockedByAck}
                  onClick={() => dispatch("sendMessage")}
                >
                  <SendHorizontal size={17} aria-hidden="true" />
                  {isSending ? t("sending") : isTimed ? t("sendButtonTimed") : t("sendButton")}
                </NeoButton>
              </div>
            </div>
          </div>

          <aside className="nm-letter-preview" aria-label={t("messagePreviewTitle")}>
            <div className="nm-letter-preview__top">
              <span className={`nm-letter-preview__seal${isTimed ? " is-public" : ""}`} aria-hidden="true">
                {isTimed ? <Eye size={22} /> : <EyeOff size={22} />}
              </span>
              <span className="nm-letter-preview__mode">{deliveryPreview}</span>
            </div>
            <div className="nm-letter-preview__to">
              <span>{t("recipientPreviewLabel")}</span>
              <strong>{recipientPreview}</strong>
            </div>
            <p className="nm-letter-preview__body">{draftPreview}</p>
            <div className="nm-letter-preview__meta">
              <span>
                <small>{t("characterBudgetLabel")}</small>
                <strong>{t("bodyCounter", { count: bodyLength, max: MAX_BODY_LENGTH })}</strong>
              </span>
              <span>
                <small>{t("deliveryPreviewLabel")}</small>
                <strong>{isTimed ? t("modeTimed") : t("modeRecipient")}</strong>
              </span>
            </div>
          </aside>
        </div>
      </NeoCard>

      <NeoCard title={t("inboxTitle")}>
        <div className="nm-inbox-head">
          <span className="nm-account">
            {connected ? <Identicon addr={address} /> : null}
            <span className="nm-account-addr">
              {connected ? shortAddress(address) : t("notConnected")}
            </span>
          </span>
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
          <StateView
            kind="empty"
            icon={null}
            className="nm-inbox-empty"
            title={connected ? t("inboxEmpty") : undefined}
            hint={connected ? undefined : t("connectToView")}
          />
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
