import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createObservable } from "../reactive";

const FACTORY_HASH = `0x${"ab".repeat(20)}`;
const APP_ID = "platform-factory-test";
const NETWORK = "neo-n3-testnet" as const;
const controlMethods = new Set([
  "_deploy",
  "_initialize",
  "admin",
  "setAdmin",
  "update",
  "registerTemplate",
  "registerTemplateArtifact",
]);

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  launchContext: Record<string, unknown> = { appId: APP_ID },
) {
  const chain = {
    address: createObservable<string | null>(`0x${"11".repeat(20)}`),
    contractAddress: createObservable<string | null>(FACTORY_HASH),
    ensureWallet: vi.fn(async () => `0x${"11".repeat(20)}`),
    read: vi.fn(async (_operation: string, _args?: unknown[], _options?: unknown): Promise<unknown> => "1"),
    invoke: vi.fn(async (_operation: string, _args: unknown[], _options?: unknown) => ({ txid: "0xtx", success: true })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: APP_ID,
    platformFactory: { hashes: { [NETWORK]: FACTORY_HASH } },
    ...options,
  });
  return { app, chain };
}

describe("app.platformFactory", () => {
  it("fails closed for missing or network-incomplete config", async () => {
    const missing = makeApp({ platformFactory: undefined });
    expect(missing.app.platformFactory.available).toBe(false);
    await expect(missing.app.platformFactory.templateCount(NETWORK)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkCapabilityError && error.capability === "platformFactory",
    );

    const partial = makeApp();
    expect(partial.app.platformFactory.availableOn("neo-n3-mainnet")).toBe(false);
    await expect(partial.app.platformFactory.templateCount("neo-n3-mainnet"))
      .rejects.toBeInstanceOf(FrameworkCapabilityError);
  });

  it("targets the configured network and validates plan execution calls", async () => {
    const { app, chain } = makeApp();
    await app.platformFactory.executeDeploymentCall(NETWORK, {
      operation: "createMiniAppFromTemplate",
      args: [
        { type: "String", value: "tpl.reward" },
        { type: "String", value: "pkg-1" },
        { type: "String", value: "digest" },
        { type: "String", value: "{}" },
      ],
    }, { waitForEvent: "MiniAppCreated" });
    expect(chain.invoke).toHaveBeenCalledWith("createMiniAppFromTemplate", [
      { type: "String", value: "tpl.reward" },
      { type: "String", value: "pkg-1" },
      { type: "String", value: "digest" },
      { type: "String", value: "{}" },
    ], { scriptHash: FACTORY_HASH, waitForEvent: "MiniAppCreated" });

    await expect(app.platformFactory.executeDeploymentCall(NETWORK, {
      operation: "deployArtifactFromTemplate",
      args: [],
    })).rejects.toThrow(/exactly 6 arguments/);
  });

  it("covers every tenant-facing MiniAppFactory ABI method", async () => {
    const { app, chain } = makeApp();
    const common = { templateId: "tpl", packageId: "pkg", digest: "digest", initParams: "{}" };

    await app.platformFactory.getTemplate(NETWORK, "tpl");
    await app.platformFactory.templateExists(NETWORK, "tpl");
    await app.platformFactory.templateCount(NETWORK);
    await app.platformFactory.getTemplateIdByIndex(NETWORK, 0);
    await app.platformFactory.deployFromTemplate(NETWORK, common);
    await app.platformFactory.createMiniAppFromTemplate(NETWORK, common);
    await app.platformFactory.deployArtifactFromTemplate(NETWORK, {
      ...common,
      nef: "AQID",
      manifest: "{}",
    });
    await app.platformFactory.getDeployment(NETWORK, "pkg");
    await app.platformFactory.getMiniApp(NETWORK, "pkg");
    await app.platformFactory.deploymentCount(NETWORK);
    await app.platformFactory.miniAppCount(NETWORK);
    await app.platformFactory.getDeploymentIdByIndex(NETWORK, 0);
    await app.platformFactory.getMiniAppIdByIndex(NETWORK, 0);

    const operations = [
      ...chain.read.mock.calls.map((call) => call[0]),
      ...chain.invoke.mock.calls.map((call) => call[0]),
    ].sort();
    const manifest = JSON.parse(fs.readFileSync(
      path.resolve(process.cwd(), "../contracts/build/MiniAppFactory.manifest.json"),
      "utf8",
    ));
    const tenantAbi = manifest.abi.methods
      .map((method: { name: string }) => method.name)
      .filter((name: string) => !controlMethods.has(name))
      .sort();
    expect(operations).toEqual(tenantAbi);
  });

  it("runs guest then permission guards before writes", async () => {
    const guest = makeApp();
    guest.app.mode.set("guest");
    await expect(guest.app.platformFactory.createMiniAppFromTemplate(NETWORK, {
      templateId: "tpl", packageId: "pkg", digest: "digest", initParams: "{}",
    })).rejects.toThrow(/guest-mode/);
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: {} });
    await expect(denied.app.platformFactory.deployFromTemplate(NETWORK, {
      templateId: "tpl", packageId: "pkg", digest: "digest", initParams: "{}",
    })).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:primary",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();
  });
});
