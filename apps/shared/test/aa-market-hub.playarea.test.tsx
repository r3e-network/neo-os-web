import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-market-hub/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(k: string) { return k; }

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

describe("aa-market-hub PlayArea (v2)", () => {
  it("renders a foreground escrow desk with marketplace listings", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: "NWallet111111111111111111111111111111",
          marketHash: "0x1234567890abcdef1234567890abcdef12345678",
          listings: [
            { id: "1", title: "Clean AA shell", priceGas: "1.5", status: "active" },
            { id: "2", title: "Fresh plugins", priceGas: "2", status: "active" },
          ],
          totalListingsDisplay: 2,
          activeListingsDisplay: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".market-scene")).toBeTruthy();
    expect(container.querySelector(".market-scene__backdrop")).toBeNull();
    expect(container.querySelector<HTMLImageElement>(".market-scene__desk-image")?.getAttribute("src")).toContain("market-escrow-desk.webp");
    expect(container.querySelector(".market-scene__desk-card")).toBeTruthy();
    expect(container.querySelector(".market-scene__trade-panel")).toBeTruthy();
    expect(container.querySelector(".market-scene__route")).toBeTruthy();
    expect(container.querySelector(".market-scene__shelf")).toBeTruthy();
    expect(container.querySelectorAll(".market-scene__shelf button").length).toBe(2);
  });

  it("loads listings with the actual market hash instead of an undefined argument", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: "NWallet111111111111111111111111111111",
          marketHash: "0x1234567890abcdef1234567890abcdef12345678",
          listings: [],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /loadListings/ }));
    expect(dispatch).toHaveBeenCalledWith("loadListings", "0x1234567890abcdef1234567890abcdef12345678");
  });

  it("selects listing cards from the marketplace shelf", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: "NWallet111111111111111111111111111111",
          marketHash: "0x1234567890abcdef1234567890abcdef12345678",
          listings: [{ id: "2", title: "Fresh plugins", priceGas: "2", status: "active" }],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Fresh plugins/ }));
    expect(dispatch).toHaveBeenCalledWith("selectListing", "2");
  });

  it("keeps market hash and settlement controls in shared drawer panels", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: "NWallet111111111111111111111111111111",
          walletDisplay: "NWallet...1111",
          marketHash: "0x1234567890abcdef1234567890abcdef12345678",
          listings: [],
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const drawer = container.querySelector(".market-drawer");
    expect(drawer).toBeTruthy();
    expect(drawer?.querySelectorAll(".market-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(drawer?.querySelector("h4")).toBeNull();
    expect(drawer?.querySelectorAll(".market-drawer__notice.mx2-open-notice.semi-banner")).toHaveLength(1);
    expect(drawer?.querySelectorAll(".market-drawer__field.mx2-open-field .mx2-open-field__control input.semi-input")).toHaveLength(2);
    expect(drawer?.querySelector<HTMLInputElement>(".market-drawer__field input")?.value).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  it("has reduced-motion", () => {
    const styles = readFileSync(`${process.cwd()}/../aa-market-hub/src/PlayArea.scss`, "utf8");
    expect(styles).toMatch(/prefers-reduced-motion/);
  });

  it("keeps the marketplace as a clean foreground shelf, not a backdrop wash", () => {
    const styles = readFileSync(`${process.cwd()}/../aa-market-hub/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../aa-market-hub/src/PlayArea.tsx`, "utf8");

    expect(styles).toMatch(/\.market-scene\s*\{[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.market-scene__desk-card,[\s\S]*\.market-scene__trade-panel\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.market-scene__desk-image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.market-scene__shelf\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.market-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.market-drawer__panel--wide > \.semi-card-body\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*520px\)\s+minmax\(160px,\s*220px\)/);
    expect(styles).not.toMatch(/\.market-drawer__panel h4/);
    expect(styles).toMatch(/\.aa-market-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 188px/);
    expect(styles).toMatch(/\.aa-market-play-area \.mx2-action-rail__row \.mx2-btn--primary:not\(:disabled\)\s*\{[\s\S]*background:\s*var\(--mx2-brand-hover\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.market-scene__desk-card\s*\{[\s\S]*grid-template-rows:\s*92px auto/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.market-scene__desk-caption small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.market-scene__route\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.market-scene__empty\s*\{[\s\S]*min-height:\s*74px/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.aa-market-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.market-scene__status\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.aa-market-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*184px/);
    expect(source).toMatch(/<img className="market-scene__desk-image" src="\.\/market-escrow-desk\.webp"/);
    expect(styles).not.toMatch(/market-scene__backdrop|market-scene__escrow|var\(--mx2-scene-wash|background-image:\s*url/);
    expect(source).not.toMatch(/market-scene__backdrop|market-scene__escrow/);
  });
});
