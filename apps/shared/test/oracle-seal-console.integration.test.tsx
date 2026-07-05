import React from "react";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-seal-console/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    statusReady: "Ready",
    digestPlaceholder: "-",
    panelTitle: "Request Envelope Reference Builder",
    panelEyebrow: "Oracle request envelope reference",
    sealHeroCopy: "Prepare a plain reference envelope.",
    sealComposerTitle: "Reference package",
    sealPlan: "Reference plan",
    sealValidationReady: "Reference ready",
    sealPayloadStateInvalid: "Needs repair",
    sealPurposeTitle: "Envelope purpose",
    purposeInput: "Oracle input",
    purposeInputHint: "Reference data intended for an oracle request.",
    purposeCallback: "Callback secret",
    purposeCallbackHint: "Route-bound value, still not encrypted here.",
    purposeAttestation: "Attestation",
    purposeAttestationHint: "Package claim metadata for later review.",
    sealRecipientTitle: "Recipient or route",
    recipientPlaceholder: "Enter recipient or oracle route",
    sealPayloadTitle: "Payload reference",
    payloadPlaceholder: "Paste JSON",
    sealPayloadStateReady: "Valid JSON",
    payloadReadyHint: "JSON is valid.",
    payloadInvalidHint: "Fix JSON.",
    sealPayloadChars: "{count} chars",
    sealStageTitle: "Envelope workbench",
    sealReferenceOnly: "Reference only",
    purpose: "Purpose",
    recipient: "Recipient",
    statDigest: "Checksum",
    sealEmptyTitle: "Build a reference receipt",
    protectionValue: "Not encrypted - reference checksum only",
    sealProtectionCopy: "Checksum reference only.",
    sealReceipt: "Envelope receipt",
    sealEmptyCopy: "The receipt will show protection truth.",
    sealFlowTitle: "Envelope reference flow",
    sealFlowPlain: "Plain reference",
    sealFlowPlainDesc: "Checksum only, no encryption.",
    sealFlowRoute: "Route context",
    sealFlowRouteDesc: "Purpose and recipient bind the preview.",
    sealFlowChecksum: "Checksum receipt",
    sealFlowChecksumDesc: "Copy metadata for downstream review.",
    statRequests: "Envelopes",
    lastStatus: "Last Status",
    statEndpoint: "Mode",
    runAction: "Build Reference",
    reset: "Reset",
    sealBuildActionActive: "Building Reference",
    payloadValid: "Payload is valid JSON",
    protectionLabel: "Protection",
    yes: "Yes",
    no: "No",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    networkLabel: "Morpheus Mainnet",
    endpointLabel: "Envelope reference",
    lastStatus: "Ready",
    lastDigest: "-",
    requestCount: 0,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function openSourceDrawer(container: HTMLElement, getByRole: ReturnType<typeof render>["getByRole"]) {
  fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
  fireEvent.click(within(container.querySelector(".seal-drawer__switcher") as HTMLElement).getByRole("radio", { name: /Reference package/ }));
  getByRole("region", { name: /Reference package/ });
}

describe("oracle-seal-console integration", () => {
  it("dispatches a buildRequest with the composed envelope fields", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    openSourceDrawer(container, getByRole);
    fireEvent.change(getByRole("textbox", { name: "Recipient or route" }), {
      target: { value: "oracle://prices/gas-usd" },
    });
    fireEvent.change(getByRole("textbox", { name: "Payload reference" }), {
      target: { value: "{ \"asset\": \"GAS\", \"ttl\": 30 }" },
    });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildRequest", {
      purpose: "oracle-input",
      recipient: "oracle://prices/gas-usd",
      payload: "{ \"asset\": \"GAS\", \"ttl\": 30 }",
    }));
  });

  it("keeps invalid JSON visible in the same foreground validation surface", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    openSourceDrawer(container, getByRole);
    fireEvent.change(getByRole("textbox", { name: "Payload reference" }), {
      target: { value: "{ invalid" },
    });

    expect(container.querySelector(".seal-validation")?.textContent).toContain("Needs repair");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      payload: "{ invalid",
    })));
  });
});
