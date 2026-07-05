import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../recovery-guardian/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(k: string) { return k; }

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

const VALID_HASH = "0x1234567890abcdef1234567890abcdef12345678";
const NEXT_OWNER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("recovery-guardian PlayArea (v2)", () => {
  it("renders a recovery route with account, state, and handoff steps", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: VALID_HASH,
          recoveryNewOwner: NEXT_OWNER,
          recoveryExpiryMinutes: "30",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".guardian-scene")).toBeTruthy();
    expect(container.querySelector(".guardian-command-panel")).toBeTruthy();
    expect(container.querySelector(".guardian-account-pass")).toBeTruthy();
    expect(container.querySelector(".guardian-route")).toBeTruthy();
    expect(container.querySelector(".guardian-state-card")).toBeTruthy();
    expect(container.querySelector(".guardian-pass-panel")).toBeTruthy();
    expect(container.querySelector(".guardian-command-art img")?.getAttribute("src")).toContain("recovery-command-center.webp");
    expect(container.querySelector(".guardian-recovery-pass")).toBeTruthy();
    expect(container.querySelector(".guardian-scene__backdrop")).toBeNull();
    expect(container.querySelector(".guardian-console")).toBeNull();
    expect(container.querySelectorAll(".guardian-scene input")).toHaveLength(1);
    expect(container.querySelectorAll(".mx2-action-rail__row .mx2-btn--ghost").length).toBe(1);
  });

  it("queries guardian state only after a valid account locator is present", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: VALID_HASH,
          recoveryNewOwner: NEXT_OWNER,
          recoveryExpiryMinutes: "30",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /queryState/ }));
    expect(dispatch).toHaveBeenCalledWith("queryGuardianState");
  });

  it("opens the prepared recovery preview when the pass is ready", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: VALID_HASH,
          recoveryNewOwner: NEXT_OWNER,
          recoveryExpiryMinutes: "30",
          hasPayload: true,
          accountId: VALID_HASH,
          verifierHash: VALID_HASH,
          previewUrl: "https://example.test/recovery-preview",
          credentialUrl: "https://example.test/recovery-credential",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /openRecoveryPreview/ }));
    expect(dispatch).toHaveBeenCalledWith("openRecoveryPreviewLink");
  });

  it("keeps handoff owner and expiry controls tucked inside the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: VALID_HASH,
          recoveryNewOwner: NEXT_OWNER,
          recoveryExpiryMinutes: "30",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(".guardian-scene input")).toHaveLength(1);
    expect(container.querySelector(".guardian-expiry-presets")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /guardianPrepareShort/ }));

    expect(container.querySelector(".guardian-drawer__actions")).toBeTruthy();
    expect(screen.getByRole("button", { name: /openRecoveryDocs/ })).toBeTruthy();
    expect(container.querySelector(".guardian-expiry-presets")).toBeTruthy();
    expect(container.querySelectorAll(".guardian-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(5);
    expect(container.querySelectorAll(".guardian-drawer__notice.mx2-open-notice.semi-banner").length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll(".guardian-drawer__field.mx2-open-field")).toHaveLength(4);
    expect(container.querySelector(".guardian-drawer h4")).toBeNull();
    expect(container.querySelectorAll(".guardian-drawer__panel input").length).toBeGreaterThanOrEqual(4);

    fireEvent.click(screen.getByRole("button", { name: /60m/ }));
    expect((container.querySelector(".guardian-drawer__panel input[inputmode='numeric']") as HTMLInputElement).value).toBe("60");
  });

  it("has reduced-motion", () => {
    const fs = require("node:fs");
    const styles = fs.readFileSync(`${process.cwd()}/../recovery-guardian/src/PlayArea.scss`, "utf8");
    expect(styles).toMatch(/prefers-reduced-motion/);
  });

  it("keeps recovery guardian stage background clean and foreground-led", () => {
    const fs = require("node:fs");
    const styles = fs.readFileSync(`${process.cwd()}/../recovery-guardian/src/PlayArea.scss`, "utf8");

    expect(styles).toMatch(/\.recovery-guardian-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.guardian-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.guardian-scene\s*\{[\s\S]*align-items:\s*start/);
    expect(styles).toMatch(/\.guardian-command-art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.guardian-scene\s*\{[\s\S]*grid-template-columns:\s*minmax\(270px,\s*0\.82fr\) minmax\(340px,\s*1\.18fr\)/);
    expect(styles).toMatch(/\.guardian-pass-panel\s*\{[\s\S]*order:\s*1/);
    expect(styles).toMatch(/\.guardian-command-panel\s*\{[\s\S]*order:\s*2/);
    expect(styles).toMatch(/\.guardian-command-art\s*\{[\s\S]*grid-template-rows:\s*minmax\(184px,\s*auto\) auto/);
    expect(styles).toMatch(/\.guardian-command-art img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.guardian-command-art img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.guardian-command-art img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.guardian-command-art figcaption\s*\{[\s\S]*position:\s*relative/);
    expect(styles).not.toMatch(/\.guardian-command-art img\s*\{[\s\S]*opacity:\s*0\.76/);
    expect(styles).not.toMatch(/\.guardian-command-art img\s*\{[\s\S]*filter:\s*saturate/);
    expect(styles).toMatch(/\.guardian-account-pass\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.guardian-account-pass\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.guardian-account-pass\s*\{[\s\S]*padding:\s*9px 11px/);
    expect(styles).toMatch(/@media \(max-width:\s*900px\)[\s\S]*\.guardian-route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.recovery-guardian-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 224px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.guardian-command-panel\s*\{[\s\S]*order:\s*1/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.guardian-command-art\s*\{[\s\S]*grid-template-rows:\s*minmax\(102px,\s*auto\) auto/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.recovery-guardian-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.recovery-guardian-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 118px/);
    expect(styles).toMatch(/\.guardian-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.guardian-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.guardian-drawer__field-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.1fr\) minmax\(160px,\s*0\.9fr\)/);
    expect(styles).toMatch(/\.guardian-link-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.guardian-link-actions\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).not.toMatch(/\.guardian-drawer__panel h4/);
    expect(styles).not.toContain("guardian-scene__backdrop");
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).not.toContain("repeating-linear-gradient");
    expect(styles).not.toMatch(/\.recovery-guardian-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(styles).not.toContain("var(--mx2-scene-wash");
  });
});
