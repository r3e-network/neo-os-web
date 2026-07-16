import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OpenUiLite renders native controls wearing Semi's class contract. That is a
 * deliberate trade — it keeps Semi's JavaScript runtime out of focused apps —
 * but it means the classnames are a promise the module has to keep: every
 * `semi-*` class it emits must have CSS behind it, or the native control shows
 * through.
 *
 * That promise has been broken twice in production. A missing rule left an OS
 * radio dot over every segment in 17 apps, and `.semi-checkbox` went unstyled
 * long enough to ship a bare OS checkbox in neo-message. Neither was caught by
 * ~4400 passing tests, and could not have been: the suite runs in jsdom, which
 * applies no stylesheets, and the tests assert that a classname is PRESENT —
 * which is equally true whether any rule matches it or not.
 *
 * So this guard checks the thing the render tests structurally cannot: that the
 * contract is backed. It is static on purpose (no browser), so it stays in the
 * fast unit gate.
 */

function repoRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
}

function read(rel: string): string {
  return readFileSync(path.join(repoRoot(), rel), "utf8");
}

const LITE_PATH = "apps/shared/components-react/v2/OpenUiLite.tsx";

/** Classnames the module hands to the DOM, from its string literals. */
function emittedSemiClasses(source: string): string[] {
  const found = new Set<string>();
  for (const [, cls] of source.matchAll(/"(semi-[a-zA-Z0-9-]+)"/g)) found.add(cls);
  // Template-built names would defeat a literal scan; assert there are none so
  // this guard cannot silently go blind.
  expect(source, "OpenUiLite must not build semi-* classnames dynamically").not.toMatch(
    /`[^`]*semi-\$\{/,
  );
  return [...found].sort();
}

/** The stylesheets that actually ship for a Lite app. */
function backingCss(source: string): string {
  const imported = [...source.matchAll(/import "([^"]*semi-foundation[^"]*\.css)"/g)].map(
    (m) => m[1]!,
  );
  expect(
    imported.length,
    "OpenUiLite must import the Semi component CSS whose classes it wears",
  ).toBeGreaterThan(0);

  const vendor = imported.map((spec) =>
    readFileSync(path.join(repoRoot(), "node_modules", spec.replace(/^@/, "@")), "utf8"),
  );
  return [read("apps/shared/components-react/v2/v2.scss"), ...vendor].join("\n");
}

describe("OpenUiLite semi-* class contract", () => {
  it("has CSS behind every Semi class it renders", () => {
    const source = read(LITE_PATH);
    const css = backingCss(source);

    const unbacked = emittedSemiClasses(source).filter((cls) => !css.includes(`.${cls}`));

    expect(unbacked).toEqual([]);
  });

  it("keeps the native controls hidden rather than removed from the tab order", () => {
    const css = backingCss(read(LITE_PATH));

    // The whole point of the imported CSS: Semi hides the real input and lets
    // the styled span be the visible control. If a future rule swapped opacity
    // for display:none the control would vanish from keyboard navigation.
    expect(css).toMatch(/\.semi-radio\s+input\[type=radio\][^}]*opacity:\s*0/);
    expect(css).toMatch(/\.semi-checkbox\s+input\[type=checkbox\][^}]*opacity:\s*0/);
  });
});
