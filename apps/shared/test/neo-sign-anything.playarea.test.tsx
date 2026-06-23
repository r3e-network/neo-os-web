import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-sign-anything/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    signHeroTitle: "Neo Signature Desk",
    signHeroKicker: "Wallet-reviewed proof desk",
    signHeroSubtitle: "Prepare a message and request a wallet signature.",
    signStageKicker: "Signature desk",
    signStageTitle: "Review the payload, approve it in wallet, then keep the proof.",
    signCount: "Signed",
    broadcastCount: "Posted",
    signFlowTitle: "Signature flow",
    signFlowStepOne: "Write message",
    signFlowStepOneCopy: "Keep it short.",
    signFlowStepTwo: "Wallet review",
    signFlowStepTwoCopy: "Approve in wallet.",
    signFlowStepThree: "Copy proof",
    signFlowStepThreeCopy: "Copy the evidence.",
    signatureDeskTitle: "Message composer",
    messagePreviewLabel: "Message signing preview",
    messagePreviewEmptyTitle: "Ready for a message",
    messagePreviewEmpty: "Your message preview will appear here.",
    messageTypePlain: "Message payload",
    messageTypeDigest: "File digest",
    messageBytesLabel: "Message bytes",
    bytesUnit: "bytes",
    walletAddress: "Wallet",
    disconnected: "Disconnected",
    walletPrompt: "Review",
    ready: "Ready",
    awaitingSignature: "Waiting",
    messageLabel: "Message",
    messagePlaceholder: "Enter your message here...",
    messageTemplateLabel: "Message starters",
    templateReleaseLabel: "Release proof",
    templateReleaseBody: "I confirm this release note is accurate, reviewed, and approved for publication.",
    templateDigestLabel: "File digest",
    templateDigestBody: "sha256:<paste digest here>\nI confirm this file digest matches the reviewed artifact.",
    templateApprovalLabel: "Approval note",
    templateApprovalBody: "I approve this request after reviewing the destination, amount, and purpose.",
    messageTooLong: "Message is too long for on-chain broadcast.",
    signFileBtn: "Hash & load file",
    hashedFileNotice: "The file is hashed locally.",
    signBtn: "Sign Message",
    broadcastBtn: "Broadcast Message (On-chain)",
    walletPromptCopy: "The wallet prompt opens when you sign or broadcast.",
    resultPanelTitle: "Proof output",
    proofEmptyHint: "Sign or broadcast a message to see its proof here.",
    noSignatureYet: "No signature yet",
    noBroadcastYet: "No broadcast yet",
    txPending: "Transaction sent (ID pending)",
    signatureResult: "Signature",
    broadcastResult: "Transaction Hash",
    copySignature: "Copy signature",
    copyVerifyBundle: "Copy verify bundle",
    verifyBundleHint: "Copies a verifier bundle.",
    copyTxHash: "Copy transaction hash",
    viewOnExplorer: "View on explorer",
    publicKeyLabel: "Public key",
    safetyPanelTitle: "Transaction safety",
    connected: "Connected",
    safetyPanelCopy: "The miniapp does not handle private keys.",
    signRouteLabel: "Sign route",
    signContractRoute: "chain.signMessage",
    broadcastRouteLabel: "Broadcast route",
    broadcastContractRoute: "GAS.transfer self -> data",
    gasAmountLabel: "Transfer amount",
    privacyLabel: "Privacy",
    privacyValue: "No secrets",
    broadcastPanelTitle: "On-chain broadcast",
    broadcastPanelCopy: "Broadcasting is public and permanent.",
    networkFeeNote: "Broadcasting still pays normal Neo fees.",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    address: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs",
    message: "ship release note",
    signature: "0xsig",
    publicKey: "02abcdef",
    txHash: "0xtxhash",
    txPending: false,
    isSigning: false,
    isBroadcasting: false,
    signCount: 2,
    broadcastCount: 1,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Neo Sign Anything PlayArea", () => {
  it("renders the signature workspace and preserves core actions", () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(container.querySelector(".sign-play-area--ready")).toBeTruthy();
    expect(container.querySelector(".sign-play-area--signed")).toBeTruthy();
    expect(container.querySelector(".sign-play-area--broadcasted")).toBeTruthy();
    expect(container.querySelector(".sign-document-preview--ready")).toBeTruthy();
    expect(container.querySelector(".sign-result-panel--ready")).toBeTruthy();
    expect(screen.getByText("Neo Signature Desk")).toBeTruthy();
    expect(screen.getByLabelText("Message signing preview")).toBeTruthy();
    expect(document.querySelector('.sign-hero-stage img[src="./signature-desk.jpg"]')).toBeTruthy();
    expect(screen.getAllByText("Message payload").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Release proof" }));
    expect(dispatch).toHaveBeenCalledWith(
      "setMessage",
      "I confirm this release note is accurate, reviewed, and approved for publication.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Message" }));
    expect(dispatch).toHaveBeenCalledWith("signMessage", "ship release note");

    fireEvent.click(screen.getByRole("button", { name: "Broadcast Message (On-chain)" }));
    expect(dispatch).toHaveBeenCalledWith("broadcastMessage", "ship release note");

    fireEvent.click(screen.getByRole("button", { name: "Copy signature" }));
    expect(dispatch).toHaveBeenCalledWith("copyToClipboard", "0xsig");

    fireEvent.click(screen.getByRole("button", { name: "Copy transaction hash" }));
    expect(dispatch).toHaveBeenCalledWith("copyToClipboard", "0xtxhash");
  });

  it("keeps empty state actions disabled until a message exists", () => {
    const { container } = render(<PlayArea t={t} state={state({ message: "", signature: "", txHash: "" })} dispatch={vi.fn()} />);

    expect(container.querySelector(".sign-play-area--ready")).toBeNull();
    expect(container.querySelector(".sign-document-preview--ready")).toBeNull();
    expect(screen.getByText("Ready for a message")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sign Message" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Broadcast Message (On-chain)" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps wallet actions mutually exclusive while one is pending", () => {
    const { rerender } = render(
      <PlayArea t={t} state={state({ isSigning: true })} dispatch={vi.fn()} />,
    );

    expect((screen.getByRole("button", { name: "Broadcast Message (On-chain)" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <PlayArea
        t={t}
        state={state({ isBroadcasting: true })}
        dispatch={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "Sign Message" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the signature desk motion and reduced-motion fallback covered", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../neo-sign-anything/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes sign-stage-drift");
    expect(styles).toContain("@keyframes sign-stage-scan");
    expect(styles).toContain("@keyframes sign-accent-ready");
    expect(styles).toContain("@keyframes sign-paper-ready");
    expect(styles).toContain("@keyframes sign-seal-ready");
    expect(styles).toContain("@keyframes sign-meter-shine");
    expect(styles).toContain("@keyframes sign-proof-reveal");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.sign-document-preview--ready \.sign-document-preview__seal[\s\S]*animation:\s*none/,
    );
  });
});
