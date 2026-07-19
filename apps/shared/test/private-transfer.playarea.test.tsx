import React from "react";
import fs from "node:fs";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../private-transfer/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults = {
    networkState: "ready",
    oracleState: "ready",
    storageState: "unknown",
    phase: "draft",
    networkLabel: "networkTestnet",
    lastStoredAt: 0,
  };
  return Object.fromEntries(Object.entries({ ...defaults, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

function source() {
  return fs.readFileSync(`${process.cwd()}/../private-transfer/src/PlayArea.tsx`, "utf8") as string;
}

function stylesheet() {
  return fs.readFileSync(`${process.cwd()}/../private-transfer/src/PlayArea.scss`, "utf8") as string;
}

describe("private-transfer privacy airlock", () => {
  it("renders one primary privacy workflow with truthful downstream boundaries", () => {
    const { container } = render(<PlayArea t={t} state={state({
      phase: "stored",
      storageState: "stored",
      requestCount: 1,
      lastDigest: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      lastSecretRef: "secret-ref-1234567890",
      lastNullifier: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      oracleContract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
    })} dispatch={vi.fn()} />);

    expect(container.querySelector(".pt-airlock")).toBeTruthy();
    expect(container.querySelector(".pt-visual__art img")?.getAttribute("src")).toContain("private-transfer-stage.webp");
    expect(container.querySelectorAll(".pt-route__step")).toHaveLength(4);
    expect(container.querySelector('.pt-route__step[data-state="outside"]')?.textContent).toContain("routeTeeTitle");
    expect(container.querySelector(".pt-service-strip")).toBeTruthy();
    expect(container.querySelector(".pt-composer")).toBeTruthy();
    expect(container.querySelector(".pt-boundary")?.textContent).toContain("boundaryTitle");
    expect(container.querySelector(".pt-primary-action")).toBeTruthy();
    expect(container.querySelectorAll(".pt-amount-input, .pt-recipient-input")).toHaveLength(2);
    expect(container.textContent).not.toMatch(/TEE verified|🔒|🔓|🔑/i);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".pt-drawer__memo")).toBeTruthy();
    expect(container.querySelectorAll(".pt-drawer__panel")).toHaveLength(4);
    expect(container.querySelector(".pt-drawer")?.textContent).toContain("privacyNotVerifiedValue");
    expect(container.querySelector(".pt-drawer")?.textContent).toContain("walletNotRequested");
  });

  it("keeps the generated privacy-airlock hierarchy, motion guard, and short-screen layout", () => {
    const s = stylesheet();
    const playAreaSource = source();
    const config = fs.readFileSync(`${process.cwd()}/../private-transfer/src/appConfig.ts`, "utf8");

    expect(playAreaSource).toContain('@shared/components-react/v2/PlayStage');
    expect(playAreaSource).not.toContain('@shared/components-react/v2"');
    expect(playAreaSource).toContain('type="radio"');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.private-transfer-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#fff/);
    expect(s).toMatch(/\.pt-airlock\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.48fr\) minmax\(330px,\s*0\.82fr\)/);
    expect(s).toMatch(/\.pt-route\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,/);
    expect(s).toMatch(/\.pt-service-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/);
    expect(s).toMatch(/\.pt-primary-action\s*\{[\s\S]*width:\s*min\(100%,\s*260px\)/);
    expect(s).toMatch(/@media \(max-width:\s*760px\)[\s\S]*\.pt-composer\s*\{\s*order:\s*1/);
    expect(s).toMatch(/@media \(max-width:\s*760px\) and \(max-height:\s*700px\)/);
    expect(config).not.toContain('feature2Name: { en: "TEE Verified"');
    expect(config).toContain("TEE execution, settlement, payment, anonymity");
  });

  it("rejects fractional NEO without silently rewriting the user's amount", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    const assetGroup = container.querySelector(".pt-asset-switch") as HTMLElement;
    fireEvent.click(within(assetGroup).getByRole("radio", { name: /NEO/ }));
    const amountInput = container.querySelector<HTMLInputElement>("input[placeholder='1']");
    expect(amountInput?.inputMode).toBe("numeric");
    fireEvent.change(amountInput as HTMLInputElement, { target: { value: "12.75" } });

    expect(amountInput?.value).toBe("12.75");
    expect(amountInput?.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".pt-amount-slot")?.textContent).toContain("NEO");
    expect((container.querySelector(".pt-primary-action") as HTMLButtonElement).disabled).toBe(true);
  });

  it("connects inline validation copy to both private inputs", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const amount = container.querySelector<HTMLInputElement>(".pt-amount-input")!;
    const recipient = container.querySelector<HTMLInputElement>(".pt-recipient-input")!;

    fireEvent.change(amount, { target: { value: "0" } });
    fireEvent.change(recipient, { target: { value: "Ninvalid" } });

    expect(amount.getAttribute("aria-invalid")).toBe("true");
    expect(amount.getAttribute("aria-describedby")).toBe("pt-amount-help");
    expect(recipient.getAttribute("aria-invalid")).toBe("true");
    expect(recipient.getAttribute("aria-describedby")).toBe("pt-recipient-help");
    expect(container.querySelector("#pt-amount-help")?.textContent).toContain("errorInvalidAmount");
    expect(container.querySelector("#pt-recipient-help")?.textContent).toContain("errorInvalidAddress");
  });

  it("clears private drafts only after a stored secret reference is confirmed", async () => {
    const appState = state();
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn()} />);
    const amount = container.querySelector<HTMLInputElement>(".pt-amount-input")!;
    const recipient = container.querySelector<HTMLInputElement>(".pt-recipient-input")!;
    fireEvent.change(amount, { target: { value: "1.25" } });
    fireEvent.change(recipient, { target: { value: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32" } });
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const memo = container.querySelector<HTMLInputElement>(".pt-drawer__memo input")!;
    fireEvent.change(memo, { target: { value: "private draft" } });

    expect(amount.value).toBe("1.25");
    expect(recipient.value).toContain("NR3E4");
    expect(memo.value).toBe("private draft");

    act(() => {
      (appState.lastStoredAt as { set(value: number): void }).set(1_750_000_000_000);
    });
    await waitFor(() => {
      expect(amount.value).toBe("");
      expect(recipient.value).toBe("");
      expect(memo.value).toBe("");
    });
  });

  it("surfaces an exact ciphertext recovery action without claiming success", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({
      phase: "recovery",
      storageState: "recoverable",
      hasPending: true,
      pendingCommitment: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      pendingAsset: "GAS",
      pendingAttempts: 2,
    })} dispatch={dispatch} />);

    expect(container.querySelector(".pt-recovery")?.textContent).toContain("pendingTitle");
    expect(container.querySelector('.pt-route__step[data-state="warning"]')).toBeTruthy();
    const recovery = within(container.querySelector(".pt-recovery") as HTMLElement);
    fireEvent.click(recovery.getByRole("button", { name: /pendingRetry/ }));
    expect(dispatch).toHaveBeenCalledWith("retryPending");

    const discard = recovery.getByRole("button", { name: /pendingDiscard/ });
    expect(discard.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(discard);
    expect(dispatch).not.toHaveBeenCalledWith("discardPending");
    expect(discard.textContent).toContain("pendingDiscardConfirm");
    expect(discard.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(discard);
    expect(dispatch).toHaveBeenCalledWith("discardPending");
    expect((container.querySelector(".pt-primary-action") as HTMLButtonElement).disabled).toBe(true);
  });

  it("invites a connect instead of declaring the sealing lane broken outside a host", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({
      phase: "draft",
      networkState: "ready",
      oracleState: "awaiting-context",
    })} dispatch={dispatch} />);

    // No red "lane is not ready" block, and the Oracle chip reads as pending.
    expect(container.querySelector(".pt-runtime-block--awaiting")).toBeTruthy();
    expect(container.textContent).not.toContain("statusRuntimeUnavailable");
    expect(container.textContent).not.toContain("serviceOracleBlocked");
    expect(container.textContent).toContain("serviceOracleAwaiting");
    const oracleChip = container.querySelectorAll(".pt-service-strip > div")[1];
    expect(oracleChip.getAttribute("data-tone")).toBe("checking");

    // The primary CTA must be live and move the visitor forward, not sit dead.
    const cta = container.querySelector(".pt-primary-action") as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    expect(cta.textContent).toContain("connectCta");
    fireEvent.click(cta);
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("keeps recovery storage fail-closed until the testnet Oracle lane is ready", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({
      phase: "recovery",
      networkState: "ready",
      oracleState: "unavailable",
      storageState: "recoverable",
      hasPending: true,
      pendingCommitment: `0x${"12".repeat(32)}`,
      pendingAsset: "GAS",
      pendingAttempts: 1,
    })} dispatch={dispatch} />);

    const retry = within(container.querySelector(".pt-recovery") as HTMLElement)
      .getByRole("button", { name: /pendingRetry/ });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(retry);
    expect(dispatch).not.toHaveBeenCalledWith("retryPending");

    fireEvent.click(within(container).getByRole("button", { name: /retryRuntime/ }));
    expect(dispatch).toHaveBeenCalledWith("refreshRuntime");
  });
});
