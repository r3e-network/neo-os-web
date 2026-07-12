import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-neodid-console/src/PlayArea";
import { messages } from "../../oracle-neodid-console/src/appConfig";
import type {
  NeoDidEvidenceSnapshot,
  ProviderCatalogSnapshot,
} from "../../oracle-neodid-console/src/neodid-console";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

type LocalizedMessage = { en: string; zh: string };
const localized = messages as Record<string, LocalizedMessage>;

function t(key: string, params: Record<string, string | number> = {}) {
  let text = localized[key]?.en ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

const DID = "did:morpheus:neo_n3:service:neodid";
const REGISTRY = "0xb81f31ea81e279793b30411b82c2e82078b63105";
const CATALOG: ProviderCatalogSnapshot = {
  endpoint: "/api/morpheus/neodid/providers?network=mainnet",
  network: "mainnet",
  status: "providers-returned",
  source: "host-runtime",
  warning: "",
  providers: [{
    id: "web3auth",
    category: "identity",
    aliases: ["w3a"],
    authModes: ["aggregate_oauth", "mfa"],
    claimTypes: ["Web3Auth_PrimaryIdentity", "Web3Auth_LinkedSocials"],
    derivesProviderUidInTee: true,
  }],
  loadedAt: "2099-07-11T00:00:00.000Z",
  raw: { providers: [{ id: "web3auth" }] },
};

const EVIDENCE: NeoDidEvidenceSnapshot = {
  kind: "oracle.neodid.evidence",
  formatVersion: 1,
  network: "mainnet",
  subject: DID,
  createdAt: "2099-07-11T00:00:00.000Z",
  expiresAt: "2099-07-11T00:15:00.000Z",
  resolver: {
    endpoint: `/api/morpheus/neodid/resolve?did=${encodeURIComponent(DID)}&network=mainnet`,
    status: "document-returned",
    contentType: "application/json",
    snapshot: { didDocument: { id: DID } },
  },
  catalog: CATALOG,
  registry: {
    network: "mainnet",
    status: "verified",
    contract: REGISTRY,
    contractName: "NeoDIDRegistry",
    networkMagic: 860833102,
    checkedAt: "2099-07-11T00:00:00.000Z",
    reason: "verified-deployment",
  },
  didDocument: {
    id: DID,
    controller: [DID],
    versionId: "unversioned",
    anchorContract: REGISTRY,
    serviceTypes: ["DIDResolutionService", "MorpheusOracleGateway"],
    serviceCount: 4,
    verificationMethodCount: 0,
    runtimeVerifierMetadata: "unavailable",
    oracleGateway: "declared",
  },
  context: {
    requestedProvider: "web3auth",
    requestedClaim: "Web3Auth_PrimaryIdentity",
    matchedProviderId: "web3auth",
    providerCategory: "identity",
    matchedBy: "id",
    status: "claim-listed",
  },
  boundaries: {
    identityVerification: "not-performed",
    claimAttestation: "not-performed",
    signatureVerification: "not-performed",
    oracleDispatch: "not-performed",
    providerCatalog: "metadata-only",
  },
  digest: "ab".repeat(32),
};

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    network: "mainnet",
    networkLabel: "Morpheus Mainnet",
    endpointLabel: "Host resolver + provider catalog",
    lastStatus: "Ready to resolve",
    lastError: "",
    lastDigest: "—",
    evidenceStatus: "Not resolved",
    registryStatus: "Not checked",
    providerCount: 0,
    requestCount: 0,
    isResolving: false,
    isCatalogLoading: false,
    storageHealthy: true,
    recoveryStatus: "",
    recoveryForm: {
      did: DID,
      provider: "web3auth",
      claim: "Web3Auth_PrimaryIdentity",
    },
    evidence: null,
    providerCatalog: null,
    registryProbe: null,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, createObservable(value)]),
  );
}

function appFile(file: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "oracle-neodid-console", file), "utf8");
}

