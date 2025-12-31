/**
 * CollectionStar Component Tests
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CollectionStar } from "@/components/features/miniapp/CollectionStar";
import { useCollections } from "@/hooks/useCollections";

jest.mock("@/hooks/useCollections");

const mockUseCollections = useCollections as jest.MockedFunction<typeof useCollections>;

describe("CollectionStar", () => {
  const mockToggleCollection = jest.fn();
  const mockIsCollected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCollections.mockReturnValue({
      collections: [],
      collectionsSet: new Set(),
      loading: false,
      error: null,
      isCollected: mockIsCollected,
      toggleCollection: mockToggleCollection,
      isWalletConnected: true,
    });
  });

  it("should render star button", () => {
    mockIsCollected.mockReturnValue(false);
    render(<CollectionStar appId="miniapp-lottery" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should show filled star when collected", () => {
    mockUseCollections.mockReturnValue({
      collections: ["miniapp-lottery"],
      collectionsSet: new Set(["miniapp-lottery"]),
      loading: false,
      error: null,
      isCollected: mockIsCollected,
      toggleCollection: mockToggleCollection,
      isWalletConnected: true,
    });
    render(<CollectionStar appId="miniapp-lottery" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-yellow-400/90");
  });

  it("should show empty star when not collected", () => {
    mockUseCollections.mockReturnValue({
      collections: [],
      collectionsSet: new Set(),
      loading: false,
      error: null,
      isCollected: mockIsCollected,
      toggleCollection: mockToggleCollection,
      isWalletConnected: true,
    });
    render(<CollectionStar appId="miniapp-lottery" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-black/40");
  });

  it("should call toggleCollection on click", async () => {
    mockIsCollected.mockReturnValue(false);
    mockToggleCollection.mockResolvedValue(true);

    render(<CollectionStar appId="miniapp-lottery" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockToggleCollection).toHaveBeenCalledWith("miniapp-lottery");
    });
  });

  it("should show alert when wallet not connected", () => {
    mockUseCollections.mockReturnValue({
      collections: [],
      collectionsSet: new Set(),
      loading: false,
      error: null,
      isCollected: mockIsCollected,
      toggleCollection: mockToggleCollection,
      isWalletConnected: false,
    });

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    render(<CollectionStar appId="miniapp-lottery" />);
    fireEvent.click(screen.getByRole("button"));

    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("should prevent event propagation", () => {
    mockIsCollected.mockReturnValue(false);
    const parentClick = jest.fn();

    render(
      <div onClick={parentClick}>
        <CollectionStar appId="miniapp-lottery" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(parentClick).not.toHaveBeenCalled();
  });
});
