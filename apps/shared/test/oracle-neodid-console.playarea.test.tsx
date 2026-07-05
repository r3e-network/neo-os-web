import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-neodid-console/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    buildRequest: "Build Request",
    callbackOptional: "No callback",
    callbackReadyHint: "Callback is optional and format-safe.",
    callbackShort: "Callback",
    claim: "Claim",
    claimMissingHint: "Choose the claim type to verify.",
    claimReadyHint: "Claim type is present.",
    detailsLabel: "Details",
    did: "DID",
    didInvalidHint: "Use did:neo:<method-specific-id>.",
    didReadyHint: "DID shape is ready for preview.",
    digestPlaceholder: "No digest",
    lastStatus: "Last Status",
    neodidCatalogCopy: "Provider and claim options are examples.",
    neodidCatalogTitle: "Review mode",
    neodidBuildActive: "Building preview...",
    neodidEmptyCopy: "Preview the request to see the digest.",
    neodidFlowTitle: "NeoDID verification flow",
    neodidIdentityTrackTitle: "Identity verification track",
    neodidPlan: "Verification workspace",
    neodidPlanCopy: "Build the request from identity context.",
    neodidReceipt: "Verification receipt",
    neodidTrackClaim: "Claim",
    neodidTrackProvider: "Provider",
    neodidTrackReceipt: "Receipt",
    neodidTrackSubject: "Subject",
    neodidValidationReady: "Ready to preview",
    panelEyebrow: "Oracle",
    panelTitle: "NeoDID",
    previewReady: "Preview ready",
    providerRegistry: "NeoDID registry",
    providerRegistryHint: "Registry-backed credential lookup",
    ready: "Ready",
    runAction: "Preview Verification",
    statDigest: "Digest",
    statEndpoint: "Mode",
    statNetwork: "Network",
    statRequests: "Requests",
    statusReady: "Ready",
    validationBlocked: "Validation blocked",
  };
  return messages[key] ?? key;
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    endpointLabel: "Preview",
    lastDigest: "No digest",
    lastStatus: "Ready",
    networkLabel: "Mainnet",
    requestCount: 0,
    ...o,
  };
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, createObservable(value)]),
  );
}

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}

describe("oracle-neodid-console PlayArea (v2)", () => {
  it("renders a clean identity workspace instead of a backdrop terminal", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".neodid-workspace")).toBeTruthy();
    expect(container.querySelector(".neodid-request-card")).toBeTruthy();
    expect(container.querySelectorAll(".neodid-track__item")).toHaveLength(4);
    expect(container.querySelector(".neodid-stage-art img")?.getAttribute("src"))
      .toBe("neodid-identity-stage.webp");
    expect(container.querySelector(".oracle-console-scene__backdrop")).toBeNull();
    expect(container.textContent).not.toContain("⚡");
  });

  it("keeps Preview Verification wired to the preview action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Preview Verification/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", {
      callback: "",
      claim: "profile.kyc",
      did: "did:neo:testnet:sample-user",
      provider: "neodid-registry",
    });
  });

  it("surfaces digest state without turning art into the foreground", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ lastDigest: "0x1234567890abcdef1234567890abcdef" })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".neodid-workspace")?.getAttribute("data-state"))
      .toBe("ready");
    expect(container.textContent).toContain("0x1234567890ab...7890abcdef");
    expect(container.querySelector(".neodid-stage-art")?.getAttribute("aria-hidden"))
      .toBe("true");
  });

  it("keeps the scene scoped, clean, and motion-accessible", () => {
    const styles = playAreaStyles("oracle-neodid-console");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(
      /\.oracle-neodid-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/,
    );
    expect(styles).toMatch(
      /\.oracle-neodid-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/,
    );
    expect(styles).toMatch(/\.neodid-stage-art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.neodid-stage-art\s*\{[\s\S]*padding:\s*12px/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.neodid-stage-art::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-request-card__copy\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-track\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-track__item strong\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-track__item small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-stage-art\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-stage-art\s*\{[\s\S]*height:\s*86px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-catalog-card__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-catalog-card__facts dd\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-route-card\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.oracle-neodid-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).not.toMatch(/\.neodid-stage-art img\s*\{[\s\S]*opacity:\s*0\.34/);
    expect(styles).not.toMatch(/\.neodid-stage-art img\s*\{[\s\S]*filter:\s*saturate/);
    expect(styles).not.toMatch(/AI-generated scene backdrop/);
    expect(styles).not.toMatch(/__backdrop/);
    expect(styles).not.toMatch(/\.tool-scene__backdrop/);
    expect(styles).not.toMatch(/oracle-console-scene__icon/);
  });
});
