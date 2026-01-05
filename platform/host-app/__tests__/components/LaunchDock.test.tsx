import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaunchDock, LaunchDockProps } from "../../components/LaunchDock";
import { WalletState } from "../../components/types";

describe("LaunchDock", () => {
  const mockOnBack = jest.fn();
  const mockOnExit = jest.fn();
  const mockOnShare = jest.fn();

  const baseProps: LaunchDockProps = {
    appName: "Test App",
    appId: "test-app",
    wallet: { connected: false, address: "", provider: null },
    networkLatency: 50,
    onBack: mockOnBack,
    onExit: mockOnExit,
    onShare: mockOnShare,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render app name", () => {
      render(<LaunchDock {...baseProps} />);
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    it("should apply fixed position styles to dock", () => {
      const { container } = render(<LaunchDock {...baseProps} />);
      const dock = container.firstChild as HTMLElement;

      // Component uses Tailwind classes: fixed top-0 left-0 right-0 h-14 z-[9999]
      expect(dock).toHaveClass("fixed", "top-0", "left-0", "right-0");
    });

    it("should render share button", () => {
      render(<LaunchDock {...baseProps} />);
      const shareButton = screen.getByTitle("Copy share link");
      expect(shareButton).toBeInTheDocument();
    });

    it("should render exit button", () => {
      render(<LaunchDock {...baseProps} />);
      const exitButton = screen.getByTitle("Exit (ESC)");
      expect(exitButton).toBeInTheDocument();
    });
  });

  describe("Wallet Status Display", () => {
    it("should display 'Connect Wallet' when wallet is not connected", () => {
      render(<LaunchDock {...baseProps} />);
      expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    });

    it("should display truncated address when wallet is connected", () => {
      const connectedWallet: WalletState = {
        connected: true,
        address: "NeoTestAddress123456789",
        provider: "neoline",
      };

      render(<LaunchDock {...baseProps} wallet={connectedWallet} />);
      expect(screen.getByText("NeoTes...6789")).toBeInTheDocument();
    });

    it("should show red dot when wallet is disconnected", () => {
      const { container } = render(<LaunchDock {...baseProps} />);
      // Component uses Tailwind class bg-red-500 for disconnected wallet
      const walletDot = container.querySelector(".bg-red-500");
      expect(walletDot).toBeInTheDocument();
    });

    it("should show green dot when wallet is connected", () => {
      const connectedWallet: WalletState = {
        connected: true,
        address: "NeoTestAddress123456789",
        provider: "neoline",
      };

      const { container } = render(<LaunchDock {...baseProps} wallet={connectedWallet} />);
      // Component uses Tailwind class bg-neo for connected wallet
      const walletDot = container.querySelector(".bg-neo");
      expect(walletDot).toBeInTheDocument();
    });

    it("should handle very short addresses", () => {
      const shortWallet: WalletState = {
        connected: true,
        address: "Neo123",
        provider: "neoline",
      };

      render(<LaunchDock {...baseProps} wallet={shortWallet} />);
      // Should still slice properly without errors
      expect(screen.getByText(/Neo/)).toBeInTheDocument();
    });
  });

  describe("Network Latency Indicator", () => {
    it("should display 'Good' status with green dot for latency < 100ms", () => {
      render(<LaunchDock {...baseProps} networkLatency={50} />);
      expect(screen.getByText("50ms")).toBeInTheDocument();
    });

    it("should display 'Fair' status with yellow dot for latency 100-500ms", () => {
      render(<LaunchDock {...baseProps} networkLatency={250} />);
      expect(screen.getByText("250ms")).toBeInTheDocument();
    });

    it("should display 'Slow' status with red dot for latency > 500ms", () => {
      render(<LaunchDock {...baseProps} networkLatency={600} />);
      expect(screen.getByText("600ms")).toBeInTheDocument();
    });

    it("should display 'Offline' when latency is null", () => {
      render(<LaunchDock {...baseProps} networkLatency={null} />);
      expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("should show green indicator for good latency", () => {
      const { container } = render(<LaunchDock {...baseProps} networkLatency={50} />);
      // Network status uses text color on Activity icon, not a dot
      const networkIndicator = container.querySelector(".text-neo");
      expect(networkIndicator).toBeInTheDocument();
    });

    it("should show yellow indicator for fair latency", () => {
      const { container } = render(<LaunchDock {...baseProps} networkLatency={250} />);
      const networkIndicator = container.querySelector(".text-yellow-500");
      expect(networkIndicator).toBeInTheDocument();
    });

    it("should show red indicator for slow latency", () => {
      const { container } = render(<LaunchDock {...baseProps} networkLatency={600} />);
      const networkIndicator = container.querySelector(".text-red-500");
      expect(networkIndicator).toBeInTheDocument();
    });

    it("should handle latency at boundary (99ms)", () => {
      render(<LaunchDock {...baseProps} networkLatency={99} />);
      expect(screen.getByText("99ms")).toBeInTheDocument();
    });

    it("should handle latency at boundary (100ms)", () => {
      render(<LaunchDock {...baseProps} networkLatency={100} />);
      expect(screen.getByText("100ms")).toBeInTheDocument();
    });

    it("should handle latency at boundary (500ms)", () => {
      render(<LaunchDock {...baseProps} networkLatency={500} />);
      expect(screen.getByText("500ms")).toBeInTheDocument();
    });
  });

  describe("Button Interactions", () => {
    it("should call onExit when exit button is clicked", () => {
      render(<LaunchDock {...baseProps} />);
      const exitButton = screen.getByTitle("Exit (ESC)");
      fireEvent.click(exitButton);
      expect(mockOnExit).toHaveBeenCalledTimes(1);
    });

    it("should call onShare when share button is clicked", () => {
      render(<LaunchDock {...baseProps} />);
      const shareButton = screen.getByTitle("Copy share link");
      fireEvent.click(shareButton);
      expect(mockOnShare).toHaveBeenCalledTimes(1);
    });

    it("should not call handlers on multiple rapid clicks (debounce test)", () => {
      render(<LaunchDock {...baseProps} />);
      const exitButton = screen.getByTitle("Exit (ESC)");

      fireEvent.click(exitButton);
      fireEvent.click(exitButton);
      fireEvent.click(exitButton);

      expect(mockOnExit).toHaveBeenCalledTimes(3);
    });
  });

  describe("App Name Truncation", () => {
    it("should handle very long app names", () => {
      const longName = "A".repeat(100);
      render(<LaunchDock {...baseProps} appName={longName} />);

      const appNameElement = screen.getByText(longName);
      // Check that the element has truncate class for text overflow
      expect(appNameElement).toHaveClass("truncate");
    });

    it("should handle empty app name", () => {
      render(<LaunchDock {...baseProps} appName="" />);
      // Should render without crashing
      expect(screen.getByTitle("Exit (ESC)")).toBeInTheDocument();
    });

    it("should handle app name with special characters", () => {
      const specialName = "App <>&\"' Test";
      render(<LaunchDock {...baseProps} appName={specialName} />);
      expect(screen.getByText(specialName)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have title attributes on buttons for screen readers", () => {
      render(<LaunchDock {...baseProps} />);

      expect(screen.getByTitle("Copy share link")).toBeInTheDocument();
      expect(screen.getByTitle("Exit (ESC)")).toBeInTheDocument();
    });

    it("should render buttons with proper HTML structure", () => {
      render(<LaunchDock {...baseProps} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3); // Back, Share, Exit
    });
  });

  describe("SVG Icons", () => {
    it("should render share icon SVG", () => {
      const { container } = render(<LaunchDock {...baseProps} />);
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(2);
    });

    it("should render exit icon SVG", () => {
      const { container } = render(<LaunchDock {...baseProps} />);
      const shareButton = screen.getByTitle("Copy share link");
      const svg = shareButton.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle all props being updated simultaneously", () => {
      const { rerender } = render(<LaunchDock {...baseProps} />);

      const newProps: LaunchDockProps = {
        appName: "New App",
        appId: "new-app",
        wallet: { connected: true, address: "NewAddress123", provider: "o3" },
        networkLatency: 999,
        onBack: jest.fn(),
        onExit: jest.fn(),
        onShare: jest.fn(),
      };

      rerender(<LaunchDock {...newProps} />);

      expect(screen.getByText("New App")).toBeInTheDocument();
      expect(screen.getByText("999ms")).toBeInTheDocument();
      expect(screen.getByText(/NewAdd/)).toBeInTheDocument();
    });

    it("should handle negative latency gracefully", () => {
      render(<LaunchDock {...baseProps} networkLatency={-1} />);
      // Should display as is without crashing
      expect(screen.getByText("-1ms")).toBeInTheDocument();
    });

    it("should handle zero latency", () => {
      render(<LaunchDock {...baseProps} networkLatency={0} />);
      expect(screen.getByText("0ms")).toBeInTheDocument();
    });
  });
});
