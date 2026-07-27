import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import PlayPage, { getServerSideProps } from "../../pages/play/[id]";
import { StandaloneMiniAppFrame } from "@/components/playarea/StandaloneMiniAppFrame";
import { clearMiniAppCdnCatalogCache } from "@/lib/miniapp-cdn";

jest.mock("@/lib/wallet/store", () => ({
  useWalletStore: {
    getState: () => ({
      connected: false,
      address: "",
      accountHash: "",
      network: null,
    }),
    subscribe: jest.fn(() => () => {}),
  },
  getWalletAdapter: () => null,
}));

jest.mock("@/lib/miniapp-definitions", () => ({
  loadBundledMiniAppById: jest.fn(async () => null),
}));

const CDN = "https://cdn.example.test";

const PROPS = {
  appId: "miniapp-game-2048",
  name: "2048",
  url: `${CDN}/minigames/game-2048/1.3.0/index.html?network=testnet&source=standalone`,
  network: "testnet" as const,
  iconUrl: `${CDN}/minigames/game-2048/1.3.0/logo.webp`,
  version: "1.3.0",
};

function catalogFetch() {
  return jest.fn(async (url: unknown) => {
    if (String(url).includes("/catalog/minigames.json")) {
      return {
        ok: true,
        json: async () => ({
          kind: "minigames",
          cdn_base_url: CDN,
          apps: [
            {
              app_id: "miniapp-game-2048",
              slug: "game-2048",
              name: "2048",
              description: "Slide tiles",
              category: "games",
              tags: [],
              version: "1.3.0",
              icon_url: `${CDN}/minigames/game-2048/1.3.0/logo.webp`,
              banner_url: "",
              entry_url: `${CDN}/minigames/game-2048/1.3.0/index.html`,
              manifest_url: `${CDN}/minigames/game-2048/1.3.0/neo-manifest.json`,
              supported_networks: [],
              default_network: "",
              contracts: {},
            },
          ],
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

describe("/play/[id] standalone surface", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearMiniAppCdnCatalogCache();
    process.env.MINIAPP_CDN_BASE_URL = CDN;
    delete process.env.MINIAPP_BUNDLE_SOURCE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    clearMiniAppCdnCatalogCache();
  });

  it("renders the app frame and nothing of the platform around it", () => {
    render(<PlayPage {...PROPS} />);

    const frame = screen.getByTestId("standalone-miniapp-frame");
    expect(frame).toHaveAttribute("src", PROPS.url);
    expect(frame).toHaveAttribute("title", "2048");

    // No platform chrome: the surface OneGate embeds must not advertise the
    // platform or offer navigation out of the app.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByText(/MiniApp Platform/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sizes the surface in viewport units, not by inset alone", () => {
    // The host's page wrapper animates `transform`, which makes it the
    // containing block for fixed descendants. Relying on `inset-0` alone
    // collapsed this surface to the wrapper's zero height in production.
    render(<PlayPage {...PROPS} />);

    const surface = screen.getByTestId("standalone-miniapp-frame").parentElement!;
    expect(surface).toHaveClass("h-screen");
    expect(surface).toHaveClass("w-screen");
    expect(surface).toHaveStyle({ height: "100dvh" });
  });

  it("keeps the opaque-origin sandbox the embedded surface uses", () => {
    render(<PlayPage {...PROPS} />);

    expect(screen.getByTestId("standalone-miniapp-frame")).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
    );
  });

  it("shows the shared loader until the bundle reports load", () => {
    render(<PlayPage {...PROPS} />);

    const loader = screen.getByTestId("standalone-miniapp-frame-loading");
    expect(loader).toHaveTextContent("Loading 2048");
    expect(loader).toHaveTextContent("Version 1.3.0");
  });

  it("delegates motion sensors only to the goose game", () => {
    const { rerender } = render(<PlayPage {...PROPS} appId="miniapp-zhuada-e" />);
    expect(screen.getByTestId("standalone-miniapp-frame")).toHaveAttribute(
      "allow",
      "accelerometer *; gyroscope *",
    );

    rerender(<PlayPage {...PROPS} />);
    expect(screen.getByTestId("standalone-miniapp-frame")).not.toHaveAttribute("allow");
  });

  it("resolves the CDN entry and marks the launch as standalone", async () => {
    global.fetch = catalogFetch();

    const result = await getServerSideProps({
      params: { id: "game-2048" },
      query: {},
    } as never);

    expect("props" in result).toBe(true);
    const props = (result as { props: typeof PROPS }).props;
    expect(props.appId).toBe("miniapp-game-2048");
    expect(props.version).toBe("1.3.0");
    // `source=standalone` tells the app shell it owns the viewport.
    expect(props.url).toContain(`${CDN}/minigames/game-2048/1.3.0/index.html?`);
    expect(props.url).toContain("source=standalone");
  });

  it("passes launch parameters through to the app but never overrides source", async () => {
    global.fetch = catalogFetch();

    const result = await getServerSideProps({
      params: { id: "game-2048" },
      query: { network: "mainnet", operation: "claim", source: "onegate", ref: "abc" },
    } as never);

    const props = (result as { props: typeof PROPS }).props;
    const url = new URL(props.url);
    expect(url.searchParams.get("network")).toBe("mainnet");
    expect(url.searchParams.get("operation")).toBe("claim");
    expect(url.searchParams.get("ref")).toBe("abc");
    expect(url.searchParams.get("source")).toBe("standalone");
    expect(props.network).toBe("mainnet");
  });

  it("404s for an app that is neither on the CDN nor bundled", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;

    const result = await getServerSideProps({
      params: { id: "does-not-exist" },
      query: {},
    } as never);

    expect(result).toEqual({ notFound: true });
  });
});

describe("standalone frame load states", () => {
  const app = {
    appId: "miniapp-game-2048",
    name: "2048 Rush",
    url: "https://meshmini.app/minigames/game-2048/2.0.0/index.html",
    network: "testnet" as const,
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("holds the loader and stays silent before the bundle is slow", () => {
    render(<StandaloneMiniAppFrame {...app} />);

    expect(screen.getByTestId("standalone-miniapp-frame")).toHaveClass("opacity-0");
    expect(screen.queryByTestId("standalone-miniapp-frame-error")).not.toBeInTheDocument();

    // Just short of the timeout: a slow bundle must not be called a failure.
    act(() => {
      jest.advanceTimersByTime(19_000);
    });
    expect(screen.queryByTestId("standalone-miniapp-frame-error")).not.toBeInTheDocument();
  });

  it("offers a retry once the bundle has not responded in time", () => {
    render(<StandaloneMiniAppFrame {...app} />);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });

    const failure = screen.getByTestId("standalone-miniapp-frame-error");
    expect(failure).toBeInTheDocument();
    // Announced, not just drawn - this replaces the whole surface.
    expect(failure).toHaveAttribute("role", "status");
    expect(failure).toHaveAttribute("aria-live", "polite");
  });

  it("re-requests the bundle when retry is pressed", () => {
    render(<StandaloneMiniAppFrame {...app} />);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    // The failure clears and the loader comes back for the new attempt.
    expect(screen.queryByTestId("standalone-miniapp-frame-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("standalone-miniapp-frame")).toHaveClass("opacity-0");
  });

  it("reveals the app and drops the loader once the bundle reports load", () => {
    render(<StandaloneMiniAppFrame {...app} />);

    fireEvent.load(screen.getByTestId("standalone-miniapp-frame"));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByTestId("standalone-miniapp-frame")).toHaveClass("opacity-100");
    expect(screen.queryByTestId("standalone-miniapp-frame-error")).not.toBeInTheDocument();
  });

  it("clears the failure when a slow bundle finally arrives", () => {
    // The sequence the !loaded guard exists for: the bundle misses the timeout,
    // the failure replaces the surface, and then the bundle loads anyway. It
    // must hand the surface back rather than leaving the retry card over a
    // working app.
    render(<StandaloneMiniAppFrame {...app} />);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(screen.getByTestId("standalone-miniapp-frame-error")).toBeInTheDocument();

    fireEvent.load(screen.getByTestId("standalone-miniapp-frame"));

    expect(screen.queryByTestId("standalone-miniapp-frame-error")).not.toBeInTheDocument();
  });

  it("does not call a loaded bundle timed out", () => {
    render(<StandaloneMiniAppFrame {...app} />);

    fireEvent.load(screen.getByTestId("standalone-miniapp-frame"));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.queryByTestId("standalone-miniapp-frame-error")).not.toBeInTheDocument();
  });
});
