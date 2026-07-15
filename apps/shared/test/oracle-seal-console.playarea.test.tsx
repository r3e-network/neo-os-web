import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-seal-console/src/PlayArea";
import { messages } from "../../oracle-seal-console/src/appConfig";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

type LocalizedMessage = { en: string; zh: string };
const localized = messages as Record<string, LocalizedMessage>;
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../oracle-seal-console");
function t(key: string, params: Record<string, string | number> = {}) {
  let value = localized[key]?.en ?? key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    networkLabel: "Neo N3 Testnet",
    runtimeState: "ready",
    runtimeStateLabel: "Contract key verified",
    phase: "draft",
    lastStatus: "Current Oracle contract key verified.",
    lastFingerprint: "—",
    lastSecretRef: "",
    lastContract: "",
    lastAlgorithm: "",
    lastStoredAt: 0,
    sealCount: 0,
    isBusy: false,
    storageReady: true,
    hasPending: false,
    pendingStored: false,
    pendingMalformed: false,
    pendingFingerprint: "",
    pendingSecretRef: "",
    pendingAttempts: 0,
    pendingCreatedAt: 0,
    pendingPurpose: "",
    pendingPublicRoute: "",
    keyContract: "0x4b882e94ed766807c4fd728768f972e13008ad52",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("oracle-seal-console PlayArea", () => {
  it("renders a resource-led seal object and keeps source fields secondary", () => {
    const { container, getByRole } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".seal-workspace")).toBeTruthy();
    expect(container.querySelector(".seal-object")).toBeTruthy();
    expect(container.querySelector(".seal-draft")).toBeTruthy();
    expect(container.querySelectorAll(".seal-journey li")).toHaveLength(3);
    expect(container.querySelectorAll(".seal-purpose-card")).toHaveLength(3);
    expect(container.querySelector(".seal-workspace textarea")).toBeFalsy();
    expect(container.querySelector(".seal-workspace input:not([type='radio'])")).toBeFalsy();
    const image = container.querySelector(".seal-object__asset img") as HTMLImageElement;
    expect(image.src).toContain("seal-reference-stage.webp");

    const primary = getByRole("button", { name: "Seal & store ciphertext" }) as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Prepare");
    expect(container.textContent).toContain("Local encryption chamber");
    expect(container.textContent).toContain("Plaintext boundary");
  });

  it("opens the private source in the drawer and enables the one primary action only for valid JSON", () => {
    const { container, getByRole } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);

    expect(container.querySelector(".seal-drawer__source")).toBeTruthy();
    expect(container.querySelectorAll(".seal-field.mx2-open-field")).toHaveLength(2);
    fireEvent.change(getByRole("textbox", { name: "Confidential JSON" }), {
      target: { value: "{\"threshold\":7}" },
    });
    expect((getByRole("button", { name: "Seal & store ciphertext" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("promotes exact-ciphertext recovery above creating a second packet", () => {
    const fingerprint = `0x${"ab".repeat(32)}`;
    const { container, getByRole } = render(
      <PlayArea
        t={t}
        state={state({
          runtimeState: "unavailable",
          runtimeStateLabel: "Ciphertext recoverable",
          phase: "recovery",
          hasPending: true,
          pendingFingerprint: fingerprint,
          pendingAttempts: 2,
          pendingCreatedAt: Date.now(),
          pendingPurpose: "callback-secret",
          pendingPublicRoute: "oracle://callback",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".seal-recovery")).toBeTruthy();
    expect(container.querySelector('.seal-workspace[data-pending="true"]')).toBeTruthy();
    expect(container.textContent).toContain("Recover pending ciphertext");
    const primary = getByRole("button", { name: "Retry exact ciphertext" }) as HTMLButtonElement;
    expect(primary.disabled).toBe(false);
    expect(container.querySelector(".mx2-action-rail__row")?.textContent).not.toContain("Seal & store ciphertext");
  });

  it("renders a receipt only from non-empty stored state and labels its boundary", () => {
    const fingerprint = `0x${"cd".repeat(32)}`;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          phase: "stored",
          lastFingerprint: fingerprint,
          lastSecretRef: "secret-ref-live",
          lastContract: "0x4b882e94ed766807c4fd728768f972e13008ad52",
          lastAlgorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          lastStoredAt: Date.now(),
          sealCount: 1,
        })}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);

    expect(container.querySelector(".seal-drawer__receipt")?.textContent).toContain("secret-ref-live");
    expect(container.textContent).toContain("No transaction or attestation");
  });

  it("keeps the visual resource bounded, bright, and motion-accessible", () => {
    const styles = readFileSync(path.join(appDir, "src/PlayArea.scss"), "utf8");
    const source = readFileSync(path.join(appDir, "src/PlayArea.tsx"), "utf8");

    expect(styles).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(styles).toMatch(/\.seal-workspace\s*\{[\s\S]*background:\s*var\(--seal-canvas\)/);
    expect(styles).toMatch(/\.seal-object__asset img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.oracle-seal-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 228px/);
    expect(styles).toMatch(/\.seal-purpose-card\s*\{[\s\S]*min-height:\s*48px[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\)/);
    expect(styles).toMatch(/@media \(max-width: 920px\)[\s\S]*grid-template-areas:[\s\S]*"object"[\s\S]*"draft"/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).not.toMatch(/radial-gradient|backdrop-filter|object-fit:\s*cover/);
    expect(source).toContain("seal-reference-stage.webp");
    expect(source).not.toContain("previewId");
    expect(source).not.toContain("useTransientFlag");
    expect(source).not.toContain("attestation");
  });
});
