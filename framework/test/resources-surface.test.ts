/**
 * S12 resources spec (framework-extraction plan §2/S12).
 *
 * Covers: url()/image() resolution against the host base (explicit baseUrl
 * override, document.baseURI default, no-DOM degradation), absolute-URL
 * passthrough, tokenArt injection keeping the bundler-resolved values
 * byte-identical (apps/shared/art/token-assets contract), and the additive
 * BaseScene.preloadAssets loader helper.
 */

import { describe, expect, it, vi } from "vitest";
import { createResourcesSurface } from "../resources";
import { BaseScene } from "../phaser";

describe("S12 app.resources", () => {
  describe("url()/image() base resolution", () => {
    it("resolves relative paths against an explicit absolute baseUrl", () => {
      const resources = createResourcesSurface({
        baseUrl: "https://neomini.app/miniapps/dice-game",
      });

      expect(resources.url("gas-vault-stage.webp")).toBe(
        "https://neomini.app/miniapps/dice-game/gas-vault-stage.webp",
      );
      expect(resources.url("art/tile-felt.webp")).toBe(
        "https://neomini.app/miniapps/dice-game/art/tile-felt.webp",
      );
    });

    it("treats leading ./ and / as app-base-relative, not origin-relative", () => {
      const resources = createResourcesSurface({
        baseUrl: "https://neomini.app/miniapps/dice-game/",
      });

      expect(resources.url("./stage.webp")).toBe(
        "https://neomini.app/miniapps/dice-game/stage.webp",
      );
      expect(resources.url("/stage.webp")).toBe(
        "https://neomini.app/miniapps/dice-game/stage.webp",
      );
    });

    it("joins path-only base overrides without an origin", () => {
      const resources = createResourcesSurface({ baseUrl: "/miniapps/dice-game" });

      expect(resources.url("stage.webp")).toBe("/miniapps/dice-game/stage.webp");
    });

    it("passes absolute and protocol-relative URLs through untouched", () => {
      const resources = createResourcesSurface({ baseUrl: "https://neomini.app/miniapps/x/" });

      for (const absolute of [
        "https://cdn.example.com/icon.png",
        "http://cdn.example.com/icon.png",
        "data:image/png;base64,AAAA",
        "blob:https://neomini.app/123",
        "//cdn.example.com/icon.png",
      ]) {
        expect(resources.url(absolute)).toBe(absolute);
      }
    });

    it("defaults to the embedding document base (every host lane serves the app dir)", () => {
      const resources = createResourcesSurface({ host: "miniapp-platform" });

      expect(resources.url("stage.webp")).toBe(
        new URL("stage.webp", document.baseURI).toString(),
      );
    });

    it("resolves image() exactly like url()", () => {
      const resources = createResourcesSurface({
        host: () => "onegate",
        baseUrl: "https://neomini.app/miniapps/dice-game/",
      });

      expect(resources.image("./art/die-face-1.webp")).toBe(
        resources.url("art/die-face-1.webp"),
      );
    });

    it("returns empty output for empty input", () => {
      const resources = createResourcesSurface();

      expect(resources.url("")).toBe("");
      expect(resources.url("   ")).toBe("");
    });
  });

  describe("tokenArt", () => {
    it("keeps injected bundler-resolved URLs byte-identical (token-assets contract)", () => {
      // In the real wiring these come from apps/shared/art/token-assets ?url
      // imports; the surface must never rewrite them.
      const injected = {
        gasUrl: "/assets/gas-icon-Ab12Cd.svg",
        gasPhaserUrl: "/assets/gas-icon-Ef34Gh.png",
        neoUrl: "/assets/neo-icon-Ij56Kl.svg",
      };
      const resources = createResourcesSurface({
        baseUrl: "https://neomini.app/miniapps/dice-game/",
        tokenArt: injected,
      });

      expect(resources.tokenArt).toEqual(injected);
    });

    it("falls back to the canonical shared token paths resolved against the base", () => {
      const resources = createResourcesSurface({
        baseUrl: "https://neomini.app/miniapps/dice-game/",
      });

      expect(resources.tokenArt).toEqual({
        gasUrl: "https://neomini.app/miniapps/dice-game/assets/tokens/gas-icon.svg",
        gasPhaserUrl: "https://neomini.app/miniapps/dice-game/assets/tokens/gas-icon.png",
        neoUrl: "https://neomini.app/miniapps/dice-game/assets/tokens/neo-icon.svg",
      });
    });

    it("fills only the missing slots when the injection is partial", () => {
      const resources = createResourcesSurface({
        baseUrl: "/app/",
        tokenArt: { gasPhaserUrl: "/assets/gas-icon-Ef34Gh.png" },
      });

      expect(resources.tokenArt.gasPhaserUrl).toBe("/assets/gas-icon-Ef34Gh.png");
      expect(resources.tokenArt.gasUrl).toBe("/app/assets/tokens/gas-icon.svg");
      expect(resources.tokenArt.neoUrl).toBe("/app/assets/tokens/neo-icon.svg");
    });
  });
});

describe("S12 BaseScene.preloadAssets", () => {
  function makeScene(existing: string[] = []) {
    const scene = {
      load: { image: vi.fn() },
      textures: { exists: (key: string) => existing.includes(key) },
    };
    return scene as unknown as Parameters<typeof BaseScene.preloadAssets>[0] & typeof scene;
  }

  it("queues one loader image per asset entry", () => {
    const scene = makeScene();

    BaseScene.preloadAssets(scene, {
      stage: "./gas-vault-stage.webp",
      gasIcon: "https://neomini.app/miniapps/x/assets/tokens/gas-icon.png",
    });

    expect(scene.load.image).toHaveBeenCalledTimes(2);
    expect(scene.load.image).toHaveBeenCalledWith("stage", "./gas-vault-stage.webp");
    expect(scene.load.image).toHaveBeenCalledWith(
      "gasIcon",
      "https://neomini.app/miniapps/x/assets/tokens/gas-icon.png",
    );
  });

  it("skips textures that already exist so scene restarts do not re-queue work", () => {
    const scene = makeScene(["stage"]);

    BaseScene.preloadAssets(scene, {
      stage: "./gas-vault-stage.webp",
      gasIcon: "./gas-icon.png",
    });

    expect(scene.load.image).toHaveBeenCalledTimes(1);
    expect(scene.load.image).toHaveBeenCalledWith("gasIcon", "./gas-icon.png");
  });

  it("ignores empty keys and URLs instead of queueing broken loads", () => {
    const scene = makeScene();

    BaseScene.preloadAssets(scene, { stage: "", "": "./ghost.webp" });

    expect(scene.load.image).not.toHaveBeenCalled();
  });
});
