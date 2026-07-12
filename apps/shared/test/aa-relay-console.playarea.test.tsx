import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import { getExternalIntegrationConfig } from "../constants/rpc";
import PlayArea from "../../aa-relay-console/src/PlayArea";
import { draftFingerprint } from "../../aa-relay-console/src/relay-job";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const CORE = getExternalIntegrationConfig("mainnet").contracts.aaCore;
const PAYMASTER = getExternalIntegrationConfig("mainnet").contracts.aaPaymaster;
const ACCOUNT = `0x${"11".repeat(20)}`;
const TARGET = `0x${"22".repeat(20)}`;

function t(key: string) {
  return key;
}

function validPayload() {
  return JSON.stringify({
    metaInvocation: {
      scriptHash: CORE,
      operation: "executeUserOp",
      args: [
        { type: "Hash160", value: "$AA_ACCOUNT" },
        {
          type: "Struct",
          value: [
            { type: "Hash160", value: TARGET },
            { type: "String", value: "transfer" },
            { type: "Array", value: [] },
            { type: "Integer", value: "0" },
            { type: "Integer", value: String(Date.now() + 600_000) },
            { type: "ByteArray", value: "aabb" },
          ],
        },
      ],
    },
  }, null, 2);
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const base = {
    aaAddressInput: ACCOUNT,
    dappIdInput: "miniapp-aa-relay-console",
    payloadInput: validPayload(),
    reviewPackageJson: "",
    reviewJobId: "",
    reviewDigest: "",
    reviewReadiness: "draft",
    previewState: "not-run",
    targetDisplay: "",
    methodDisplay: "",
    preparedFingerprint: "",
    sponsorState: "not-checked",
    sponsorSummary: "sponsorNotChecked",
    relayReceiptJson: "",
    receiptStatus: "none",
    txidDisplay: "",
    chainStatus: "not-tracked",
    chainReason: "receiptNotTracked",
    confirmationsDisplay: "0",
    aaCoreDisplay: CORE,
    paymasterDisplay: PAYMASTER,
    networkDisplay: "mainnet",
    runtimeMode: "review-only",
    hasReview: false,
    hasReceipt: false,
    hasTrackableReceipt: false,
    isPreparing: false,
    isCheckingSponsorship: false,
    isTracking: false,
    ...values,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

function source(app: string, file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src", file), "utf8");
}

describe("AA Relay Console product surface", () => {
  it("renders a resource-led job lifecycle instead of a primary parameter form", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".aa-relay-scene__art")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".aa-relay-scene__art img")?.getAttribute("src"))
      .toBe("aa-relay-station.webp");
    expect(container.querySelectorAll(".aa-relay-scene__steps article")).toHaveLength(4);
    expect(container.querySelector(".aa-relay-scene__route")).toBeTruthy();
    expect(container.querySelector(".aa-relay-scene__status")).toBeTruthy();
    expect(container.textContent).toContain("review-only");
    expect(container.textContent).not.toContain("Submit Relay Payload");
    expect(container.textContent).not.toMatch(/[📡⛽🚀]/u);
    expect((screen.getByRole("button", { name: "prepareReview" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps one primary state action and prepares the exact current draft", () => {
    const payload = validPayload();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ payloadInput: payload })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "prepareReview" }));
    expect(dispatch).toHaveBeenCalledWith(
      "prepareReview",
      ACCOUNT,
      "miniapp-aa-relay-console",
      payload,
    );
    expect((screen.getByRole("button", { name: "checkSponsorEvidence" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves advanced JSON and receipt import into the secondary workspace", () => {
    const payload = validPayload();
    const fingerprint = draftFingerprint(ACCOUNT, "miniapp-aa-relay-console", payload);
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea
      t={t}
      state={state({
        payloadInput: payload,
        hasReview: true,
        reviewJobId: "aa-123456789abc",
        reviewDigest: `0x${"aa".repeat(32)}`,
        reviewReadiness: "review-ready",
        reviewPackageJson: "{\"kind\":\"aa-relay-review-package\"}",
        preparedFingerprint: fingerprint,
      })}
      dispatch={dispatch}
    />);

    fireEvent.click(screen.getByRole("button", { name: "openJobWorkspace" }));
    expect(container.querySelector(".aa-relay-drawer__tab-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".aa-relay-drawer__tab-group .semi-radio")).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "advancedCallData" })).toBeTruthy();

    fireEvent.click(container.querySelectorAll(".aa-relay-drawer__tab-group .semi-radio")[2] as Element);
    const receipt = screen.getByRole("textbox", { name: "receiptJson" });
    fireEvent.change(receipt, { target: { value: "{\"network\":\"mainnet\"}" } });
    fireEvent.click(screen.getByRole("button", { name: "importReceipt" }));
    expect(dispatch).toHaveBeenCalledWith("importReceipt", "{\"network\":\"mainnet\"}");
  });

  it("promotes on-chain tracking to the primary action only after a bound txid exists", () => {
    const payload = validPayload();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea
      t={t}
      state={state({
        payloadInput: payload,
        hasReview: true,
        hasReceipt: true,
        hasTrackableReceipt: true,
        txidDisplay: `0x${"ab".repeat(32)}`,
        receiptStatus: "broadcast",
        preparedFingerprint: draftFingerprint(ACCOUNT, "miniapp-aa-relay-console", payload),
        reviewReadiness: "review-ready",
        chainStatus: "pending",
      })}
      dispatch={dispatch}
    />);

    fireEvent.click(screen.getByRole("button", { name: "trackReceipt" }));
    expect(dispatch).toHaveBeenCalledWith("trackReceipt");
    expect(screen.queryByRole("button", { name: "prepareReview" })).toBeNull();
  });

  it("uses the warm shared design system with responsive and reduced-motion guards", () => {
    const styles = source("aa-relay-console", "PlayArea.scss");
    const playArea = source("aa-relay-console", "PlayArea.tsx");

    expect(styles).toMatch(/\.aa-relay-scene\s*\{[\s\S]*background:\s*#fffdf8/);
    expect(styles).toMatch(/\.aa-relay-scene__workspace\s*\{[\s\S]*grid-template-columns/);
    expect(styles).toMatch(/\.aa-relay-scene__art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/@media \(max-width:\s*620px\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(styles).not.toMatch(/background-image:\s*url|aa-relay-scene-art/);
    expect(playArea).toContain("CoinArt");
    expect(playArea).toContain('variant="gas"');
    expect(playArea).not.toContain("submitRelay");
    expect(playArea).not.toContain("requestSponsor");
  });
});
