import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-message/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
function playAreaStyles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "neo-message", "src/PlayArea.scss"), "utf8");
}
function messages(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "neo-message", "src/locale/messages.ts"), "utf8");
}
function cssBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] ?? "";
}
function optionByText(container: HTMLElement, selector: string, text: string): HTMLElement {
  const option = Array.from(container.querySelectorAll<HTMLElement>(selector)).find((item) => item.textContent?.includes(text));
  expect(option).toBeTruthy();
  return option as HTMLElement;
}
describe("neo-message PlayArea (v2)", () => {
  it("renders the scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelector(".neomsg-mail-desk")).toBeTruthy();
    expect(container.querySelector(".neomsg-mail-desk__art img")?.getAttribute("src")).toContain("sealed-message-desk");
    expect(container.querySelector(".neomsg-envelope-card")).toBeTruthy();
    expect(container.querySelector(".neomsg-envelope-card__stamp")).toBeTruthy();
    expect(container.querySelector(".neomsg-recipient")).toBeTruthy();
    expect(container.querySelector(".neomsg-note-sheet")).toBeTruthy();
    expect(container.querySelector(".neomsg-postmark")).toBeTruthy();
    expect(container.querySelector(".neomsg-mail-desk__route")).toBeTruthy();
    expect(container.querySelector(".neomsg-mail-desk__preview")).toBeTruthy();
    expect(container.querySelector(".neomsg-mail-desk__status")).toBeTruthy();
    expect(container.querySelector(".neo-message-playstage")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".neomsg-mailpiece")).toBeNull();
    expect(container.querySelector(".neomsg-seal")).toBeNull();
    expect(container.querySelector(".neomsg-compose")).toBeNull();
    expect(container.querySelector(".neomsg-desk__workspace")).toBeNull();
    expect(Array.from(container.querySelectorAll(".mx2-action-rail__row .mx2-btn--ghost")).some((button) => button.textContent === "switchToNeoX")).toBe(false);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".neomsg-drawer-panel--mode")).toBeTruthy();
    expect(container.querySelector(".neomsg-drawer-panel--network")).toBeNull();
    expect(container.querySelector(".neomsg-drawer h3")).toBeNull();
    expect(container.querySelector(".neomsg-drawer-tabs .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".neomsg-drawer-tabs .semi-radio").length).toBe(4);
    expect(container.querySelector(".neomsg-mode__choices .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".neomsg-mode__choices .semi-radio").length).toBe(2);
    expect(screen.queryByRole("button", { name: "switchToNeoX" })).toBeNull();
    fireEvent.click(optionByText(container, ".neomsg-drawer-tabs .semi-radio", "inboxTitle"));
    expect(container.querySelector(".neomsg-drawer-panel--list")).toBeTruthy();
    fireEvent.click(optionByText(container, ".neomsg-drawer-tabs .semi-radio", "networkCardTitle"));
    expect(container.querySelector(".neomsg-drawer-panel--network")).toBeTruthy();
    expect(container.querySelector(".neomsg-drawer__actions")).toBeTruthy();
    expect(screen.getByRole("button", { name: "switchToNeoX" })).toBeTruthy();
  });
  it("uses Semi card controls for the timed reveal acknowledgement", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          composeForm: {
            recipient: "",
            body: "",
            lockMode: "timed",
            revealDate: "",
            publicRevealAcknowledged: false,
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".neomsg-timed__date .semi-input-wrapper")).toBeTruthy();
    expect(container.querySelector(".neomsg-timed__ack.semi-checkbox")).toBeTruthy();
    expect(container.querySelector(".neomsg-timed__ack.semi-checkbox-cardType")).toBeTruthy();
    expect(container.querySelector(".neomsg-timed__ack.semi-checkbox input[type='checkbox']")).toBeTruthy();

    fireEvent.click(container.querySelector(".neomsg-timed__ack.semi-checkbox") as Element);
    expect(container.querySelector(".neomsg-timed__ack.semi-checkbox-checked")).toBeTruthy();
  });
  it("has reduced-motion", () => { const s = playAreaStyles(); expect(s).toMatch(/prefers-reduced-motion/); });
  it("keeps the connected send action wired after the mailpiece redesign", () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          address: "0x9999999999999999999999999999999999999999",
          composeForm: {
            recipient: "0x1111111111111111111111111111111111111111",
            body: "Seal this note for the recipient.",
            lockMode: "recipient",
            revealDate: "",
            publicRevealAcknowledged: false,
          },
          hasWallet: true,
          inbox: [],
          isLoading: false,
          isSending: false,
          networkSupported: true,
          outbox: [],
        })}
        dispatch={dispatch}
      />,
    );

    const send = screen.getByRole("button", { name: "sendButton" }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    expect(dispatch).toHaveBeenCalledWith("sendMessage");
  });
  it("keeps the message desk letter-led instead of textarea-led", () => {
    const s = playAreaStyles();
    const envelopeBlock = cssBlock(s, ".neomsg-envelope-card");
    const inputBlock = s.match(/\.neomsg-note-sheet__input\.mx2-open-field__control--textarea\s*\{[^}]*\}/)?.[0] ?? "";
    const textareaBlock = s.match(/\.neomsg-note-sheet__input \.semi-input-textarea\s*\{[^}]*\}/)?.[0] ?? "";

    expect(s).toMatch(/\.neomsg-desk\s*\{[\s\S]*width:\s*min\(100%,\s*760px\)/);
    expect(s).toMatch(/\.neomsg-desk\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.neo-message-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 220px/);
    expect(s).toMatch(/\.neo-message-play-area \.mx2-action-rail,[\s\S]*\.neo-message-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*760px\)/);
    expect(s).toMatch(/\.neo-message-play-area \.mx2-action-rail__row\s*\{[\s\S]*justify-content:\s*center/);
    expect(s).toMatch(/\.neo-message-play-area \.mx2-action-rail__drawer-toggle\s*\{[\s\S]*margin-left:\s*0/);
    expect(s).toMatch(/\.neo-message-play-area \.mx2-drawer__inner\s*\{[\s\S]*border-radius:\s*24px/);
    expect(s).toMatch(/\.neomsg-mail-desk\s*\{[\s\S]*width:\s*min\(100%,\s*580px\)/);
    expect(s).toMatch(/\.neomsg-mail-desk\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.neomsg-mail-desk__hero\s*\{[\s\S]*grid-template-columns:\s*148px minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.neomsg-mail-desk__art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.neomsg-mail-desk__art img\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.neomsg-mail-desk__art img\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.neomsg-letter-card\s*\{[\s\S]*background:\s*#fbfdf9/);
    expect(s).toMatch(/\.neomsg-envelope-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.neomsg-envelope-card\s*\{[\s\S]*grid-template-rows:\s*auto auto auto auto/);
    expect(envelopeBlock).not.toContain("minmax(0, 1fr)");
    expect(s).toMatch(/\.neomsg-envelope-card__stamp\s*\{[\s\S]*background:\s*rgba\(229,\s*244,\s*226,\s*0\.72\)/);
    expect(s).toMatch(/\.neomsg-postmark\s*\{[\s\S]*justify-content:\s*space-between/);
    expect(s).toMatch(/\.neomsg-note-sheet\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.neomsg-note-sheet\s*\{[\s\S]*box-shadow:\s*inset 3px 0 0 rgba\(34,\s*139,\s*82,\s*0\.15\)/);
    expect(inputBlock).toContain("height: 76px");
    expect(inputBlock).toContain("min-height: 76px");
    expect(inputBlock).toContain("max-height: 76px");
    expect(inputBlock).toContain("resize: none");
    expect(textareaBlock).toContain("height: 76px");
    expect(textareaBlock).toContain("min-height: 76px");
    expect(textareaBlock).toContain("max-height: 76px");
    expect(textareaBlock).toContain("resize: none");
    expect(inputBlock).not.toContain("min-height: 72px");
    expect(inputBlock).not.toContain("min-height: 84px");
    expect(inputBlock).not.toContain("min-height: 96px");
    expect(inputBlock).not.toContain("min-height: 150px");
    expect(s).toMatch(/\.neomsg-mail-desk__route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.neomsg-drawer-tabs \.neomsg-drawer-segmented\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.neomsg-mode-card\s*\{[\s\S]*grid-template-areas:/);
    expect(s).toMatch(/\.neomsg-mode__choices \.neomsg-mode-segmented\.mx2-open-segmented\.semi-radioGroup \.semi-radio-addon-buttonRadio\s*\{[\s\S]*min-height:\s*92px/);
    expect(s).toMatch(/\.neomsg-timed__ack\.semi-checkbox/);
    expect(s).toMatch(/\.neomsg-timed__ack\.semi-checkbox-checked/);
    expect(s).toMatch(/\.neomsg-mode__note\s*\{[\s\S]*-webkit-line-clamp:\s*4/);
    expect(s).toMatch(/\.neomsg-drawer__notice\.mx2-open-notice\.semi-banner/);
    expect(s).toMatch(/\.neomsg-empty\.mx2-open-notice\.semi-banner/);
    expect(s).not.toMatch(/\.neomsg-mode,\s*\n\.neomsg-list\s*\{/);
    expect(s).not.toMatch(/\.neomsg-mode h3/);
    expect(s).not.toMatch(/\.neomsg-list h3/);
    expect(s).not.toMatch(/\.neomsg-desk__workspace/);
    expect(s).not.toMatch(/\.neomsg-seal/);
    expect(s).not.toMatch(/\.neomsg-compose/);
    expect(s).not.toMatch(/\.neomsg-mailpiece/);
    expect(s).toMatch(/@media \(max-width: 480px\)[\s\S]*\.neomsg-mail-desk__hero\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width: 480px\)[\s\S]*\.neo-message-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 92px/);
    expect(s).toMatch(/@media \(max-width: 480px\)[\s\S]*\.neomsg-note-sheet__input\.mx2-open-field__control--textarea\s*\{[\s\S]*height:\s*58px/);
    expect(s).not.toMatch(/neomsg-scene-art\.jpg/);
    expect(s).not.toMatch(/repeating-linear-gradient/);
    expect(s).not.toMatch(/backdrop-filter/);
    expect(s).not.toMatch(/font-size:\s*clamp/);
  });
  it("uses product-state readiness copy instead of form validation prompts", () => {
    const m = messages();

    expect(m).toContain('deliveryTab: { en: "Delivery"');
    expect(m).toContain('readinessNeedRecipient: { en: "Recipient seal pending"');
    expect(m).toContain('readinessNeedMessage: { en: "Blank note draft"');
    expect(m).not.toContain("Add a valid recipient");
    expect(m).not.toContain("Write a message");
    expect(m).not.toContain("Needs details");
  });
});
