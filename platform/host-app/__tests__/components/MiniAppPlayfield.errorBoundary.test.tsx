import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../../components/playarea/PlayAreaRegistry", () => ({
  PlayAreaRegistry: () => {
    throw new Error("playarea render crash");
  },
}));

jest.mock("@/lib/monitoring/errors", () => ({
  trackError: jest.fn(() => "err_playarea_test"),
  getTrackedErrors: jest.fn(() => []),
  getErrorCount: jest.fn(() => 0),
}));

jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { MiniAppPlayfield } from "../../components/MiniAppPlayfield";
import type { MiniAppInfo } from "../../components/types";
import { trackError } from "@/lib/monitoring/errors";

const app: MiniAppInfo = {
  app_id: "miniapp-gasbox",
  name: "GASBox",
  description: "Gacha machine",
  icon: "G",
  category: "gaming",
  entry_url: "mf://manifest?app=miniapp-gasbox",
  contract_hash: "0x1234567890abcdef1234567890abcdef12345678",
  permissions: {},
};

describe("MiniAppPlayfield error boundary", () => {
  const originalFetch = global.fetch;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs caught render errors through console.error; keep test output clean.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("contains a playarea render crash to a compact refresh card without blanking the page", () => {
    render(
      <div>
        <span data-testid="page-shell">operations panel</span>
        <MiniAppPlayfield app={app} />
      </div>,
    );

    expect(
      screen.getByText("This play area failed to render"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    // The crash stays inside the playarea boundary; sibling page content survives.
    expect(screen.getByTestId("page-shell")).toBeInTheDocument();
    expect(trackError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "playarea render crash" }),
      expect.objectContaining({
        extra: expect.objectContaining({ componentName: "playarea:miniapp-gasbox" }),
      }),
    );
  });
});
