/**
 * LinkedIdentitiesList Tests
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LinkedIdentitiesList } from "../LinkedIdentitiesList";
import type { LinkedIdentity } from "@/lib/neohub-account";

// Mock i18n
jest.mock("@/lib/i18n/react", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockIdentities: LinkedIdentity[] = [
  {
    id: "1",
    neohubAccountId: "acc-1",
    provider: "google-oauth2",
    providerUserId: "123",
    auth0Sub: "google-oauth2|123",
    email: "test@gmail.com",
    linkedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    neohubAccountId: "acc-1",
    provider: "github",
    providerUserId: "456",
    auth0Sub: "github|456",
    name: "testuser",
    linkedAt: "2024-01-02T00:00:00Z",
  },
];

describe("LinkedIdentitiesList", () => {
  const mockOnUnlink = jest.fn();

  it("should show empty message when no identities", () => {
    render(<LinkedIdentitiesList identities={[]} canUnlink={true} onUnlink={mockOnUnlink} />);

    expect(screen.getByText("account.neohub.noIdentities")).toBeInTheDocument();
  });

  it("should render identities list", () => {
    render(<LinkedIdentitiesList identities={mockIdentities} canUnlink={true} onUnlink={mockOnUnlink} />);

    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("test@gmail.com")).toBeInTheDocument();
  });

  it("should show link new button when onLinkNew provided", () => {
    const mockLinkNew = jest.fn();
    render(
      <LinkedIdentitiesList
        identities={mockIdentities}
        canUnlink={true}
        onUnlink={mockOnUnlink}
        onLinkNew={mockLinkNew}
      />,
    );

    expect(screen.getByText("account.neohub.linkNew")).toBeInTheDocument();
  });
});
