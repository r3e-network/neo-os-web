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
    emptyTemplates: "No templates yet",
    emptyTemplatesHint: "Create a template to start issuing certificates.",
    statusActive: "Active",
    statusInactive: "Inactive",
    issued: "Issued",
    soldOut: "Sold out",
    deactivate: "Deactivate",
    activate: "Activate",
    updating: "Updating...",
    copyIssueLink: "Copy Issue Link",
    shareIssueLink: "Share Issue Link",
    emptyTemplateDescription: "No description provided.",
    verifyHelp: "Look up a token ID.",
    verifyTokenId: "Token ID",
    verifyTokenIdPlaceholder: "Enter token ID",
    lookup: "Lookup",
    lookingUp: "Looking up...",
    revoke: "Revoke",
    revoking: "Revoking...",
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

  it("keeps raw action keys and fake modal copy out of the rendered workspace", () => {
    const { container } = render(
      <PlayArea t={t} state={baseState()} dispatch={vi.fn()} />,
    );

    expect(container.textContent).not.toContain("openIssueModal");
    expect(container.textContent).not.toContain("soulbound:openIssueModal");
    expect(container.textContent).not.toContain("contractMissing");
  });
});
