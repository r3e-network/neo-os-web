import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neodid-passport/src/PlayArea";
import type { NeoDidRegistryProbe, PassportPayload } from "../../neodid-passport/src/passport";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const DID = "did:morpheus:neo_n3:service:neodid";
const FORM = {
  subject: DID,
  claim: "wallet-signature-context",
  audience: "miniapp-neodid-passport",
};

function t(key: string) {
  const messages: Record<string, string> = {
    title: "NeoDID Passport Review",
    passportProductSubtitle: "Inspect a DID document and a short-lived local review.",
    mainnet: "Mainnet",
    testnet: "Testnet",
    details: "Review details",
    reviewDetailsTitle: "Passport review details",
    heroVisualAlt: "A bright identity desk with a floating digital ID card.",
    localReviewBoundary: "Local review — not identity issuance",
    credentialCardTitle: "NeoDID review passport",
    passportPreview: "NeoDID passport preview",
    claimContext: "Self-authored context",
    audience: "Relying audience",
    reviewExpiry: "Review expires",
    tenMinuteReview: "10 minutes after creation",
    documentVersion: "Resolver version",
    services: "Services",
    verificationMethods: "Verification methods",
    passportWorkspaceTitle: "Review purpose",
    passportTemplateTitle: "Choose a review context",
    passportTemplateWallet: "Wallet signature context",
    passportTemplateWalletHint: "DID ownership is not checked.",
    passportTemplateRelying: "App audience context",
    passportTemplateRelyingHint: "This does not grant access.",
    passportTemplateDeveloper: "Developer context",
    passportTemplateDeveloperHint: "No developer status is verified.",
    passportCustomCredential: "Custom review context",
    selfAuthoredClaimNote: "Claims are user-entered labels and are not verified.",
    assuranceTitle: "Evidence boundary",
    assuranceSubtitle: "What this passport can actually show",
    assuranceDocument: "DID document",
    assuranceRuntime: "Runtime metadata",
    assuranceRegistry: "Registry deployment",
    assuranceWallet: "Wallet signature",
    resolverNotCheckedStatus: "Not resolved",
    runtimeNotCheckedStatus: "Not checked",
    registryNotChecked: "Not checked",
    registryDeploymentVerified: "Contract deployment found on the selected network",
    proofNotAttachedStatus: "No wallet proof attached",
    proofAttachedUnverifiedStatus: "Wallet signature returned — convention unconfirmed",
    reviewEnvelopeReady: "Local review envelope ready",
    reviewNotBuilt: "Awaiting DID resolution",
    passportExpiredStatus: "Review envelope expired",
    statusReady: "Passport review ready",
    routeBuild: "Resolve & create review",
    signAction: "Attach wallet signature",
    waitingWalletStatus: "Waiting for wallet signature…",
    resolvingStatus: "Resolving DID document…",
    proofLaneHint: "No chain transaction",
    offChainNote: "This app never registers a DID, verifies a claim, or broadcasts a transaction.",
    advancedFieldsTitle: "Advanced review fields",
    advancedFieldsCopy: "Use exact values supplied by the relying party.",
    subject: "Subject DID",
    subjectPlaceholder: DID,
    claimPlaceholder: "wallet-signature-context",
    audiencePlaceholder: "miniapp id or relying party",
    reviewEvidenceTitle: "Review and proof data",
    reviewEvidenceCopy: "The digest is reproducible; signature verification needs wallet-adapter preimage rules.",
    payloadDigest: "Review digest",
    anchorContract: "Resolver-declared anchor",
    reviewNonce: "Nonce",
    proofAddress: "Signing address",
    messageDigest: "Signed-message digest",
    proofVerification: "Signature verification",
    proofNotVerifiedHere: "Not performed — wallet preimage convention unavailable",
    byteLimitHint: "UTF-8 byte limit",
    copyAction: "Copy review JSON",
    retryStorageAction: "Retry local recovery",
    reset: "Reset passport",
  };
  return messages[key] ?? key;
}

const PROBE: NeoDidRegistryProbe = {
  environment: "mainnet",
  status: "verified",
  contract: "0xb81f31ea81e279793b30411b82c2e82078b63105",
  contractName: "NeoDIDRegistry",
  networkMagic: 860833102,
  checkedAt: "2099-06-01T00:00:01.000Z",
  reason: "verified-deployment",
};

