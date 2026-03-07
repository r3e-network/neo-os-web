describe("isEdgeRpcAllowed env access", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.EDGE_RPC_ALLOWLIST;
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", writable: true });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("reads EDGE_RPC_ALLOWLIST lazily at call time", () => {
    const { isEdgeRpcAllowed } = require("../../lib/edge") as typeof import("../../lib/edge");

    process.env.EDGE_RPC_ALLOWLIST = "relay,sponsor";

    expect(isEdgeRpcAllowed("relay")).toBe(true);
    expect(isEdgeRpcAllowed("sponsor")).toBe(true);
    expect(isEdgeRpcAllowed("twitter-feed")).toBe(false);
  });
});
