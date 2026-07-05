import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CoinArt } from "../art";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function readShared(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function repoRoot() {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function gitFiles() {
  return execFileSync("git", ["ls-files"], {
    cwd: repoRoot(),
    encoding: "utf8",
  })
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

describe("official token assets", () => {
  it("keeps official Neo Press Kit NEO and GAS icons in shared assets", () => {
    const neoIcon = readShared("assets/tokens/neo-icon.svg");
    const gasIcon = readShared("assets/tokens/gas-icon.svg");

    expect(neoIcon).toContain('viewBox="0 0 512 512"');
    expect(neoIcon).toContain("#00e599");
    expect(neoIcon).toContain("#00af92");
    expect(neoIcon).toContain("92.69 136.44");

    expect(gasIcon).toContain('viewBox="0 0 512 512"');
    expect(gasIcon).toContain("#01e397");
    expect(gasIcon).toContain("M263.41,438.88");
  });

  it("renders shared CoinArt with official token image assets instead of a hand-drawn N coin", () => {
    const { container } = render(
      <div>
        <CoinArt variant="neo" size={32} />
        <CoinArt variant="gas" size={32} />
      </div>,
    );
    const labels = Array.from(container.querySelectorAll(".mx2-coin")).map((node) => node.getAttribute("aria-label"));
    const imageSources = Array.from(container.querySelectorAll("img")).map((node) => node.getAttribute("src") ?? "");
    const source = readShared("art/CoinArt.tsx");

    expect(labels).toEqual(["NEO token", "GAS token"]);
    expect(imageSources.filter(Boolean)).toHaveLength(2);
    expect(source).toContain("../assets/tokens/neo-icon.svg");
    expect(source).toContain("../assets/tokens/gas-icon.svg");
    expect(source).not.toContain("<text");
    expect(source).not.toContain("mx2-coin-face");
    expect(source).not.toContain("dominantBaseline");
  });

  it("keeps Neo Swap token icons routed through shared CoinArt instead of local SVG imports", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "../neo-swap/src/components/TokenIcon.tsx"),
      "utf8",
    );

    expect(source).toContain('import { CoinArt } from "@shared/art";');
    expect(source).toContain("size = 38");
    expect(source).not.toContain("@shared/assets/tokens/neo-icon.svg");
    expect(source).not.toContain("@shared/assets/tokens/gas-icon.svg");
    expect(source).not.toContain("TOKEN_IMAGES");
  });

  it("prevents miniapps from bypassing the shared official NEO/GAS token component", () => {
    const allowedDirectImports = new Set([
      "apps/shared/art/CoinArt.tsx",
      "apps/shared/test/official-token-assets.test.tsx",
    ]);
    const runtimeSource = /^(apps\/(?!shared\/)[^/]+\/src\/|platform\/host-app\/components\/playarea\/).*\.(?:tsx?|jsx?|vue|svelte|scss|css)$/;
    const directTokenArtwork = /assets\/tokens\/(?:neo|gas)-icon\.svg|(?:neo|gas)-token\.(?:svg|png|webp|jpe?g)/i;

    const offenders = gitFiles().flatMap((file) => {
      const violations: string[] = [];

      if (/^apps\/(?!shared\/assets\/tokens\/).+\/(?:neo|gas)-token\.(?:svg|png|webp|jpe?g)$/i.test(file)) {
        violations.push("ships a local NEO/GAS token image");
      }

      if (
        runtimeSource.test(file) &&
        !allowedDirectImports.has(file)
      ) {
        const source = fs.readFileSync(path.join(repoRoot(), file), "utf8");
        if (directTokenArtwork.test(source)) {
          violations.push("references token artwork outside shared CoinArt");
        }
      }

      return violations.map((reason) => `${file}: ${reason}`);
    });

    expect(offenders).toEqual([]);
  });
});
