import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type Observable } from "../react/context";
import { parseMiniAppLaunchContext } from "@shared/utils/launch-params";
import { messages } from "../../nft-factory/src/locale/messages";
import { NftFactoryPlayArea } from "../../nft-factory/src/NftFactoryPlayArea";
import type { FactoryPlan } from "../factory/factoryPlan";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function t(key: string, params?: Record<string, string | number>): string {
  const entry = (
    messages as Record<string, { en: string; zh: string } | string>
  )[key];
  if (!entry) throw new Error(`missing NFT Factory message: ${key}`);
  let text = typeof entry === "string" ? entry : entry.en;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(params[name] ?? ""),
    );
  }
  return text;
}

function buildState(
  overrides: Record<string, unknown> = {},
): Record<string, Observable> {
  return Object.fromEntries(
    Object.entries({
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
      metadataStatus: "not-checked",
      metadataDetailKey: "metadataNotChecked",
      metadataSampleUrl: "",
      metadataSampleName: "",
      metadataSampleImage: "",
      metadataCheckedAt: 0,
      ...overrides,
    }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function lockedPlan(): FactoryPlan {
  const digest = `0x${"ab".repeat(32)}`;
  const packageId = "tpl-nep11-collection-v1-ababababab";
  return {
    kind: "nep11",
    title: "Sunlit Editions",
    network: "neo-n3-testnet",
    templateRef: "tpl.nep11.collection.v1",
    templateId: "tpl.nep11.collection.v1",
    templateVersion: "1.0.0",
    templateArtifact: {
      status: "metadata-only",
      nefHash: `0x${"11".repeat(32)}`,
      manifestHash: `0x${"22".repeat(32)}`,
      configSchemaHash: `0x${"33".repeat(32)}`,
    },
    operation: "prepareNEP11",
    deploymentCall: {
      scriptHash: `0x${"44".repeat(20)}`,
      operation: "deployFromTemplate",
      args: [],
    },
    execution: {
      outcome: "contract-deployment",
      available: false,
      blockedReasonKey: "artifactNotRegistered",
      confirmingEvent: "TokenDeployed",
      signerHint: "NMUD7q5tYaFtw4w4hXk3feupGSGnv9jcrQ",
    },
    packageId,
    digest,
    publishable: true,
    blockingErrors: [],
    warnings: [],
    payload: { initParams: { collectionName: "Sunlit Editions" } },
    steps: [],
    oneGate: { url: "https://neomain.app/", params: {} },
    generatedAt: "deterministic",
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NFT Factory collection studio", () => {
  it("leads with artwork/release scope and leaves the dead metadata seed empty", () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <NftFactoryPlayArea
        t={t}
        state={buildState()}
        dispatch={dispatch}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
          "miniapp-nft-factory",
        )}
      />,
    );

    // The shared hero remains in the DOM but is hidden by the app stylesheet;
    // the compact app-owned heading is the visible one in the rendered app.
    expect(
      screen.getAllByRole("heading", { name: "NFT Collection Studio" }),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        "Identity · supply · royalty policy · transfer policy · metadata origin · owner signature",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Checked when the package is locked"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Local preview only · not uploaded or added to the package",
      ),
    ).toBeTruthy();
    expect(
      document.querySelector(
        ".domain-factory-studio-flow__stage--nep11 img",
      )?.getAttribute("src"),
    ).toBe("./nft-drop-preview.webp");

    fireEvent.click(screen.getByText("Provenance & ownership"));
    expect((screen.getByLabelText("Base URI") as HTMLInputElement).value).toBe(
      "",
    );
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("input[type='checkbox']")).toHaveLength(
      0,
    );
    expect(
      screen.queryByRole("radio", { name: /Neo N3 Mainnet/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Deployment locked" }),
    ).toBeNull();
  });

  it("uses a creator-selected image across the live studio without uploading it", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:nft-artwork-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(
      <NftFactoryPlayArea
        t={t}
        state={buildState()}
        dispatch={vi.fn(async () => undefined)}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
          "miniapp-nft-factory",
        )}
      />,
    );

    const artwork = new File(["real-image-bytes"], "sunlit.webp", {
      type: "image/webp",
    });
    fireEvent.change(screen.getByLabelText("Choose local art"), {
      target: { files: [artwork] },
    });

    expect(URL.createObjectURL).toHaveBeenCalledWith(artwork);
    expect(screen.getByText("sunlit.webp")).toBeTruthy();
    expect(
      document.querySelectorAll('img[src="blob:nft-artwork-preview"]').length,
    ).toBeGreaterThan(2);

    fireEvent.click(screen.getByRole("button", { name: "Remove local preview" }));
    expect(
      document.querySelectorAll('img[src="./nft-drop-preview.webp"]').length,
    ).toBeGreaterThan(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nft-artwork-preview");
  });

  it("uses the verified HTTPS token artwork as the collector-facing source", () => {
    render(
      <NftFactoryPlayArea
        t={t}
        state={buildState({
          metadataStatus: "verified",
          metadataDetailKey: "metadataVerified",
          metadataSampleName: "Sunlit Edition #1",
          metadataSampleImage: "https://cdn.example.com/sunlit/1.webp",
        })}
        dispatch={vi.fn(async () => undefined)}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
          "miniapp-nft-factory",
        )}
      />,
    );

    expect(screen.getByText("Sunlit Edition #1")).toBeTruthy();
    expect(
      document.querySelectorAll(
        'img[src="https://cdn.example.com/sunlit/1.webp"]',
      ).length,
    ).toBeGreaterThan(2);
  });

  it("keeps collector rights as an explicit two-state choice", () => {
    render(
      <NftFactoryPlayArea
        t={t}
        state={buildState()}
        dispatch={vi.fn(async () => undefined)}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
          "miniapp-nft-factory",
        )}
      />,
    );

    const soulbound = screen.getByRole("radio", {
      name: /Soulbound Tokens stay bound/,
    });
    expect(soulbound.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(soulbound);
    expect(soulbound.getAttribute("aria-checked")).toBe("true");
  });

  it("turns a completed creator commitment into a disabled one-shot action", () => {
    const dispatch = vi.fn(async () => undefined);
    const plan = lockedPlan();
    render(
      <NftFactoryPlayArea
        t={t}
        state={buildState({
          currentPlan: plan,
          walletSignature: "owner-signature",
          walletSignatureInfo: {
            signature: "owner-signature",
            publicKey: "02abcd",
            message: "exact commitment",
            signedAt: "2026-07-12T00:00:00.000Z",
          },
        })}
        dispatch={dispatch}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
          "miniapp-nft-factory",
        )}
      />,
    );

    const signedAction = screen.getByRole("button", { name: "Signed" });
    expect((signedAction as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(signedAction);
    expect(dispatch).not.toHaveBeenCalledWith("signCurrentPlan");
    const exported = JSON.parse(
      document.querySelector(".domain-factory-json")?.textContent ?? "{}",
    ) as {
      payload?: Record<string, unknown>;
      walletSignature?: { message?: string; signature?: string };
    };
    expect(exported.payload).toEqual(plan.payload);
    expect(exported.walletSignature).toMatchObject({
      message: "exact commitment",
      signature: "owner-signature",
    });
  });

  it("keeps signing visibly disabled while token metadata is still unresolved", () => {
    render(
      <NftFactoryPlayArea
        t={t}
        state={buildState({
          currentPlan: lockedPlan(),
          metadataStatus: "checking",
          metadataDetailKey: "metadataChecking",
        })}
        dispatch={vi.fn(async () => undefined)}
        launchContext={parseMiniAppLaunchContext(
          "https://neomini.app/miniapps/nft-factory/index.html?network=testnet",
          "miniapp-nft-factory",
        )}
      />,
    );

    const signAction = screen.getByRole("button", {
      name: "Sign creator commitment",
    });
    expect((signAction as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("Reading token #1…").length).toBeGreaterThan(0);
  });
});
