import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const WALLET_SURFACE_STYLES = [
  "apps/aa-account-lab/src/PlayArea.scss",
  "apps/aa-market-hub/src/PlayArea.scss",
  "apps/aa-permissions-lab/src/PlayArea.scss",
  "apps/aa-relay-console/src/PlayArea.scss",
  "apps/aa-session-key-lab/src/PlayArea.scss",
  "apps/recovery-guardian/src/PlayArea.scss",
];

// Per-surface shipped hero facts after the "Neo Soft" light redesign.
// Each AA/recovery wallet keeps its own hero block + eyebrow heading, but they
// all stay compact (bounded desktop padding/radius, a tight heading scale, and
// a mobile breakpoint that shrinks the card chrome + heading) so the surface
// reads as an embedded console panel rather than a landing-page hero.
const WALLET_HERO_SURFACES = [
  {
    file: "apps/aa-account-lab/src/PlayArea.scss",
    hero: ".account-hero",
    heading: ".account-hero__heading h2",
    desktopPadding: "26px",
    desktopRadius: "20px",
    headingFontSize: "26px",
    headingLineHeight: "1.15",
    mobileMaxWidth: 640,
    mobilePadding: "20px",
    mobileRadius: "18px",
    mobileHeadingFontSize: "22px",
  },
  {
    file: "apps/aa-market-hub/src/PlayArea.scss",
    hero: ".market-hero",
    heading: ".market-hero__title h2",
    desktopPadding: "22px 24px",
    desktopRadius: "var(--ns-radius-lg, 20px)",
    headingFontSize: "26px",
    headingLineHeight: "1.15",
    mobileMaxWidth: 720,
    mobilePadding: "18px",
    mobileRadius: "var(--ns-radius-md, 16px)",
    mobileHeadingFontSize: "22px",
  },
  {
    file: "apps/aa-permissions-lab/src/PlayArea.scss",
    hero: ".permissions-hero",
    heading: ".permissions-hero__copy h2",
    desktopPadding: "28px 30px",
    desktopRadius: "var(--ns-radius-lg, 20px)",
    headingFontSize: "26px",
    headingLineHeight: "1.16",
    mobileMaxWidth: 720,
    mobilePadding: "20px 20px",
    mobileRadius: "var(--ns-radius-md, 16px)",
    mobileHeadingFontSize: "22px",
  },
  {
    file: "apps/aa-relay-console/src/PlayArea.scss",
    hero: ".relay-hero",
    heading: ".relay-hero__copy h2",
    desktopPadding: "26px 28px",
    desktopRadius: "var(--ns-radius-lg, 20px)",
    headingFontSize: "27px",
    headingLineHeight: "1.12",
    mobileMaxWidth: 640,
    mobilePadding: "20px",
    mobileRadius: "18px",
    mobileHeadingFontSize: "21px",
  },
  {
    file: "apps/aa-session-key-lab/src/PlayArea.scss",
    hero: ".session-hero",
    heading: ".session-hero__heading h2",
    desktopPadding: "28px",
    desktopRadius: "var(--ns-radius-xl, 24px)",
    headingFontSize: "30px",
    headingLineHeight: "1.14",
    mobileMaxWidth: 720,
    mobilePadding: "18px",
    mobileRadius: "var(--ns-radius-lg, 20px)",
    mobileHeadingFontSize: "24px",
  },
  {
    file: "apps/recovery-guardian/src/PlayArea.scss",
    hero: ".guardian-hero",
    heading: ".guardian-hero__copy h2",
    desktopPadding: "28px",
    desktopRadius: "var(--ns-radius-lg, 20px)",
    headingFontSize: "24px",
    headingLineHeight: "1.14",
    mobileMaxWidth: 640,
    mobilePadding: "18px",
    mobileRadius: "14px",
    mobileHeadingFontSize: "22px",
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The Neo Soft redesign deliberately adopted uppercase eyebrow labels with
// 0.12em tracking as the shared AA/recovery design language. This guard
// replaces the obsolete "only zero letter-spacing" rule: instead of forbidding
// the new language it asserts the new language is actually shipped (an
// uppercase, positively-tracked eyebrow) while still rejecting accidental
// over-spacing of body copy.
function assertNeoSoftEyebrowTracking(styles, relativePath) {
  const spacingValues = [
    ...styles.matchAll(/letter-spacing:\s*([^;]+);/g),
  ].map((match) => match[1].trim());
  assert.ok(
    spacingValues.length > 0,
    `${relativePath} should declare letter-spacing`,
  );

  // Eyebrow/label tracking: the redesign standardised on 0.12em for uppercase
  // eyebrows, with a few tighter inline-label variants (0.04em–0.08em).
  assert.ok(
    spacingValues.includes("0.12em"),
    `${relativePath} should track uppercase eyebrows at 0.12em`,
  );

  // The redesign also adopted uppercase eyebrow labels — they must be present.
  assert.match(
    styles,
    /text-transform:\s*uppercase/,
    `${relativePath} should ship uppercase eyebrow labels`,
  );

  // Tight negative tracking on the hero heading is part of the type system.
  assert.match(
    styles,
    /letter-spacing:\s*-0\.0[12]em/,
    `${relativePath} should tighten its display heading with negative tracking`,
  );

  // Reject runaway positive tracking that would read as letter-spaced banners
  // rather than the intended subtle eyebrow tracking.
  for (const value of spacingValues) {
    const em = value.match(/^(-?\d*\.?\d+)em$/);
    if (em) {
      assert.ok(
        Number(em[1]) <= 0.12,
        `${relativePath} should not over-space text beyond 0.12em (found ${value})`,
      );
    }
  }
}

test("AA and recovery wallet surfaces share professional card and type rules", () => {
  for (const relativePath of WALLET_SURFACE_STYLES) {
    const styles = read(relativePath);

    assert.doesNotMatch(
      styles,
      /font-size:\s*clamp\(/,
      `${relativePath} should avoid viewport-scaled text`,
    );
    assert.doesNotMatch(
      styles,
      /border-radius:\s*2[2-9]px/,
      `${relativePath} should avoid oversized rounded panels`,
    );
    assert.doesNotMatch(
      styles,
      /opacity:\s*0\.[45]/,
      `${relativePath} should keep disabled and muted states readable`,
    );
    assertNeoSoftEyebrowTracking(styles, relativePath);
  }
});

test("AA and recovery wallet heroes stay compact inside embedded miniapp consoles", () => {
  for (const surface of WALLET_HERO_SURFACES) {
    const styles = read(surface.file);
    const hero = escapeForRegExp(surface.hero);
    const heading = escapeForRegExp(surface.heading);

    assert.match(
      styles,
      new RegExp(
        `${hero}\\s*\\{[\\s\\S]*?padding:\\s*${escapeForRegExp(surface.desktopPadding)};`,
      ),
      `${surface.file} hero should use compact desktop panel padding`,
    );
    assert.match(
      styles,
      new RegExp(
        `${hero}\\s*\\{[\\s\\S]*?border-radius:\\s*${escapeForRegExp(surface.desktopRadius)};`,
      ),
      `${surface.file} hero should use a bounded panel radius`,
    );
    assert.match(
      styles,
      new RegExp(
        `${heading}\\s*\\{[\\s\\S]*?font-size:\\s*${escapeForRegExp(surface.headingFontSize)};[\\s\\S]*?line-height:\\s*${escapeForRegExp(surface.headingLineHeight)};`,
      ),
      `${surface.file} hero title should read as an embedded console heading`,
    );
    assert.match(
      styles,
      new RegExp(
        `@media \\(max-width:\\s*${surface.mobileMaxWidth}px\\)[\\s\\S]*?${hero}\\s*\\{[\\s\\S]*?padding:\\s*${escapeForRegExp(surface.mobilePadding)};[\\s\\S]*?border-radius:\\s*${escapeForRegExp(surface.mobileRadius)};`,
      ),
      `${surface.file} mobile hero should shrink the card chrome`,
    );
    assert.match(
      styles,
      new RegExp(
        `@media \\(max-width:\\s*${surface.mobileMaxWidth}px\\)[\\s\\S]*?${heading}\\s*\\{[\\s\\S]*?font-size:\\s*${escapeForRegExp(surface.mobileHeadingFontSize)};`,
      ),
      `${surface.file} mobile hero title should not dominate the first viewport`,
    );
  }
});
