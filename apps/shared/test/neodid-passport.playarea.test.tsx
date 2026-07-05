import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neodid-passport/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) {
  const messages: Record<string, string> = {
    audience: "Audience",
    audiencePlaceholder: "miniapp-id or relying party",
    advancedFieldsCopy: "Use advanced DID fields only when exact values are required.",
    advancedFieldsTitle: "Advanced credential fields",
    apiProofHint: "External proof providers prepare a package.",
    claimPlaceholder: "wallet-ownership",
    credentialCardTitle: "Identity passport",
    credentialFlowCopy: "Resolve the DID, review the payload, then attach a proof only when the lane matches the relying party.",
    documentId: "Document ID",
    documentVersion: "Version",
    emptyPayloadTitle: "Awaiting DID resolution",
    notSignedStatus: "Not signed",
    passportPreview: "Passport preview",
    passportReady: "Passport payload ready",
    passportSealHint: "Resolve DID to build the passport",
    passportSealTrack: "Passport issuance track",
    passportTemplateDeveloper: "Developer pass",
    passportTemplateDeveloperHint: "Package an oracle or tool developer credential.",
    passportTemplateRelying: "Relying-party access",
    passportTemplateRelyingHint: "Prepare an access passport for another miniapp.",
    passportTemplateTitle: "Credential purpose",
    passportTemplateWallet: "Wallet ownership",
    passportTemplateWalletHint: "Prove this DID controls the wallet.",
    passportActionsTitle: "Passport actions",
    passportCustomCredential: "Custom credential",
    passportWorkspaceTitle: "Credential studio",
    passportSigned: "Wallet proof attached",
    preparedStatus: "Prepared",
    proofLaneHint: "No chain transaction",
    provider: "Proof provider",
    previewClaimLabel: "Claim",
    previewSubjectFallback: "Subject DID pending",
    resolvedStatus: "DID resolved",
    routeBuild: "Build credential",
    routeResolve: "Resolve DID",
    sealPayload: "Payload",
    sealProof: "Proof",
    sealSubject: "Subject",
    services: "Services",
    signAction: "Sign Passport",
    signedStatus: "Signed",
    subject: "Subject DID",
    walletProvider: "Wallet signature",
    walletProviderTile: "Sign in-app with the connected wallet.",
    emailProvider: "Email attestation",
    emailProviderTile: "Prepare a package for an email verifier.",
    githubProvider: "GitHub attestation",
    githubProviderTile: "Prepare a package for a GitHub verifier.",
  };
  return messages[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    lastStatus: "Ready",
    lastDigest: "—",
    requestCount: 0,
    proofStatus: "Not signed",
    documentId: "—",
    documentVersion: "—",
    serviceCount: 0,
    lastError: "",
    isResolving: false,
    isSigning: false,
    ...o,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neodid-passport PlayArea (v2)", () => {
  it("renders the passport card without a decorative backdrop node", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelector(".did-passport")).toBeTruthy();
    expect(container.querySelector(".did-passport__fields")).toBeTruthy();
    expect(container.querySelector(".did-credential-lane")).toBeTruthy();
    expect(container.querySelector(".did-credential-lane")?.getAttribute("data-ready")).toBe("true");
    expect(container.querySelector(".did-template-deck")).toBeTruthy();
    expect(container.querySelectorAll(".did-template-deck button")).toHaveLength(3);
    expect(container.querySelector(".did-template-deck button.is-active")?.textContent).toContain("Wallet ownership");
    expect(container.querySelector(".did-lane-summary")).toBeTruthy();
    expect(container.querySelector(".did-credential-lane input")).toBeNull();
    expect(container.querySelector(".did-credential-slot")).toBeNull();
    expect(container.querySelector(".did-issuance")).toBeTruthy();
    expect(container.querySelectorAll(".did-issuance__step")).toHaveLength(3);
    expect(container.querySelector(".did-lane-summary")?.textContent).toContain("did:morpheus…neodid");
    expect(container.querySelector(".did-scene__backdrop")).toBeNull();
  });

  it("keeps the build action tied to the designed lane while raw edits stay in the drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");

    expect(primary?.disabled).toBe(false);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const claimInput = container.querySelectorAll<HTMLInputElement>(".did-drawer__field input")[1];
    fireEvent.change(claimInput, { target: { value: "" } });
    expect(container.querySelector(".did-credential-lane")?.getAttribute("data-ready")).toBeFalsy();
    expect(primary?.disabled).toBe(true);
  });

  it("changes the foreground credential package from template cards", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelectorAll(".did-template-deck button")[2]);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    expect(container.querySelector(".did-template-deck button.is-active")?.textContent).toContain("Developer pass");
    expect(dispatch).toHaveBeenCalledWith("buildPassport", {
      subject: "did:morpheus:neo_n3:service:neodid",
      claim: "developer-pass",
      audience: "miniapp-oracle-services",
      provider: "wallet",
    });
  });

  it("does not treat default Ready / Not signed state as a completed passport", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.textContent).toContain("Awaiting DID resolution");
    expect(container.textContent).toContain("Not signed");
    expect(container.textContent).not.toContain("Wallet proof attached");
    expect(container.querySelector(".did-passport__stamp[data-signed='true']")).toBeFalsy();
    expect(container.querySelectorAll(".did-issuance__step[data-active='true']")).toHaveLength(0);
  });

  it("has reduced-motion", () => {
    const s = readFileSync(`${process.cwd()}/../neodid-passport/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });

  it("keeps the DID passport scene as a clean document surface", () => {
    const s = readFileSync(`${process.cwd()}/../neodid-passport/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../neodid-passport/src/PlayArea.tsx`, "utf8");

    expect(s).toMatch(/\.did-scene\s*\{[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/\.did-scene\s*\{[\s\S]*border:\s*0/);
    expect(s).toMatch(/\.did-scene\s*\{[\s\S]*grid-template-columns:\s*minmax\(360px,\s*1fr\) minmax\(360px,\s*0\.95fr\)/);
    expect(s).toMatch(/\.did-passport,[\s\S]*\.did-issuance\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.did-credential-lane\s*\{[\s\S]*grid-area:\s*lane/);
    expect(s).toMatch(/\.did-credential-lane\[data-ready="true"\]\s*\{[\s\S]*box-shadow:\s*inset 4px 0 0 rgba\(8,\s*153,\s*129,\s*0\.22\)/);
    expect(s).toMatch(/\.did-template-deck\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.did-template-deck button\s*\{[\s\S]*min-height:\s*118px/);
    expect(s).toMatch(/\.did-lane-summary\s*\{[\s\S]*grid-template-columns:\s*1\.15fr 0\.92fr 0\.92fr/);
    expect(s).toMatch(/\.did-passport\s*\{[\s\S]*box-shadow:\s*0 12px 26px rgba\(15,\s*23,\s*42,\s*0\.055\)/);
    expect(s).toMatch(/\.did-passport::before\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.did-passport__fields\s*\{[\s\S]*display:\s*grid/);
    expect(s).toMatch(/\.did-passport__fields\s*\{[\s\S]*overflow:\s*hidden/);
    expect(s).toMatch(/\.did-passport__fields span \+ span\s*\{[\s\S]*border-top:\s*1px solid rgba\(31,\s*41,\s*55,\s*0\.065\)/);
    expect(s).toMatch(/\.did-issuance__steps\s*\{[\s\S]*display:\s*grid/);
    expect(s).toMatch(/\.did-issuance__steps\s*\{[\s\S]*border-top:\s*1px solid rgba\(31,\s*41,\s*55,\s*0\.065\)/);
    expect(s).toMatch(/\.did-scene__status\s*\{[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/\.did-scene__status\s*\{[\s\S]*box-shadow:\s*none/);
    expect(s).toMatch(/\.did-passport__stamp\[data-signed="true"\]\s*\{[\s\S]*transform:\s*rotate\(-8deg\)/);
    expect(s).toMatch(/\.did-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.did-drawer__field-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.did-provider-deck button\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.neodid-passport-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).toMatch(/\.neodid-passport-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*background:\s*#0f9f7a/);
    expect(s).toMatch(/@media \(max-width:\s*760px\)[\s\S]*grid-template-areas:\s*[\s\S]*"passport"[\s\S]*"lane"[\s\S]*"route"[\s\S]*"status"/);
    expect(s).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.did-template-deck,[\s\S]*\.did-lane-summary,[\s\S]*\.did-drawer,[\s\S]*\.did-drawer__field-grid,[\s\S]*\.did-drawer__row\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).not.toMatch(/did-scene__backdrop|var\(--mx2-scene-wash|background-image:\s*url|radial-gradient|linear-gradient|backdrop-filter/);
    expect(source).not.toContain("did-scene__backdrop");
    expect(source).not.toContain("did-scene__card");
    expect(source).not.toContain("did-credential-slot");
  });
});
