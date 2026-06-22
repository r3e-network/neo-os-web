import fs from "node:fs";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../neodid-passport/src/PlayArea";
import type { PassportPayload } from "../../neodid-passport/src/passport";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    apiProofHint: "External providers prepare an unsigned package.",
    audience: "Audience",
    audiencePlaceholder: "miniapp-id or relying party",
    claim: "Claim",
    claimPlaceholder: "wallet-ownership",
    copyAction: "Copy Payload",
    documentVersion: "Version",
    emptyPayloadCopy: "Resolve a DID before handoff.",
    emptyPayloadTitle: "Awaiting DID resolution",
    githubProvider: "GitHub attestation",
    identityRoute: "Identity route",
    liveResolver: "Morpheus NeoDID API",
    notSignedStatus: "Not signed",
    panelDescription: "Resolve, build, and optionally sign a passport.",
    panelTitle: "NeoDID Passport Builder",
    passportReady: "Passport payload ready",
    payloadDigest: "Payload Digest",
    provider: "Proof Provider",
    reset: "Reset",
    routeBuild: "Build credential",
    routeResolve: "Resolve DID",
    routeSign: "Optional wallet proof",
    runAction: "Resolve and Build",
    services: "Services",
    signAction: "Sign Passport",
    signature: "Signature",
    statEndpoint: "Resolver",
    statNetwork: "Network",
    statRequests: "Passports",
    subject: "Subject DID",
    subjectPlaceholder: "did:morpheus:neo_n3:service:neodid",
    walletProvider: "Wallet signature",
    walletProofHint: "Wallet signatures do not broadcast.",
    statistics: "Passport metrics",
    degradedRuntimeBadge: "Degraded",
    degradedRuntimeWarning: "Runtime attestation metadata unavailable.",
    externalVerifierTitle: "Submit to an external verifier",
    externalVerifierCopy: "GitHub and email proofs are prepared for an external verifier.",
    externalVerifierLink: "Open attestation docs",
    emailProvider: "Email attestation",
    credentialCardTitle: "Identity passport",
    credentialFlowCopy: "Resolve, review, then attach a proof.",
    githubProviderTile: "Prepare a package for a GitHub verifier.",
    heroVisualAlt: "Identity passport desk",
    passportSealHint: "Resolve DID to build the passport",
    passportSealTrack: "Passport issuance track",
    passportPreview: "Passport preview",
    passportWorkspaceTitle: "Credential studio",
    previewAudienceLabel: "Audience",
    previewClaimLabel: "Claim",
    previewSubjectFallback: "Subject DID pending",
    proofLaneHint: "No chain transaction",
    proofLaneTitle: "Choose proof lane",
    preparedStatus: "Prepared",
    sealPayload: "Payload",
    sealProof: "Proof",
    sealSubject: "Subject",
    signedStatus: "Signed",
    walletProviderTile: "Sign in-app with the connected wallet.",
    emailProviderTile: "Prepare a package for an email verifier.",
  };
  return messages[key] ?? key;
}

function payload(overrides: Partial<PassportPayload> = {}): PassportPayload {
  return {
    kind: "neodid.passport.credential",
    schema: "https://schemas.r3e.network/neodid/passport/v1",
    network: "testnet",
    subject: "did:morpheus:neo_n3:service:neodid",
    provider: "wallet",
    claim: "wallet-ownership",
    audience: "miniapp-neodid-passport",
    issuedAt: "2026-06-01T00:00:00.000Z",
    resolver: {
      endpoint: "/api/morpheus/neodid/resolve?did=did%3Amorpheus%3Aneo_n3%3Aservice%3Aneodid&network=testnet",
      status: "resolved",
      contentType: "application/json",
    },
    didDocument: {
      id: "did:morpheus:neo_n3:service:neodid",
      controller: ["did:morpheus:neo_n3:service:neodid"],
      versionId: "compose-testnet-123",
      anchorContract: "0xabc",
      serviceTypes: ["DIDResolutionService", "MorpheusNeoDIDRuntime"],
      serviceCount: 2,
    },
    proof: {
      provider: "wallet",
      type: "NeoWalletSignature2026",
      status: "prepared",
    },
    digest: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    ...overrides,
  };
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    networkLabel: "Morpheus Testnet",
    endpointLabel: "NeoDID resolver",
    requestCount: 0,
    proofStatus: "Not signed",
    lastError: "",
    isResolving: false,
    isSigning: false,
    passportPayload: null,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function props(overrides: Partial<React.ComponentProps<typeof PlayArea>> = {}) {
  return {
    t,
    state: state(),
    dispatch: vi.fn(async () => undefined),
    services: { clipboard: { copy: vi.fn(async () => undefined) } },
    status: null,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/neodid-passport",
      "miniapp-neodid-passport",
    ),
    ...overrides,
  } as React.ComponentProps<typeof PlayArea>;
}

