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
    callbackInvalid: "Callback must be a 0x hash160",
    callbackInvalidHint: "Optional, but when present it must be a 0x hash160.",
    callbackShort: "Callback",
    callbackPlaceholder: "Optional callback contract hash",
    claim: "Claim",
    claimPlaceholder: "e.g. profile.kyc",
    claimMissingHint: "Choose the claim type to verify.",
    claimReadyHint: "Claim type is present.",
    detailsLabel: "Details",
    did: "DID",
    didPlaceholder: "did:neo:testnet:sample-user",
    didInvalid: "Enter a valid did:neo identifier",
    didInvalidHint: "Use did:neo:<method-specific-id>.",
    didReadyHint: "DID shape is ready for preview.",
    digestPlaceholder: "No digest",
    lastStatus: "Last Status",
    neodidCatalogCopy: "Provider and claim options are examples.",
    neodidCatalogTitle: "Review mode",
    neodidBuildActive: "Building preview...",
    neodidEmptyTitle: "No receipt yet",
    neodidEmptyCopy: "Preview the request to see the digest.",
    neodidFlowTitle: "NeoDID verification flow",
    neodidIdentityTrackTitle: "Identity verification track",
    neodidPlan: "Verification workspace",
    neodidPlanCopy: "Build the request from identity context.",
    neodidReceipt: "Verification receipt",
    neodidSubjectTitle: "Identity subject",
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
    providerShort: "Provider",
    providerWallet: "Wallet signature",
    providerWalletHint: "Wallet-controlled proof check",
    providerSocial: "Social attestation",
    providerSocialHint: "External attestation signal",
    ready: "Ready",
    reset: "Reset",
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

function playAreaSource(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.tsx"), "utf8");
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

  it("keeps identity parameters in the drawer and dispatches the edited preview", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    expect(container.querySelector(".mx2-stage__scene input, .mx2-stage__scene textarea")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(container.querySelector(".neodid-drawer h4")).toBeNull();
    expect(container.querySelector(".neodid-composer")).toBeTruthy();

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".neodid-composer input.semi-input"));
    expect(inputs).toHaveLength(3);

    fireEvent.change(inputs[0], { target: { value: "did:neo:testnet:merchant-42" } });
    fireEvent.click(screen.getByText("Wallet signature"));
    fireEvent.change(inputs[1], { target: { value: "profile.accredited" } });
    fireEvent.change(inputs[2], { target: { value: "0x1234567890abcdef1234567890abcdef12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /Preview Verification/ }));

    expect(container.textContent).toContain("Wallet-controlled proof check");
    expect(container.textContent).not.toContain("Wallet signatureRegistry-backed credential lookup");
    expect(dispatch).toHaveBeenCalledWith("buildRequest", {
      callback: "0x1234567890abcdef1234567890abcdef12345678",
      claim: "profile.accredited",
      did: "did:neo:testnet:merchant-42",
      provider: "wallet-signature",
    });
  });

  it("blocks malformed identity inputs before dispatching preview", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".neodid-composer input.semi-input"));
    const primary = screen.getByRole("button", { name: /Preview Verification/ }) as HTMLButtonElement;

    fireEvent.change(inputs[0], { target: { value: "did:web:example.com" } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Enter a valid did:neo identifier");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.change(inputs[0], { target: { value: "did:neo:testnet:merchant-42" } });
    fireEvent.change(inputs[2], { target: { value: "0x1234" } });
    expect(primary.disabled).toBe(true);
    expect(container.textContent).toContain("Callback must be a 0x hash160");
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalled();
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
    const source = playAreaSource("oracle-neodid-console");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(
      /\.oracle-neodid-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/,
    );
    expect(styles).toMatch(
      /\.oracle-neodid-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/,
    );
    expect(styles).toMatch(/\.neodid-stage-art\s*\{[\s\S]*background:\s*#eef8ff/);
    expect(styles).toMatch(/\.neodid-stage-art\s*\{[\s\S]*padding:\s*0/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*inset:\s*0/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*object-position:\s*center bottom/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.neodid-stage-art img\s*\{[\s\S]*filter:\s*saturate\(1\.08\) contrast\(1\.03\)/);
    expect(styles).toMatch(/\.neodid-stage-art::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.neodid-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.neodid-provider-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.neodid-composer__grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(230px,\s*0\.9fr\)/);
    expect(styles).toMatch(/\.neodid-input \.semi-input\s*\{[\s\S]*height:\s*42px/);
    expect(source).toContain("if (!formatReady) return;");
    expect(source).toContain("disabled: !formatReady || actionPreview");
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-request-card__copy\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-track\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-track__item strong\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-track__item small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-stage-art\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-stage-art\s*\{[\s\S]*height:\s*112px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-catalog-card__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-catalog-card__facts dd\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-route-card\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-provider-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-composer__grid,[\s\S]*\.neodid-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.oracle-neodid-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).not.toMatch(/\.neodid-stage-art img\s*\{[\s\S]*opacity:\s*0\.34/);
    expect(styles).not.toMatch(/AI-generated scene backdrop/);
    expect(styles).not.toMatch(/__backdrop/);
    expect(styles).not.toMatch(/\.tool-scene__backdrop/);
    expect(styles).not.toMatch(/oracle-console-scene__icon/);
  });
});
