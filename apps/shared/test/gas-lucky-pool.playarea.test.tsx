import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function appFile(file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "gas-lucky-pool", "src", file), "utf8");
}

describe("OneGate Vault production surface ownership", () => {
  it("routes the compatibility PlayArea entry to the single Phaser surface", () => {
    const alias = appFile("PlayArea.tsx").trim();
    expect(alias).toBe('export { default } from "./PhaserPlayArea";');
  });

  it("keeps the live surface game-first instead of preserving a second form UI", () => {
    const wrapper = appFile("PhaserPlayArea.tsx");
    const styles = appFile("PlayArea.scss");

    expect(wrapper).toContain("gas-pool-stage-shell");
    expect(wrapper).toContain("gas-pool-stage-hud");
    expect(wrapper).toContain("gas-pool-a11y-controls");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).not.toMatch(/<form\b|<textarea\b|<select\b/);
    expect(styles).toContain("height: clamp(420px, calc(100dvh - 136px), 700px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).not.toContain(".vault-workspace");
    expect(styles).not.toContain(".vault-stepper");
    expect(styles).not.toContain(".vault-plan-card");
  });
});