describe("NeoDID Passport PlayArea", () => {
  it("renders the passport preview with real logo assets and an issuance track", () => {
    const { container } = render(<PlayArea {...props()} />);

    expect(
      container.querySelector('.neodid-passport__credential-logo source[srcset="./logo.avif"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('.neodid-passport__credential-logo img[src="./logo.jpg"]'),
    ).toBeTruthy();
    expect(screen.getByLabelText("Passport issuance track")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__seal-token--subject")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__seal-token--payload.is-ready")).toBeNull();
    expect(container.querySelector(".neodid-passport__seal-token--proof.is-ready")).toBeNull();
  });

  it("dispatches a real passport build request from the visible form", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.change(screen.getByLabelText("Claim"), {
      target: { value: "dao-member" },
    });
    fireEvent.change(screen.getByLabelText("Audience"), {
      target: { value: "miniapp-aa-market-hub" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Resolve and Build/i }));

    expect(dispatch).toHaveBeenCalledWith("buildPassport", {
      subject: "did:morpheus:neo_n3:service:neodid",
      provider: "wallet",
      claim: "dao-member",
      audience: "miniapp-aa-market-hub",
    });
  });

  it("renders resolved document metadata and a copyable payload", () => {
    const copy = vi.fn(async () => undefined);
    const currentState = state({
      requestCount: 1,
      passportPayload: payload(),
      proofStatus: "Prepared",
    });
    const { container } = render(
      <PlayArea
        {...props({
          state: currentState,
          services: { clipboard: { copy } } as never,
        })}
      />,
    );

    expect(screen.getAllByText("did:morpheus:neo_n3:service:neodid").length).toBeGreaterThan(0);
    expect(screen.getByText("compose-testnet-123")).toBeTruthy();
    expect(screen.getByText("1234567890...90abcdef")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__credential-preview--built")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__seal-token--payload.is-ready")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__seal-token--proof.is-ready")).toBeNull();
    expect(container.textContent).not.toContain("[object Object]");

    fireEvent.click(screen.getByRole("button", { name: /Copy Payload/i }));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('"kind": "neodid.passport.credential"'), "copied");
  });

  it("keeps wallet signing disabled until a payload exists", () => {
    const { rerender } = render(<PlayArea {...props()} />);

    expect(screen.getByRole("button", { name: /Sign Passport/i }).hasAttribute("disabled")).toBe(true);

    rerender(
      <PlayArea
        {...props({
          state: state({ passportPayload: payload(), proofStatus: "Prepared" }),
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /Sign Passport/i }).hasAttribute("disabled")).toBe(false);
  });

  it("marks the proof step ready once a wallet signature is attached", () => {
    const { container } = render(
      <PlayArea
        {...props({
          state: state({
            passportPayload: payload({
              proof: {
                address: "NbeG6moXrsUtJCBuLrJbCWs8RZ8xutYx64",
                provider: "wallet",
                signature: "0x1234",
                status: "signed",
                type: "NeoWalletSignature2026",
              },
            }),
            proofStatus: "Signed",
          }),
        })}
      />,
    );

    expect(container.querySelector(".neodid-passport__credential-preview--signed")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__seal-token--proof.is-ready")).toBeTruthy();
  });

  it("warns when the built passport carries an unversioned (degraded-runtime) document", () => {
    const { container } = render(
      <PlayArea
        {...props({
          state: state({
            passportPayload: payload({
              didDocument: {
                ...payload().didDocument,
                versionId: "unversioned",
              },
            }),
          }),
        })}
      />,
    );
    // The degraded chip + warning note appear only for unversioned documents.
    expect(screen.getByText("Runtime attestation metadata unavailable.")).toBeTruthy();
    expect(container.querySelector(".neodid-passport__degraded-chip")).toBeTruthy();

    // A normally-versioned document shows no warning.
    cleanup();
    const { container: ok } = render(<PlayArea {...props({ state: state({ passportPayload: payload() }) })} />);
    expect(ok.querySelector(".neodid-passport__degraded-note")).toBeNull();
  });

  it("shows external-verifier guidance for github/email providers", () => {
    render(<PlayArea {...props()} />);
    // Wallet provider (default) shows no external-verifier card.
    expect(screen.queryByText("Submit to an external verifier")).toBeNull();

    // Switching to GitHub surfaces the external-verifier guidance + docs link.
    fireEvent.click(screen.getByRole("radio", { name: "Proof Provider: GitHub attestation" }));
    expect(screen.getByText("Submit to an external verifier")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Open attestation docs/i }),
    ).toBeTruthy();
  });

  it("keeps passport issuance motion reduced-motion safe", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../neodid-passport/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes neodid-passport-card-scan");
    expect(styles).toContain("@keyframes neodid-passport-seal-breathe");
    expect(styles).toContain("@keyframes neodid-passport-route-flow");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.neodid-passport__seal-token\.is-ready[\s\S]*animation:\s*none/,
    );
  });
});
