import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  ChainStateStrip,
  EmbeddedDappSurface,
  HOST_PLAYFIELD_REFRESH,
} from "../../components/playarea/PlayAreaShared";

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

const SURFACE_PROPS = {
  title: "Live MiniApp workspace",
  subtitle: "Embedded surface",
  url: "/miniapps/demo/index.html?network=testnet&source=embed",
  frameTitle: "Demo dApp",
  testId: "native-dapp-frame-miniapp-demo",
} as const;

describe("EmbeddedDappSurface load-failure recovery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("swaps the infinite spinner for a Retry / new-window card after the load timeout", () => {
    render(<EmbeddedDappSurface {...SURFACE_PROPS} />);

    expect(
      screen.getByTestId("native-dapp-frame-miniapp-demo-loading"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("native-dapp-frame-miniapp-demo-load-error"),
    ).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(15_001);
    });

    expect(
      screen.getByTestId("native-dapp-frame-miniapp-demo-load-error"),
    ).toBeInTheDocument();
    expect(screen.getByText(/still loading demo/i)).toBeInTheDocument();
    expect(
      screen.getByTestId("native-dapp-frame-miniapp-demo-retry"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open in new window/i }),
    ).toHaveAttribute("href", SURFACE_PROPS.url);
  });

  it("returns to the loading state when Retry is pressed", () => {
    render(<EmbeddedDappSurface {...SURFACE_PROPS} />);

    act(() => {
      jest.advanceTimersByTime(15_001);
    });
    fireEvent.click(screen.getByTestId("native-dapp-frame-miniapp-demo-retry"));

    expect(
      screen.getByTestId("native-dapp-frame-miniapp-demo-loading"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("native-dapp-frame-miniapp-demo-load-error"),
    ).not.toBeInTheDocument();
  });

  it("does not show the failure card once the frame has loaded", () => {
    render(<EmbeddedDappSurface {...SURFACE_PROPS} />);

    fireEvent.load(screen.getByTestId("native-dapp-frame-miniapp-demo"));
    act(() => {
      jest.advanceTimersByTime(15_001);
    });

    expect(
      screen.queryByTestId("native-dapp-frame-miniapp-demo-load-error"),
    ).not.toBeInTheDocument();
    // Settle delay elapsed, so the loading overlay is gone too.
    expect(
      screen.queryByTestId("native-dapp-frame-miniapp-demo-loading"),
    ).not.toBeInTheDocument();
  });

  it("keeps the pop-out escape hatch reachable on touch devices", () => {
    render(<EmbeddedDappSurface {...SURFACE_PROPS} />);

    const popOut = screen.getByLabelText("Open dApp in a new window");
    // Base (mobile / coarse pointer) opacity must not be 0; the hide-on-idle
    // behavior is scoped to sm+ where hover exists.
    expect(popOut.className).not.toMatch(/(^|\s)opacity-0(\s|$)/);
    expect(popOut.className).toContain("sm:opacity-0");
    expect(popOut.className).toContain("sm:group-hover:opacity-100");
  });
});

describe("ChainStateStrip host refresh broadcast", () => {
  it("re-reads chain state when the host dispatches a playfield refresh", () => {
    const onRefresh = jest.fn();
    render(
      <ChainStateStrip
        loading={false}
        error={null}
        contractHash="0x442162de9c0d0e30b09590b125c2b1f7e8fa5e3b"
        network="testnet"
        onRefresh={onRefresh}
      />,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(HOST_PLAYFIELD_REFRESH));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
