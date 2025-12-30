import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/router";
import LaunchPage, { getServerSideProps } from "../../pages/launch/[id]";
import { MiniAppInfo } from "../../components/types";
import { installMiniAppSDK } from "../../lib/miniapp-sdk";

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

jest.mock("../../lib/miniapp-sdk", () => ({
  installMiniAppSDK: jest.fn(),
}));

const mockApp: MiniAppInfo = {
  app_id: "test-app",
  name: "Test App",
  description: "Test description",
  icon: "🧪",
  category: "gaming",
  entry_url: "https://example.com/app",
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
  let mockSDK: any;
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

    mockSDK = {
      getAddress: jest.fn().mockResolvedValue("NeoTestAddress123456789"),
      wallet: {
        getAddress: jest.fn().mockResolvedValue("NeoTestAddress123456789"),
        invokeIntent: jest.fn().mockResolvedValue({ txid: "0x1" }),
      },
      payments: {
        payGAS: jest.fn().mockResolvedValue({ request_id: "req-1" }),
      },
      governance: {
        vote: jest.fn().mockResolvedValue({ request_id: "req-2" }),
      },
      rng: {
        requestRandom: jest.fn().mockResolvedValue({ randomness: "abc" }),
      },
      datafeed: {
        getPrice: jest.fn().mockResolvedValue({ price: "123" }),
      },
      stats: {
        getMyUsage: jest.fn().mockResolvedValue({ tx_count: 1 }),
      },
      events: {
        list: jest.fn().mockResolvedValue({ events: [] }),
      },
      transactions: {
        list: jest.fn().mockResolvedValue({ transactions: [] }),
      },
    };
    (installMiniAppSDK as jest.Mock).mockReturnValue(mockSDK);

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
      expect(screen.getByText("Test App")).toBeInTheDocument();
    });

    it("should render iframe with correct src and sandbox attributes", async () => {
      await renderLaunchPage();
      const iframe = document.querySelector("iframe");
      expect(iframe).toBeInTheDocument();
      expect(iframe?.src).toBe("https://example.com/app");
      expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-forms allow-popups");
      expect(iframe?.title).toBe("Test App MiniApp");
    });

    it("should render iframe with fullscreen styles", async () => {
      await renderLaunchPage();
      const iframe = document.querySelector("iframe");
      expect(iframe).toHaveStyle({
        position: "absolute",
        top: "48px",
        width: "100vw",
        height: "calc(100vh - 48px)",
      });
    });
  });

  describe("Network Latency Monitoring", () => {
    it("should measure network latency on mount", async () => {
      await renderLaunchPage();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/health", { method: "HEAD" });
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

  describe("MiniApp SDK bridge", () => {
    const setupFrame = () => {
      const iframe = document.querySelector("iframe") as HTMLIFrameElement;
      const contentWindow = {
        postMessage: jest.fn(),
        dispatchEvent: jest.fn(),
      } as any;
      Object.defineProperty(iframe, "contentWindow", {
        value: contentWindow,
        writable: true,
      });
      return { iframe, contentWindow };
    };

    const sendMessage = async (
      contentWindow: any,
      method: string,
      params: unknown[],
      origin = "https://example.com",
    ) => {
      contentWindow.postMessage.mockClear();
      const event = new MessageEvent("message", {
        data: { type: "neo_miniapp_sdk_request", id: method, method, params },
        origin,
      });
      Object.defineProperty(event, "source", { value: contentWindow });
      window.dispatchEvent(event);
      await waitFor(() => expect(contentWindow.postMessage).toHaveBeenCalled());
      return contentWindow.postMessage.mock.calls.at(-1);
    };

    it("responds to MiniApp SDK requests", async () => {
      await renderLaunchPage();
      const { contentWindow } = setupFrame();

      await waitFor(() => expect(installMiniAppSDK).toHaveBeenCalled());

      const response1 = await sendMessage(contentWindow, "wallet.getAddress", []);
      expect(response1?.[0]).toEqual(
        expect.objectContaining({ ok: true, result: "NeoTestAddress123456789", id: "wallet.getAddress" }),
      );

      await sendMessage(contentWindow, "wallet.invokeIntent", ["req-1"]);
      expect(mockSDK.wallet.invokeIntent).toHaveBeenCalledWith("req-1");

      const response3 = await sendMessage(contentWindow, "payments.payGAS", ["test-app", "1", "memo"]);
      expect(response3?.[0]).toEqual(expect.objectContaining({ ok: true, id: "payments.payGAS" }));
      expect(mockSDK.payments.payGAS).toHaveBeenCalledWith("test-app", "1", "memo");

      await sendMessage(contentWindow, "governance.vote", ["test-app", "proposal-1", "10", true]);
      expect(mockSDK.governance.vote).toHaveBeenCalledWith("test-app", "proposal-1", "10", true);

      await sendMessage(contentWindow, "rng.requestRandom", ["test-app"]);
      expect(mockSDK.rng.requestRandom).toHaveBeenCalledWith("test-app");

      await sendMessage(contentWindow, "datafeed.getPrice", ["NEO-USD"]);
      expect(mockSDK.datafeed.getPrice).toHaveBeenCalledWith("NEO-USD");

      await sendMessage(contentWindow, "stats.getMyUsage", []);
      expect(mockSDK.stats.getMyUsage).toHaveBeenCalledWith("test-app", undefined);

      await sendMessage(contentWindow, "events.list", [{ limit: 2 }]);
      expect(mockSDK.events.list).toHaveBeenCalledWith({ limit: 2, app_id: "test-app" });

      await sendMessage(contentWindow, "transactions.list", [{ limit: 3 }]);
      expect(mockSDK.transactions.list).toHaveBeenCalledWith({ limit: 3, app_id: "test-app" });

      const response7 = await sendMessage(contentWindow, "unsupported.method", []);
      expect(response7?.[0]).toEqual(expect.objectContaining({ ok: false, id: "unsupported.method" }));
    });

    it("denies requests without manifest permissions", async () => {
      const restrictedApp: MiniAppInfo = {
        ...mockApp,
        permissions: { payments: false },
      };
      await renderLaunchPage(restrictedApp);
      const { contentWindow } = setupFrame();

      await waitFor(() => expect(installMiniAppSDK).toHaveBeenCalled());

      const response = await sendMessage(contentWindow, "payments.payGAS", ["test-app", "1"]);
      expect(response?.[0]).toEqual(
        expect.objectContaining({ ok: false, id: "payments.payGAS", error: expect.stringContaining("permission") }),
      );
    });

    it("injects MiniAppSDK into same-origin iframes", async () => {
      const sameOriginApp: MiniAppInfo = {
        ...mockApp,
        entry_url: "/miniapps/test/index.html",
      };
      await renderLaunchPage(sameOriginApp);
      const { iframe, contentWindow } = setupFrame();

      await waitFor(() => expect(installMiniAppSDK).toHaveBeenCalled());
      fireEvent.load(iframe);

      await waitFor(() => {
        expect((contentWindow as any).MiniAppSDK).toBe(mockSDK);
      });

      const dispatched = (contentWindow.dispatchEvent as jest.Mock).mock.calls.at(-1)?.[0];
      expect(dispatched?.type).toBe("miniapp-sdk-ready");
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
      json: async () => ({ stats: [mockApp] }),
    });

    const result = await getServerSideProps(context);

    expect(result).toHaveProperty("props");
    expect((result as any).props.app.app_id).toBe("test-app");
    expect((result as any).props.app.name).toBe("Test App");
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:3000/api/miniapp-stats?app_id=test-app");
  });

  it("should return 404 for non-existent app_id", async () => {
    const context = {
      params: { id: "non-existent-app" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ stats: [] }),
    });

    const result = await getServerSideProps(context);

    expect(result).toEqual({ notFound: true });
  });

  it("should return props with correct entry_url", async () => {
    const context = {
      params: { id: "miniapp-coinflip" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ stats: [] }),
    });

    const result = await getServerSideProps(context);

    expect((result as any).props.app.entry_url).toBe("/miniapps/coin-flip/");
  });

  it("should return app with required fields", async () => {
    const context = {
      params: { id: "miniapp-dicegame" },
      req: { headers: { host: "localhost:3000" } },
    } as any;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ stats: [] }),
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
