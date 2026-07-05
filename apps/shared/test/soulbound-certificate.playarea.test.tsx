import fs from "node:fs";
import path from "node:path";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../soulbound-certificate/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    issuerWorkspaceTitle: "Issuer workspace",
    certificateHeroTitle: "Soulbound Certificate",
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
    issue: "Issue",
    issuing: "Issuing...",
    issueHelp: "Select a template and recipient.",
    mintLaneReady: "Ready to seal",
    createTemplate: "Create Template",
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
    isVerifying: false,
    isRevoking: false,
    lastError: "",
    lastSuccess: "",
    templates: [],
    certificates: [],
    verifiedCertificate: null,
    verifiedIsIssuer: false,
    deepLinkTemplateId: "",
    deepLinkAutoIssue: false,
    deepLinkVerifyTokenId: "",
    isLoading: false,
    isRefreshing: false,
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
    expect(container.querySelector(".certificate-artifact__seal")).toBeTruthy();
    expect(container.querySelector(".cert-credential-strip")).toBeTruthy();
    expect(container.querySelector(".cert-blueprint-card")).toBeTruthy();
    expect(container.querySelector(".cert-blueprint-presets")).toBeTruthy();
    expect(container.querySelector(".cert-atelier-card")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".cert-atelier-card__image")?.getAttribute("src")).toContain("certificate-atelier");
    expect(container.querySelector<HTMLImageElement>(".certificate-artifact__texture")?.getAttribute("src")).toContain("certificate-paper");
    expect(container.querySelector(".cert-field-stack")).toBeNull();
    expect(container.querySelector(".cert-modebar .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".cert-tab-label svg").length).toBe(3);
    expect(container.querySelectorAll(".cert-mint-lane__step").length).toBe(3);
  });

  it("defaults to template blueprints when no active template can be issued", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".cert-modebar .semi-radio-checked")?.textContent).toContain("Templates");
    expect(container.querySelectorAll(".cert-blueprint-preset").length).toBe(3);
    expect(container.querySelector(".cert-pass-card")).toBeNull();
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
    // Issue
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("issueCertificate", expect.objectContaining({ templateId: "7", recipient: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", recipientName: "Alex Chen", achievement: "Advanced track" })));
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

  it("dispatches verifyCertificate from the verify tab", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" })} dispatch={dispatch} />);
    fireEvent.click(optionByText(container, ".cert-modebar .semi-radio", "Verify"));
    expect(container.querySelector(".cert-verifier-lens")).toBeTruthy();
    fireEvent.change(textInputs(container)[0], { target: { value: "0xabc123" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("verifyCertificate", { tokenId: "0xabc123" }));
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
    fireEvent.change(textInputs(container)[0], { target: { value: "0xabc123" } });
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Lookup");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("verifyCertificate", { tokenId: "0xabc123" }));
    expect(dispatch).not.toHaveBeenCalledWith("connectWallet");
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

  it("offers recent certificate holder wallets as recipient chips", () => {
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
    expect(container.querySelector(".cert-recipient-rail")).toBeTruthy();
    fireEvent.click(container.querySelector(".cert-recipient-chip") as Element);
    fireEvent.click(screen.getByText("Edit recipient"));
    expect(textInputs(container)[0].value).toBe("NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq");
  });

  it("keeps motion and clean certificate hierarchy backed by tests", () => {
    const styles = readPlayAreaStyles();
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("--mx2-accent: #0f766e");
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
    expect(styles).toMatch(/\.cert-recipient-rail,[\s\S]*\.cert-certificate-rail\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.cert-recipient-chip--active,[\s\S]*\.cert-certificate-card--active\s*\{[\s\S]*background:\s*#ecfdf5/);
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
    assertZeroLetterSpacing(styles);
    expect(styles).not.toMatch(/font-size:\s*clamp\(/);
    expect(styles).not.toMatch(/radial-gradient/);
    expect(styles).not.toMatch(/\.certificate-artifact__texture\s*\{[^}]*filter:\s*saturate/);
    expect(styles).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[0-8]/);
  });
});
