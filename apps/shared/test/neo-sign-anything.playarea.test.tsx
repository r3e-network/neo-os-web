import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-sign-anything/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  if (!params) return key;
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(`{${name}}`, String(value)),
    key,
  );
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function appPath(file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, "neo-sign-anything", file);
}

describe("neo-sign-anything PlayArea", () => {
  it("renders a foreground-led signing document and real scene resource", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          network: "neo-n3-mainnet",
          message: "release statement",
          payloadText: "neo-sign-anything:v1\n\nrelease statement",
          payloadHash: "a".repeat(64),
          payloadBytes: 48,
          payloadStatus: "ready",
          signingMode: "bound",
          signingDomain: "neo-sign-anything",
          historyStorageHealthy: true,
        })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(container.querySelector(".sign-desk")).toBeTruthy();
    expect(container.querySelector(".sign-desk__paper")).toBeTruthy();
    expect(container.querySelector(".sign-desk__payload-card pre")?.textContent)
      .toContain("neo-sign-anything:v1");
    expect(container.querySelector(".sign-desk__digest code")?.textContent).toBe("a".repeat(64));
    const image = container.querySelector(".sign-desk__photo img") as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.src).toContain("signature-desk.webp");
    expect(image.alt).toBe("deskImageAlt");
  });

  it("keeps one primary sign action and demotes file, encoding, proof, and history", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
          network: "neo-n3-mainnet",
          message: "sign me",
          payloadText: "sign me",
          payloadHash: "b".repeat(64),
          payloadBytes: 7,
          payloadStatus: "ready",
          signingMode: "bound",
          signingDomain: "neo-sign-anything",
          historyStorageHealthy: true,
        })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(container.querySelectorAll(".mx2-action-rail__row .mx2-btn--primary")).toHaveLength(1);
    expect(container.querySelectorAll(".mx2-action-rail__row .mx2-btn--ghost")).toHaveLength(2);
    expect(container.textContent).not.toContain("broadcast");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    expect(container.querySelectorAll(".sign-details__tabs [role='tab']")).toHaveLength(3);
    expect(container.querySelector(".sign-details__panel--proof.mx2-open-panel.semi-card")).toBeTruthy();

    fireEvent.click(container.querySelectorAll(".sign-details__tabs [role='tab']")[1]);
    expect(container.querySelector(".sign-details__panel--encoding")).toBeTruthy();
    expect(container.querySelector(".sign-details__mode-control [role='radiogroup']")).toBeTruthy();
    expect(container.querySelector(".sign-details__domain-field input")).toBeTruthy();

    fireEvent.click(container.querySelectorAll(".sign-details__tabs [role='tab']")[2]);
    expect(container.querySelector(".sign-details__panel--history")).toBeTruthy();
  });

  it("shows a wallet-returned assurance label instead of claiming local verification", () => {
    const proof = {
      schema: "neo-sign-anything-proof:v1",
      createdAt: "2026-07-11T00:00:00.000Z",
      signer: { address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", network: "neo-n3-mainnet", binding: "signed-envelope" },
      payload: {
        mode: "bound",
        kind: "text",
        domain: "neo-sign-anything",
        encoding: "utf-8",
        exactText: "payload",
        bytes: 7,
        sha256: "c".repeat(64),
        contentSha256: "d".repeat(64),
        file: null,
      },
      signature: { value: `0x${"11".repeat(64)}`, encoding: "hex", publicKey: null },
      assurance: { status: "wallet-returned", cryptographicallyVerifiedHere: false },
    } as const;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: proof.signer.address,
          network: proof.signer.network,
          message: "payload",
          payloadText: "payload",
          payloadHash: proof.payload.sha256,
          payloadBytes: 7,
          payloadStatus: "ready",
          signingMode: "bound",
          signingDomain: "neo-sign-anything",
          signature: proof.signature.value,
          signatureEncoding: "hex",
          artifact: proof,
          proofBundle: JSON.stringify(proof),
          historyStorageHealthy: true,
        })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    expect(container.querySelector(".sign-details__notice")?.textContent).toContain("boundAssuranceTitle");
    expect(container.textContent).not.toContain("cryptographically verified");
  });

  it("labels exact-mode account and network as observed context rather than signed claims", () => {
    const proof = {
      schema: "neo-sign-anything-proof:v1",
      createdAt: "2026-07-11T00:00:00.000Z",
      signer: { address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", network: "neo-n3-testnet", binding: "observed-request-context" },
      payload: {
        mode: "exact",
        kind: "text",
        domain: null,
        encoding: "utf-8",
        exactText: "challenge",
        bytes: 9,
        sha256: "e".repeat(64),
        contentSha256: "e".repeat(64),
        file: null,
      },
      signature: { value: `0x${"22".repeat(64)}`, encoding: "hex", publicKey: null },
      assurance: { status: "wallet-returned", cryptographicallyVerifiedHere: false },
    } as const;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: proof.signer.address,
          network: proof.signer.network,
          message: "challenge",
          payloadText: "challenge",
          payloadHash: proof.payload.sha256,
          payloadBytes: 9,
          payloadStatus: "ready",
          signingMode: "exact",
          signingDomain: "neo-sign-anything",
          signature: proof.signature.value,
          signatureEncoding: "hex",
          artifact: proof,
          proofBundle: JSON.stringify(proof),
          historyStorageHealthy: true,
        })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    expect(container.querySelector(".sign-details__notice")?.textContent).toContain("exactAssuranceTitle");
  });

  it("uses semantic OpenUiLite controls and avoids the heavy OpenUi runtime", () => {
    const source = readFileSync(appPath("src/PlayArea.tsx"), "utf8");
    expect(source).toContain("@shared/components-react/v2/OpenUiLite");
    expect(source).not.toContain('from "@shared/components-react/v2"');
    expect(source).toContain("OpenUiTextArea");
    expect(source).toContain("OpenUiSegmented");
  });

  it("publishes a sign-only manifest with no transaction or fake chain-state claims", () => {
    const manifest = JSON.parse(readFileSync(appPath("neo-manifest.json"), "utf8")) as {
      version: string;
      supported_networks: string[];
      permissions: string[];
      features: { stateless: boolean };
      platform: { transactions: boolean };
    };
    const packageJson = JSON.parse(readFileSync(appPath("package.json"), "utf8")) as { version: string };
    const mainSource = readFileSync(appPath("src/main.tsx"), "utf8");
    const domainSource = readFileSync(appPath("src/composables/useSignAnything.ts"), "utf8");
    const internalManifest = readFileSync(appPath("src/manifest.ts"), "utf8");

    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.supported_networks).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    expect(manifest.permissions).toEqual(["wallet:sign-message"]);
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.platform.transactions).toBe(false);
    expect(mainSource).not.toContain("broadcastMessage");
    expect(domainSource).not.toContain("app.chain.invoke");
    expect(internalManifest).toContain("tabs: []");
    expect(internalManifest).toContain("stats: []");
    expect(internalManifest).toContain("permissions: { storage: true }");
    expect(internalManifest).not.toContain("contract:");
  });

  it("keeps high-contrast white foregrounds, bounded controls, responsive layout, and reduced motion", () => {
    const styles = readFileSync(appPath("src/PlayArea.scss"), "utf8");
    expect(styles).toMatch(/\.sign-desk\s*\{[\s\S]*background:\s*#fffefa/);
    expect(styles).toMatch(/\.sign-desk__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(390px,\s*1\.16fr\) minmax\(290px,\s*0\.84fr\)/);
    expect(styles).toMatch(/\.sign-desk__paper,[\s\S]*\.sign-desk__proof\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.sign-desk__message-field textarea\.semi-input-textarea\s*\{[\s\S]*min-height:\s*84px/);
    expect(styles).toMatch(/\.sign-desk__payload-card pre\s*\{[\s\S]*max-height:\s*76px/);
    expect(styles).toMatch(/\.tool-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 172px/);
    expect(styles).toMatch(/\.sign-details__tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*760px\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(styles).toMatch(/0\.001ms/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toMatch(/repeating-linear-gradient/);
  });
});
