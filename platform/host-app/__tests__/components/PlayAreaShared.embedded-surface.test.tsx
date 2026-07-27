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

// autoLoad short-circuits the deferred-bundle poster: every test in this file is
// about what happens once the bundle has been requested. The poster itself is
// covered by the deferred-bundle describe block at the end.
const SURFACE_PROPS = {
  title: "Live MiniApp workspace",
  subtitle: "Embedded surface",
  url: "/miniapps/demo/index.html?network=testnet&source=embed",
  frameTitle: "Demo dApp",
  testId: "native-dapp-frame-miniapp-demo",
  autoLoad: true,
} as const;

describe("EmbeddedDappSurface load-failure recovery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
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

  it("delegates motion sensors only to Goose Basket Shuffle while preserving the sandbox", () => {
    const { rerender } = render(
      <EmbeddedDappSurface {...SURFACE_PROPS} appId="miniapp-zhuada-e" />,
    );
    const gooseFrame = screen.getByTestId("native-dapp-frame-miniapp-demo");
    expect(gooseFrame).toHaveAttribute("allow", "accelerometer *; gyroscope *");
    expect(gooseFrame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
    );

    rerender(<EmbeddedDappSurface {...SURFACE_PROPS} appId="miniapp-demo" />);
    expect(screen.getByTestId("native-dapp-frame-miniapp-demo")).not.toHaveAttribute("allow");
  });

  // Assertion update (audit fix C-4, commit a8101a750): this test previously
  // pinned the app-scoped `allow-same-origin` grant for Automation Copilot.
  // That grant was deliberately removed — it let a compromised bundle reach
  // the host's session storage — and the contract security regression
  // AuditFixC4_MiniAppIframesAreSandboxed now forbids allow-same-origin on
  // any miniapp sandbox line, so the old assertion pinned a security hole and
  // was already failing. The replacement pins the successor invariant: the
  // copilot iframe keeps the opaque sandbox and its host session flows only
  // through the appId-gated credential bridge.
  it("keeps the opaque sandbox for the automation studio and serves its session over the credential bridge", () => {
    window.sessionStorage.setItem("sb-access-token", "host-session-jwt");
    try {
      const { rerender } = render(
        <EmbeddedDappSurface {...SURFACE_PROPS} appId="miniapp-automation-copilot" />,
      );
      const frame = screen.getByTestId("native-dapp-frame-miniapp-demo") as HTMLIFrameElement;
      expect(frame).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
      );

      const frameWindow = frame.contentWindow!;
      const post = jest.spyOn(frameWindow, "postMessage").mockImplementation(() => {});
      const credentialRequest = {
        type: "neo-miniapp-credential:request",
        version: 1,
        requestId: "credential-test-01",
        appId: "miniapp-automation-copilot",
        scope: "automation-gateway",
      };

      act(() => {
        window.dispatchEvent(new MessageEvent("message", {
          origin: "null",
          source: frameWindow,
          data: credentialRequest,
        }));
      });
      expect(post).toHaveBeenCalledWith(expect.objectContaining({
        type: "neo-miniapp-credential:response",
        requestId: "credential-test-01",
        ok: true,
        token: "host-session-jwt",
        apiKey: "",
      }), "*");

      // A non-opaque (non-"null") origin must be rejected even from the same
      // window reference.
      post.mockClear();
      act(() => {
        window.dispatchEvent(new MessageEvent("message", {
          origin: window.location.origin,
          source: frameWindow,
          data: { ...credentialRequest, requestId: "credential-test-02" },
        }));
      });
      expect(post).not.toHaveBeenCalled();

      // A request without the automation-gateway scope must fail closed.
      act(() => {
        window.dispatchEvent(new MessageEvent("message", {
          origin: "null",
          source: frameWindow,
          data: { ...credentialRequest, requestId: "credential-test-03", scope: "wallet" },
        }));
      });
      expect(post).not.toHaveBeenCalled();

      // The bridge is keyed to the canonical copilot app id — a generic
      // catalog app never gets a credential lane.
      rerender(<EmbeddedDappSurface {...SURFACE_PROPS} appId="miniapp-demo" />);
      const genericFrame = screen.getByTestId("native-dapp-frame-miniapp-demo") as HTMLIFrameElement;
      expect(genericFrame).toHaveAttribute(
        "sandbox",
        "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
      );
      const genericWindow = genericFrame.contentWindow!;
      const genericPost = jest
        .spyOn(genericWindow, "postMessage")
        .mockImplementation(() => {});
      act(() => {
        window.dispatchEvent(new MessageEvent("message", {
          origin: "null",
          source: genericWindow,
          data: { ...credentialRequest, requestId: "credential-test-04", appId: "miniapp-demo" },
        }));
        window.dispatchEvent(new MessageEvent("message", {
          origin: "null",
          source: genericWindow,
          data: { ...credentialRequest, requestId: "credential-test-05" },
        }));
      });
      // The wallet bridge legitimately publishes its state packet to every
      // frame; the invariant is that no credential response ever reaches a
      // non-copilot app.
      expect(genericPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "neo-miniapp-credential:response" }),
        expect.anything(),
      );
    } finally {
      window.sessionStorage.removeItem("sb-access-token");
    }
  });

  it("bridges only namespaced local game storage to the opaque goose iframe", () => {
    render(<EmbeddedDappSurface {...SURFACE_PROPS} appId="miniapp-zhuada-e" />);
    const frame = screen.getByTestId("native-dapp-frame-miniapp-demo") as HTMLIFrameElement;
    const frameWindow = frame.contentWindow!;
    const post = jest.spyOn(frameWindow, "postMessage").mockImplementation(() => {});
    window.localStorage.setItem(
      "neo-miniapp-storage:miniapp-zhuada-e:zhuada-e:progress",
      "{\"v\":3}",
    );

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frameWindow,
        data: {
          type: "neo-miniapp-storage:request",
          version: 1,
          requestId: "hydrate-test-123",
          appId: "miniapp-zhuada-e",
          op: "getAll",
        },
      }));
    });
    expect(post).toHaveBeenCalledWith(expect.objectContaining({
      type: "neo-miniapp-storage:response",
      requestId: "hydrate-test-123",
      ok: true,
      values: { "zhuada-e:progress": "{\"v\":3}" },
    }), "*");

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frameWindow,
        data: {
          type: "neo-miniapp-storage:request",
          version: 1,
          requestId: "write-test-1234",
          appId: "miniapp-zhuada-e",
          op: "set",
          key: "zhuada-e:theme",
          value: "night-market",
        },
      }));
    });
    expect(window.localStorage.getItem(
      "neo-miniapp-storage:miniapp-zhuada-e:zhuada-e:theme",
    )).toBe("night-market");
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
