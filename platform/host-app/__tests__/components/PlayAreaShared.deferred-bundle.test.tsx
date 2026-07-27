import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { EmbeddedDappSurface } from "../../components/playarea/PlayAreaShared";

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

const BASE_PROPS = {
  title: "Live MiniApp workspace",
  subtitle: "Embedded surface",
  url: "https://cdn.example.test/minigames/game-2048/1.3.0/index.html?network=testnet&source=embed",
  frameTitle: "2048 dApp",
  testId: "native-dapp-frame-miniapp-game-2048",
  posterName: "2048",
  posterDescription: "Slide tiles to reach 2048.",
  posterIconUrl: "https://cdn.example.test/minigames/game-2048/1.3.0/logo.webp",
  posterVersion: "1.3.0",
} as const;

const POSTER = `${BASE_PROPS.testId}-poster`;
const OPEN = `${BASE_PROPS.testId}-open`;
const FRAME = BASE_PROPS.testId;
const LOADING = `${BASE_PROPS.testId}-loading`;

describe("EmbeddedDappSurface deferred bundle", () => {
  it("shows metadata and artwork without requesting the bundle", () => {
    render(<EmbeddedDappSurface {...BASE_PROPS} />);

    expect(screen.getByTestId(POSTER)).toBeInTheDocument();
    expect(screen.getByText("2048")).toBeInTheDocument();
    expect(screen.getByText("Slide tiles to reach 2048.")).toBeInTheDocument();
    // The iframe is what would fetch ~1MB from the CDN, so it must not exist yet.
    expect(screen.queryByTestId(FRAME)).not.toBeInTheDocument();
    expect(screen.queryByTestId(LOADING)).not.toBeInTheDocument();
  });

  it("mounts the frame with the CDN entry only once the visitor opens it", () => {
    render(<EmbeddedDappSurface {...BASE_PROPS} />);

    fireEvent.click(screen.getByTestId(OPEN));

    const frame = screen.getByTestId(FRAME);
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute("src", BASE_PROPS.url);
    expect(screen.queryByTestId(POSTER)).not.toBeInTheDocument();
  });

  it("shows the shared loader between opening and the frame reporting load", () => {
    render(<EmbeddedDappSurface {...BASE_PROPS} />);
    fireEvent.click(screen.getByTestId(OPEN));

    const loader = screen.getByTestId(LOADING);
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveTextContent("Loading 2048");
    expect(loader).toHaveTextContent("Version 1.3.0");
  });

  it("keeps the opaque-origin sandbox on the deferred frame", () => {
    render(<EmbeddedDappSurface {...BASE_PROPS} />);
    fireEvent.click(screen.getByTestId(OPEN));

    expect(screen.getByTestId(FRAME)).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
    );
  });

  it("autoLoad skips the poster for surfaces the visitor already chose to open", () => {
    render(<EmbeddedDappSurface {...BASE_PROPS} autoLoad />);

    expect(screen.queryByTestId(POSTER)).not.toBeInTheDocument();
    expect(screen.getByTestId(FRAME)).toBeInTheDocument();
  });

  it("falls back to the frame title when no poster metadata is supplied", () => {
    render(
      <EmbeddedDappSurface
        title={BASE_PROPS.title}
        subtitle={BASE_PROPS.subtitle}
        url={BASE_PROPS.url}
        frameTitle="2048 dApp"
        testId={BASE_PROPS.testId}
      />,
    );

    // "dApp" is trimmed off the frame title for display.
    expect(screen.getByTestId(POSTER)).toHaveTextContent("2048");
    expect(screen.getByTestId(OPEN)).toBeInTheDocument();
  });

  it("does not run the load watchdog while the poster is showing", () => {
    jest.useFakeTimers();
    try {
      render(<EmbeddedDappSurface {...BASE_PROPS} />);
      jest.advanceTimersByTime(60_000);

      // Nothing is in flight, so no failure card - just the poster.
      expect(screen.getByTestId(POSTER)).toBeInTheDocument();
      expect(screen.queryByTestId(`${FRAME}-load-error`)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
