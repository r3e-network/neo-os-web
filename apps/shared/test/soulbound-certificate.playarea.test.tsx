import fs from "node:fs";
import path from "node:path";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../soulbound-certificate/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { qrToDataURL } = vi.hoisted(() => ({
  qrToDataURL: vi.fn(async () => "data:image/png;base64,certificate-verify-link"),
}));

vi.mock("qrcode", () => ({ default: { toDataURL: qrToDataURL } }));

afterEach(() => {
  cleanup();
  qrToDataURL.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    issuerWorkspaceTitle: "Issuer workspace",
    verifierWorkspaceTitle: "Public credential verifier",
    certificateHeroTitle: "Soulbound Certificate",
    soulboundStandard: "Non-transferable NEP-11",
    docSubtitle: "Issue non-transferable certificates.",
    templatesTab: "Templates",
    certificatesTab: "Certificates",
    verifyTab: "Verify",
    detailsLabel: "Details",
    sidebarActive: "Active",
    issueTab: "Issue",
    connectWallet: "Connect Wallet",
    connecting: "Connecting...",
    walletRequiredIssueHint: "Connect wallet to issue.",
    transactionPending: "Waiting for chain confirmation.",
    transactionPendingShort: "Confirmation pending",
    checkConfirmation: "Check confirmation",
    checkingConfirmation: "Checking...",
    recoveryStorageUnavailable: "Transaction recovery storage is unavailable.",
    retryRecoveryStorage: "Retry recovery storage",
    cachedDataNotice: "Showing a local snapshot.",
    cachedVerifyRequired: "Cached — verify",
    partialChainNotice: "The chain scan is partial.",
    partialVerifyRequired: "Partial — verify",
    statusUnavailable: "Unavailable",
    certificateLoadFailed: "Certificate wallet unavailable",
    certificateLoadFailedHint: "The wallet balance could not be read from chain. No empty or zero state is being assumed.",
    templateLoadFailedHint: "The template index could not be read.",
    partialCertificateEmpty: "Wallet scan incomplete",
    retryCertificateWallet: "Retry wallet",
    retryTemplates: "Retry templates",
    refreshing: "Refreshing...",
    issue: "Issue",
    issuing: "Issuing...",
    issuedSuccess: "Certificate issued",
    issueHelp: "Select a template and recipient.",
    mintLaneReady: "Ready to seal",
    createTemplate: "Create Template",
    templateCreated: "Template created",
    updateTemplate: "Update Template",
    updateTemplateHelp: "Refine this credential design.",
    editTemplate: "Edit",
    editingTemplate: "Editing template",
    newTemplate: "New design",
    creating: "Creating...",
    lookup: "Lookup",
    certificateTitlePlaceholder: "Certificate title",
    awardedToPlaceholder: "Awarded to",
    achievementPreviewPlaceholder: "For achievement",
    issueRecipientPlaceholder: "Recipient address",
    recipientNamePlaceholder: "Recipient name",
    achievementPlaceholder: "Achievement",
    issueRecipient: "Recipient address",
    recipientName: "Recipient name",
    recipientDetails: "Edit recipient",
    achievement: "Achievement",
    awardedTo: "Awarded to",
    forAchievement: "For",
    soulboundBadge: "Soulbound",
    issuerPreviewPlaceholder: "Issuer",
    templateId: "Template ID",
    templateIdPlaceholder: "1",
    noTemplateSelected: "Choose a template or enter an ID",
    issueAdvancedHint: "Advanced",
    memo: "Memo",
    memoPlaceholder: "Memo",
    credentialStripLabel: "Credential state",
    credentialStripTemplate: "Design",
    credentialStripRecipient: "Subject",
    credentialStripSeal: "Seal",
    credentialPassLabel: "Credential pass",
    credentialPassWallet: "Wallet",
    credentialPassSeal: "Seal state",
    credentialReadyLabel: "Ready",
    credentialDraftLabel: "Draft",
    templatePreviewLabel: "Template preview",
    certificatePreviewLabel: "Live preview",
    verificationPendingLabel: "Awaiting chain verification",
    recentRecipients: "Recent recipient wallets",
    certificateWalletLabel: "Certificate wallet",
    issueRecipientPassLabel: "Recipient pass",
    issueRecipientPassHint: "Prepare the recipient.",
    createTemplateDrawerHint: "New design",
    verifyDrawerHint: "Check token",
    certificateAtelierLabel: "Certificate atelier",
    certificateAtelierCaption: "Issue from a designed credential, not a blank form.",
    mintLaneLabel: "Mint lane",
    issueFlowTemplate: "Pick template",
    issueFlowRecipient: "Add recipient",
    issueFlowMint: "Mint",
    templateFlowDesign: "Design",
    templateFlowPolicy: "Set policy",
    templateFlowPublish: "Publish",
    templateFlowUpdate: "Update",
    verifyFlowToken: "Read token",
    verifyFlowChain: "Read chain",
    verifyFlowStatus: "Resolve status",
    mintLaneDraft: "Complete the credential.",
    mintLaneSealing: "Sealing on-chain.",
    templateNamePlaceholder: "Template name",
    issuerNamePlaceholder: "Issuer name",
    categoryPlaceholder: "Category",
    maxSupplyPlaceholder: "Max supply",
    templateName: "Template name",
    issuerName: "Issuer name",
    category: "Category",
    maxSupply: "Max supply",
    description: "Description",
    descriptionPlaceholder: "Description",
    createTemplateHelp: "Create a credential design.",
    templateBlueprintLabel: "Template blueprint",
    templateBlueprintHint: "Shape the credential.",
    templateBlueprintFoot: "Supply limit pending",
    templateBlueprintDetails: "On-chain details",
    templateDetails: "Edit details",
    blueprintPresetsLabel: "Credential blueprints",
    blueprintCourseName: "Course completion",
    blueprintCourseIssuer: "Neo Academy",
    blueprintCourseCategory: "Course",
    blueprintCourseDescription: "Issued to graduates who completed a structured Neo learning path.",
    blueprintEventName: "Event participation",
    blueprintEventIssuer: "Neo Community",
    blueprintEventCategory: "Event",
    blueprintEventDescription: "A non-transferable attendance credential for contributors and participants.",
    blueprintLicenseName: "Contributor license",
    blueprintLicenseIssuer: "Neo Guild",
    blueprintLicenseCategory: "License",
    blueprintLicenseDescription: "Recognizes a verified contributor role, permission, or professional milestone.",
    verifyTokenIdPlaceholder: "Token ID",
    verifyTokenId: "Token ID",
    verifyHelp: "Verify a credential.",
    verifyLensLabel: "Verification lens",
    lookingUp: "Looking up...",
    emptyTemplates: "No templates yet.",
    emptyTemplatesHint: "Create a template first.",
    emptyCertificates: "No certificates yet.",
    yourTemplates: "Your templates",
    certificateTrustSignals: "Trust signals",
    certificateProofPermanent: "Soulbound — non-transferable.",
    certificateProofVerify: "Verifiable on-chain.",
    certificateValid: "Valid",
    certificateRevoked: "Revoked",
    certificateNotFoundHint: "Enter a token.",
    soulboundNote: "Bound to the owner wallet.",
    tokenQrLabel: "Token QR",
    copyVerifyLink: "Copy verify link",
    shareVerifyLink: "Share",
    revoking: "Revoking...",
    tokenId: "Token ID",
    revoke: "Revoke",
    activate: "Activate",
    deactivate: "Deactivate",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    templatesCount: 0,
    certificatesCount: 0,
    activeTemplatesCount: 0,
    address: "",
    isConnecting: false,
    isIssuing: false,
    isCreatingTemplate: false,
    isUpdatingTemplate: false,
    isVerifying: false,
    isRevoking: false,
    isRecovering: false,
    lastError: "",
    lastSuccess: "",
    lastNotice: "",
    pendingOperation: null,
    recoveryStorageAvailable: true,
    templates: [],
    certificates: [],
    templatesSource: "chain",
    certificatesSource: "chain",
    verifiedCertificate: null,
    verifiedIsIssuer: false,
    deepLinkTemplateId: "",
    deepLinkAutoIssue: false,
    deepLinkVerifyTokenId: "",
    isLoading: false,
    isRefreshing: false,
    isRefreshingCertificates: false,
    lastTxid: "",
    togglingId: null,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

function readPlayAreaStyles() {
  const candidates = [
    path.resolve(process.cwd(), "apps/soulbound-certificate/src/PlayArea.scss"),
    path.resolve(process.cwd(), "../soulbound-certificate/src/PlayArea.scss"),
    path.resolve(__dirname, "../../soulbound-certificate/src/PlayArea.scss"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Unable to locate Soulbound Certificate PlayArea.scss from ${process.cwd()}`);
  return fs.readFileSync(found, "utf8");
}

function assertZeroLetterSpacing(styles: string) {
  for (const match of styles.matchAll(/letter-spacing:\s*([^;]+);/g)) {
    expect(match[1].trim()).toBe("0");
  }
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.match(/[a-f\d]{2}/gi)?.map((part) => parseInt(part, 16) / 255) ?? [];
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function optionByText(container: HTMLElement, selector: string, text: string) {
  const option = Array.from(container.querySelectorAll<HTMLElement>(selector))
    .find((node) => node.textContent?.includes(text));
  if (!option) throw new Error(`Missing option "${text}" in ${selector}`);
  return option;
}

function textInputs(container: HTMLElement) {
  return container.querySelectorAll<HTMLInputElement>(".cert-field .semi-input");
}

describe("Soulbound Certificate PlayArea (v2 scene-driven)", () => {
  it("renders the certificate workbench with a foreground artifact", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".cert-workbench")).toBeTruthy();
    expect(container.querySelector(".cert-workbench__photo")).toBeNull();
    expect(container.querySelector(".cert-workbench__wash")).toBeNull();
    expect(container.querySelector(".certificate-artifact")).toBeTruthy();
    expect(container.querySelector(".certificate-artifact")?.getAttribute("data-verification-state")).toBe("preview");
    expect(container.querySelector(".cert-badge--preview")?.textContent).toBe("Awaiting chain verification");
    expect(container.querySelector(".certificate-artifact__seal-label svg")).toBeTruthy();
    expect(container.querySelector(".cert-credential-strip")).toBeTruthy();
    expect(container.querySelector(".cert-verifier-lens")).toBeTruthy();
    expect(container.querySelector(".cert-blueprint-card")).toBeNull();
    expect(container.querySelector<HTMLImageElement>(".certificate-artifact__texture")?.getAttribute("src")).toContain("certificate-paper");
    expect(container.querySelector(".cert-field-stack")).toBeNull();
    expect(container.querySelector(".cert-modebar .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".cert-tab-label svg").length).toBe(3);
    expect(container.querySelectorAll(".cert-mint-lane__step").length).toBe(3);
  });

  it("defaults to template blueprints when no active template can be issued", () => {
    const { container } = render(<PlayArea t={t} state={state({ address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" })} dispatch={vi.fn()} />);
    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Templates");
    expect(container.querySelectorAll(".cert-blueprint-preset").length).toBe(3);
    expect(container.querySelector(".cert-atelier-card")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".cert-atelier-card__image")?.getAttribute("src")).toContain("certificate-atelier");
    expect(container.querySelector(".cert-pass-card")).toBeNull();
  });

  it("opens in permissionless verification before asking for a wallet", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Verify");
    expect(container.querySelector(".mx2-eyebrow")?.textContent).toContain("Public credential verifier");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.textContent).toContain("Lookup");
  });

  it("keeps the issue workspace visible when templates have not loaded yet", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Issue"));

    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Issue");
    expect(container.querySelector(".cert-pass-card")).toBeTruthy();
    expect(container.querySelector(".cert-template-strip")?.textContent).toContain("Create a template first.");
    expect(container.textContent).toContain("Choose a template or enter an ID");
  });

  it("dispatches connectWallet when disconnected", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Templates"));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connectWallet"));
  });

  it("dispatches issueCertificate with form data", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX", templates: [{ id: "7", name: "Cert A", active: true }] })} dispatch={dispatch} />,
    );
    // Select template chip
    fireEvent.click(container.querySelector(".cert-template-chip") as Element);
    expect(container.querySelector(".cert-field-stack")).toBeNull();
    fireEvent.click(screen.getByText("Edit recipient"));
    // Fill recipient
    const inputs = textInputs(container);
    fireEvent.change(inputs[0], { target: { value: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq" } });
    fireEvent.change(inputs[1], { target: { value: "Alex Chen" } });
    fireEvent.change(inputs[2], { target: { value: "Advanced track" } });
    expect(container.querySelector(".certificate-artifact")?.getAttribute("data-verification-state")).toBe("preview");
    expect(container.querySelector(".cert-badge--valid")).toBeNull();
    // Issue
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("issueCertificate", expect.objectContaining({ templateId: "7", recipient: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", recipientName: "Alex Chen", achievement: "Advanced track" })));
  });

  it("moves an exactly confirmed issuance into the verified credential view", async () => {
    const appState = state({
      address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
      templates: [{ id: "7", name: "Cert A", active: true }],
    });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={vi.fn().mockResolvedValue(undefined)} />);

    act(() => {
      appState.verifiedCertificate.set({
        tokenId: "7-1",
        templateName: "Cert A",
        issuerName: "Neo Academy",
        recipientName: "Alex Chen",
        achievement: "Advanced track",
        revoked: false,
      });
      appState.lastSuccess.set("Certificate issued");
    });

    await waitFor(() => expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Verify"));
    expect(container.querySelector(".cert-verify-card")?.textContent).toContain("Cert A");
    expect(container.querySelector(".certificate-artifact")?.getAttribute("data-verification-state")).toBe("verified");
  });

  it("dispatches createTemplate from the templates tab", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" })} dispatch={dispatch} />,
    );
    // Switch to templates tab
    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Templates"));
    expect(container.querySelector(".cert-blueprint-card")).toBeTruthy();
    expect(container.querySelector(".cert-template-dossier")).toBeTruthy();
    expect(container.querySelector(".cert-field-stack")).toBeNull();
    fireEvent.click(screen.getByText("Edit details"));
    const blueprintDetails = container.querySelector(".cert-advanced--blueprint") as HTMLDetailsElement;
    expect(blueprintDetails.open).toBe(false);
    let inputs = textInputs(container);
    fireEvent.change(inputs[0], { target: { value: "My Template" } });
    fireEvent.change(inputs[1], { target: { value: "Neo Academy" } });
    fireEvent.click(blueprintDetails.querySelector("summary") as Element);
    expect(blueprintDetails.open).toBe(true);
    inputs = textInputs(container);
    fireEvent.change(inputs[2], { target: { value: "Course" } });
    fireEvent.change(inputs[3], { target: { value: "100" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createTemplate", expect.objectContaining({ name: "My Template", issuerName: "Neo Academy", category: "Course", maxSupply: "100" })));
  });

  it("turns a blueprint card into a complete template payload", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" })} dispatch={dispatch} />,
    );

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Templates"));
    expect(container.querySelectorAll(".cert-blueprint-preset").length).toBe(3);
    fireEvent.click(screen.getByText("Event participation"));
    expect((container.querySelector(".cert-blueprint-preset--active") as HTMLElement).textContent).toContain("Event");
    expect(container.querySelector(".cert-template-dossier")?.textContent).toContain("Event participation");
    expect(container.querySelector(".cert-field-stack")).toBeNull();
    expect(container.querySelector(".certificate-artifact")?.getAttribute("data-verification-state")).toBe("preview");
    expect(container.querySelector(".cert-badge--valid")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createTemplate", {
        name: "Event participation",
        issuerName: "Neo Community",
        category: "Event",
        maxSupply: "1200",
        description: "A non-transferable attendance credential for contributors and participants.",
      }),
    );
  });

  it("loads an existing credential design and dispatches updateTemplate", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          templates: [{
            id: "7",
            name: "Neo Builder Graduate",
            issuerName: "Neo Academy",
            category: "Course",
            maxSupply: 1000n,
            issued: 12n,
            description: "Issued to builders.",
            active: true,
          }],
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(container.querySelector(".cert-drawer-action--edit") as Element);

    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Templates");
    expect(container.querySelector(".cert-blueprint-card")?.textContent).toContain("Editing template #7");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    const inputs = textInputs(container);
    fireEvent.change(inputs[0], { target: { value: "Neo Builder Credential" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("updateTemplate", {
      templateId: "7",
      name: "Neo Builder Credential",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to builders.",
    }));
  });

  it("dispatches verifyCertificate from the verify tab", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" })} dispatch={dispatch} />);
    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Verify"));
    expect(container.querySelector(".cert-verifier-lens")).toBeTruthy();
    fireEvent.change(textInputs(container)[0], { target: { value: "1-9" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("verifyCertificate", { tokenId: "1-9" }));
  });

  it("opens shared verify links directly in the verification lens", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ deepLinkVerifyTokenId: "1-9" })} dispatch={dispatch} />,
    );

    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Verify");
    expect(textInputs(container)[0].value).toBe("1-9");
    expect(container.querySelector(".cert-verifier-lens")?.textContent).toContain("1-9");
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("consumeVerifyDeepLink"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("verifyCertificate", { tokenId: "1-9" }));
  });

  it("opens an issue shortcut as a draft without broadcasting", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ deepLinkTemplateId: "7", deepLinkAutoIssue: true })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Issue");
    expect(container.textContent).toContain("Template ID #7");
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("consumeDeepLink"));
    expect(dispatch).not.toHaveBeenCalledWith("issueCertificate", expect.anything());
  });

  it("lets holders pick a certificate from the wallet rail instead of typing a token id", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          certificates: [
            { tokenId: "1-1", templateName: "Neo Builder Graduate", recipientName: "Alex Chen", owner: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", revoked: false },
            { tokenId: "1-2", templateName: "Event participation", recipientName: "Sam Lee", owner: "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs", revoked: true },
          ],
          certificatesCount: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Verify"));
    expect(container.querySelector(".cert-certificate-rail")).toBeTruthy();
    expect(container.querySelectorAll(".cert-certificate-card")).toHaveLength(2);
    fireEvent.click(container.querySelector(".cert-certificate-card") as Element);
    expect(textInputs(container)[0].value).toBe("1-1");
    expect(container.querySelector(".cert-certificate-card--active")).toBeTruthy();
  });

  it("lets public certificate verification run without connecting a wallet", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Verify"));
    fireEvent.change(textInputs(container)[0], { target: { value: "1-9" } });
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Lookup");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("verifyCertificate", { tokenId: "1-9" }));
    expect(dispatch).not.toHaveBeenCalledWith("connectWallet");
  });

  it("shows revoked verification truth and shares a real verification deep link", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const verified = {
      tokenId: "1-9",
      templateName: "Neo Builder Graduate",
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      issuerName: "Neo Academy",
      revoked: true,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ verifiedCertificate: verified, deepLinkVerifyTokenId: "1-9" })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".cert-verifier-lens")?.textContent).toContain("Revoked");
    expect(container.querySelector(".cert-verifier-lens")?.textContent).not.toContain("Valid");
    expect(container.querySelector(".cert-credential-strip")?.textContent).toContain("Neo Builder Graduate");
    expect(container.querySelector(".cert-credential-strip")?.textContent).toContain("Revoked");
    expect(container.querySelector(".certificate-artifact")?.getAttribute("data-verification-state")).toBe("verified");
    expect(container.querySelector(".cert-badge--preview")).toBeNull();
    await waitFor(() => expect(qrToDataURL).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/neomini\.app\/.*verifyTokenId=1-9/),
      expect.any(Object),
    ));

    fireEvent.click(screen.getByText("Copy verify link"));
    fireEvent.click(screen.getByText("Share"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("copyVerifyLink", "1-9"));
    expect(dispatch).toHaveBeenCalledWith("shareVerifyLink", "1-9");
    expect(container.querySelector(".cert-revoke-action")).toBeNull();
  });

  it("hides stale verification truth as soon as the token input changes", () => {
    const verified = {
      tokenId: "1-9",
      templateName: "Neo Builder Graduate",
      recipientName: "Alex Chen",
      revoked: false,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ verifiedCertificate: verified, deepLinkVerifyTokenId: "1-9" })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const input = textInputs(container)[0];
    expect(container.querySelector(".cert-verifier-lens")?.textContent).toContain("Valid");

    fireEvent.change(input, { target: { value: "1-10" } });

    expect(container.querySelector(".cert-verifier-lens")?.textContent).toContain("1-10");
    expect(container.querySelector(".cert-verifier-lens")?.textContent).not.toContain("Valid");
    expect(container.querySelector(".cert-verify-card")).toBeNull();
  });

  it("surfaces pending recovery and blocks duplicate wallet actions", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          templates: [{ id: "7", name: "Cert A", active: true }],
          lastNotice: "Waiting for chain confirmation.",
          pendingOperation: { txid: "0xabc123", kind: "issue-certificate" },
        })}
        dispatch={dispatch}
      />,
    );

    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.textContent).toContain("Check confirmation");
    expect(primary?.disabled).toBe(false);
    expect(container.querySelector(".cert-controls__notice")?.textContent).toContain("Waiting for chain confirmation.");
    expect(container.querySelectorAll(".cert-recovery-action")).toHaveLength(0);
    fireEvent.click(primary as HTMLButtonElement);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPendingOperation"));
  });

  it("restores post-broadcast durability before offering confirmation checks", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          recoveryStorageAvailable: false,
          lastNotice: "Waiting for chain confirmation.",
          pendingOperation: { txid: "0xabc123", kind: "issue-certificate" },
        })}
        dispatch={dispatch}
      />,
    );

    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.textContent).toContain("Retry recovery storage");
    fireEvent.click(primary as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("refreshRecoveryStorage");
    expect(dispatch).not.toHaveBeenCalledWith("recoverPendingOperation");
  });

  it("replaces wallet writes with one recovery-storage retry when durability is unavailable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          templates: [{ id: "7", name: "Cert A", active: true }],
          recoveryStorageAvailable: false,
        })}
        dispatch={dispatch}
      />,
    );

    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.disabled).toBe(false);
    expect(primary?.textContent).toContain("Retry recovery storage");
    expect(container.querySelector(".cert-data-trust--warning")?.textContent).toContain(
      "Transaction recovery storage is unavailable",
    );
    fireEvent.click(primary as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("refreshRecoveryStorage");
    expect(dispatch).not.toHaveBeenCalledWith("issueCertificate", expect.anything());
  });

  it("labels cached records as untrusted and never offers them for issuance", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          templatesSource: "cache",
          certificatesSource: "cache",
          templates: [{ id: "7", name: "Cached template", active: true }],
          certificates: [{ tokenId: "1-1", templateName: "Cached certificate", revoked: false }],
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Issue"));
    expect(container.querySelectorAll(".cert-template-chip")).toHaveLength(0);
    expect(container.querySelector(".cert-data-trust")?.textContent).toContain("local snapshot");
    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Verify"));
    expect(container.querySelector(".cert-certificate-card")?.textContent).toContain("Cached — verify");
  });

  it("renders a failed certificate read as unavailable with a retry, never as empty", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
          certificatesSource: "failed",
          certificates: [],
          certificatesCount: 0,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Verify"));
    expect(container.querySelector(".cert-data-trust")?.textContent).toContain("No empty or zero state is being assumed");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".cert-drawer-tabs .semi-radio", "Certificates"));
    expect(container.querySelector(".cert-drawer-empty")?.textContent).toContain("Certificate wallet unavailable");
    expect(container.querySelector(".cert-drawer-empty")?.textContent).not.toContain("No certificates yet");
    expect(container.querySelectorAll(".cert-drawer-tab-label strong")[1]?.textContent).toBe("—");

    fireEvent.click(screen.getByText("Retry wallet"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("refreshCertificates"));
  });

  it("shows templates + certificates in the drawer", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ templates: [{ id: "1", name: "TPL", issuerName: "ISS", active: true }], certificates: [{ id: "c1", name: "Credential Alpha", revoked: false }] })} dispatch={vi.fn()} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".cert-drawer-tabs")).toBeTruthy();
    expect(container.querySelector(".cert-drawer-tabs .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".cert-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".cert-drawer h4")).toBeNull();
    expect(container.querySelector(".cert-drawer .mx2-history")).toBeNull();
    expect(container.querySelector(".cert-drawer__panel-body")?.getAttribute("data-mode")).toBe("templates");
    expect(container.querySelector(".cert-drawer-list")).toBeTruthy();
    expect(container.textContent).toContain("TPL");
    expect(container.textContent).not.toContain("Credential Alpha");

    fireEvent.click(optionByText(container, ".cert-drawer-tabs .semi-radio", "Certificates"));
    expect(container.querySelectorAll(".cert-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".cert-drawer__panel-body")?.getAttribute("data-mode")).toBe("certificates");
    expect(container.textContent).toContain("Credential Alpha");

    fireEvent.click(optionByText(container, ".cert-drawer-tabs .semi-radio", "Trust signals"));
    expect(container.querySelectorAll(".cert-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".cert-drawer__panel-body")?.getAttribute("data-mode")).toBe("trust");
    expect(container.querySelector(".cert-trust-stack")).toBeTruthy();
    expect(container.textContent).toContain("Soulbound — non-transferable.");
  });

  it("keeps mode switching inside the workbench and the action rail focused", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelectorAll(".cert-modebar .semi-radio")).toHaveLength(3);
    expect(container.querySelector(".cert-modebar .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".mx2-action-rail__row .mx2-btn").length).toBe(2);
    expect(container.querySelector(".mx2-score")).toBeFalsy();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")?.textContent).toContain("Details");
    expect(container.querySelector(".mx2-action-rail")?.textContent).not.toContain("IssueVerifyCertificates");
  });

  it("opens recipient details as a compact dossier editor", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ templates: [{ id: "7", name: "Cert A", active: true }] })} dispatch={vi.fn()} />,
    );

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Issue"));
    fireEvent.click(screen.getByText("Edit recipient"));

    expect(container.querySelector(".cert-field-stack")).toBeTruthy();
    expect(container.querySelector(".cert-field-grid--recipient")).toBeTruthy();
  });

  it("does not mislabel held-certificate owners as recent issuance recipients", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          templates: [{ id: "7", name: "Cert A", active: true }],
          certificates: [
            { tokenId: "1-1", templateName: "Neo Builder Graduate", recipientName: "Alex Chen", owner: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", revoked: false },
          ],
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Issue"));
    expect(container.querySelector(".cert-recipient-rail")).toBeNull();
    expect(container.querySelector(".cert-recipient-chip")).toBeNull();
  });

  it("keeps motion and clean certificate hierarchy backed by tests", () => {
    const styles = readPlayAreaStyles();
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).not.toContain("@douyinfe/semi");
    expect(styles).not.toContain("@shared/components-react/v2/v2");
    expect(styles).toContain("--mx2-accent: #0f766e");
    expect(styles).toMatch(/\.certificate-play-area\.mx2,[\s\S]*--mx2-brand:\s*#0f766e/);
    expect(styles).toMatch(/\.certificate-play-area \.mx2-badge\[data-tone="accent"\][\s\S]*background:\s*#dff7f2/);
    expect(styles).toMatch(/certificate-play-area \.mx2-action-rail\.mx2-cat-nft[\s\S]*--mx2-accent:\s*#0f766e/);
    expect(styles).toMatch(/\.certificate-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/\.cert-workbench\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.cert-workbench\s*\{[\s\S]*background-image:\s*none/);
    expect(styles).toMatch(/\.cert-workbench\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).not.toContain("cert-workbench__photo");
    expect(styles).not.toContain("cert-workbench__wash");
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).toMatch(/\.cert-modebar \.cert-modebar__segmented\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-pill\)/);
    expect(styles).toMatch(/\.cert-modebar \.cert-modebar__segmented\.mx2-open-segmented\.semi-radioGroup \.semi-radio-addon-buttonRadio\s*\{[\s\S]*min-height:\s*42px/);
    expect(styles).toMatch(/\.cert-drawer-tabs \.cert-drawer-segmented\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.cert-drawer-tabs \.cert-drawer-segmented\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.cert-drawer-tabs \.cert-drawer-segmented\.mx2-open-segmented\.semi-radioGroup \.semi-radio-addon-buttonRadio\s*\{[\s\S]*min-height:\s*50px/);
    expect(styles).toMatch(/\.cert-drawer-tab-label strong\s*\{[\s\S]*font-size:\s*12px/);
    expect(styles).toMatch(/\.cert-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.cert-drawer-list\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.cert-drawer-item\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.cert-trust-stack article\s*\{[\s\S]*background:\s*#fffef8/);
    expect(styles).not.toMatch(/\.cert-drawer-section h4/);
    expect(styles).not.toMatch(/\.cert-drawer-tabs em/);
    expect(styles).toMatch(/\.cert-blueprint-presets[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/\.cert-blueprint-presets[\s\S]*overflow-x:\s*auto/);
    expect(styles).toMatch(/\.cert-blueprint-preset[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.cert-blueprint-preset[\s\S]*flex:\s*0 0 clamp\(148px,\s*31%,\s*176px\)/);
    expect(styles).toMatch(/\.cert-blueprint-preset[\s\S]*min-height:\s*54px/);
    expect(styles).toMatch(/\.cert-certificate-rail\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.cert-certificate-card--active\s*\{[\s\S]*background:\s*#ecfdf5/);
    expect(styles).toMatch(/\.cert-certificate-card[\s\S]*flex:\s*0 0 clamp\(150px,\s*48%,\s*186px\)/);
    expect(styles).toMatch(/\.cert-atelier-card[\s\S]*background:\s*#fffef8/);
    expect(styles).toMatch(/\.cert-atelier-card[\s\S]*grid-template-columns:\s*108px minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.cert-atelier-card__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.cert-atelier-card__image\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.cert-atelier-card__image\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.certificate-artifact__frame\s*\{[\s\S]*background:\s*#fffef8/);
    expect(styles).toMatch(/\.certificate-artifact__texture\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.certificate-artifact__texture\s*\{[\s\S]*object-position:\s*center/);
    expect(styles).toMatch(/\.certificate-artifact__texture\s*\{[^}]*opacity:\s*0\.64/);
    expect(styles).toMatch(/\.certificate-artifact__head,\n\.certificate-artifact__title,\n\.certificate-artifact__body\s*\{[\s\S]*background:\s*#fffef8/);
    expect(styles).toMatch(/\.certificate-artifact__frame::before,\n\.certificate-artifact__frame::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).not.toContain(".certificate-artifact__draft-label");
    expect(styles).not.toMatch(/\.certificate-artifact__seal\s*\{/);
    expect(styles).toMatch(/\.certificate-artifact__seal-label\s*\{[\s\S]*background:\s*#f0fdfa/);
    expect(styles).toMatch(/\.cert-recipient-dossier[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.cert-detail-toggle\[aria-expanded="true"\][\s\S]*background:\s*#0f766e/);
    expect(styles).toMatch(/\.cert-field-stack\s*\{[\s\S]*background:\s*#fbfefd/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-field-grid--recipient[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.certificate-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*18px 18px 20px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-workbench__foreground[\s\S]*gap:\s*10px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*certificate-artifact__frame[\s\S]*min-height:\s*242px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-workbench\[data-mode="templates"\] \.certificate-artifact__frame[\s\S]*min-height:\s*224px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-dossier__head[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-pass-card dl[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-template-strip:has\(\.cert-controls__hint\)[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-recipient-dossier[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-blueprint-presets[\s\S]*flex-wrap:\s*nowrap/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-blueprint-preset[\s\S]*flex:\s*0 0 142px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-credential-strip,[\s\S]*cert-mint-lane[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-workbench\[data-mode="templates"\] \.cert-blueprint-card p,[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-workbench\[data-mode="templates"\] \.cert-blueprint-card dl\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-certificate-card[\s\S]*flex:\s*0 0 142px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-credential-strip[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-template-dossier[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-detail-toggle[\s\S]*width:\s*auto/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*cert-atelier-card[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.cert-drawer-tab-label strong\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\)[\s\S]*\.certificate-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\)[\s\S]*cert-blueprint-preset[\s\S]*flex-basis:\s*132px/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\)[\s\S]*cert-blueprint-preset small[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\)[\s\S]*certificate-artifact__title[\s\S]*margin:\s*8px auto 7px/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\)[\s\S]*cert-tab-label strong[\s\S]*text-overflow:\s*clip/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\)[\s\S]*cert-tab-label strong[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*460px\) and \(max-height:\s*700px\)[\s\S]*\.mx2-action-rail[\s\S]*position:\s*fixed/);
    assertZeroLetterSpacing(styles);
    expect(styles).not.toMatch(/font-size:\s*clamp\(/);
    expect(styles).not.toMatch(/radial-gradient/);
    expect(styles).not.toMatch(/\.certificate-artifact__texture\s*\{[^}]*filter:\s*saturate/);
    expect(styles).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[0-8]/);
  });

  it("keeps small credential text at WCAG AA contrast or better", () => {
    const styles = readPlayAreaStyles();
    const pairs = [
      ["#172033", "#fffef8"],
      ["#0f766e", "#f0fdfa"],
      ["#7c2d12", "#fff7ed"],
      ["#8a5b12", "#ffffff"],
      ["#ffffff", "#0f766e"],
      ["#667085", "#ffffff"],
      ["#687386", "#ffffff"],
      ["#115e59", "#f0fdfa"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(styles).toContain(foreground);
      expect(styles).toContain(background);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
