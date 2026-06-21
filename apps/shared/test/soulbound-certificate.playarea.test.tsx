import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../soulbound-certificate/src/PlayArea";
import type {
  CertificateItem,
  TemplateItem,
} from "../../soulbound-certificate/src/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const template: TemplateItem = {
  id: "7",
  issuer: "0x00112233445566778899aabbccddeeff00112233",
  name: "Neo Builder Graduate",
  issuerName: "Neo Academy",
  category: "Course",
  maxSupply: 1000n,
  issued: 12n,
  description: "Issued to builders who completed the advanced track.",
  active: true,
};

const certificate: CertificateItem = {
  tokenId: "0x0700000000000001",
  templateId: "7",
  owner: "0x00112233445566778899aabbccddeeff00112233",
  templateName: "Neo Builder Graduate",
  issuerName: "Neo Academy",
  category: "Course",
  description: "Issued to builders who completed the advanced track.",
  recipientName: "Alex Chen",
  achievement: "Advanced track",
  memo: "Cohort 1",
  issuedTime: 1780300000,
  revoked: false,
  revokedTime: 0,
};

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Soulbound Certificate",
    docSubtitle: "On-chain, non-transferable NEP-11 certificates",
    templatesTab: "Templates",
    certificatesTab: "My Certificates",
    verifyTab: "Verify",
    sidebarActive: "Active",
    connectWallet: "Connect Wallet",
    walletConnected: "Wallet connected",
    issuerWorkspaceTitle: "Issuer workspace",
    certificateHeroTitle: "Design a credential, issue it on-chain, verify it anywhere.",
    certificateTrustSignals: "Credential trust signals",
    certificateProofPermanent: "Permanent record",
    certificateProofVerify: "QR verification",
    templatePreviewLabel: "Template preview",
    certificatePreviewLabel: "Live preview",
    awardedTo: "Awarded to",
    awardedToPlaceholder: "Recipient's name",
    forAchievement: "For",
    achievementPreviewPlaceholder: "Their achievement",
    certificateTitlePlaceholder: "Certificate of Achievement",
    issuerPreviewPlaceholder: "Issuing organization",
    soulboundBadge: "Soulbound",
    createTemplate: "Create Template",
    creating: "Creating...",
    createTemplateHelp: "Create an on-chain certificate template.",
    templateName: "Certificate name",
    templateNamePlaceholder: "Neo Course Completion",
    issuerName: "Issuer name",
    issuerNamePlaceholder: "Neo Academy",
    category: "Category",
    categoryPlaceholder: "Course / Event",
    maxSupply: "Max supply",
    description: "Description",
    descriptionPlaceholder: "Issued to graduates of the Neo course",
    issueCertificate: "Issue Certificate",
    issueHelp: "Mint a non-transferable NEP-11 certificate.",
    selectedTemplate: "Selected template",
    noTemplateSelected: "Choose a template or enter an ID",
    templateId: "Template ID",
    templateIdPlaceholder: "1",
    issueRecipient: "Recipient address",
    issueRecipientPlaceholder: "Neo N3 address",
    recipientName: "Recipient name",
    recipientNamePlaceholder: "Alex Chen",
    achievement: "Achievement",
    achievementPlaceholder: "Advanced track",
    memo: "Memo (optional)",
    memoPlaceholder: "Certificate ID or note",
    issue: "Issue",
    issuing: "Issuing...",
    yourTemplates: "Your Templates",
    refresh: "Refresh",
    walletNotConnected: "Wallet not connected",
    walletNotConnectedHint: "Connect a wallet to load templates.",
    walletRequiredTitle: "Wallet required",
    walletRequiredIssueHint: "Connect the issuer wallet before minting a soulbound certificate.",
    walletRequiredTemplateHint: "Connect the issuer wallet before creating an on-chain template.",
    emptyTemplates: "No templates yet",
    emptyTemplatesHint: "Create a template to start issuing certificates.",
    statusActive: "Active",
    statusInactive: "Inactive",
    issued: "Issued",
    soldOut: "Sold out",
    deactivate: "Deactivate",
    activate: "Activate",
    updating: "Updating...",
    copyIssueShortcut: "Copy issuing shortcut",
    emptyTemplateDescription: "No description provided.",
    verifyHelp: "Look up a token ID.",
    verifyTokenId: "Token ID",
    verifyTokenIdPlaceholder: "Enter token ID",
    lookup: "Lookup",
    lookingUp: "Looking up...",
    revoke: "Revoke",
    revoking: "Revoking...",
    onlyIssuerCanRevoke: "Only the issuing wallet can revoke this certificate.",
    copyVerifyLink: "Copy verify link",
    shareVerifyLink: "Share",
    tokenQrLabel: "Certificate token ID QR code",
    tokenQrCaption: "Scan to verify by token ID",
    tokenId: "Token ID",
    certificateValid: "Valid",
    certificateRevoked: "Revoked",
    certificateNotFoundHint: "Enter a token ID to verify.",
    emptyCertificates: "No certificates yet",
    emptyCertificatesHint: "Certificates issued to this wallet will appear here.",
  };
  return messages[key] ?? key;
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    templates: [template],
    certificates: [certificate],
    verifiedCertificate: certificate,
    verifiedIsIssuer: true,
    templatesCount: 1,
    certificatesCount: 1,
    activeTemplatesCount: 1,
    address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
    isRefreshing: false,
    isLoading: false,
    isCreatingTemplate: false,
    isIssuing: false,
    isVerifying: false,
    isRevoking: false,
    togglingId: "",
    lastTxid: "",
    lastError: "",
    lastSuccess: "",
    deepLinkTemplateId: "",
    deepLinkAutoIssue: false,
    deepLinkVerifyTokenId: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Soulbound Certificate PlayArea", () => {
  it("exposes complete issuer, issuance, verify, and revoke actions", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    expect(screen.getByRole("button", { name: "Create Template" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Issue Certificate" }),
    ).toBeTruthy();
    expect(screen.getByText("Your Templates")).toBeTruthy();
    expect(screen.getByText("Verify")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create Template" }));
    expect(dispatch).toHaveBeenCalledWith("createTemplate", {
      name: "Neo Course Completion",
      issuerName: "Neo Academy",
      category: "Course",
      maxSupply: "1000",
      description: "Issued to graduates who completed the Neo builder track.",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Issue Certificate" }),
    );
    expect(screen.getByDisplayValue("7")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX" },
    });
    fireEvent.change(screen.getByLabelText("Recipient name"), {
      target: { value: "Alex Chen" },
    });
    fireEvent.change(screen.getByLabelText("Achievement"), {
      target: { value: "Advanced track" },
    });
    fireEvent.change(screen.getByLabelText("Memo (optional)"), {
      target: { value: "Cohort 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Issue" }));
    expect(dispatch).toHaveBeenCalledWith("issueCertificate", {
      templateId: "7",
      recipient: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
      recipientName: "Alex Chen",
      achievement: "Advanced track",
      memo: "Cohort 1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(dispatch).toHaveBeenCalledWith("toggleTemplate", template);

    fireEvent.change(screen.getByLabelText("Token ID"), {
      target: { value: "0x0700000000000001" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Lookup" })[0]);
    expect(dispatch).toHaveBeenCalledWith("verifyCertificate", {
      tokenId: "0x0700000000000001",
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]);
    expect(dispatch).toHaveBeenCalledWith("revokeCertificate", {
      tokenId: "0x0700000000000001",
    });
  });

  it("prefills the issue template from a deep link and marks it consumed", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ deepLinkTemplateId: "7", deepLinkAutoIssue: true })}
        dispatch={dispatch}
      />,
    );

    // Template id input is preselected from ?issueTemplateId=7 without the user
    // having to pick a template manually.
    expect(
      (screen.getByLabelText("Template ID") as HTMLInputElement).value,
    ).toBe("7");
    // The view tells the logic layer the deep link has been applied.
    expect(dispatch).toHaveBeenCalledWith("consumeDeepLink");
  });

  it("does not override a template the user already typed", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ deepLinkTemplateId: "", deepLinkAutoIssue: false })}
        dispatch={dispatch}
      />,
    );

    const input = screen.getByLabelText("Template ID") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "42" } });
    expect(input.value).toBe("42");
    expect(dispatch).not.toHaveBeenCalledWith("consumeDeepLink");
  });

  it("keeps raw action keys and fake modal copy out of the rendered workspace", () => {
    const { container } = render(
      <PlayArea t={t} state={baseState()} dispatch={vi.fn()} />,
    );

    expect(container.textContent).not.toContain("openIssueModal");
    expect(container.textContent).not.toContain("soulbound:openIssueModal");
    expect(container.textContent).not.toContain("contractMissing");
  });

  it("keeps signing actions gated until an issuer wallet is connected", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ address: "", templates: [], certificates: [] })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getAllByText("Wallet required")).toHaveLength(2);
    expect(
      screen.getByText(
        "Connect the issuer wallet before minting a soulbound certificate.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Connect the issuer wallet before creating an on-chain template.",
      ),
    ).toBeTruthy();

    const issueButton = screen.getByRole("button", { name: "Issue" });
    const createButton = screen.getByRole("button", { name: "Create Template" });
    expect((issueButton as HTMLButtonElement).disabled).toBe(true);
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(createButton);
    fireEvent.click(issueButton);

    expect(dispatch).not.toHaveBeenCalledWith("createTemplate", expect.anything());
    expect(dispatch).not.toHaveBeenCalledWith("issueCertificate", expect.anything());
  });

  it("hides Revoke for a non-issuer verifier and explains why", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ verifiedIsIssuer: false })}
        dispatch={dispatch}
      />,
    );

    // The contract only lets the template issuer revoke, so a third-party
    // verifier must never be shown the destructive action that would revert.
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
    expect(
      screen.getByText("Only the issuing wallet can revoke this certificate."),
    ).toBeTruthy();
  });

  it("shares a permissionless verify link for the verified certificate", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={baseState()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(dispatch).toHaveBeenCalledWith(
      "shareVerifyLink",
      "0x0700000000000001",
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy verify link" }));
    expect(dispatch).toHaveBeenCalledWith(
      "copyVerifyLink",
      "0x0700000000000001",
    );
  });

  it("prefills and runs the verify lookup from a verify deep link", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ deepLinkVerifyTokenId: "0x0700000000000001" })}
        dispatch={dispatch}
      />,
    );

    expect(dispatch).toHaveBeenCalledWith("verifyCertificate", {
      tokenId: "0x0700000000000001",
    });
    expect(dispatch).toHaveBeenCalledWith("consumeVerifyDeepLink");
  });
});
