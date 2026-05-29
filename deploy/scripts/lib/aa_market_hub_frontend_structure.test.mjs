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
  assert.match(playArea, /className="market-steps"/);
  assert.match(walletCard, /canLoadListings/);
  assert.match(walletCard, /disabled=\{!canLoadListings/);
  assert.match(createCard, /isMarketReady/);
  assert.match(createCard, /const canSubmit =/);
  assert.match(createCard, /disabled=\{!canSubmit/);
  assert.match(listingCard, /className="listing-card__price"/);
  assert.match(styles, /\.market-play-area button:disabled/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.match(styles, /\.hint-text\s*\{[^}]*padding:\s*11px 13px/s);
  assert.match(styles, /\.hint-text\s*\{[^}]*border:\s*1px solid/s);
  assert.match(styles, /\.hint-text\s*\{[^}]*background:\s*#f8fafc/s);
  assert.match(
    styles,
    /@media \(max-width: 720px\)[\s\S]*\.market-section-heading\s*\{[^}]*flex-direction:\s*column/s,
  );
  assert.match(messages, /marketHeroTitle/);
  assert.match(messages, /marketMetricActive/);
  assert.match(messages, /marketStepSettlement/);
});
