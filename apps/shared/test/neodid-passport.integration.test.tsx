import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neodid-passport/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) { return key; }

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries({
    network: "testnet",
    networkLabel: "Morpheus Testnet",
    lastStatus: "statusReady",
    lastDigest: "—",
    resolverStatus: "resolverNotCheckedStatus",
    runtimeStatus: "runtimeNotCheckedStatus",
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
    ...overrides,
  }).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

describe("neodid-passport integration: foreground actions", () => {
  it("dispatches the designed default review context without a legacy provider field", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildPassport", {
      subject: "did:morpheus:neo_n3:service:neodid",
      claim: "wallet-signature-context",
      audience: "miniapp-neodid-passport",
    }));
  });

  it("keeps exact raw fields secondary and disables an incomplete draft", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const claimInput = container.querySelectorAll<HTMLInputElement>(".did-drawer__field input")[1];
    fireEvent.change(claimInput, { target: { value: "" } });

    expect(primary?.disabled).toBe(true);
    fireEvent.click(primary as Element);
    await waitFor(() => expect(dispatch).not.toHaveBeenCalled());
  });

  it("dispatches the selected review template as the primary product choice", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelectorAll(".did-template-deck button")[2]);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildPassport", {
      subject: "did:morpheus:neo_n3:service:neodid",
      claim: "developer-context",
      audience: "miniapp-oracle-services",
    }));
  });

  it("applies UTF-8 byte limits before readiness and never cuts a multibyte symbol", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const claimInput = container.querySelectorAll<HTMLInputElement>(".did-drawer__field input")[1];

    fireEvent.change(claimInput, { target: { value: "你".repeat(40) } });

    expect(claimInput.value).toBe("你".repeat(32));
    expect(new TextEncoder().encode(claimInput.value)).toHaveLength(96);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.disabled).toBe(false);
    fireEvent.click(primary as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildPassport", {
      subject: "did:morpheus:neo_n3:service:neodid",
      claim: "你".repeat(32),
      audience: "miniapp-neodid-passport",
    }));
  });
});
