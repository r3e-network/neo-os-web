import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/router";
import LaunchPage, { getServerSideProps } from "../../pages/launch/[id]";
import { MiniAppInfo } from "../../components/types";

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

// Mock LaunchDock component
jest.mock("../../components/LaunchDock", () => ({
  LaunchDock: ({ appName, onExit, onShare }: any) => (
    <div data-testid="launch-dock">
      <span>{appName}</span>
      <button onClick={onExit}>Exit</button>
      <button onClick={onShare}>Share</button>
    </div>
  ),
}));

const mockApp: MiniAppInfo = {
  app_id: "test-app",
  name: "Test App",
  description: "Test description",
  icon: "🧪",
  category: "gaming",
  entry_url: "mf://manifest?app=test-app",
  permissions: { payments: true, governance: true, randomness: true, datafeed: true },
};

const flushAsyncUpdates = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderLaunchPage = async (app: MiniAppInfo = mockApp) => {
  const rendered = render(<LaunchPage app={app} />);
  await flushAsyncUpdates();
  return rendered;
};

describe("LaunchPage", () => {
  let mockPush: jest.Mock;
  let mockFetch: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      query: { id: "test-app" },
    });

    // Mock fetch for network latency check
    mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    // Mock performance.now for latency measurement
    let performanceCounter = 0;
    jest.spyOn(performance, "now").mockImplementation(() => {
      performanceCounter += 50; // Simulate 50ms latency
      return performanceCounter;
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });

    // Mock window.NEOLineN3
    (window as any).NEOLineN3 = {
      Init: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({
          address: "NeoTestAddress123456789",
        }),
      })),
    };

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
  });

  describe("Rendering", () => {
    it("should render LaunchDock with app name", async () => {
      await renderLaunchPage();
      expect(screen.getByTestId("launch-dock")).toBeInTheDocument();
      expect(screen.getAllByText("Test App").length).toBeGreaterThan(0);
    });

    it("should render manifest runtime", async () => {
      await renderLaunchPage();
      expect(screen.getByText("Manifest Runtime")).toBeInTheDocument();
      expect(document.querySelector("iframe")).not.toBeInTheDocument();
    });

    it("should render runtime sections", async () => {
      await renderLaunchPage();
      expect(screen.getByText("Layout")).toBeInTheDocument();
      expect(screen.getAllByText("Operations").length).toBeGreaterThan(0);
    });
  });

  describe("Network Latency Monitoring", () => {
    it("should measure network latency on mount", async () => {
      await renderLaunchPage();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/health",
          expect.objectContaining({ method: "HEAD", signal: expect.any(Object) }),
        );
      });
    });

    it("should measure latency every 5 seconds", async () => {
      await renderLaunchPage();

      // Initial call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      // Advance timer by 5 seconds
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Advance another 5 seconds
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await renderLaunchPage();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Should not throw error
      expect(screen.getByTestId("launch-dock")).toBeInTheDocument();
    });
  });

  describe("Wallet Connection", () => {
    it("should attempt to connect wallet on mount", async () => {
      await renderLaunchPage();

      await waitFor(() => {
        expect((window as any).NEOLineN3.Init).toHaveBeenCalled();
      });
    });

    it("should handle wallet connection failure silently", async () => {
      (window as any).NEOLineN3.Init = jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockRejectedValue(new Error("User rejected")),
      }));

      await renderLaunchPage();

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByTestId("launch-dock")).toBeInTheDocument();
      });
    });
  });

  describe("Exit Functionality", () => {
    it("should navigate to /miniapps/[id] when exit button is clicked", async () => {
      await renderLaunchPage();

      const exitButton = screen.getByText("Exit");
      fireEvent.click(exitButton);

      expect(mockPush).toHaveBeenCalledWith("/miniapps/test-app");
    });

    it("should navigate to /miniapps/[id] when ESC key is pressed", async () => {
      await renderLaunchPage();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(mockPush).toHaveBeenCalledWith("/miniapps/test-app");
    });

    it("should not navigate on other keys", async () => {
      await renderLaunchPage();

      fireEvent.keyDown(window, { key: "Enter" });
      fireEvent.keyDown(window, { key: "a" });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should cleanup event listener on unmount", async () => {
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");
      const { unmount } = await renderLaunchPage();

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });

  describe("Share Functionality", () => {
    it("should copy share link to clipboard when share button is clicked", async () => {
      await renderLaunchPage();

      const shareButton = screen.getByText("Share");
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/launch/test-app"));
      });
    });

    it("should handle clipboard write failure", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error("Clipboard denied"));

      await renderLaunchPage();

      const shareButton = screen.getByText("Share");
      fireEvent.click(shareButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] Failed to copy link", expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup network latency interval on unmount", async () => {
      const { unmount } = await renderLaunchPage();

      unmount();

      // Advance timer - should not trigger new fetch
      const initialCallCount = mockFetch.mock.calls.length;
      jest.advanceTimersByTime(10000);

      expect(mockFetch).toHaveBeenCalledTimes(initialCallCount);
    });
  });
});

describe("getServerSideProps", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return app props for valid app_id", async () => {
    const context = {
      params: { id: "test-app" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ app: mockApp }),
    });

    const result = await getServerSideProps(context);

    expect(result).toHaveProperty("props");
    expect((result as any).props.app.app_id).toBe("test-app");
    expect((result as any).props.app.name).toBe("Test App");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/miniapps/catalog?app_id=test-app",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  it("should return 404 for non-existent app_id", async () => {
    const context = {
      params: { id: "non-existent-app" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ app: null }),
    });

    const result = await getServerSideProps(context);

    expect(result).toEqual({ notFound: true });
  });

  it("should return props with manifest entry_url", async () => {
    const context = {
      params: { id: "miniapp-coinflip" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ app: null }),
    });

    const result = await getServerSideProps(context);

    expect((result as any).props.app.entry_url).toBe("mf://manifest?app=miniapp-coinflip");
  });

  it("should return app with required fields", async () => {
    const context = {
      params: { id: "miniapp-neo-gacha" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ app: null }),
    });

    const result = await getServerSideProps(context);

    const app = (result as any).props.app;
    expect(app).toHaveProperty("app_id");
    expect(app).toHaveProperty("name");
    expect(app).toHaveProperty("description");
    expect(app).toHaveProperty("icon");
    expect(app).toHaveProperty("category");
    expect(app).toHaveProperty("entry_url");
    expect(app).toHaveProperty("permissions");
  });
});
