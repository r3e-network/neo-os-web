import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MiniAppDetailPage from "../../pages/miniapps/[id]";
import {
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_RESULT,
} from "../../components/playarea/PlayAreaShared";

jest.mock("../../components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

jest.mock("../../components/AppDetailHeader", () => ({
  AppDetailHeader: ({ app }: { app: { name: string } }) => (
    <div data-testid="detail-header">{app.name}</div>
  ),
}));

jest.mock("../../components/MiniAppPlayfield", () => ({
  MiniAppPlayfield: () => <div data-testid="playfield" />,
}));

jest.mock("../../components/OperationPanel", () => ({
  OperationPanel: ({
    operations = [],
    getDisabledReason,
  }: {
    operations?: Array<{ name?: string; method?: string }>;
    getDisabledReason?: (operation: {
      name?: string;
      method?: string;
    }) => string | null;
  }) => (
    <div data-testid="operation-panel">
      {operations.map((operation) => {
        const disabledReason = getDisabledReason?.(operation);
        return (
          <div key={`${operation.method}:${operation.name}`}>
            <span>{operation.name}</span>
            {disabledReason && (
              <span data-testid={`disabled-${operation.method}`}>
                {disabledReason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  ),
}));

jest.mock("../../components/features/reviews", () => ({
  ReviewsTab: () => <div data-testid="reviews-tab" />,
}));

jest.mock("../../components/features/forum", () => ({
  ForumTab: () => <div data-testid="forum-tab" />,
}));

jest.mock("../../components/features/secrets/AppSecretsTab", () => ({
  AppSecretsTab: () => <div data-testid="secrets-tab" />,
}));

jest.mock("../../components/features/miniapp/DetailContentBlocks", () => ({
  DetailContentBlocks: () => <div data-testid="detail-content-blocks" />,
}));

jest.mock("../../hooks/useActivityFeed", () => ({
  useActivityFeed: () => ({ activities: [] }),
}));

jest.mock("../../lib/wallet/store", () => ({
  useWalletStore: jest.fn((selector?: (state: unknown) => unknown) => {
    const state = { connected: false, address: "" };
    return typeof selector === "function" ? selector(state) : state;
  }),
  getWalletAdapter: jest.fn(),
}));

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    asPath: "/miniapps/miniapp-demo?network=testnet",
  }),
}));

const CONTRACT_HASH = "0x68ef0ead081d2263acc51ce82f5c70c46440cca4";
const TXID =
  "0x9f53a363fa1f0536b5112c31ad28295799319984730477432c6d6e63f0c7c7aa";

function buildApp() {
  return {
    app_id: "miniapp-demo",
    name: "Demo App",
    description: "Demo description",
    icon: "D",
    category: "gaming",
    entry_url: "/miniapps/demo/index.html",
    permissions: { payments: true },
    contracts: { "neo-n3-testnet": CONTRACT_HASH },
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [] },
      ],
      operation_panel: {
        title: "Demo Actions",
        operations: [
          { name: "Create Envelope", method: "createEnvelope", params: [] },
          { name: "Claim Envelope", method: "claimEnvelope", params: [] },
          { name: "Check In", method: "checkIn", params: [] },
        ],
      },
    },
  };
}

function renderDetailPage() {
  return render(
    <MiniAppDetailPage
      app={buildApp() as never}
      initialTargetNetwork="testnet"
      miniAppNav={[]}
      notifications={[]}
      sharedRuntime={null}
    />,
  );
}

