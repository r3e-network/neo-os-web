import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("AA Market Hub exposes wallet-style market overview and guarded listing load", () => {
  const playArea = read("apps/aa-market-hub/src/PlayArea.tsx");
  const walletCard = read(
    "apps/aa-market-hub/src/components/WalletConnectCard.tsx",
  );
  const createCard = read(
    "apps/aa-market-hub/src/components/CreateListingCard.tsx",
  );
  const listingCard = read("apps/aa-market-hub/src/components/ListingCard.tsx");
  const styles = read("apps/aa-market-hub/src/PlayArea.scss");
  const messages = read("apps/aa-market-hub/src/locale/messages.ts");

  assert.match(playArea, /className="market-hero"/);
  assert.match(playArea, /className="market-hero__metrics"/);
  assert.match(playArea, /className="market-workspace"/);
  // The side rail now collapses to a single column when no listing is
  // selected, so its className is a template literal
  // (`market-side-rail${selected ? "" : " market-side-rail--single"}`)
  // rather than a static string. Tolerate both static className="market-side-rail"
  // and template-literal className={`market-side-rail...`} forms while still
  // requiring the rail to exist.
  assert.match(playArea, /className=(?:"market-side-rail"|\{`market-side-rail)/);
  assert.match(playArea, /className="market-section-heading"/);
  assert.match(walletCard, /canLoadListings/);
  assert.match(walletCard, /disabled=\{!canLoad\b/);
  assert.match(createCard, /isMarketReady/);
  assert.match(createCard, /const canSubmit =/);
  assert.match(createCard, /disabled=\{!canSubmit/);
  assert.match(listingCard, /className="listing-card__price"/);
  assert.match(styles, /\.market-play-area button:disabled/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  // Neo Soft eyebrow language: uppercase kicker + 0.12em tracking is the
  // intentional redesign vocabulary, replacing the old flat-case labels.
  assert.match(playArea, /className="market-hero__eyebrow"/);
  assert.match(
    styles,
    /\.market-hero__eyebrow\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  assert.match(
    styles,
    /\.market-hero__eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s,
  );
  // Neo Soft hero heading uses the light ink token, not the old dark wash.
  assert.match(
    styles,
    /\.market-hero__title h2\s*\{[^}]*color:\s*var\(--ns-ink, #1e1e2e\)/s,
  );
  assert.match(styles, /\.hint-text\s*\{[^}]*padding:\s*12px 14px/s);
  assert.match(styles, /\.hint-text\s*\{[^}]*border:\s*1px solid/s);
  assert.match(
    styles,
    /\.hint-text\s*\{[^}]*background:\s*var\(--ns-surface-subtle, #f7f8fa\)/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.market-section-heading\s*\{[^}]*flex-direction:\s*column/s,
  );
  // Neo Soft design-system constraints that must keep holding.
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);
  for (const literalRadius of styles.matchAll(/border-radius:\s*(\d+)px/g)) {
    assert.ok(
      Number(literalRadius[1]) <= 20,
      `unexpected oversized literal border-radius: ${literalRadius[0]}`,
    );
  }
  assert.match(messages, /marketHeroTitle/);
  assert.match(messages, /marketMetricActive/);
  assert.match(messages, /marketStepSettlement/);
});
