// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock("../react/MiniAppRoot", () => ({
  MiniAppRoot: (props: Record<string, unknown>) => {
    capture.props = props;
    return null;
  },
}));

import { defineMiniApp } from "../react/defineMiniApp";

const VESTING_HASH = `0x${"12".repeat(20)}`;
const ESCROW_HASH = `0x${"34".repeat(20)}`;
const REGISTRY_HASH = `0x${"56".repeat(20)}`;
const GAME_HASH = `0x${"78".repeat(20)}`;
const SOCIAL_HASH = `0x${"9a".repeat(20)}`;
const ANCHOR_HASH = `0x${"bc".repeat(20)}`;
const DEFI_HASH = `0x${"de".repeat(20)}`;
const FACTORY_MAINNET_HASH = `0x${"f0".repeat(20)}`;
const FACTORY_TESTNET_HASH = `0x${"f1".repeat(20)}`;

describe("defineMiniApp platform engine config wiring", () => {
  beforeEach(() => {
    capture.props = null;
  });

  it("passes explicit vesting and manifest escrow bindings into MiniAppRoot", async () => {
    const mountTarget = document.createElement("div");
    mountTarget.id = "platform-engine-config-test";
    document.body.appendChild(mountTarget);

    const root = defineMiniApp({
      appId: "miniapp-platform-engine-config-test",
      mountTo: "#platform-engine-config-test",
      playArea: (() => null) as never,
      manifest: {
        name: "Escrow",
        category: "defi",
        contract: {
          mode: "shared",
          moduleId: "platform-escrow",
          engine: ESCROW_HASH,
        },
        permissions: {
          "invoke:platform-vesting": true,
          "invoke:platform-escrow": true,
        },
      },
      platformVesting: { vestingHash: VESTING_HASH },
    });

    await vi.waitFor(() => expect(capture.props).toBeTruthy());
    expect(capture.props).toMatchObject({
      platformVesting: { vestingHash: VESTING_HASH },
      platformEscrow: { escrowHash: ESCROW_HASH },
    });
    expect(capture.props?.manifest).toMatchObject({
      permissions: {
        "invoke:platform-vesting": true,
        "invoke:platform-escrow": true,
      },
    });

    root.unmount();
    mountTarget.remove();
  });

  it("composes multiple platform bindings without consuming the primary contract slot", async () => {
    const mountTarget = document.createElement("div");
    mountTarget.id = "platform-engine-composition-test";
    document.body.appendChild(mountTarget);

    const root = defineMiniApp({
      appId: "miniapp-platform-engine-composition-test",
      mountTo: "#platform-engine-composition-test",
      playArea: (() => null) as never,
      manifest: {
        name: "Composed finance app",
        category: "defi",
        contract: { mode: "custom", hash: "0x" + "56".repeat(20) },
        platformBindings: {
          registry: REGISTRY_HASH,
          game: GAME_HASH,
          social: SOCIAL_HASH,
          anchor: ANCHOR_HASH,
          defi: DEFI_HASH,
          vesting: VESTING_HASH,
          escrow: ESCROW_HASH,
          factory: {
            "neo-n3-mainnet": FACTORY_MAINNET_HASH,
            "neo-n3-testnet": FACTORY_TESTNET_HASH,
          },
        },
      },
    });

    await vi.waitFor(() => expect(capture.props).toBeTruthy());
    expect(capture.props).toMatchObject({
      registry: { registryHash: REGISTRY_HASH },
      platformGame: { gameHash: GAME_HASH },
      platformSocial: { socialHash: SOCIAL_HASH },
      platformAnchor: { anchorHash: ANCHOR_HASH },
      platformDeFi: { defiHash: DEFI_HASH },
      platformVesting: { vestingHash: VESTING_HASH },
      platformEscrow: { escrowHash: ESCROW_HASH },
      platformFactory: {
        hashes: {
          "neo-n3-mainnet": FACTORY_MAINNET_HASH,
          "neo-n3-testnet": FACTORY_TESTNET_HASH,
        },
      },
    });
    expect(capture.props?.manifest).toMatchObject({
      contract: { mode: "custom" },
      platformBindings: { vesting: VESTING_HASH, escrow: ESCROW_HASH },
    });

    root.unmount();
    mountTarget.remove();
  });
});
