import type ReactType from "react";

describe("FederatedMiniApp env access", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_MF_REMOTES;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("reads NEXT_PUBLIC_MF_REMOTES lazily at render time", () => {
    const { TextEncoder } = require("util") as typeof import("util");
    Object.assign(global, { TextEncoder });

    const React = require("react") as typeof ReactType;
    const { renderToString } =
      require("react-dom/server") as typeof import("react-dom/server");
    const { FederatedMiniApp } =
      require("../../components/FederatedMiniApp") as typeof import("../../components/FederatedMiniApp");

    process.env.NEXT_PUBLIC_MF_REMOTES = "miniapp=https://remote.example";

    const html = renderToString(
      React.createElement(FederatedMiniApp, { remote: "miniapp" }),
    );

    expect(html).not.toContain("Module Federation Not Configured");
    expect(html).toContain("Loading federated MiniApp");
  });
});
