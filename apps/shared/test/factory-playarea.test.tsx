import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type Observable } from "../react/context";
import { factoryMessages } from "../factory/messages";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";
// Checksum-valid address whose script hash is 0x11…11 (see factory-chain.test).
const OWNER = "NMUD7q5tYaFtw4w4hXk3feupGSGnv9jcrQ";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

/**
 * Resolves through the real engine locale map so any statically referenced
 * key missing from factoryMessages fails the test instead of rendering "".
 */
function t(key: string, params?: Record<string, string | number>): string {
  const entry = (factoryMessages as Record<string, { en: string } | string>)[
    key
  ];
  if (!entry) throw new Error(`missing factoryMessages key: ${key}`);
  let text = typeof entry === "string" ? entry : entry.en;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(params[name] ?? ""),
    );
  }
  return text;
}

interface HarnessState {
  [key: string]: Observable;
}

function buildState(
  overrides: Partial<Record<string, unknown>> = {},
): HarnessState {
  const defaults: Record<string, unknown> = {
    currentPlan: null,
    walletAddress: null,
    artifactPresence: {},
    isSigning: false,
    isGenerating: false,
    isExecuting: false,
    walletSignature: "",
    walletSignatureInfo: null,
    lastError: "",
    lastTxid: "",
    deployedContractHash: "",
    executedDigest: "",
    feeEstimateGas: "",
    deployments: [],
    deploymentsTotal: 0,
    deploymentsState: "idle",
  };
  const state: HarnessState = {};
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    state[key] = createObservable(value);
  }
  return state;
}

