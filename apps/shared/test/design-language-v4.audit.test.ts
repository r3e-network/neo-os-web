import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function repoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot(), relativePath), "utf8");
}

function trackedFiles(...patterns: string[]): string[] {
  return execFileSync("git", ["ls-files", ...patterns], {
    cwd: repoRoot(),
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean)
    // `git ls-files` also reports tracked paths removed in the working tree.
    .filter((file) => existsSync(path.join(repoRoot(), file)));
}

describe("Neo MiniApps design language v4 foundation", () => {
  it("publishes the warm restrained v4 token palette", () => {
    const tokens = repoFile("apps/shared/styles/v2/_tokens.scss");

    expect(tokens).toContain("--mx2-bg: #faf9f7;");
    expect(tokens).toContain("--mx2-bg-2: #f4f2ef;");
    expect(tokens).toContain("--mx2-surface-2: #f8f7f5;");
    expect(tokens).toContain("--mx2-surface-hover: #f1efec;");
    expect(tokens).toContain("--mx2-border: #e8e6e1;");
    expect(tokens).toContain("--mx2-border-strong: #d4d0c9;");
    expect(tokens).toContain("--mx2-ink: #1a1a19;");
    expect(tokens).toContain("--mx2-text-2: #5c5a56;");
    expect(tokens).toContain("--mx2-text-faint: #8b8984;");
    expect(tokens).toContain("--mx2-brand: #16c784;");
    expect(tokens).toContain("--mx2-brand-hover: #0ea371;");
    expect(tokens).toContain("--mx2-r-sm: 8px;");
    expect(tokens).toContain("--mx2-r: 10px;");
    expect(tokens).toContain("--mx2-r-lg: 12px;");
    expect(tokens).toContain("--mx2-t-fast: 150ms;");
    expect(tokens).toContain("--mx2-t: 200ms;");
    expect(tokens).toContain("--mx2-t-slow: 250ms;");
    expect(tokens).toContain("--mx2-ease-snap: ease-out;");
    expect(tokens).toContain("--mx2-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);");
    expect(tokens).toContain("--mx2-scene-rim: #e8e6e1;");
    expect(tokens).toContain("--mx2-scene-grid: transparent;");
    expect(tokens).toContain(".mx2-cat-social");
    expect(tokens).toContain(".mx2-cat-governance");
    expect(tokens).toContain(".mx2-theme-dark");
  });

  it("keeps shared components inside the v4 card, button, and input rules", () => {
    const styles = repoFile("apps/shared/components-react/v2/v2.scss");

    expect(styles).toMatch(/--semi-color-primary:\s*var\(--mx2-brand\)/);
    expect(styles).toMatch(/font-family:\s*var\(--mx2-font-sans\)/);
    expect(styles).toMatch(/\.mx2-btn\s*\{[\s\S]*border-radius:\s*var\(--mx2-r\)/);
    expect(styles).toMatch(/\.mx2-btn--primary\s*\{[\s\S]*background:\s*var\(--mx2-brand\)/);
    expect(styles).toMatch(/\.mx2-btn--primary\s*\{[\s\S]*min-height:\s*44px/);
    expect(styles).toMatch(/\.mx2-spinner\s*\{[\s\S]*animation:\s*mx2-spin 1s linear infinite/);
    expect(styles).toMatch(/\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-lg\)/);
    expect(styles).toMatch(/\.mx2-open-panel\.semi-card\s*\{[\s\S]*box-shadow:\s*var\(--mx2-shadow\)/);
    expect(styles).toMatch(/\.mx2-open-panel > \.semi-card-body\s*\{[\s\S]*padding:\s*16px 24px 24px/);
    expect(styles).toMatch(/\.mx2-open-field__control\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/\.mx2-open-field__control\s*\{[\s\S]*border:\s*1px solid var\(--mx2-border-strong\)/);
    expect(styles).toMatch(/\.mx2-open-field__control\s*\{[\s\S]*border-radius:\s*var\(--mx2-r\)/);
    expect(styles).toMatch(/\.mx2-open-field__control:focus,[\s\S]*\.mx2-open-field__control:focus-within\s*\{[\s\S]*border-color:\s*var\(--mx2-brand\)/);
    expect(styles).not.toMatch(/cubic-bezier\(0\.34,\s*1\.56/);
    expect(styles).not.toMatch(/border-radius:\s*(18|20|22)px/);
    expect(styles).not.toContain("#f7f9fc");
    expect(styles).not.toContain("#0f766e");
  });

  it("keeps shared motion short and non-continuous except loading spinners", () => {
    const motion = repoFile("apps/shared/styles/v2/_motion.scss");

    expect(motion).toContain("no continuous idle motion");
    expect(motion).toMatch(/\.mx2-float\s*\{[\s\S]*animation:\s*mx2-rise-in var\(--mx2-t\) var\(--mx2-ease\) both/);
    expect(motion).toMatch(/\.mx2-spin\s*\{[\s\S]*animation:\s*mx2-spin 1s linear infinite/);

    const nonSpinnerInfinite = motion
      .split("\n")
      .filter((line) => /animation:/.test(line) && /infinite/.test(line) && !/mx2-spin/.test(line));
    expect(nonSpinnerInfinite).toEqual([]);
  });

  it("keeps tracked miniapp surfaces off the old cold v3 whites", () => {
    const offenders = trackedFiles("apps/*/src/**/*.scss", "apps/*/src/*.scss").filter((file) => {
      const source = repoFile(file);
      return /#f7f9fc|#fbfcfe/i.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