const PAYLOAD: PassportPayload = {
  kind: "neodid.passport.review",
  formatVersion: 1,
  network: "mainnet",
  subject: DID,
  claim: FORM.claim,
  audience: FORM.audience,
  issuer: "self-authored-local-review",
  issuedAt: "2099-06-01T00:00:00.000Z",
  expiresAt: "2099-06-01T00:10:00.000Z",
  nonce: "ab".repeat(16),
  resolver: {
    endpoint: "/api/morpheus/neodid/resolve?did=did%3Amorpheus%3Aneo_n3%3Aservice%3Aneodid&network=mainnet",
    status: "document-returned",
    contentType: "application/did+ld+json",
    snapshot: { didDocument: { id: DID } },
  },
  registry: PROBE,
  didDocument: {
    id: DID,
    controller: [DID],
    versionId: "compose-mainnet-123",
    anchorContract: PROBE.contract,
    serviceTypes: ["DIDResolutionService", "MorpheusNeoDIDRuntime"],
    serviceCount: 4,
    verificationMethodCount: 1,
  },
  assurance: {
    claimVerification: "not-performed",
    didWalletBinding: "not-checked",
    registryAnchor: "deployment-verified",
    runtimeAttestation: "metadata-available",
    walletProof: "not-attached",
  },
  proof: {
    provider: "wallet",
    type: "NeoWalletMessageSignature",
    status: "prepared",
    verification: "not-performed",
    verificationLimitation: "wallet-preimage-convention-not-disclosed",
  },
  digest: "a".repeat(64),
};

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    network: "testnet",
    networkLabel: "Morpheus Testnet",
    lastStatus: "Passport review ready",
    lastDigest: "—",
    resolverStatus: "Not resolved",
    runtimeStatus: "Not checked",
    documentId: "—",
    documentVersion: "—",
    anchorContract: "—",
    serviceCount: 0,
    verificationMethodCount: 0,
    lastError: "",
    recoveryStatus: "",
    isResolving: false,
    isSigning: false,
    storageHealthy: true,
    passportPayload: null,
    registryProbe: null,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

function resolvedState(overrides: Partial<Record<string, unknown>> = {}) {
  return state({
    network: "mainnet",
    networkLabel: "Morpheus Mainnet",
    lastStatus: "Local review envelope ready",
    lastDigest: "aaaaaaaaaa...aaaaaaaa",
    resolverStatus: "Document returned — identity not verified",
    runtimeStatus: "Verifier metadata present",
    documentId: DID,
    documentVersion: "compose-mainnet-123",
    anchorContract: PROBE.contract,
    serviceCount: 4,
    verificationMethodCount: 1,
    passportPayload: PAYLOAD,
    registryProbe: PROBE,
    ...overrides,
  });
}

