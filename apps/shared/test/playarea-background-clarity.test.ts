import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot() {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function trackedFiles(...patterns: string[]) {
  return execFileSync("git", ["ls-files", ...patterns], {
    cwd: repoRoot(),
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot(), relativePath), "utf8");
}

function cssBlocks(source: string, selectorPattern: RegExp) {
  const blocks: Array<{ selector: string; block: string }> = [];
  const matcher = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(source)) !== null) {
    const selector = match[1].trim();
    if (selectorPattern.test(selector)) {
      blocks.push({ selector, block: match[0] });
    }
  }

  return blocks;
}

const playAreaFiles = () => trackedFiles("apps/*/src/PlayArea.scss");

const oldColdTokens = /#(?:f7f9fc|fbfcfe|f8fafc|f1f5f9|e2e8f0|64748b|475569|334155|1e293b|0f172a)\b/i;
const bouncyMotion = /cubic-bezier\(0\.34,\s*1\.56/i;
const infiniteBackgroundMotion = /(?:backdrop|wash|shade|stage-light|background)[\w-]*[^;\n{]*\{?[^;\n]*animation:\s*(?!mx2-spin|[^;]*spin)[^;]*\binfinite\b/i;
const topLevelSceneSelector = /(?:^|,|\s)\.[\w-]+(?:-scene|-workspace|-workbench|-stage-stack|-arena)$/;

function sourceOffenders(pattern: RegExp, label: string) {
  return playAreaFiles().flatMap((file) => {
    const source = readRepoFile(file);
    return source
      .split("\n")
      .map((line, index) => ({ line, index: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, index }) => `${file}:${index}: ${label}: ${line.trim()}`);
  });
}

describe("PlayArea background clarity", () => {
  it("audits only committed miniapp PlayArea styles", () => {
    const files = playAreaFiles();

    expect(files.length).toBeGreaterThan(40);
    expect(files).toContain("apps/dice-game/src/PlayArea.scss");
    expect(files).toContain("apps/aim-master/src/PlayArea.scss");
    expect(files).toContain("apps/oracle-seal-console/src/PlayArea.scss");
    expect(files).toContain("apps/sheep-solitaire/src/PlayArea.scss");
  });

  it("keeps PlayAreas off the old cold slate palette", () => {
    expect(sourceOffenders(oldColdTokens, "old cold color")).toEqual([]);
  });

  it("keeps explicit stage floors inside the v4 canvas family", () => {
    const allowedStageFloors = new Set([
      "#ffffff",
      "#faf9f7",
      "#f4f2ef",
      "var(--mx2-bg)",
      "var(--mx2-bg-2)",
      "var(--mx2-stage-floor)",
    ]);

    const offenders = playAreaFiles().flatMap((file) => {
      const source = readRepoFile(file);
      return [...source.matchAll(/--mx2-stage-floor:\s*([^;]+);/g)]
        .filter((match) => !allowedStageFloors.has(match[1].trim().toLowerCase()))
        .map((match) => `${file}: ${match[0]}`);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps direct shared stage-scene overrides neutral", () => {
    const allowed = new Set([
      "#ffffff",
      "#faf9f7",
      "#f4f2ef",
      "transparent",
      "var(--mx2-bg)",
      "var(--mx2-bg-2)",
      "var(--mx2-surface)",
      "var(--mx2-surface-2)",
      "var(--mx2-stage-floor)",
    ]);

    const offenders = playAreaFiles().flatMap((file) => {
      const source = readRepoFile(file);
      const blocks = source.match(/\.[\w-]+-play-area\s+\.mx2-stage__scene\s*\{[^}]*\}/g) ?? [];

      return blocks.flatMap((block) =>
        [...block.matchAll(/background:\s*([^;]+);/g)]
          .map((match) => match[1].trim().toLowerCase())
          .filter((value) => !allowed.has(value))
          .map((value) => `${file}: stage scene background ${value}`),
      );
    });

    expect(offenders).toEqual([]);
  });

  it("keeps top-level work areas from becoming decorative backdrops", () => {
    const offenders = playAreaFiles().flatMap((file) => {
      const source = readRepoFile(file);
      return cssBlocks(source, topLevelSceneSelector).flatMap(({ selector, block }) => {
        if (selector.includes("__")) return [];

        const violations: string[] = [];
        const background = block.match(/background(?:-image)?:\s*([^;]+);/i)?.[1]?.trim();
        const shadow = block.match(/box-shadow:\s*([^;]+);/i)?.[1]?.trim();

        if (background && /gradient|url\(/i.test(background)) {
          violations.push("decorative background");
        }
        if (shadow && shadow !== "none" && !/var\(--mx2-shadow\)/.test(shadow)) {
          violations.push("custom container shadow");
        }

        return violations.map((reason) => `${file}: ${selector}: ${reason}`);
      });
    });

    expect(offenders).toEqual([]);
  });

  it("keeps background layers quiet and non-interactive", () => {
    const offenders = playAreaFiles().flatMap((file) => {
      const source = readRepoFile(file);
      const blocks = source.match(/__[\w-]*(?:backdrop|wash|shade|stage-light|background)[\w-]*[^{}]*\{[^{}]*\}/g) ?? [];

      return blocks.flatMap((block) => {
        const violations: string[] = [];
        if (/opacity:\s*0\.(?:[4-9]\d*|3[5-9])/i.test(block)) violations.push("high opacity");
        if (/background-image:\s*url\(/i.test(block)) violations.push("image backdrop");
        if (/pointer-events:\s*(?!none\b)\S[^;}]*/i.test(block)) violations.push("interactive background layer");
        return violations.map((reason) => `${file}: ${reason}: ${block.replace(/\s+/g, " ").slice(0, 180)}`);
      });
    });

    expect(offenders).toEqual([]);
  });

  it("keeps shared v2 stage and surfaces aligned to design language v4", () => {
    const tokens = readRepoFile("apps/shared/styles/v2/_tokens.scss");
    const styles = readRepoFile("apps/shared/components-react/v2/v2.scss");

    expect(tokens).toContain("--mx2-bg: #faf9f7;");
    expect(tokens).toContain("--mx2-bg-2: #f4f2ef;");
    expect(tokens).toContain("--mx2-surface-2: #f8f7f5;");
    expect(tokens).toContain("--mx2-surface-hover: #f1efec;");
    expect(tokens).toContain("--mx2-border: #e8e6e1;");
    expect(tokens).toContain("--mx2-scene-rim: #e8e6e1;");
    expect(tokens).toContain("--mx2-scene-grid: transparent;");
    expect(styles).toContain("background: var(--mx2-stage-floor, #faf9f7);");
    expect(styles).toMatch(/\.mx2-stage__scene\s*\{[\s\S]*background-image:\s*none/);
    expect(styles).toMatch(/\.mx2-stage__scene::before\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.mx2-btn--primary:disabled\s*\{[\s\S]*background:\s*var\(--mx2-surface-hover\)/);
    expect(styles).toMatch(/\.mx2-btn--primary:disabled\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.mx2-open-panel\.semi-card\s*\{[\s\S]*box-shadow:\s*var\(--mx2-shadow\)/);
    expect(styles).toMatch(/\.mx2-open-field__control\s*\{[\s\S]*min-height:\s*40px/);
  });

  it("keeps primary actions focused instead of page-wide", () => {
    const styles = readRepoFile("apps/shared/components-react/v2/v2.scss");

    expect(styles).toMatch(/\.mx2-action-rail\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--mx2-action-rail-width,\s*640px\)\)/);
    expect(styles).toMatch(/\.mx2-action-rail\s*\{[\s\S]*margin-inline:\s*auto/);
    expect(styles).toMatch(/\.mx2-action-rail__row\s*\{[\s\S]*justify-content:\s*center/);
    expect(styles).toMatch(/\.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 1 auto/);
    expect(styles).toMatch(/\.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*max-width:\s*min\(100%,\s*280px\)/);
    expect(styles).not.toContain("flex: 1 1 100%;");
  });

  it("keeps readouts compact and not form-tile heavy", () => {
    const styles = readRepoFile("apps/shared/components-react/v2/v2.scss");

    expect(styles).toMatch(/\.mx2-score\s*\{[\s\S]*gap:\s*16px/);
    expect(styles).toMatch(/\.mx2-score__item\s*\{[\s\S]*flex:\s*0 1 auto/);
    expect(styles).toMatch(/\.mx2-score__item\s*\{[\s\S]*border-radius:\s*var\(--mx2-r\)/);
    expect(styles).toMatch(/\.mx2-score__item\[data-accent="true"\]\s*\{[\s\S]*box-shadow:\s*inset 2px 0 0 var\(--mx2-brand\)/);
    expect(styles).not.toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(styles).not.toContain("box-shadow: inset 3px 0 0 var(--mx2-accent);");
  });

  it("keeps functional scrims out of the names the stage rule zeroes", () => {
    // v2.scss deliberately zeroes decorative layers inside a stage scene:
    // `.mx2-stage__scene [class$="__shade"|"__wash"|"__stage-light"]` gets
    // opacity:0 !important. Two apps named a LEGIBILITY scrim with a reserved
    // suffix, so the browser silently switched off a layer their white copy
    // depended on — aa-market-hub's hero fell to ~2:1 contrast and
    // daily-checkin's caption became unreadable, while both apps' committed
    // guards happily asserted the gradient existed in the stylesheet. CSS
    // presence is not proof of paint. A layer carrying a gradient or a
    // translucent fill is doing legibility work and must not wear a name the
    // platform reserves for decoration (use __legibility).
    const reserved = /\.[\w-]*__(?:shade|wash|stage-light)\b/;
    const offenders: string[] = [];

    for (const file of trackedFiles("apps/*/src/**/*.scss", "apps/*/src/*.scss")) {
      // Strip comments first: the fixed apps document the old name in prose,
      // and a comment naming a reserved class is not a rule that paints.
      const source = readRepoFile(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const { selector, block } of cssBlocks(source, reserved)) {
        if (/linear-gradient|radial-gradient|background:\s*rgba\(/.test(block)) {
          offenders.push(`${file}: ${selector.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps idle background motion finite and non-bouncy", () => {
    const motion = readRepoFile("apps/shared/styles/v2/_motion.scss");
    const sharedStyles = readRepoFile("apps/shared/components-react/v2/v2.scss");
    const nonSpinnerInfinite = motion
      .split("\n")
      .filter((line) => /animation:/.test(line) && /infinite/.test(line) && !/mx2-spin/.test(line));

    expect(nonSpinnerInfinite).toEqual([]);
    expect(motion).not.toMatch(bouncyMotion);
    expect(sharedStyles).not.toMatch(bouncyMotion);
    expect(sourceOffenders(bouncyMotion, "bouncy motion")).toEqual([]);
    expect(sourceOffenders(infiniteBackgroundMotion, "infinite background motion")).toEqual([]);
  });
});