describe("Oracle NeoDID Console resource-led PlayArea", () => {
  it("leads with the warm Oracle workspace and one foreground evidence object", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".neodid-console-stage__art")?.getAttribute("src"))
      .toContain("oracle-workspace-stage.webp");
    expect(container.querySelector(".neodid-evidence-pass")).toBeTruthy();
    expect(container.querySelector(".neodid-evidence-map")).toBeTruthy();
    expect(container.querySelectorAll(".neodid-evidence-map__list > div")).toHaveLength(4);
    expect(container.querySelector(".mx2-stage__scene input, .mx2-stage__scene select")).toBeNull();
    expect(container.textContent).toContain("Identity not verified");
  });

  it("makes Resolve DID immediately usable with a resolver-supported default", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Resolve DID" }));
    expect(dispatch).toHaveBeenCalledWith("resolveEvidence", {
      did: DID,
      provider: "web3auth",
      claim: "Web3Auth_PrimaryIdentity",
    });
  });

  it("keeps technical parameters in the secondary drawer and blocks an invalid DID", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ providerCatalog: CATALOG, providerCount: 1 })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Inspect details" }));
    const didInput = screen.getByLabelText("Morpheus NeoDID") as HTMLInputElement;
    fireEvent.change(didInput, { target: { value: "did:web:example.com" } });

    const primary = screen.getByRole("button", { name: "Resolve DID" }) as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    expect(screen.getByText(/Use a supported did:morpheus:neo_n3/)).toBeTruthy();
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalledWith("resolveEvidence", expect.anything());
  });

  it("shows exact evidence boundaries and exposes copy only after a matching result", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          evidence: EVIDENCE,
          providerCatalog: CATALOG,
          providerCount: 1,
          lastDigest: "ab12345678…12345678",
          registryProbe: EVIDENCE.registry,
          registryStatus: "Canonical deployment found",
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".neodid-evidence-pass")?.getAttribute("data-ready")).toBe("true");
    expect(container.textContent).toContain("Document returned — identity not verified");
    expect(container.textContent).toContain("Provider and claim listed");
    expect(container.textContent).toContain("Gateway declared in DID services");

    fireEvent.click(screen.getByRole("button", { name: "Copy evidence JSON" }));
    expect(dispatch).toHaveBeenCalledWith("copyEvidence");

    fireEvent.click(screen.getByRole("button", { name: "Inspect details" }));
    expect(screen.getAllByText("Not performed")).toHaveLength(4);
    expect(screen.getByTitle(EVIDENCE.digest)).toBeTruthy();
  });

  it("removes an expired snapshot from the active product surface", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const expired = {
      ...EVIDENCE,
      createdAt: "2000-01-01T00:00:00.000Z",
      expiresAt: "2000-01-01T00:15:00.000Z",
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ evidence: expired, providerCatalog: CATALOG, registryProbe: expired.registry })}
        dispatch={dispatch}
      />,
    );

    expect(dispatch).toHaveBeenCalledWith("expireEvidence");
    expect(container.querySelector(".neodid-evidence-pass")?.getAttribute("data-ready")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy evidence JSON" })).toBeNull();
  });

  it("uses scoped warm contrast, compact actions, responsive hierarchy, and reduced motion", () => {
    const styles = appFile("src/PlayArea.scss");
    const source = appFile("src/PlayArea.tsx");

    expect(styles).toMatch(/--mx2-stage-floor:\s*#faf9f7/);
    expect(styles).toMatch(/\.neodid-console-stage__art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.neodid-evidence-pass\s*\{[\s\S]*background:\s*rgba\(255, 253, 248, 0\.95\)/);
    expect(styles).toMatch(/\.mx2-btn--primary\s*\{[\s\S]*max-width:\s*188px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.neodid-evidence-map__list\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(source).toContain("oracle-workspace-stage.webp");
    expect(source).toContain('dispatchSafely("resolveEvidence", form)');
    expect(source).toContain(".catch(() => undefined)");
    expect(source).not.toMatch(/neodid-identity-stage|neodid-scene-art|useTransientFlag|callback/);
    expect(source).not.toContain("Preview Verification");
    expect(source).not.toMatch(/[⚡🎮🎲🔮]/u);
  });
});