describe("MiniAppDetailPage cross-lane double-submit guard", () => {
  it("locks the matching console operation by resolved chain method + contract hash", async () => {
    renderDetailPage();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOST_WALLET_BRIDGE_RESULT, {
          detail: {
            appId: "miniapp-demo",
            network: "testnet",
            requestMethod: "invoke",
            txid: TXID,
            operation: "createEnvelope",
            // Different casing / prefix than the manifest hash on purpose —
            // the matcher must normalize both sides.
            contractHash: CONTRACT_HASH.replace("0x", "0X").toUpperCase(),
            memo: "",
            at: new Date().toISOString(),
          },
        }),
      );
    });

    await waitFor(() =>
      expect(
        screen.getAllByTestId("disabled-createEnvelope")[0],
      ).toHaveTextContent("Already submitted from the embedded workspace"),
    );
    // Sibling operations stay armed with the regular wallet-required reason.
    expect(
      screen.getAllByTestId("disabled-claimEnvelope")[0],
    ).not.toHaveTextContent("Already submitted from the embedded workspace");
  });

  it("locks deposit-then-act operations via the <appId>:<action> transfer memo", async () => {
    renderDetailPage();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOST_WALLET_BRIDGE_RESULT, {
          detail: {
            appId: "miniapp-demo",
            network: "testnet",
            requestMethod: "invoke",
            txid: TXID,
            operation: "transfer",
            contractHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
            memo: "miniapp-demo:checkin",
            at: new Date().toISOString(),
          },
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getAllByTestId("disabled-checkIn")[0]).toHaveTextContent(
        "Already submitted from the embedded workspace",
      ),
    );
    expect(
      screen.getAllByTestId("disabled-createEnvelope")[0],
    ).not.toHaveTextContent("Already submitted from the embedded workspace");
  });

  it("renders the embedded submission as a receipt with short txid and explorer link", async () => {
    renderDetailPage();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOST_WALLET_BRIDGE_RESULT, {
          detail: {
            appId: "miniapp-demo",
            network: "testnet",
            requestMethod: "invoke",
            txid: TXID,
            operation: "createEnvelope",
            contractHash: CONTRACT_HASH,
            memo: "",
            at: new Date().toISOString(),
          },
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getAllByTestId("invoke-feedback").length).toBeGreaterThan(
        0,
      ),
    );
    expect(
      screen.getByText(
        `Embedded workspace submitted transaction: ${TXID.slice(0, 10)}...${TXID.slice(-8)}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /view on explorer/i })[0],
    ).toHaveAttribute(
      "href",
      `https://dora.coz.io/transaction/neo3/testnet/${TXID}`,
    );
  });
});

describe("MiniAppDetailPage bridge rejection notice", () => {
  it("shows a short-lived host notice when an embedded request is rejected", async () => {
    renderDetailPage();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOST_WALLET_BRIDGE_ERROR, {
          detail: {
            appId: "miniapp-demo",
            network: "testnet",
            requestMethod: "invoke",
            message: "User rejected the request.",
            rejected: true,
            at: new Date().toISOString(),
          },
        }),
      );
    });

    await waitFor(() =>
      expect(
        screen.getAllByTestId("bridge-error-notice")[0],
      ).toHaveTextContent("Request rejected — nothing was submitted."),
    );
  });

  it("ignores bridge errors for other apps", async () => {
    renderDetailPage();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(HOST_WALLET_BRIDGE_ERROR, {
          detail: {
            appId: "miniapp-other",
            network: "testnet",
            requestMethod: "invoke",
            message: "User rejected the request.",
            rejected: true,
            at: new Date().toISOString(),
          },
        }),
      );
    });

    expect(screen.queryByTestId("bridge-error-notice")).not.toBeInTheDocument();
  });
});

describe("MiniAppDetailPage mobile action sheet", () => {
  it("locks body scroll while the sheet is open and restores it on close", async () => {
    renderDetailPage();

    expect(document.body.style.overflow).not.toBe("hidden");
    fireEvent.click(screen.getByTestId("mobile-action-open"));
    expect(screen.getByTestId("mobile-action-sheet")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Close actions" })[1],
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("mobile-action-sheet"),
      ).not.toBeInTheDocument(),
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("moves focus to the close button when the sheet opens", async () => {
    renderDetailPage();

    fireEvent.click(screen.getByTestId("mobile-action-open"));
    const closeButton = document.querySelector("[data-mobile-action-close]");
    expect(closeButton).not.toBeNull();
    await waitFor(() => expect(closeButton).toHaveFocus());
  });
});