describe("neodid-passport PlayArea production surface", () => {
  it("uses a bright identity artwork and document resource as the visual main stage", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".did-identity-stage")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".did-identity-stage__art")?.src).toContain("passport-desk.webp");
    expect(container.querySelector<HTMLImageElement>(".did-passport__mark")?.src).toContain("logo.webp");
    expect(container.querySelector(".did-passport")).toBeTruthy();
    expect(container.querySelector(".did-assurance")).toBeTruthy();
    expect(container.querySelectorAll(".did-template-deck button")).toHaveLength(3);
    expect(container.querySelector(".did-template-deck button.is-active")?.textContent).toContain("Wallet signature context");
    expect(container.querySelector(".did-credential-lane input")).toBeNull();
    expect(container.textContent).toContain("Local review — not identity issuance");
    expect(container.textContent).toContain("Claims are user-entered labels and are not verified.");
  });

  it("keeps custom fields and raw evidence in the secondary drawer", () => {
    const { container } = render(<PlayArea t={t} state={resolvedState()} dispatch={vi.fn()} />);

    expect(container.querySelector(".did-drawer")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelectorAll(".did-drawer__field input")).toHaveLength(3);
    expect(container.querySelectorAll(".did-evidence-list > div")).toHaveLength(8);
    expect(container.textContent).toContain("This app never registers a DID, verifies a claim, or broadcasts a transaction.");
    expect(container.textContent).toContain(PAYLOAD.digest);
    expect(screen.getByRole("button", { name: "Copy review JSON" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset passport" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Email attestation|GitHub attestation|Proof provider/);
  });

  it("surfaces the draft-validation reason beside the fields once an edit disables the build action", () => {
    // The build button disables on an invalid draft; the only other surfacing
    // path (runBuild's validation branch) is unreachable because a disabled
    // button cannot dispatch it. The message must therefore render at the
    // point of edit, and clear again when the field recovers.
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".did-draft-error")).toBeNull();

    const subject = container.querySelector(".did-drawer__field--wide input") as HTMLInputElement;
    fireEvent.change(subject, { target: { value: "not-a-did" } });
    const hint = container.querySelector(".did-draft-error");
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain("passportInvalidDid");

    fireEvent.change(subject, { target: { value: DID } });
    expect(container.querySelector(".did-draft-error")).toBeNull();
  });

  it("makes wallet signing secondary and dispatches the exact current draft", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={resolvedState()} dispatch={dispatch} />);

    const sign = screen.getByRole("button", { name: "Attach wallet signature" });
    fireEvent.click(sign);

    expect(dispatch).toHaveBeenCalledWith("signPassport", FORM);
  });

  it("offers storage recovery only as a secondary drawer action after persistence fails", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea
      t={t}
      state={resolvedState({ storageHealthy: false })}
      dispatch={dispatch}
    />);

    expect(screen.queryByRole("button", { name: "Retry local recovery" })).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("button", { name: "Retry local recovery" }));

    expect(dispatch).toHaveBeenCalledWith("retryPassportStorage");
  });

  it("clears stale evidence as soon as the visible draft no longer matches it", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea
      t={t}
      state={resolvedState({ recoveryForm: { ...FORM, claim: "changed-context" } })}
      dispatch={dispatch}
    />);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("discardPassportReview"));
    expect(container.textContent).not.toContain(PAYLOAD.digest);
    expect(screen.queryByRole("button", { name: "Attach wallet signature" })).toBeNull();
  });

  it("does not present an idle resolver as a completed identity", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.textContent).toContain("Awaiting DID resolution");
    expect(container.textContent).toContain("No wallet proof attached");
    expect(container.textContent).not.toContain("Wallet signature returned — convention unconfirmed");
    expect(container.querySelector(".did-passport[data-attached='true']")).toBeNull();
  });

  it("implements clean contrast, restrained action sizing, responsive layout, and reduced motion", () => {
    const scss = readFileSync(`${process.cwd()}/../neodid-passport/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../neodid-passport/src/PlayArea.tsx`, "utf8");

    expect(scss).toMatch(/\.mx2-stage,[\s\S]*width:\s*min\(100%,\s*980px\)/);
    expect(scss).toMatch(/\.mx2-btn--primary[\s\S]*max-width:\s*min\(100%,\s*224px\)/);
    expect(scss).toMatch(/\.did-identity-stage\s*\{[\s\S]*min-height:\s*570px/);
    expect(scss).toMatch(/\.did-identity-stage__art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(scss).toMatch(/\.did-identity-stage__veil\s*\{[\s\S]*linear-gradient/);
    expect(scss).toMatch(/\.did-passport\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\)/);
    expect(scss).toMatch(/@media \(max-width:\s*820px\)[\s\S]*grid-template-columns:\s*1fr/);
    expect(scss).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.did-passport__fields,[\s\S]*grid-template-columns:\s*1fr/);
    expect(scss).toMatch(/prefers-reduced-motion/);
    expect(scss).not.toMatch(/backdrop-filter/);
    expect(source).toContain("passport-desk.webp");
    expect(source).toContain("@shared/components-react/v2/OpenUiLite");
    expect(source).not.toMatch(/CoinArt|emailProvider|githubProvider|did-scene-art/);
  });

  it("keeps the manifest and runtime truthful about state, networks, and writes", () => {
    const manifest = JSON.parse(readFileSync(`${process.cwd()}/../neodid-passport/neo-manifest.json`, "utf8"));
    const main = readFileSync(`${process.cwd()}/../neodid-passport/src/main.tsx`, "utf8");
    const passport = readFileSync(`${process.cwd()}/../neodid-passport/src/passport.ts`, "utf8");
    const readme = readFileSync(`${process.cwd()}/../neodid-passport/README.md`, "utf8");

    expect(manifest.supported_networks).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.permissions).toEqual(["read:blockchain", "wallet:sign-message"]);
    expect(main).toContain("neodid/passport-review-v2");
    expect(main).toContain("neodid/passport-pending-v1");
    expect(main).toContain("ensureWallet");
    expect(main).toContain("signMessage(canonicalize(payload))");
    expect(main).not.toMatch(/\.invoke\(|broadcast|sendTransaction/);
    expect(passport).toContain("MORPHEUS_PUBLIC_REGISTRY");
    expect(passport).toContain('contractName !== "NeoDIDRegistry"');
    expect(passport).toContain("wallet-adapter-specific-not-disclosed");
    expect(readme).toContain("cannot be cryptographically verified from this bundle alone");
  });
});
