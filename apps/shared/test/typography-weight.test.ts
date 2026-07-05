import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot() {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function trackedPlayAreaStyles() {
  const root = repoRoot();

  try {
    return execFileSync("git", ["ls-files", "apps/*/src/PlayArea.scss"], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .map((file) => path.join(root, file));
  } catch {
    return [];
  }
}

function cssBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] ?? "";
}

function lineOf(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}

describe("Miniapp typography weights", () => {
  it("keeps PlayArea typography out of black-heavy weights", () => {
    const root = repoRoot();
    const files = [
      ...trackedPlayAreaStyles(),
      path.join(root, "apps/shared/components-react/v2/v2.scss"),
      path.join(root, "apps/shared/components-react/ConsoleToolPanel.scss"),
    ].filter((file) => existsSync(file));
    const heavyWeightPattern = /font-weight:\s*(?:[7-9]\d\d|bold|bolder)\s*;/gi;

    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");

      return [...source.matchAll(heavyWeightPattern)].map((match) => {
        const line = lineOf(source, match.index ?? 0);
        return `${path.relative(root, file)}:${line} ${match[0]}`;
      });
    });

    expect(offenders).toEqual([]);
  });

  it("keeps shared OpenUI text hierarchy calm instead of poster-heavy", () => {
    const styles = readFileSync(
      path.join(repoRoot(), "apps/shared/components-react/v2/v2.scss"),
      "utf8",
    );

    expect(cssBlock(styles, ".mx2-stage__title")).toContain("font-weight: 600;");
    expect(cssBlock(styles, ".mx2-score__label")).toContain("font-weight: 600;");
    expect(cssBlock(styles, ".mx2-score__value")).toContain("font-weight: 600;");
    expect(cssBlock(styles, ".mx2-badge")).toContain("font-weight: 500;");
    expect(cssBlock(styles, ".mx2-open-panel__copy strong")).toContain("font-weight: 600;");
    expect(cssBlock(styles, ".mx2-open-notice .semi-banner-title")).toContain("font-weight: 600;");
    expect(cssBlock(styles, ".mx2-open-field__label")).toContain("font-weight: 500;");
  });

  it("keeps the open detail drawer stronger than the base collapsed drawer", () => {
    const styles = readFileSync(
      path.join(repoRoot(), "apps/shared/components-react/v2/v2.scss"),
      "utf8",
    );

    expect(cssBlock(styles, ".mx2-drawer.mx2-drawer--open")).toContain("max-height: 1400px;");
  });
});
