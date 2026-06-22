import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-message/src/PlayArea";
import { messages as neoMessageMessages } from "../../neo-message/src/locale/messages";
import { MAX_BODY_LENGTH, type MessageView } from "../../neo-message/src/message-logic";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const en = neoMessageMessages as Record<string, { en: string }>;
function t(key: string, params?: Record<string, string | number>): string {
  const value = en[key]?.en ?? key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

const RECIPIENT = "0x622ae03BDB6d7E2A29BE853c75d625bB25c0139C";
const OTHER = "0x0000000000000000000000000000000000000abc";

function row(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: "1",
    sender: OTHER,
    recipient: RECIPIENT,
    unlockTime: 0,
    sentAt: 0,
    revealed: false,
    plaintext: "",
    timeLocked: false,
    ...overrides,
  };
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    address: "",
    networkSupported: true,
    hasWallet: true,
    inbox: [],
    outbox: [],
    isLoading: false,
    isSending: false,
    busyIds: [],
    hasMore: false,
    lastStatus: "Ready",
    composeForm: { recipient: "", body: "", lockMode: "recipient", revealDate: "" },
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

function props(dispatch = vi.fn(async () => undefined), appState: ObservableState = state()) {
  return { t, state: appState, dispatch } as React.ComponentProps<typeof PlayArea>;
}

describe("Neo Message PlayArea", () => {
  it("renders real brand imagery, live sealing stage, sealed preview, and delivery-mode radio cards", () => {
    const { container } = render(<PlayArea {...props()} />);

    expect(container.querySelector('.nm-hero img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelector('.nm-hero-media img[src="./banner.jpg"]')).toBeTruthy();
    expect(container.querySelector('.nm-message-stage img[src="./sealed-message-desk.jpg"]')).toBeTruthy();
    expect(screen.getByLabelText("Live message sealing stage")).toBeTruthy();
    expect(container.querySelector(".nm-hero svg")).toBeNull();
    expect(screen.getByLabelText("Sealed message preview")).toBeTruthy();
    expect(screen.getByText("Choose a recipient")).toBeTruthy();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].getAttribute("aria-checked")).toBe("false");
  });

  it("keeps the message stage animated with a reduced-motion fallback", () => {
    const scss = readFileSync(
      join(process.cwd(), "../neo-message/src/PlayArea.scss"),
      "utf8",
    );
    expect(scss).toContain("@keyframes nm-packet-send");
    expect(scss).toContain("@keyframes nm-stage-image-drift");
    expect(scss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("offers an in-app Switch to Neo X button when an EVM wallet is present", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props(dispatch, state({ networkSupported: false, hasWallet: true }))} />);

    const switchBtn = screen.getByRole("button", { name: "Switch to Neo X" });
    expect(switchBtn).toBeTruthy();
    fireEvent.click(switchBtn);
    expect(dispatch).toHaveBeenCalledWith("switchToNeoX");
  });

  it("shows the no-EVM-wallet message with no switch button when no provider exists", () => {
    render(<PlayArea {...props(vi.fn(), state({ networkSupported: false, hasWallet: false }))} />);

    expect(
      screen.getByText(/No EVM wallet detected/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Switch to Neo X" })).toBeNull();
  });

  it("disables only the actively-revealing row, not every reveal button", () => {
    const appState = state({
      address: RECIPIENT,
      inbox: [
        row({ id: "1", recipient: RECIPIENT }),
        row({ id: "2", recipient: RECIPIENT }),
      ],
      busyIds: ["1"],
    });
    const { container } = render(<PlayArea {...props(vi.fn(), appState)} />);

    // Row 2 (not busy) keeps its labeled, enabled reveal button.
    const row2Button = screen.getByRole("button", { name: "Decrypt for me" });
    expect((row2Button as HTMLButtonElement).disabled).toBe(false);

    // Exactly one row is in the busy/disabled state (row 1), proving the busy
    // flag is per-row rather than disabling every reveal button.
    const busyButtons = container.querySelectorAll('button[aria-busy="true"]');
    expect(busyButtons).toHaveLength(1);
    expect((busyButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders a live body counter and caps input at MAX_BODY_LENGTH", () => {
    const appState = state();
    render(<PlayArea {...props(vi.fn(), appState)} />);

    expect(screen.getAllByText(`0/${MAX_BODY_LENGTH}`).length).toBeGreaterThanOrEqual(2);
    const meter = screen.getByRole("progressbar", { name: "Length" });
    expect(meter.getAttribute("aria-valuenow")).toBe("0");

    const textarea = screen.getByLabelText("Message");
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(appState.composeForm?.get()).toMatchObject({ body: "hello" });
    expect(meter.getAttribute("aria-valuenow")).toBe("5");
    expect(screen.getAllByText("hello").length).toBeGreaterThanOrEqual(1);

    // Over-long input is clamped to MAX_BODY_LENGTH on change.
    fireEvent.change(textarea, { target: { value: "x".repeat(MAX_BODY_LENGTH + 50) } });
    expect((appState.composeForm?.get() as { body: string }).body.length).toBe(MAX_BODY_LENGTH);
  });

  it("switches the compose preview into public-later mode", () => {
    const appState = state();
    render(<PlayArea {...props(vi.fn(), appState)} />);

    fireEvent.click(screen.getByText("Open later"));

    expect(appState.composeForm?.get()).toMatchObject({ lockMode: "timed" });
    expect(screen.getByText("Public later")).toBeTruthy();
    expect(screen.getByText(/Public reveal:/)).toBeTruthy();
  });

  it("sets a min on the time-locked reveal date so past instants are rejected", () => {
    const appState = state({
      composeForm: { recipient: "", body: "", lockMode: "timed", revealDate: "" },
    });
    const { container } = render(<PlayArea {...props(vi.fn(), appState)} />);
    const dateInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.getAttribute("min")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("keeps public-reveal send disabled until a reveal date is valid", () => {
    const appState = state({
      composeForm: {
        recipient: RECIPIENT,
        body: "hello",
        lockMode: "timed",
        revealDate: "",
      },
    });
    render(<PlayArea {...props(vi.fn(), appState)} />);

    fireEvent.click(screen.getByLabelText("I understand this message will become public on-chain at the reveal time."));

    expect(screen.getByText("Choose a valid reveal date.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Schedule public reveal" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders a Load older button only when more pages exist and dispatches loadOlder", () => {
    const dispatch = vi.fn(async () => undefined);
    const appState = state({
      address: RECIPIENT,
      inbox: [row({ id: "9", recipient: RECIPIENT })],
      hasMore: true,
    });
    render(<PlayArea {...props(dispatch, appState)} />);

    const inboxCard = screen.getByText("Inbox").closest(".neo-card") as HTMLElement;
    const loadOlder = within(inboxCard).getByRole("button", { name: "Load older" });
    fireEvent.click(loadOlder);
    expect(dispatch).toHaveBeenCalledWith("loadOlder");
  });
});
