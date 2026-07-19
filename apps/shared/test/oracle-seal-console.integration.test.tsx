import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-seal-console/src/PlayArea";
import { messages } from "../../oracle-seal-console/src/appConfig";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

type LocalizedMessage = { en: string; zh: string };
const localized = messages as Record<string, LocalizedMessage>;
function t(key: string, params: Record<string, string | number> = {}) {
  let value = localized[key]?.en ?? key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    networkLabel: "Neo N3 Testnet",
    runtimeState: "ready",
    runtimeStateLabel: "Contract key verified",
    phase: "draft",
    lastStatus: "Ready",
    lastFingerprint: "—",
    lastSecretRef: "",
    lastContract: "",
    lastAlgorithm: "",
    lastStoredAt: 0,
    sealCount: 0,
    isBusy: false,
    storageReady: true,
    hasPending: false,
    pendingStored: false,
    pendingMalformed: false,
    pendingFingerprint: "",
    pendingSecretRef: "",
    pendingAttempts: 0,
    pendingCreatedAt: 0,
    pendingPurpose: "",
    pendingPublicRoute: "",
    keyContract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function openDrawer(container: HTMLElement) {
  fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
}

describe("oracle-seal-console interaction", () => {
  it("dispatches the reviewed object through one seal action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    openDrawer(container);

    fireEvent.change(getByRole("textbox", { name: "Public route" }), {
      target: { value: "oracle://policy/check" },
    });
    fireEvent.change(getByRole("textbox", { name: "Confidential JSON" }), {
      target: { value: "{ \"account\": \"private\", \"limit\": 7 }" },
    });
    fireEvent.click(getByRole("button", { name: "Seal & store ciphertext" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("sealPayload", {
      purpose: "oracle-input",
      publicRoute: "oracle://policy/check",
      payload: "{ \"account\": \"private\", \"limit\": 7 }",
    }));
  });

  it("does not dispatch malformed JSON as a seal request", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    openDrawer(container);
    fireEvent.change(getByRole("textbox", { name: "Confidential JSON" }), {
      target: { value: "{ invalid" },
    });
    const primary = getByRole("button", { name: "Seal & store ciphertext" }) as HTMLButtonElement;
    expect(primary.disabled).toBe(true);
    fireEvent.click(primary);
    expect(dispatch).not.toHaveBeenCalledWith("sealPayload", expect.anything());
  });

  it("keeps rejected action promises handled after the status layer reports the failure", async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error("store unavailable"));
    const { container, getByRole } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} />,
    );
    openDrawer(container);
    fireEvent.change(getByRole("textbox", { name: "Confidential JSON" }), {
      target: { value: "{\"threshold\":7}" },
    });
    fireEvent.click(getByRole("button", { name: "Seal & store ciphertext" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
  });

  it("routes recovery to exact retry and requires a second click to discard", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(
      <PlayArea
        t={t}
        state={state({
          runtimeState: "unavailable",
          runtimeStateLabel: "Ciphertext recoverable",
          phase: "recovery",
          hasPending: true,
          pendingFingerprint: `0x${"ab".repeat(32)}`,
          pendingAttempts: 1,
          pendingCreatedAt: Date.now(),
          pendingPurpose: "private-compute",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Retry exact ciphertext" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("retryPending"));

    openDrawer(container);
    const discard = await waitFor(() => getByRole("button", { name: "Discard ciphertext" }));
    fireEvent.click(discard);
    expect(dispatch).not.toHaveBeenCalledWith("discardPending");
    fireEvent.click(getByRole("button", { name: "Confirm discard" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("discardPending"));
  });

  it("finalizes a returned receipt locally instead of labeling it as another store retry", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PlayArea
        t={t}
        state={state({
          phase: "recovery",
          hasPending: true,
          pendingStored: true,
          pendingFingerprint: `0x${"cd".repeat(32)}`,
          pendingSecretRef: "stored-reference",
          pendingAttempts: 1,
          pendingCreatedAt: Date.now(),
          pendingPurpose: "oracle-input",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Finish receipt cleanup" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("retryPending"));
    expect(getByRole("button", { name: "Finish receipt cleanup" }).textContent)
      .not.toContain("Retry exact ciphertext");
  });

  it("requires confirmation before clearing an unreadable local recovery record", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PlayArea
        t={t}
        state={state({
          runtimeState: "unavailable",
          phase: "recovery",
          hasPending: true,
          pendingMalformed: true,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Clear unreadable recovery" }));
    expect(dispatch).not.toHaveBeenCalledWith("discardPending");
    fireEvent.click(getByRole("button", { name: "Confirm recovery cleanup" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("discardPending"));
  });
});
