import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../timestamp-proof/src/PlayArea";
import type { TimestampProof } from "../../timestamp-proof/src/composables/useTimestampProof";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const proof: TimestampProof = {
  id: 3,
  content: "release-notes.pdf v1.2.0",
  contentHash: "7f83b1657ff1fc53b92dc18148a1d65dfa13583b2d4f4f6bdad4f3f4f7c2e6aa",
  timestamp: 1780300000000,
  creator: "local",
  txHash: "local:7f83b1657ff1fc53",
};

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Timestamp Proof",
    docSubtitle: "Device-local SHA-256 proof journal",
    totalProofs: "Total Proofs",
    yourProofs: "Your Proofs",
    latestProof: "Latest proof",
    latestId: "Latest ID",
    localOnlyLabel: "Saved locally",
    hashAlgorithm: "Hash",
    proofWorkspace: "Timestamp proof workspace",
    createProof: "Create Proof",
    creating: "Creating...",
    enterContent: "Enter content to timestamp",
    contentPlaceholder: "Paste text, a document hash, or a release note...",
    verifyProof: "Verify Proof",
    verifying: "Verifying...",
    proofLookup: "Proof lookup",
    verifyPlaceholder: "Proof ID, SHA-256 digest, or original content",
    validProof: "Proof Found",
    invalidProof: "Invalid Proof",
    verifyEmpty: "No proof selected",
    proofDigest: "SHA-256 digest",
    timestamp: "Timestamp",
    contentPreview: "Content preview",
    recentProofs: "Recent Proofs",
    proofs: "Proofs",
    clearAllProofs: "Clear all",
    noProofs: "No proofs yet",
    noProofsHint: "Saved proof entries will appear here.",
    localReference: "Local reference",
    creatorLabel: "Creator",
    sourceLocal: "Local",
    copyDigest: "Copy digest",
    copyReference: "Copy proof reference",
    deleteProof: "Delete proof",
    verify: "Verify",
    notAvailable: "N/A",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    totalProofs: 1,
    yourProofs: 1,
    isCreating: false,
    isVerifying: false,
    proofs: [proof],
    verifiedProof: proof,
    verifyError: false,
    latestId: "#3",
    lastMessage: "",
    lastMessageType: "info",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Timestamp Proof PlayArea", () => {
  it("exposes create, verify, copy, delete, and clear proof actions", () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(screen.getByText("Timestamp Proof")).toBeTruthy();
    expect(screen.getByText("Recent Proofs")).toBeTruthy();
    expect(screen.getByText("Proof Found")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Enter content to timestamp"), {
      target: { value: "audit artifact" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Proof" }));
    expect(dispatch).toHaveBeenCalledWith("createProof", "audit artifact");

    fireEvent.change(screen.getByLabelText("Proof lookup"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Proof" }));
    expect(dispatch).toHaveBeenCalledWith("verifyProof", "3");

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(dispatch).toHaveBeenCalledWith("verifyProof", "3");

    fireEvent.click(screen.getByRole("button", { name: "Copy digest" }));
    expect(dispatch).toHaveBeenCalledWith("copyProofDigest", 3);

    fireEvent.click(screen.getByRole("button", { name: "Copy proof reference" }));
    expect(dispatch).toHaveBeenCalledWith("copyProofReference", 3);

    fireEvent.click(screen.getByRole("button", { name: "Delete proof" }));
    expect(dispatch).toHaveBeenCalledWith("deleteProof", 3);

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(dispatch).toHaveBeenCalledWith("clearProofs");
  });

  it("does not render blockchain anchoring promises for the local proof flow", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ proofs: [], verifiedProof: null, totalProofs: 0 })} dispatch={vi.fn()} />,
    );

    expect(container.textContent).not.toContain("Anchor timestamp");
    expect(container.textContent).not.toContain("Record block");
    expect(container.textContent).not.toContain("contractMissing");
  });
});