async function loadFactoryModules() {
  vi.stubEnv("VITE_NEO_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_ASSET_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_NFT_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.stubEnv("VITE_MINIAPP_FACTORY_TESTNET_CONTRACT", FACTORY_HASH);
  vi.resetModules();
  const plan = await import("../factory/factoryPlan");
  const playArea = await import("../factory/FactoryPlayArea");
  return { ...plan, ...playArea };
}

function renderPlayArea(
  Component: React.ComponentType<Record<string, unknown>>,
  kind: string,
  state: HarnessState,
  dispatch = vi.fn(async () => undefined),
  extraProps: Record<string, unknown> = {},
) {
  const appId = `miniapp-${kind === "nep17" ? "asset" : kind === "nep11" ? "nft" : "miniapp"}-factory`;
  const launchContext = parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/factory/index.html?network=testnet`,
    appId,
  );
  render(
    <Component
      t={t}
      state={state}
      dispatch={dispatch}
      launchContext={launchContext}
      fixedKind={kind}
      appId={appId}
      {...extraProps}
    />,
  );
  return dispatch;
}

const NEP17_INPUT = {
  name: "Yiwu Credits",
  symbol: "YIWU",
  decimals: "8",
  initialSupply: "1000000",
  owner: OWNER,
  treasury: OWNER,
  mintable: true,
  network: "testnet",
};

describe("FactoryPlayArea", () => {
  it("first paint shows a neutral Draft pill and productized choice controls", async () => {
    const { FactoryPlayArea } = await loadFactoryModules();
    renderPlayArea(FactoryPlayArea as never, "nep17", buildState());

    const pill = document.querySelector(".domain-factory-hero__pill");
    expect(pill?.textContent).toBe("Draft");
    expect(pill?.className).toContain("is-draft");
    expect(pill?.className).not.toContain("is-blocked");
    expect(document.querySelector(".domain-factory")?.className).toContain(
      "domain-factory--stage-draft-needs-work",
    );
    const studioFlow = document.querySelector(".domain-factory-studio-flow");
    expect(studioFlow).toBeTruthy();
    expect(
      studioFlow
        ?.querySelector(".domain-factory-studio-flow__stage--nep17 img")
        ?.getAttribute("src"),
    ).toBe("./token-mint-studio.webp");
    expect(
      document.querySelector(".domain-factory-studio-flow__step--active")
        ?.textContent,
    ).toContain("Draft");
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("input[type='checkbox']")).toHaveLength(0);
    expect(screen.getByRole("radiogroup", { name: "Network" })).toBeTruthy();
    expect(
      screen
        .getByRole("radio", { name: "Network: Neo N3 Testnet" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getAllByRole("button", { name: "Generate template plan" }),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll(".domain-factory-studio-flow__step--blocked"),
    ).toHaveLength(0);
    // The template artifact row is honest about not having a live read yet.
    expect(screen.getAllByText("Unverified").length).toBeGreaterThan(0);
  }, 30_000);

  it("updates miniapp template cards and service switches without native form controls", async () => {
    const { FactoryPlayArea } = await loadFactoryModules();
    renderPlayArea(FactoryPlayArea as never, "miniapp", buildState());

    const oracleTemplate = screen.getByRole("radio", {
      name: "Template kind: Oracle console",
    });
    act(() => {
      oracleTemplate.click();
    });
    expect(oracleTemplate.getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByText("Oracle console").length).toBeGreaterThan(0);

    const oracleSwitch = screen.getByRole("switch", { name: "Needs oracle" });
    expect(oracleSwitch.getAttribute("aria-checked")).toBe("false");
    act(() => {
      oracleSwitch.click();
    });
    expect(oracleSwitch.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("input[type='checkbox']")).toHaveLength(0);
  }, 15_000);

  it("prefills the owner from the connected wallet and drops the blocking owner error", async () => {
    const { FactoryPlayArea } = await loadFactoryModules();
    const state = buildState();
    renderPlayArea(FactoryPlayArea as never, "nep17", state);

    expect(
      screen.getAllByText("Owner must be a Neo N3 address or Hash160.").length,
    ).toBeGreaterThan(0);
    act(() => {
      state.walletAddress.set(OWNER);
    });
    const ownerInput = screen.getByLabelText("Owner") as HTMLInputElement;
    expect(ownerInput.value).toBe(OWNER);
    expect(
      screen.queryByText("Owner must be a Neo N3 address or Hash160."),
    ).toBeNull();
  }, 15_000);

  it("restores an app-owned NEP-17 draft, limits network choices, and journals before generate", async () => {
    const { FactoryPlayArea } = await loadFactoryModules();
    const dispatch = vi.fn(async () => undefined);
    renderPlayArea(FactoryPlayArea as never, "nep17", buildState(), dispatch, {
      initialNep17Draft: {
        ...NEP17_INPUT,
        name: "Restored Credits",
        network: "neo-n3-testnet",
      },
      supportedNetworks: ["neo-n3-testnet"],
      persistDraftAction: "persistAssetDraft",
    });

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Restored Credits",
    );
    expect(
      screen.queryByRole("radio", { name: "Network: Neo N3 Mainnet" }),
    ).toBeNull();
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "persistAssetDraft",
        expect.objectContaining({
          name: "Restored Credits",
          network: "neo-n3-testnet",
        }),
      );
    });

    dispatch.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate template plan" }),
    );
    await waitFor(() => {
      expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
        "persistAssetDraft",
        "generatePlan",
      ]);
    });
  });

  it("blocks the execute button with the honest artifact reason for metadata-only templates", async () => {
    const { FactoryPlayArea, buildFactoryPlan } = await loadFactoryModules();
    const plan = buildFactoryPlan("nep17", NEP17_INPUT, {
      appId: "miniapp-asset-factory",
      artifactPresence: "missing",
      artifactDeploymentSupport: "supported",
    });
    expect(plan.publishable).toBe(true);
    const state = buildState({ currentPlan: plan });
    renderPlayArea(FactoryPlayArea as never, "nep17", state);

    const execute = screen.getByRole("button", {
      name: "Deploy via factory",
    }) as HTMLButtonElement;
    expect(execute.disabled).toBe(true);
    expect(
      screen.getByText(/Template artifact not registered on-chain yet/),
    ).toBeTruthy();
    expect(screen.getAllByText("Metadata only").length).toBeGreaterThan(0);
  });

  it("keeps execute blocked when only a legacy template artifact is present", async () => {
    const { FactoryPlayArea, buildFactoryPlan } = await loadFactoryModules();
    const plan = buildFactoryPlan("nep17", NEP17_INPUT, {
      appId: "miniapp-asset-factory",
      artifactPresence: "present",
      artifactDeploymentSupport: "missing",
    });
    const state = buildState({ currentPlan: plan });
    const dispatch = renderPlayArea(FactoryPlayArea as never, "nep17", state);

    const execute = screen.getByRole("button", {
      name: "Deploy via factory",
    }) as HTMLButtonElement;
    expect(execute.disabled).toBe(true);
    expect(document.querySelector(".domain-factory")?.className).toContain(
      "domain-factory--stage-ready",
    );
    expect(
      screen.getByText(/does not expose the exact six-argument artifact deployment ABI/),
    ).toBeTruthy();
    expect(screen.getAllByText("Preloaded on-chain").length).toBeGreaterThan(0);

    act(() => {
      execute.click();
    });
    expect(dispatch).not.toHaveBeenCalledWith("executePlan");
  });

  it("lists on-chain creations with mine-tagging, record-only labels, and deployed hashes", async () => {
    const { FactoryPlayArea } = await loadFactoryModules();
    const state = buildState({
      walletAddress: OWNER,
      deploymentsState: "ready",
      deploymentsTotal: 2,
      deployments: [
        {
          packageId: "tpl-nep17-asset-v1-aabbccddee",
          templateId: "tpl.nep17.asset.v1",
          digest: "0xabc",
          creator: `0x${"11".repeat(20)}`,
          deployedHash: `0x${"22".repeat(20)}`,
          createdAt: 1765500000000,
        },
        {
          packageId: "tpl-nep17-asset-v1-ffeeddccbb",
          templateId: "tpl.nep17.asset.v1",
          digest: "0xdef",
          creator: "someone-else",
          deployedHash: "",
          createdAt: 0,
        },
      ],
    });
    renderPlayArea(FactoryPlayArea as never, "nep17", state);

    expect(screen.getByText("2 recorded on-chain")).toBeTruthy();
    expect(screen.getByText("tpl-nep17-asset-v1-aabbccddee")).toBeTruthy();
    // creator 0x11…11 matches the connected wallet's script hash.
    expect(screen.getByText("Yours")).toBeTruthy();
    expect(screen.getByText(`0x${"22".repeat(20)}`)).toBeTruthy();
    expect(screen.getByText("Record only — no contract deployed")).toBeTruthy();
  });

  it("shows the bps→percent helper under the NFT royalty input", async () => {
    const { FactoryPlayArea } = await loadFactoryModules();
    renderPlayArea(FactoryPlayArea as never, "nep11", buildState());
    expect(screen.getByText("250 bps = 2.5% of each sale")).toBeTruthy();
    expect(
      document.querySelector(".domain-factory-studio-flow__drop-deck"),
    ).toBeTruthy();
    expect(
      document.querySelectorAll(".domain-factory-studio-flow__drop-deck img"),
    ).toHaveLength(3);
    expect(
      document.querySelector(".domain-factory-drop-rail__stack"),
    ).toBeTruthy();
    expect(
      document.querySelectorAll(".domain-factory-drop-rail__stack img"),
    ).toHaveLength(3);
    expect(
      document.querySelector(".domain-factory-drop-composer"),
    ).toBeTruthy();
    expect(
      document.querySelector(".domain-factory-drop-identity"),
    ).toBeTruthy();
    expect(
      document.querySelector(".domain-factory-drop-field--collection"),
    ).toBeTruthy();
    expect(
      document.querySelector(".domain-factory-drop-field--symbol"),
    ).toBeTruthy();
    expect(
      document.querySelector(".domain-factory-drop-supply-control"),
    ).toBeTruthy();
    expect(
      document.querySelector(".domain-factory-drop-royalty-control"),
    ).toBeTruthy();
    expect(
      document.querySelectorAll(".domain-factory-drop-preset img"),
    ).toHaveLength(4);
    act(() => {
      screen.getByRole("button", { name: /5,000/ }).click();
    });
    expect((screen.getByLabelText("Max supply") as HTMLInputElement).value).toBe(
      "5000",
    );
    fireEvent.change(screen.getByLabelText("Royalty bps"), {
      target: { value: "500" },
    });
    expect(screen.getByText("500 bps = 5% of each sale")).toBeTruthy();
    const soulboundPolicy = screen.getByRole("radio", { name: /Soulbound/ });
    act(() => {
      soulboundPolicy.click();
    });
    expect(soulboundPolicy.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("switch", { name: /Transferable NFT/ })).toBeNull();
    expect(
      document.querySelector(".domain-factory-preview__edition-stack"),
    ).toBeTruthy();
    expect(
      document.querySelectorAll(".domain-factory-preview__edition-stack img"),
    ).toHaveLength(3);
  });

  it("marks a blocked NFT owner inline and discards the stale plan once the draft is fixed", async () => {
    const {
      FactoryPlayArea,
      buildFactoryPlan,
      createFactoryDraftFromLaunchContext,
    } = await loadFactoryModules();
    const launchContext = parseMiniAppLaunchContext(
      "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
      "miniapp-nft-factory",
    );
    const draft = createFactoryDraftFromLaunchContext(
      launchContext,
      "nep11",
    ).nep11;
    const plan = buildFactoryPlan("nep11", draft, {
      appId: "miniapp-nft-factory",
      artifactPresence: "missing",
    });
    expect(plan.blockingErrors).toContain("owner_address");
    const dispatch = renderPlayArea(
      FactoryPlayArea as never,
      "nep11",
      buildState({ currentPlan: plan }),
    );

    const owner = screen.getByLabelText("Owner") as HTMLInputElement;
    expect(owner.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getAllByText("Owner must be a Neo N3 address or Hash160.").length,
    ).toBeGreaterThan(0);

    fireEvent.change(owner, { target: { value: OWNER } });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("discardPlan");
    });
  });

  it("keeps the NFT factory stage animated with reduced-motion support", () => {
    const styles = readFileSync(
      resolve(__dirname, "../factory/FactoryPlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain(".domain-factory-studio-flow__drop-deck");
    expect(styles).toContain(".domain-factory-drop-rail__stack");
    expect(styles).toContain(".domain-factory-drop-composer");
    expect(styles).toContain(".domain-factory-drop-identity");
    expect(styles).toContain(".domain-factory-drop-supply-control");
    expect(styles).toContain(".domain-factory-drop-royalty-control");
    expect(styles).toContain(".domain-factory-drop-preset");
    expect(styles).toContain(".domain-factory-drop-policy");
    expect(styles).toContain(".domain-factory-preview__edition-stack");
    expect(styles).toMatch(/\.domain-factory-drop-composer\s*\{[\s\S]*background:\s*var\(--ns-surface,\s*#ffffff\)/);
    expect(styles).toMatch(/\.domain-factory-drop-composer__presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.domain-factory-drop-preset\s*\{[\s\S]*min-height:\s*58px/);
    expect(styles).toMatch(/\.domain-factory-drop-policy\s*\{[\s\S]*min-height:\s*52px/);
    const mobileDropPolicyBlock =
      styles.match(
        /@media \(max-width:\s*480px\)[\s\S]*?\.domain-factory-drop-composer__policy\s*\{(?<body>[\s\S]*?)\n {2}\}/,
      )?.groups?.body ?? "";
    expect(mobileDropPolicyBlock).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).not.toMatch(/\.domain-factory-drop-preset\s*\{[\s\S]*min-height:\s*112px/);
    expect(mobileDropPolicyBlock).not.toContain("grid-template-columns: 1fr;");
    expect(styles).toContain("@keyframes domain-factory-nft-card-float");
    expect(styles).toContain("@keyframes domain-factory-nft-drop-cycle");
    expect(styles).toContain("@keyframes domain-factory-nft-mint-scan");
    expect(styles).toContain("@keyframes domain-factory-drop-field-scan");
    expect(styles).toContain("@keyframes domain-factory-drop-control-lock");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/\.domain-factory-control-card\s*\{[\s\S]*order:\s*1/);
    expect(styles).toMatch(/\.domain-factory-output\s*\{[\s\S]*order:\s*2/);
  });

  it("binds the wallet signature into the copyable package JSON once signed", async () => {
    const { FactoryPlayArea, buildFactoryPlan } = await loadFactoryModules();
    const plan = buildFactoryPlan("nep17", NEP17_INPUT, {
      appId: "miniapp-asset-factory",
      artifactPresence: "present",
    });
    const signatureInfo = {
      signature: "signature-bytes",
      publicKey: "02abcd",
      message: `NEP-17 Factory template plan\n${plan.digest}\n${plan.packageId}`,
      signedAt: "2026-06-12T00:00:00.000Z",
    };
    const state = buildState({
      currentPlan: plan,
      walletSignature: "signature-bytes",
      walletSignatureInfo: signatureInfo,
    });
    renderPlayArea(FactoryPlayArea as never, "nep17", state);

    const json =
      document.querySelector(".domain-factory-json")?.textContent ?? "";
    const parsed = JSON.parse(json) as {
      walletSignature?: typeof signatureInfo;
      execution?: { available?: boolean; outcome?: string };
    };
    expect(parsed.walletSignature).toEqual(signatureInfo);
    expect(parsed.execution).toMatchObject({
      available: false,
      outcome: "contract-deployment",
    });
    expect(screen.getByRole("button", { name: "Copy signature" })).toBeTruthy();
  });
});
